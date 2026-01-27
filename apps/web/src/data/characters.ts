export {
  CHARACTERS,
  DEFAULT_CHARACTERS,
  getKillerPortrait,
} from '@dbd-utils/shared';

const GENERIC_SURVIVOR_PATTERNS = [
  /\b(?:jog[aue]|uma?)\s+(?:de\s+)?surv(?:ivor)?(?:zinho|zinha)?\b/i,
  /\b(?:de\s+)?surv(?:ivor)?(?:zinho|zinha)?\b/i,
  /\bsobrevivente\b/i,
];

import { CHARACTERS } from '@dbd-utils/shared';

export function tryLocalMatch(message: string): { character: string; type: 'killer' | 'survivor'; ambiguous?: boolean } | null {
  const lower = message.toLowerCase();
  const matches: { character: string; type: 'killer' | 'survivor'; position: number }[] = [];

  for (const type of ['killers', 'survivors'] as const) {
    for (const char of CHARACTERS[type]) {
      for (const name of [char.name, ...char.aliases]) {
        const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        let match;
        while ((match = regex.exec(lower)) !== null) {
          matches.push({
            character: char.name,
            type: type === 'killers' ? 'killer' : 'survivor',
            position: match.index
          });
        }
      }
    }
  }

  if (matches.length === 0) {
    // No specific character found - check for generic survivor request
    for (const pattern of GENERIC_SURVIVOR_PATTERNS) {
      if (pattern.test(lower)) {
        return { character: 'Survivor', type: 'survivor' };
      }
    }
    return null;
  }

  // Get unique characters matched
  const uniqueChars = new Set(matches.map(m => m.character));
  const lastMatch = matches.reduce((a, b) => b.position > a.position ? b : a);

  return {
    character: lastMatch.character,
    type: lastMatch.type,
    ambiguous: uniqueChars.size > 1
  };
}
