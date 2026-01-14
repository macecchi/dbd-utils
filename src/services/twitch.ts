import { connectionStore } from '../store/connection';
import { sourcesStore } from '../store/sources';
import { settingsStore } from '../store/settings';
import { chatStore } from '../store/chat';
import { requestStore } from '../store/requests';
import { identifyCharacter } from './llm';
import { tryLocalMatch } from '../data/characters';
import { parseAmount, parseDonationMessage } from '../utils/helpers';

let ws: WebSocket | null = null;

const getSourcesEnabled = () => sourcesStore.getEnabled();
const getChatCommand = () => sourcesStore.getChatCommand();
const getChatTiers = () => sourcesStore.getChatTiers();
const hasSessionRequest = (u: string) => sourcesStore.hasSessionRequest(u);
const addSessionRequest = (u: string) => sourcesStore.addSessionRequest(u);
const getMinDonation = () => connectionStore.get().minDonation;
const getChannel = () => connectionStore.get().channel;
const getApiKey = () => settingsStore.get().apiKey || '';
const getBotName = () => (settingsStore.get().botName || 'livepix').toLowerCase();

function setStatus(text: string, state: 'connected' | 'connecting' | 'disconnected' | 'error' = 'disconnected') {
  connectionStore.setStatus(state, text);
}

export function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
    setStatus('Desconectado');
  }
}

export function connect() {
  const channel = getChannel().trim().toLowerCase();
  if (!channel) return;
  setStatus('Conectando...', 'connecting');
  ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
  ws.onopen = () => {
    ws!.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
    ws!.send('NICK justinfan' + Math.floor(Math.random() * 99999));
    ws!.send(`JOIN #${channel}`);
  };
  ws.onmessage = (e) => {
    for (const line of e.data.split('\r\n')) {
      if (line.startsWith('PING')) ws!.send('PONG :tmi.twitch.tv');
      else if (line.includes('366')) setStatus(`t.tv/${channel}`, 'connected');
      else if (line.includes('USERNOTICE')) handleUserNotice(line);
      else if (line.includes('PRIVMSG')) handleMessage(line);
    }
  };
  ws.onclose = () => { setStatus('Desconectado', 'error'); ws = null; };
  ws.onerror = () => setStatus('Erro', 'error');
}

function parseIrcTags(raw: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const m = raw.match(/^@([^ ]+)/);
  if (m) m[1].split(';').forEach(p => { const [k, v] = p.split('='); tags[k] = v || ''; });
  return tags;
}

function getSubTierFromBadges(badges: string): number {
  if (!badges) return 0;
  const m = badges.match(/subscriber\/(\d+)/);
  if (!m) return 0;
  const t = parseInt(m[1]);
  return t >= 3000 ? 3 : t >= 2000 ? 2 : 1;
}

function handleUserNotice(raw: string) {
  const tags = parseIrcTags(raw);
  if (tags['msg-id'] !== 'resub' && tags['msg-id'] !== 'sub') return;
  if (!getSourcesEnabled().resub) return;

  const displayName = tags['display-name'] || 'unknown';
  const msgMatch = raw.match(/USERNOTICE #\w+ :(.+)$/);
  const message = msgMatch?.[1]?.trim() || '';
  if (!message) return;

  chatStore.add({ user: displayName, message: `[${tags['msg-id']}] ${message}`, isDonate: false, color: null });

  const local = tryLocalMatch(message);
  if (!local && !getApiKey()) return;

  const request = {
    id: Date.now() + Math.random(),
    timestamp: new Date(),
    donor: displayName,
    amount: '',
    amountVal: 0,
    message,
    character: 'Identificando...',
    type: 'unknown' as const,
    belowThreshold: false,
    source: 'resub' as const
  };
  requestStore.add(request);
  identifyCharacter(request);
}

function handleChatCommand(tags: Record<string, string>, displayName: string, username: string, requestText: string) {
  if (!getSourcesEnabled().chat || !requestText) return;
  if (hasSessionRequest(username)) return;

  const isSub = tags.subscriber === '1';
  const subTier = getSubTierFromBadges(tags.badges);
  if (!isSub || !getChatTiers().includes(subTier)) return;

  const local = tryLocalMatch(requestText);
  if (!local && !getApiKey()) return;

  addSessionRequest(username);

  const request = {
    id: Date.now() + Math.random(),
    timestamp: new Date(),
    donor: displayName,
    amount: '',
    amountVal: 0,
    message: requestText,
    character: 'Identificando...',
    type: 'unknown' as const,
    belowThreshold: false,
    source: 'chat' as const,
    subTier
  };
  requestStore.add(request);
  identifyCharacter(request);
}

function handleMessage(raw: string) {
  const tags = parseIrcTags(raw);
  const userMatch = raw.match(/display-name=([^;]*)/i);
  const msgMatch = raw.match(/PRIVMSG #\w+ :(.+)$/);
  const colorMatch = raw.match(/color=(#[0-9A-Fa-f]{6})/i);
  if (!userMatch || !msgMatch) return;

  const displayName = userMatch[1] || 'unknown';
  const username = displayName.toLowerCase();
  const message = msgMatch[1].trim();
  const color = colorMatch?.[1] || null;
  const botName = getBotName();

  chatStore.add({ user: displayName, message, isDonate: username === botName, color });

  const chatCommand = getChatCommand();
  if (message.toLowerCase().startsWith(chatCommand.toLowerCase())) {
    handleChatCommand(tags, displayName, username, message.slice(chatCommand.length).trim());
    return;
  }

  if (username !== botName) return;
  const parsed = parseDonationMessage(message);
  if (!parsed || !getSourcesEnabled().donation) return;

  const amountVal = parseAmount(parsed.amount);
  const belowThreshold = amountVal < getMinDonation();

  const request = {
    id: Date.now(),
    timestamp: new Date(),
    donor: parsed.donor,
    amount: parsed.amount,
    amountVal,
    message: parsed.message,
    character: belowThreshold ? 'Ignorado' : 'Identificando...',
    type: belowThreshold ? 'skipped' as const : 'unknown' as const,
    belowThreshold,
    source: 'donation' as const
  };
  requestStore.add(request);

  if (!belowThreshold) {
    const requests = requestStore.get();
    identifyCharacter(requests[requests.length - 1]);
  }
}
