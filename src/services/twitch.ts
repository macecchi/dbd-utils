import { tryLocalMatch } from '../data/characters';
import { parseAmount, parseDonationMessage } from '../utils/helpers';
import { useConnection, useSettings, useSources, useRequests, useChat } from '../store';
import type { Request } from '../types';

let ws: WebSocket | null = null;

export function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
    useConnection.getState().setStatus('disconnected', 'Desconectado');
  }
}

export function connect() {
  const { channel } = useConnection.getState();
  const ch = channel.trim().toLowerCase();
  if (!ch) return;

  useConnection.getState().setStatus('connecting', 'Conectando...');

  ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
  ws.onopen = () => {
    ws!.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
    ws!.send('NICK justinfan' + Math.floor(Math.random() * 99999));
    ws!.send(`JOIN #${ch}`);
  };
  ws.onmessage = (e) => {
    for (const line of e.data.split('\r\n')) {
      if (line.startsWith('PING')) ws!.send('PONG :tmi.twitch.tv');
      else if (line.includes('366')) useConnection.getState().setStatus('connected', `t.tv/${ch}`);
      else if (line.includes('USERNOTICE')) handleUserNotice(line);
      else if (line.includes('PRIVMSG')) handleMessage(line);
    }
  };
  ws.onclose = () => { useConnection.getState().setStatus('error', 'Desconectado'); ws = null; };
  ws.onerror = () => useConnection.getState().setStatus('error', 'Erro');
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
  const { enabled } = useSources.getState();
  const { apiKey } = useSettings.getState();
  const { add: addRequest } = useRequests.getState();
  const { add: addChat } = useChat.getState();

  const tags = parseIrcTags(raw);
  if (tags['msg-id'] !== 'resub' && tags['msg-id'] !== 'sub') return;
  if (!enabled.resub) return;

  const displayName = tags['display-name'] || 'unknown';
  const msgMatch = raw.match(/USERNOTICE #\w+ :(.+)$/);
  const message = msgMatch?.[1]?.trim() || '';
  if (!message) return;

  addChat({ user: displayName, message: `[${tags['msg-id']}] ${message}`, isDonate: false, color: null });

  const local = tryLocalMatch(message);
  if (!local && !apiKey) return;

  const request: Request = {
    id: Date.now() + Math.random(),
    timestamp: new Date(),
    donor: displayName,
    amount: '',
    amountVal: 0,
    message,
    character: local?.character || 'Identificando...',
    type: local?.type || 'unknown',
    belowThreshold: false,
    source: 'resub',
    needsIdentification: !local
  };
  addRequest(request);
}

function handleChatCommand(tags: Record<string, string>, displayName: string, username: string, requestText: string) {
  const { enabled, chatTiers, hasSessionRequest, addSessionRequest } = useSources.getState();
  const { apiKey } = useSettings.getState();
  const { add: addRequest } = useRequests.getState();

  if (!enabled.chat || !requestText) return;
  if (hasSessionRequest(username)) return;

  const isSub = tags.subscriber === '1';
  const subTier = getSubTierFromBadges(tags.badges);
  if (!isSub || !chatTiers.includes(subTier)) return;

  const local = tryLocalMatch(requestText);
  if (!local && !apiKey) return;

  addSessionRequest(username);

  const request: Request = {
    id: Date.now() + Math.random(),
    timestamp: new Date(),
    donor: displayName,
    amount: '',
    amountVal: 0,
    message: requestText,
    character: local?.character || 'Identificando...',
    type: local?.type || 'unknown',
    belowThreshold: false,
    source: 'chat',
    subTier,
    needsIdentification: !local
  };
  addRequest(request);
}

function handleMessage(raw: string) {
  const { botName, apiKey } = useSettings.getState();
  const { minDonation } = useConnection.getState();
  const { enabled, chatCommand } = useSources.getState();
  const { add: addRequest } = useRequests.getState();
  const { add: addChat } = useChat.getState();

  const tags = parseIrcTags(raw);
  const userMatch = raw.match(/display-name=([^;]*)/i);
  const msgMatch = raw.match(/PRIVMSG #\w+ :(.+)$/);
  const colorMatch = raw.match(/color=(#[0-9A-Fa-f]{6})/i);
  if (!userMatch || !msgMatch) return;

  const displayName = userMatch[1] || 'unknown';
  const username = displayName.toLowerCase();
  const message = msgMatch[1].trim();
  const color = colorMatch?.[1] || null;
  const bot = botName.toLowerCase();

  addChat({ user: displayName, message, isDonate: username === bot, color });

  if (message.toLowerCase().startsWith(chatCommand.toLowerCase())) {
    handleChatCommand(tags, displayName, username, message.slice(chatCommand.length).trim());
    return;
  }

  if (username !== bot) return;
  const parsed = parseDonationMessage(message);
  if (!parsed || !enabled.donation) return;

  const amountVal = parseAmount(parsed.amount);
  const belowThreshold = amountVal < minDonation;
  const local = belowThreshold ? null : tryLocalMatch(parsed.message);

  const request: Request = {
    id: Date.now(),
    timestamp: new Date(),
    donor: parsed.donor,
    amount: parsed.amount,
    amountVal,
    message: parsed.message,
    character: belowThreshold ? 'Ignorado' : (local?.character || 'Identificando...'),
    type: belowThreshold ? 'skipped' : (local?.type || 'unknown'),
    belowThreshold,
    source: 'donation',
    needsIdentification: !belowThreshold && !local && !!apiKey
  };
  addRequest(request);
}
