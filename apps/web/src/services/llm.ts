import { tryLocalMatch } from '../data/characters';
import { useAuth } from '../store/auth';
import type { Request, RequestExtra, RequestExtraType } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

declare const __APP_VERSION__: string;

type ExtractedCharacter = {
  character: string;
  type: string;
  matchedTerm?: string;
  build?: { text: string; matchedTerms?: string[] };
};

async function callAPI(
  message: string,
  maxCount: number,
  extras: RequestExtraType[],
  onError?: (msg: string) => void
): Promise<ExtractedCharacter[]> {
  const token = await useAuth.getState().getAccessToken();
  if (!token) return [];

  try {
    const res = await fetch(`${API_URL}/api/extract-character`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Client-Version': __APP_VERSION__,
      },
      body: JSON.stringify({ message, maxCount, extras }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errorCode = (err as { error?: string }).error;
      if (errorCode === 'daily_limit_exceeded') {
        onError?.('Limite diário de identificações atingido');
        return [];
      }
      const msg = (err as { message?: string }).message || errorCode || `HTTP ${res.status}`;
      onError?.(msg);
      return [{ character: 'Erro na API', type: 'unknown' }];
    }

    const body = await res.json() as {
      characters?: ExtractedCharacter[];
      character?: string;
      type?: string;
      matchedTerm?: string;
    };
    if (Array.isArray(body.characters)) return body.characters;
    if (body.character || body.type) {
      return [{ character: body.character ?? '', type: body.type ?? 'none', matchedTerm: body.matchedTerm }];
    }
    return [];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro de rede';
    onError?.(msg);
    return [{ character: 'Erro', type: 'unknown' }];
  }
}

function pickExtras(c: { build?: { text: string; matchedTerms?: string[] } }): RequestExtra[] | undefined {
  if (!c.build?.text) return undefined;
  return [{ type: 'build', text: c.build.text, matchedTerms: c.build.matchedTerms }];
}

export async function identifyCharacter(
  request: Request,
  extras: RequestExtraType[] = [],
  onError?: (msg: string) => void,
  onLLMUpdate?: (result: { character: string; type: 'survivor' | 'killer' | 'unknown' | 'none'; matchedTerm?: string; extras?: RequestExtra[]; validating: false }) => void
): Promise<{ character: string; type: 'survivor' | 'killer' | 'unknown' | 'none'; matchedTerm?: string; extras?: RequestExtra[]; validating?: boolean }> {
  const local = tryLocalMatch(request.message);
  const isAuthenticated = useAuth.getState().isAuthenticated;

  // Local match alone never carries extras. If the caller asked for extras AND the
  // donation is eligible, we must hit the LLM even when the character matched locally.
  const needsLLMForExtras = !!local && extras.length > 0 && isAuthenticated && !!onLLMUpdate;

  if (local && !needsLLMForExtras) {
    if (local.ambiguous && isAuthenticated && onLLMUpdate) {
      callAPI(request.message, 1, [], onError).then(arr => {
        const llmResult = arr[0] ?? { character: '', type: 'none' };
        if (llmResult.type !== 'none' && llmResult.character) {
          onLLMUpdate({
            character: llmResult.character,
            type: llmResult.type as 'survivor' | 'killer' | 'unknown',
            matchedTerm: llmResult.matchedTerm,
            validating: false
          });
        } else {
          onLLMUpdate({ ...local, validating: false });
        }
      });
      return { ...local, validating: true };
    }
    return local;
  }

  // Local match + extras requested: show the local character immediately, then let
  // the LLM result replace it wholesale when the call resolves. The LLM is the
  // source of truth for both character identification and build extraction once
  // it answers; the local match is only a placeholder during the request.
  if (local && needsLLMForExtras) {
    callAPI(request.message, 1, extras, onError).then(arr => {
      const llmResult = arr[0] ?? { character: '', type: 'none' };
      onLLMUpdate?.({
        character: llmResult.character || '',
        type: (llmResult.type || 'unknown') as 'survivor' | 'killer' | 'unknown' | 'none',
        matchedTerm: llmResult.matchedTerm,
        extras: pickExtras(llmResult),
        validating: false,
      });
    });
    return { ...local, validating: true };
  }

  if (!isAuthenticated) return { character: '', type: 'unknown' };

  const arr = await callAPI(request.message, 1, extras, onError);
  const result = arr[0] ?? { character: '', type: 'none' };
  const type = result.type || 'unknown';
  return {
    character: result.character || '',
    type: type as 'survivor' | 'killer' | 'unknown' | 'none',
    matchedTerm: result.matchedTerm,
    extras: pickExtras(result),
  };
}

export async function testExtraction(
  input: string,
  onError?: (msg: string) => void,
  onLLMUpdate?: (result: { character: string; type: 'killer' | 'survivor' | 'unknown' }) => void
): Promise<{ character: string; type: 'killer' | 'survivor' | 'unknown'; isLocal: boolean; ambiguous?: boolean }> {
  if (!input) return { character: '', type: 'unknown', isLocal: false };

  const localResult = tryLocalMatch(input);
  const isAuthenticated = useAuth.getState().isAuthenticated;

  if (localResult) {
    if (localResult.ambiguous && isAuthenticated && onLLMUpdate) {
      callAPI(input, 1, [], onError).then(arr => {
        const llmResult = arr[0] ?? { character: '', type: 'none' };
        if (llmResult.type !== 'none' && llmResult.character) {
          onLLMUpdate({
            character: llmResult.character,
            type: llmResult.type as 'killer' | 'survivor' | 'unknown'
          });
        }
      });
    }
    return { ...localResult, isLocal: true };
  }

  if (!isAuthenticated) {
    return { character: '', type: 'unknown', isLocal: false };
  }

  const arr = await callAPI(input, 1, [], onError);
  const llm = arr[0] ?? { character: '', type: 'none' };
  return {
    character: llm.character || '',
    type: (llm.type as 'killer' | 'survivor' | 'unknown') || 'unknown',
    isLocal: false
  };
}

export async function identifyMultiple(
  message: string,
  maxCount: number,
  extras: RequestExtraType[] = [],
  onError?: (msg: string) => void
): Promise<Array<{
  character: string;
  type: 'survivor' | 'killer' | 'unknown' | 'none';
  matchedTerm?: string;
  extras?: RequestExtra[];
}>> {
  const isAuthenticated = useAuth.getState().isAuthenticated;
  if (!isAuthenticated) return [];
  const arr = await callAPI(message, maxCount, extras, onError);
  return arr.map(c => {
    const extrasOut: RequestExtra[] = [];
    if (c.build?.text) {
      extrasOut.push({ type: 'build', text: c.build.text, matchedTerms: c.build.matchedTerms });
    }
    return {
      character: c.character ?? '',
      type: (c.type ?? 'unknown') as 'survivor' | 'killer' | 'unknown' | 'none',
      matchedTerm: c.matchedTerm,
      extras: extrasOut.length > 0 ? extrasOut : undefined,
    };
  });
}
