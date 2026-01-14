import { DEFAULT_CHARACTERS, tryLocalMatch } from '../data/characters';
import { settingsStore } from '../store/settings';
import { requestStore } from '../store/requests';
import { showToast } from '../store/toasts';
import type { Request } from '../types';

const RETRIABLE_CODES = [429, 500, 502, 503, 504];
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

let currentModelIndex = 0;

const getApiKey = () => settingsStore.get().apiKey || '';
const getGeminiModels = () => settingsStore.get().models || ['gemini-2.5-flash'];

export async function callLLM(
  message: string,
  attempt = 0,
  modelIdx = currentModelIndex,
  startIdx = currentModelIndex
): Promise<{ character: string; type: string }> {
  const apiKey = getApiKey();
  const models = getGeminiModels();
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
          return callLLM(message, 0, nextIdx, startIdx);
        }
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
          return callLLM(message, attempt + 1, modelIdx, startIdx);
        }
      }
      showToast(msg, 'Erro LLM', 'red');
      return { character: 'Erro na API', type: 'unknown' };
    }

    currentModelIndex = modelIdx;
    const data = await res.json();
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
  } catch (e: any) {
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      return callLLM(message, attempt + 1, modelIdx, startIdx);
    }
    showToast(e.message || 'Erro', 'Erro LLM', 'red');
    return { character: 'Erro', type: 'unknown' };
  }
}

export async function identifyCharacter(request: Request) {
  const local = tryLocalMatch(request.message);
  if (local) {
    requestStore.update(request.id, local);
    return;
  }
  if (!getApiKey()) {
    requestStore.update(request.id, { character: '', type: 'unknown' });
    return;
  }
  const result = await callLLM(request.message);
  const type = result.type === 'none' ? 'unknown' : (result.type || 'unknown');
  requestStore.update(request.id, {
    character: result.character || '',
    type: type as 'survivor' | 'killer' | 'unknown'
  });
}

export async function testExtraction(input: string, addToQueue: boolean) {
  if (!input) return { character: '', type: 'unknown', isLocal: false };
  const localResult = tryLocalMatch(input);
  const isLocal = !!localResult;
  let result: { character: string; type: 'killer' | 'survivor' | 'unknown' };
  if (localResult) {
    result = localResult;
  } else {
    const llm = await callLLM(input);
    result = { character: llm.character || '', type: llm.type === 'none' ? 'unknown' : (llm.type as 'killer' | 'survivor' | 'unknown') || 'unknown' };
  }
  if (addToQueue && result.type !== 'unknown') {
    requestStore.add({
      id: Date.now(),
      timestamp: new Date(),
      donor: 'Teste',
      amount: 'R$ 0,00',
      amountVal: 0,
      message: input,
      character: result.character,
      type: result.type,
      belowThreshold: false,
      source: 'manual'
    });
  }
  return { character: result.character, type: result.type, isLocal };
}

export async function reidentifyAll() {
  const requests = requestStore.get();
  for (const d of requests) {
    requestStore.update(d.id, { character: 'Identificando...', type: 'unknown' });
  }
  for (const d of requestStore.get()) {
    await identifyCharacter(d);
  }
}
