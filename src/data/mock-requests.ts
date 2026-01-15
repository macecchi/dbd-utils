import type { Request } from '../types';

const MOCK_REQUESTS: Omit<Request, 'id' | 'timestamp'>[] = [
  { donor: "PedroGamer", amount: "R$ 50,00", amountVal: 50, message: "Quero muito ver a Nurse!", character: "Nurse", type: "killer", source: "donation" },
  { donor: "MariaSilva", amount: "R$ 10,00", amountVal: 10, message: "joga de meg pfv", character: "Meg Thomas", type: "survivor", source: "donation" },
  { donor: "JoaoVitor2024", amount: "R$ 100,00", amountVal: 100, message: "BUBBA POR FAVOR AMO DEMAIS", character: "Cannibal", type: "killer", source: "donation" },
  { donor: "SubLeal_12meses", amount: "", amountVal: 0, message: "12 meses assistindo! Quero ver o Pyramid Head", character: "Pyramid Head", type: "killer", source: "resub" },
  { donor: "NovoSub", amount: "", amountVal: 0, message: "primeiro mes! spirit plsss", character: "Spirit", type: "killer", source: "resub" },
  { donor: "SubTier3VIP", amount: "", amountVal: 0, message: "ghostface", character: "Ghost Face", type: "killer", source: "chat", subTier: 3 },
  { donor: "SubTier2User", amount: "", amountVal: 0, message: "quero a claudette", character: "Claudette Morel", type: "survivor", source: "chat", subTier: 2 },
  { donor: "SubTier1Basic", amount: "", amountVal: 0, message: "dwight por favor", character: "Dwight Fairfield", type: "survivor", source: "chat", subTier: 1 },
  { donor: "Streamer", amount: "", amountVal: 0, message: "pedido especial", character: "Wesker", type: "killer", source: "manual" },
  { donor: "NomeDeUsuarioMuitoGrandeQueNaoCabeNaTela", amount: "R$ 25,00", amountVal: 25, message: "doctor", character: "Doctor", type: "killer", source: "donation" },
  { donor: "Tagarela", amount: "R$ 15,00", amountVal: 15, message: "Oi Mandy! Sou seu maior fã, assisto todas as lives desde 2020. Será que você poderia jogar de Legion? É meu killer favorito desde que comecei a jogar DBD. Muito obrigado por tudo!", character: "Legion", type: "killer", source: "donation" },
  { donor: "AguardandoIA", amount: "R$ 20,00", amountVal: 20, message: "aquele killer do filme de terror", character: "Identificando...", type: "unknown", source: "donation" },
  { donor: "SurvMain", amount: "R$ 30,00", amountVal: 30, message: "ada wong resident evil", character: "Ada Wong", type: "survivor", source: "donation" },
  { donor: "CageFan", amount: "", amountVal: 0, message: "NICOLAS CAGE!!!!", character: "Nicolas Cage", type: "survivor", source: "resub" },
  { donor: "JaAtendido", amount: "R$ 40,00", amountVal: 40, message: "trapper classico", character: "Trapper", type: "killer", source: "donation", done: true },
  { donor: "OutroFeito", amount: "", amountVal: 0, message: "wraith", character: "Wraith", type: "killer", source: "chat", subTier: 2, done: true },
  { donor: "Emoji_User", amount: "R$ 12,00", amountVal: 12, message: "clown <3 :) palhaço é vida!!!", character: "Clown", type: "killer", source: "donation" },
  { donor: "BrasilUser", amount: "R$ 18,00", amountVal: 18, message: "joga de caçadora pfv", character: "Huntress", type: "killer", source: "donation" },
  { donor: "Tier3Chat", amount: "", amountVal: 0, message: "oni samurai", character: "Oni", type: "killer", source: "chat", subTier: 3 },
  { donor: "BigDonor", amount: "R$ 200,00", amountVal: 200, message: "blight rpd", character: "Blight", type: "killer", source: "donation" },
];

export function loadMockData(setRequests: (fn: (r: Request[]) => Request[]) => void) {
  const now = Date.now();
  const mockWithIds: Request[] = MOCK_REQUESTS.map((d, i) => ({
    ...d,
    id: now + i,
    timestamp: new Date(now - (MOCK_REQUESTS.length - i) * 60000),
    done: d.done || false
  }));

  setRequests(() => mockWithIds);
}
