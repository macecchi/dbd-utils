import { chatStore } from '../store/chat';
import { requestStore } from '../store/requests';
import { connectionStore } from '../store/connection';
import { sourcesStore } from '../store/sources';
import { settingsStore } from '../store/settings';
import { identifyCharacter } from './llm';
import { parseAmount, parseDonationMessage } from '../utils/helpers';

// Public anonymous client ID for Twitch GQL - not a secret, widely used for unauthenticated access
const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
let vodReplayAbort: boolean | null = null;

const getBotName = () => (settingsStore.get().botName || 'livepix').toLowerCase();
const getMinDonation = () => connectionStore.get().minDonation;
const getSourcesEnabled = () => sourcesStore.getEnabled();

async function fetchVODChat(vodId: string, offset = 0) {
  const query = {
    query: `query($videoID:ID!,$contentOffsetSeconds:Int){video(id:$videoID){comments(contentOffsetSeconds:$contentOffsetSeconds,first:100){edges{node{id contentOffsetSeconds commenter{login displayName}message{fragments{text}}}}}}}`,
    variables: { videoID: vodId, contentOffsetSeconds: offset }
  };
  const opts: RequestInit = {
    method: 'POST',
    headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Content-Type': 'application/json' },
    body: JSON.stringify(query)
  };
  try {
    const res = await fetch('https://gql.twitch.tv/gql', opts);
    if (!res.ok) throw new Error();
    return res.json();
  } catch {
    const proxyOpts = { ...opts, headers: { 'Content-Type': 'application/json' } };
    const res = await fetch('https://corsproxy.io/?url=' + encodeURIComponent('https://gql.twitch.tv/gql'), proxyOpts);
    return res.json();
  }
}

export async function loadAndReplayVOD(vodId: string, speed: number, onStatus: (s: string) => void) {
  if (!vodId) return;
  vodReplayAbort = false;
  const botName = getBotName();
  let offset = 0, total = 0, donates = 0;
  const seen = new Set<string>();

  while (!vodReplayAbort) {
    const data = await fetchVODChat(vodId, offset);
    const edges = data?.data?.video?.comments?.edges || [];
    if (!edges.length) break;

    let newCount = 0, lastOffset = offset;
    for (const { node } of edges) {
      if (vodReplayAbort || seen.has(node.id)) continue;
      seen.add(node.id);
      newCount++;

      const username = node.commenter?.login?.toLowerCase() || '';
      const displayName = node.commenter?.displayName || username;
      const message = node.message?.fragments?.map((f: any) => f.text).join('') || '';
      lastOffset = node.contentOffsetSeconds || lastOffset;
      total++;

      const isDonate = username === botName;
      if (isDonate) donates++;
      chatStore.add({ user: displayName, message, isDonate, color: null });

      if (isDonate) {
        const parsed = parseDonationMessage(message);
        if (parsed && getSourcesEnabled().donation) {
          const amountVal = parseAmount(parsed.amount);
          const belowThreshold = amountVal < getMinDonation();
          const request = {
            id: Date.now() + Math.random(),
            timestamp: new Date(),
            donor: parsed.donor,
            amount: parsed.amount,
            amountVal,
            message: parsed.message,
            character: belowThreshold ? '' : 'Identificando...',
            type: belowThreshold ? 'skipped' as const : 'unknown' as const,
            belowThreshold,
            source: 'donation' as const
          };
          requestStore.add(request);
          if (!belowThreshold) await identifyCharacter(request);
        }
      }

      onStatus(`${total} msgs, ${donates} donates`);
      if (speed > 0) await new Promise(r => setTimeout(r, speed));
    }

    if (!newCount) break;
    offset = lastOffset + 1;
  }

  if (!vodReplayAbort) onStatus(`Done: ${total} msgs, ${donates} donates`);
  vodReplayAbort = null;
}

export function cancelVODReplay() {
  vodReplayAbort = true;
}
