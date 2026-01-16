import { DEFAULT_CHARACTERS, tryLocalMatch } from '../data/characters';
import type { Request } from '../types';

const RETRIABLE_CODES = [429, 500, 502, 503, 504];
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

let currentModelIndex = 0;

export interface LLMConfig {
  apiKey: string;
  models: string[];
}

export async function callLLM(
  message: string,
  config: LLMConfig,
  onError?: (msg: string) => void,
  attempt = 0,
  modelIdx = currentModelIndex,
  startIdx = currentModelIndex
): Promise<{ character: string; type: string }> {
  const { apiKey, models } = config;
  const model = models[modelIdx];
  if (!apiKey) return { character: 'Sem API key', type: 'unknown' };

  const prompt = `Identify the Dead by Daylight character from the user message. This is the list of valid characters, although the user might not specify them exactly as on this list.

<survivors>
${DEFAULT_CHARACTERS.survivors.join('\n')}
</survivors>

<killers>
${DEFAULT_CHARACTERS.killers.join('\n')}
</killers>

<user_message>
${message}
</user_message>

Identify the Dead by Daylight character from the above user message. Return ONLY JSON with character name and type. If exact character unknown, return empty character. If no character mentioned, return type "none".`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1000,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              character: { type: 'string' },
              type: { type: 'string', enum: ['survivor', 'killer', 'none'] }
            },
            required: ['character', 'type']
          }
        }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message || `HTTP ${res.status}`;
      if (RETRIABLE_CODES.includes(res.status)) {
        const nextIdx = (modelIdx + 1) % models.length;
        if (nextIdx !== startIdx) {
          currentModelIndex = nextIdx;
          return callLLM(message, config, onError, 0, nextIdx, startIdx);
        }
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
          return callLLM(message, config, onError, attempt + 1, modelIdx, startIdx);
        }
      }
      onError?.(msg);
      return { character: 'Erro na API', type: 'unknown' };
    }

    currentModelIndex = modelIdx;
    const data = await res.json();
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
  } catch (e: any) {
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      return callLLM(message, config, onError, attempt + 1, modelIdx, startIdx);
    }
    onError?.(e.message || 'Erro');
    return { character: 'Erro', type: 'unknown' };
  }
}

export async function identifyCharacter(
  request: Request,
  config: LLMConfig,
  onError?: (msg: string) => void,
  onLLMUpdate?: (result: { character: string; type: 'survivor' | 'killer' | 'unknown' }) => void
): Promise<{ character: string; type: 'survivor' | 'killer' | 'unknown' }> {
  const local = tryLocalMatch(request.message);

  if (local) {
    if (config.apiKey && onLLMUpdate) {
      callLLM(request.message, config, onError).then(llmResult => {
        if (llmResult.type !== 'none' && llmResult.character && llmResult.character !== local.character) {
          onLLMUpdate({
            character: llmResult.character,
            type: llmResult.type as 'survivor' | 'killer' | 'unknown'
          });
        }
      });
    }
    return local;
  }

  if (!config.apiKey) return { character: '', type: 'unknown' };

  const result = await callLLM(request.message, config, onError);
  const type = result.type === 'none' ? 'unknown' : (result.type || 'unknown');
  return {
    character: result.character || '',
    type: type as 'survivor' | 'killer' | 'unknown'
  };
}

export async function testExtraction(
  input: string,
  config: LLMConfig,
  onError?: (msg: string) => void,
  onLLMUpdate?: (result: { character: string; type: 'killer' | 'survivor' | 'unknown' }) => void
): Promise<{ character: string; type: 'killer' | 'survivor' | 'unknown'; isLocal: boolean }> {
  if (!input) return { character: '', type: 'unknown', isLocal: false };

  const localResult = tryLocalMatch(input);
  if (localResult) {
    if (config.apiKey && onLLMUpdate) {
      callLLM(input, config, onError).then(llmResult => {
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

  const llm = await callLLM(input, config, onError);
  return {
    character: llm.character || '',
    type: llm.type === 'none' ? 'unknown' : (llm.type as 'killer' | 'survivor' | 'unknown') || 'unknown',
    isLocal: false
  };
}
