// Live LLM evals for the Gemini character extractor.
//
// These tests hit the real Gemini API and verify that the prompt + model
// combination correctly identifies characters in real-world donation messages.
//
// Skipped by default. To run:
//
//   RUN_EVALS=1 GEMINI_API_KEY=... bun run --filter @dbd-utils/api test -- gemini.eval
//   # or, with the env var already set in apps/api/.env:
//   RUN_EVALS=1 bun run --filter @dbd-utils/api test -- gemini.eval
//
// Scenarios were sampled and lightly anonymized from real production donation
// messages on the @mandymess channel. Streamer-specific terms have been replaced
// with the generic placeholder "{{streamer}}"; bystander names have been replaced
// with fictitious initials. The semantic structure that the LLM must reason about
// (nicknames, quantifiers, long context, embedded requests) is preserved verbatim.
//
// Pass criterion: multiset equality — the array of returned character names must
// match `expected` regardless of order. This tolerates LLM variation in which
// character is listed first while still catching missed or fabricated entries.

import { describe, it, expect } from 'vitest';
import { extractCharacters } from './gemini';

// `process` isn't in the worker tsconfig lib but is available at runtime
// because vitest runs this file in a Node environment.
declare const process: { env: Record<string, string | undefined> };

const RUN_EVALS = !!process.env.RUN_EVALS;

interface EvalCase {
  name: string;
  message: string;
  maxCount: number;
  expected: string[]; // character names; empty = LLM should return no characters
}

// ──────────────────────────────────────────────────────────────────────────────
// Single-character scenarios
// ──────────────────────────────────────────────────────────────────────────────
const singleCases: EvalCase[] = [
  {
    name: 'single / nickname: Drácula → Dark Lord',
    message: 'Boa noite lindeza, tudo bem? Joga de Drácula, se puder, menor que três',
    maxCount: 1,
    expected: ['Dark Lord'],
  },
  {
    name: 'single / nickname: draga → Dredge',
    message: 'amiga, será q rola uma draga mais tarde?',
    maxCount: 1,
    expected: ['Dredge'],
  },
  {
    name: 'single / nickname: pirâmide → Pyramid Head',
    message: 'Oi {{streamer}}, tudo bom? Passando pra dar boa noite, pedi um pirâmide, tá bom? Beijo, boa live.',
    maxCount: 1,
    expected: ['Pyramid Head'],
  },
  {
    name: 'single / nickname: Sadako do Olhão → Onryō',
    message: '{{streamer}}, joga uma de Sadako do Olhão pra gente.',
    maxCount: 1,
    expected: ['Onryō'],
  },
  {
    name: 'single / nickname: kanekizinho → Ghoul',
    message: '{{streamer}} {{streamer}}nha poderia dar uma jogadinha do kanekizinho com buildzinha de velocidadezinha',
    maxCount: 1,
    expected: ['Ghoul'],
  },
  {
    name: 'single / nickname: huntrex → Huntress',
    message: 'Vamos barbarizar uma de huntrex',
    maxCount: 1,
    expected: ['Huntress'],
  },
  {
    name: 'single / nickname: Espectro → Wraith',
    message: 'Boa noite {{streamer}}, joga de Espectro com a nova skin do passe quando vc liberar ela <3 te amo',
    maxCount: 1,
    expected: ['Wraith'],
  },
  {
    name: 'single / nickname: wesker → Mastermind',
    message: 'Boa noite, ta bem? Ta aceitando pedido? Se tiver joga de wesker por favor. E eu nao dei sub pq esta bufado, nao está indo nem pelo site.',
    maxCount: 1,
    expected: ['Mastermind'],
  },
  {
    name: 'single / nickname: Myers → Shape (only Myers mentioned)',
    message: 'Boa noite! Vai uma Myers por favor. Um beijo!',
    maxCount: 1,
    expected: ['Shape'],
  },
  {
    name: 'single / nickname: trick trick trans → Trickster',
    message: '{{streamer}}, o que você tem a falar sobre a situação atual da R.? Vocês jogavam juntas e acho que eram amigas.. você está ajudando ela ou sabe se tem algum apoio? Joga de Trick trick trans',
    maxCount: 1,
    expected: ['Trickster'],
  },
  {
    name: 'single / nickname: Vecna novo → The First (Stranger Things crossover)',
    message: 'Oi {{streamer}}, passando pra dizer que adoro você, joga de Vecna novo',
    maxCount: 1,
    expected: ['The First'],
  },
  {
    name: 'single / nickname: Vecna do D&D → Lich (original D&D Vecna)',
    message: 'Vai uma de Vecna do D e D por favor',
    maxCount: 1,
    expected: ['Lich'],
  },
  {
    name: 'single / nickname: Adriana → Skull Merchant',
    message: 'Te amo irma, um beijo de Londres <3 Joga de Adriana! Minha rainha destruida.',
    maxCount: 1,
    expected: ['Skull Merchant'],
  },
  {
    name: 'single / nickname: Alien → Xenomorph',
    message: 'Bora de Alien, com a mais babadeira do DBD.',
    maxCount: 1,
    expected: ['Xenomorph'],
  },
  {
    name: 'single / long context, request at end: Oni',
    message: 'Bate bola jogo rápido! Um tom pantone? Uma marca de roupa? Um champion do Lol AD? Um surv? E um killer? ERRADO!!! JOGA DE Oni',
    maxCount: 1,
    expected: ['Oni'],
  },
  {
    name: 'single / embedded request among noise: Hag',
    message: 'Oi {{streamer}}, joga uma de hag com a skin de madame frost com uma Build de frankilin para acabar com esses achismo na área dos geladinhos. Pense gelado, pense hag!',
    maxCount: 1,
    expected: ['Hag'],
  },
  {
    name: 'single / request despite another character name in noise: Trickster (krasue is current killer reference, not request)',
    message: 'joga 1 trickster então pra despedir do muso tapete da krasue.',
    maxCount: 1,
    expected: ['Trickster'],
  },
  {
    name: 'single / Krasue nickname: kraseu → Krasue',
    message: 'puxa uma kraseu pa tropa, lindão. lethal, dissolution, bambas e bbq. cabeça de galinha e olho de porco de addon pro churras. amo vc tmj',
    maxCount: 1,
    expected: ['Krasue'],
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Scenarios that should produce zero characters (no actual play request)
// ──────────────────────────────────────────────────────────────────────────────
const noneCases: EvalCase[] = [
  {
    name: 'none / personal venting, no request',
    message: '{{streamer}}, boa noite. desabafo leve. to ansioso hoje porque amanhã começa uma jornada nova na minha vida. vou pra sp fazer minha especialização e trabalhar pesado ao mesmo tempo. sei que vou dar conta mas ao mesmo tempo dá uma ansiedade maluca e um medo',
    maxCount: 1,
    expected: [],
  },
  {
    name: 'none / movie request, not DBD',
    message: 'Boa noite, posso te fazer uma proposta? Queria muito te ver assistindo O Diabo Veste Prada, tô muito ansioso pro 2',
    maxCount: 2,
    expected: [],
  },
  {
    name: 'none / birthday greeting',
    message: 'Quem é o aniversariante mais lindo, mais maravilhoso e cheio de carisma do dia? Te amo meu amor, espero que vc tenha um novo ciclo cheio de amor, sucesso e muitas conquistas.',
    maxCount: 1,
    expected: [],
  },
  {
    name: 'none / shoutout, no character',
    message: 'BORA BARBARIZAR',
    maxCount: 1,
    expected: [],
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Multi-character scenarios (the new feature)
// ──────────────────────────────────────────────────────────────────────────────
const multiCases: EvalCase[] = [
  {
    name: 'multi / "uma de X e uma de Y" (real prod msg)',
    message: 'Oi {{streamer}}, joga uma de pig e uma de hag. Obrigado',
    maxCount: 2,
    expected: ['Pig', 'Hag'],
  },
  {
    name: 'multi / quantifier "duas de" → 2 of same character',
    message: 'Oiii {{streamer}}! Cê tá maravilhosa, como sempre. Hoje assisti uma gameplay de Detroit e achei tudo. Joga duas de Chucky, por favor!',
    maxCount: 2,
    expected: ['Good Guy', 'Good Guy'],
  },
  {
    name: 'multi / quantifier "3" → 3 of same character',
    message: 'joga 3 trickster então pra fechar a noite, beijos',
    maxCount: 3,
    expected: ['Trickster', 'Trickster', 'Trickster'],
  },
  {
    name: 'multi / two distinct nicknames: Adriana + Alien',
    message: 'Boa noite {{streamer}}, tá pedindo uma Adriana e um Alien de musas.',
    maxCount: 2,
    expected: ['Skull Merchant', 'Xenomorph'],
  },
  {
    name: 'multi / two distinct nicknames in long message: Ghost Face + Singularity',
    message: 'Boa noite minha ancestral, minha tuntancamon, minha mao ze dong, minha Hamurabi, joga uma de Ghost face e uma de singularidade, beijos',
    maxCount: 2,
    expected: ['Ghost Face', 'Singularity'],
  },
  {
    name: 'multi / "vecna novo" + "dracula" (both nicknames map to different chars)',
    message: 'pois joga uma de vecna novo e uma de dracula',
    maxCount: 2,
    expected: ['The First', 'Dark Lord'],
  },
  {
    name: 'multi / "vecna antigo" + singularidade',
    message: 'Agora joga com killers que nos vestem: maceta uma singularidade e um vecna antigo, beijos',
    maxCount: 2,
    expected: ['Singularity', 'Lich'],
  },
  {
    name: 'multi / Vecna + Myers (real prod msg, paid 10 with min 5)',
    message: 'Boa noite mamis! Vai uma de Vecna do D e D que meu maridinho pediu e uma Myers por favor. Um beijo!',
    maxCount: 2,
    expected: ['Lich', 'Shape'],
  },
  {
    name: 'multi / quantifier + extra: "2 de trapper e 1 de nurse"',
    message: 'oie {{streamer}}, joga 2 de trapper e 1 de nurse por favor',
    maxCount: 3,
    expected: ['Trapper', 'Trapper', 'Nurse'],
  },
  {
    name: 'multi / cap enforcement: user requests 3 but maxCount=2 → first 2',
    message: 'joga uma de pig, uma de hag e uma de nurse',
    maxCount: 2,
    expected: ['Pig', 'Hag'],
  },
  {
    name: 'multi / under-asks vs entitlement: user requests 1 but maxCount=3',
    message: 'pode jogar uma de Spirit por favor',
    maxCount: 3,
    expected: ['Spirit'],
  },
  {
    // Regression watch: the LLM used to return ['Krasue', 'Trickster'] here —
    // it missed the "3" quantifier and treated the contextual "krasue"
    // reference (the current killer the user is saying goodbye to) as a
    // separate request. Fixed by reframing the prompt around the user's
    // command/intent and excluding context-only mentions.
    name: 'multi / current-killer reference is NOT a request: "tapete da krasue" + "joga 3 trickster"',
    message: 'joga 3 trickster então pra despedir do muso tapete da krasue.',
    maxCount: 3,
    expected: ['Trickster', 'Trickster', 'Trickster'],
  },
];

const allCases = [...singleCases, ...noneCases, ...multiCases];

function multisetSorted(arr: string[]): string[] {
  return [...arr].sort();
}

describe.concurrent('Gemini extractCharacters — live LLM evals', () => {
  it.skipIf(!RUN_EVALS).concurrent.each(allCases)('$name', async ({ message, maxCount, expected }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Set GEMINI_API_KEY (e.g. in apps/api/.env or .dev.vars) to run evals');
    }

    const result = await extractCharacters(message, apiKey, maxCount);
    const names = result.map((r) => r.character);

    // Multiset comparison: order doesn't matter, duplicates do.
    expect(multisetSorted(names)).toEqual(multisetSorted(expected));
  }, 30_000);
});
