export { connect, disconnect } from './twitch';
export { identifyCharacter, testExtraction, reidentifyAll, callLLM } from './llm';
export { loadAndReplayVOD, cancelVODReplay } from './vod';
export { tryLocalMatch, getKillerPortrait, CHARACTERS, DEFAULT_CHARACTERS } from '../data/characters';

import { requestStore } from '../store/requests';
import { chatStore } from '../store/chat';

export function clearAllDonations() {
  requestStore.clear();
  chatStore.clear();
}
