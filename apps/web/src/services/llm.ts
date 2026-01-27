import { tryLocalMatch } from '../data/characters';
import { useAuth } from '../store/auth';
import type { Request } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

declare const __APP_VERSION__: string;

async function callAPI(
  message: string,
  onError?: (msg: string) => void
): Promise<{ character: string; type: string }> {
  const token = await useAuth.getState().getAccessToken();
  if (!token) {
    return { character: '', type: 'none' };
  }

  try {
    const res = await fetch(`${API_URL}/api/extract-character`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Client-Version': __APP_VERSION__,
      },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err as any).message || (err as any).error || `HTTP ${res.status}`;
      onError?.(msg);
      return { character: 'Erro na API', type: 'unknown' };
    }

    return await res.json();
  } catch (e: any) {
    onError?.(e.message || 'Erro de rede');
    return { character: 'Erro', type: 'unknown' };
  }
}

export async function identifyCharacter(
  request: Request,
  onError?: (msg: string) => void,
  onLLMUpdate?: (result: { character: string; type: 'survivor' | 'killer' | 'unknown'; validating: false }) => void
): Promise<{ character: string; type: 'survivor' | 'killer' | 'unknown'; validating?: boolean }> {
  const local = tryLocalMatch(request.message);
  const isAuthenticated = useAuth.getState().isAuthenticated;

  if (local) {
    if (local.ambiguous && isAuthenticated && onLLMUpdate) {
      callAPI(request.message, onError).then(llmResult => {
        if (llmResult.type !== 'none' && llmResult.character) {
          onLLMUpdate({
            character: llmResult.character,
            type: llmResult.type as 'survivor' | 'killer' | 'unknown',
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

  if (!isAuthenticated) return { character: '', type: 'unknown' };

  const result = await callAPI(request.message, onError);
  const type = result.type === 'none' ? 'unknown' : (result.type || 'unknown');
  return {
    character: result.character || '',
    type: type as 'survivor' | 'killer' | 'unknown'
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
      callAPI(input, onError).then(llmResult => {
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

  const llm = await callAPI(input, onError);
  return {
    character: llm.character || '',
    type: llm.type === 'none' ? 'unknown' : (llm.type as 'killer' | 'survivor' | 'unknown') || 'unknown',
    isLocal: false
  };
}
