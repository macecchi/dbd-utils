import type { Request } from '../types';
import { requestStore } from '../store/requests';
import { showToast } from '../store/toasts';

const MOCK_REQUESTS: Omit<Request, 'id' | 'timestamp'>[] = [
  { donor: "PedroGamer", amount: "R$ 50,00", amountVal: 50, message: "Quero muito ver a Nurse!", character: "Nurse", type: "killer", source: "donation", belowThreshold: false },
  { donor: "MariaSilva", amount: "R$ 10,00", amountVal: 10, message: "joga de meg pfv", character: "Meg Thomas", type: "survivor", source: "donation", belowThreshold: false },
  { donor: "JoaoVitor2024", amount: "R$ 100,00", amountVal: 100, message: "BUBBA POR FAVOR AMO DEMAIS", character: "Cannibal", type: "killer", source: "donation", belowThreshold: false },
  { donor: "TwitchFan99", amount: "R$ 5,00", amountVal: 5, message: "huntress seria top", character: "Ignorado", type: "skipped", belowThreshold: true, source: "donation" },
  { donor: "SubLeal_12meses", amount: "", amountVal: 0, message: "12 meses assistindo! Quero ver o Pyramid Head", character: "Pyramid Head", type: "killer", source: "resub", belowThreshold: false },
  { donor: "NovoSub", amount: "", amountVal: 0, message: "primeiro mes! spirit plsss", character: "Spirit", type: "killer", source: "resub", belowThreshold: false },
  { donor: "SubTier3VIP", amount: "", amountVal: 0, message: "ghostface", character: "Ghost Face", type: "killer", source: "chat", subTier: 3, belowThreshold: false },
  { donor: "SubTier2User", amount: "", amountVal: 0, message: "quero a claudette", character: "Claudette Morel", type: "survivor", source: "chat", subTier: 2, belowThreshold: false },
  { donor: "SubTier1Basic", amount: "", amountVal: 0, message: "dwight por favor", character: "Dwight Fairfield", type: "survivor", source: "chat", subTier: 1, belowThreshold: false },
  { donor: "Streamer", amount: "", amountVal: 0, message: "pedido especial", character: "Wesker", type: "killer", source: "manual", belowThreshold: false },
  { donor: "NomeDeUsuarioMuitoGrandeQueNaoCabeNaTela", amount: "R$ 25,00", amountVal: 25, message: "doctor", character: "Doctor", type: "killer", source: "donation", belowThreshold: false },
  { donor: "Tagarela", amount: "R$ 15,00", amountVal: 15, message: "Oi Mandy! Sou seu maior fã, assisto todas as lives desde 2020. Será que você poderia jogar de Legion? É meu killer favorito desde que comecei a jogar DBD. Muito obrigado por tudo!", character: "Legion", type: "killer", source: "donation", belowThreshold: false },
  { donor: "AguardandoIA", amount: "R$ 20,00", amountVal: 20, message: "aquele killer do filme de terror", character: "Identificando...", type: "unknown", source: "donation", belowThreshold: false },
  { donor: "SurvMain", amount: "R$ 30,00", amountVal: 30, message: "ada wong resident evil", character: "Ada Wong", type: "survivor", source: "donation", belowThreshold: false },
  { donor: "CageFan", amount: "", amountVal: 0, message: "NICOLAS CAGE!!!!", character: "Nicolas Cage", type: "survivor", source: "resub", belowThreshold: false },
  { donor: "JaAtendido", amount: "R$ 40,00", amountVal: 40, message: "trapper classico", character: "Trapper", type: "killer", source: "donation", done: true, belowThreshold: false },
  { donor: "OutroFeito", amount: "", amountVal: 0, message: "wraith", character: "Wraith", type: "killer", source: "chat", subTier: 2, done: true, belowThreshold: false },
  { donor: "Emoji_User", amount: "R$ 12,00", amountVal: 12, message: "clown <3 :) palhaço é vida!!!", character: "Clown", type: "killer", source: "donation", belowThreshold: false },
  { donor: "BrasilUser", amount: "R$ 18,00", amountVal: 18, message: "joga de caçadora pfv", character: "Huntress", type: "killer", source: "donation", belowThreshold: false },
  { donor: "Tier3Chat", amount: "", amountVal: 0, message: "oni samurai", character: "Oni", type: "killer", source: "chat", subTier: 3, belowThreshold: false },
  { donor: "BigDonor", amount: "R$ 200,00", amountVal: 200, message: "blight rpd", character: "Blight", type: "killer", source: "donation", belowThreshold: false },
];

export function loadMockData() {
  const now = Date.now();
  const mockWithIds: Request[] = MOCK_REQUESTS.map((d, i) => ({
    ...d,
    id: now + i,
    timestamp: new Date(now - (MOCK_REQUESTS.length - i) * 60000),
    done: d.done || false
  }));

  requestStore.set(mockWithIds);
  showToast(`${mockWithIds.length} itens mock carregados`);
}
