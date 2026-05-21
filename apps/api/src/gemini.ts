import { DEFAULT_CHARACTERS } from '@dbd-utils/shared';
import type { RequestExtraType } from '@dbd-utils/shared';

const MODELS = ['gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const RETRIABLE_CODES = [429, 500, 502, 503, 504];
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

let currentModelIndex = 0;

export type ExtractionResult = {
  character: string;
  type: 'survivor' | 'killer' | 'none';
  matchedTerm?: string;
  build?: { text: string; matchedTerms?: string[] };
};

export async function extractCharacters(
  message: string,
  apiKey: string,
  maxCount: number,
  extras: RequestExtraType[] = [],
  attempt = 0,
  modelIdx = currentModelIndex,
  startIdx = currentModelIndex
): Promise<ExtractionResult[]> {
  const model = MODELS[modelIdx];

  console.log(`[extract] Starting extraction using model: ${model} (attempt ${attempt + 1}/${MAX_RETRIES + 1}, maxCount=${maxCount}, extras=${extras.join(',') || 'none'})`);

  const withBuild = extras.includes('build');

  const buildBlock = withBuild ? `

For each character entry, also try to identify a "build" the donor wants for that character. A build is a description of the loadout the streamer should equip — it may include perk names (DBD has hundreds, in English or Portuguese with creative spellings and slang), addon names, item or item-addon names (survivor loadouts), a theme like "build de aura" / "build irritante" / "build de endgame", or an explicit "no perks" / "sem perks" instruction.

Builds apply equally to killer and survivor character entries.

If the message contains build text, attach it to the appropriate character(s):
- "Pig e Hag de build de aura" → same build text on both rows.
- "Pig de aura e Hag de gritos" → different build text per row.
- "3 trickster de build X" → same build on all three quantified rows.
- If a build is mentioned but it's unclear which character it belongs to, attach it to the first character entry.

Return build as { text, matchedTerms[] }:
- text: brief human-readable summary, in the donor's language (verbatim is fine; clean up obvious typos but keep the donor's wording/slang).
- matchedTerms: array of exact substrings of <user_message> that describe the build. Perks and addons may be separated by other words — include each contiguous span as a separate entry.

Omit the build field when no build text is present.
` : '';

  const prompt = `Identify Dead by Daylight characters requested in the user message. The user may request multiple characters. This is the list of valid characters, although the user might not specify them exactly as on this list.

<survivors>
${DEFAULT_CHARACTERS.survivors.join('\n')}
</survivors>

<killers>
${DEFAULT_CHARACTERS.killers.join('\n')}
</killers>

<user_message>
${message}
</user_message>

<max_count>${maxCount}</max_count>

Return ONLY JSON with a "characters" array. Each entry has character name, type, and the exact matched substring.
- Return characters in the order they appear in the message.
- The character name MUST be the official name (the first name in the slash-separated list above). e.g. "Myers" → "Shape".
- Extract ONLY the characters the user is COMMANDING the streamer to play (the user's request/order). A numeric quantifier attached to a name multiplies that specific name: "2 de trapper" → ["Trapper","Trapper"]; "3 trickster" → ["Trickster","Trickster","Trickster"]. The count never splits across other character names.
- Character names mentioned only as CONTEXT (the streamer's current/past killer, comparisons, complaints, memories, e.g. "tapete da X", "chega de X", "depois da X") are not part of the user's command — exclude them. Example: "joga 3 trickster pra despedir da krasue" → ["Trickster","Trickster","Trickster"] (krasue = what's currently being played, not requested).
- No command present (small talk, greetings, personal stories, off-topic donations) → empty array.
- Cap the total returned at max_count. If the user requests more, return the first max_count in message order. If the user requests fewer, return only what they asked for — do NOT pad to max_count.
- If the user requests a generic survivor ("joga de surv", "uma de survivor"), return one entry with character "Survivor" and type "survivor".
- Recognize creative spellings, slang, and affectionate variations (e.g. "Drakuluxuuu" = Dracula, "demogogo" = Demogorgon, "pigzinha" = Pig).
- If a character is referenced but the exact identity is unknown, use empty string for character with the best-guess type.
- In "matchedTerm", return the EXACT substring referring to that specific instance, preserving the original casing and spelling. If the same character is requested twice with the same wording, both entries may share the same matchedTerm.${buildBlock}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1000,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              characters: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    character: { type: 'string' },
                    type: { type: 'string', enum: ['survivor', 'killer', 'none'] },
                    matchedTerm: { type: 'string' },
                    ...(withBuild ? {
                      build: {
                        type: 'object',
                        properties: {
                          text: { type: 'string' },
                          matchedTerms: { type: 'array', items: { type: 'string' } },
                        },
                        required: ['text'],
                      },
                    } : {}),
                  },
                  required: ['character', 'type'],
                },
              },
            },
            required: ['characters'],
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as any).error?.message || `HTTP ${res.status}`;

    console.warn(`[extract] Request failed with status ${res.status}: ${msg}`);

    if (RETRIABLE_CODES.includes(res.status)) {
      const nextIdx = (modelIdx + 1) % MODELS.length;
      if (nextIdx !== startIdx) {
        console.log(`[extract] Switching from ${model} to ${MODELS[nextIdx]}`);
        currentModelIndex = nextIdx;
        return extractCharacters(message, apiKey, maxCount, extras, 0, nextIdx, startIdx);
      }
      if (attempt < MAX_RETRIES) {
        console.log(`[extract] Retrying in ${RETRY_DELAYS[attempt]}ms (attempt ${attempt + 2}/${MAX_RETRIES + 1})`);
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        return extractCharacters(message, apiKey, maxCount, extras, attempt + 1, modelIdx, startIdx);
      }
      console.error(`[extract] All retries exhausted after ${MAX_RETRIES + 1} attempts`);
    }

    console.error(`[extract] Non-retriable error, throwing: ${msg}`);
    throw new Error(msg);
  }

  currentModelIndex = modelIdx;
  const data = await res.json() as any;
  console.log(`[extract] Response from ${model}:`, JSON.stringify(data).slice(0, 500));
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const blockReason = data.promptFeedback?.blockReason
      || data.candidates?.[0]?.finishReason;
    console.warn(`[extract] Empty response from ${model}: ${blockReason || 'no candidates'}`);

    const nextIdx = (modelIdx + 1) % MODELS.length;
    if (nextIdx !== startIdx) {
      console.log(`[extract] Switching from ${model} to ${MODELS[nextIdx]}`);
      currentModelIndex = nextIdx;
      return extractCharacters(message, apiKey, maxCount, extras, 0, nextIdx, startIdx);
    }
    if (attempt < MAX_RETRIES) {
      console.log(`[extract] Retrying in ${RETRY_DELAYS[attempt]}ms (attempt ${attempt + 2}/${MAX_RETRIES + 1})`);
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      return extractCharacters(message, apiKey, maxCount, extras, attempt + 1, modelIdx, startIdx);
    }

    console.error(`[extract] All retries exhausted, returning empty`);
    return [];
  }

  const parsed = JSON.parse(text) as { characters?: ExtractionResult[] };
  const characters = Array.isArray(parsed.characters) ? parsed.characters.slice(0, maxCount) : [];
  console.log(`[extract] Success: ${characters.length} character(s): ${characters.map(c => c.character).join(', ')}`);
  return characters;
}
