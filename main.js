function generateCharacterListWithAliases(type) {
  return CHARACTERS[type].map(c => {
    const allNames = [c.name, ...c.aliases];
    return allNames.join('/');
  });
}

function getKillerPortrait(charName) {
  if (!charName) return null;
  const lower = charName.toLowerCase();
  const killer = CHARACTERS.killers.find(k =>
    k.name.toLowerCase() === lower ||
    k.aliases.some(a => a.toLowerCase() === lower)
  );
  return killer?.portrait || null;
}

const DEFAULT_CHARACTERS = {
  survivors: generateCharacterListWithAliases('survivors'),
  killers: generateCharacterListWithAliases('killers')
};

let ws = null;
let donations = [];
let chatMessages = [];

function getCharacters() {
  return DEFAULT_CHARACTERS;
}

function getMinDonation() {
  return parseFloat(localStorage.getItem('dbd_min_donation') || '10');
}

function loadMinDonation() {
  document.getElementById('minDonation').value = getMinDonation();
}

function saveMinDonation() {
  const val = parseFloat(document.getElementById('minDonation').value) || 0;
  localStorage.setItem('dbd_min_donation', val.toString());
}

function loadChannel() {
  const saved = localStorage.getItem('dbd_channel');
  if (saved) document.getElementById('channelInput').value = saved;
}

function saveChannel() {
  localStorage.setItem('dbd_channel', document.getElementById('channelInput').value.trim());
}

function loadDonations() {
  const saved = localStorage.getItem('dbd_donations');
  if (saved) {
    donations = JSON.parse(saved).map(d => ({ ...d, timestamp: new Date(d.timestamp) }));
    renderDonations();
  }
}

function saveDonations() {
  localStorage.setItem('dbd_donations', JSON.stringify(donations));
}

function clearDoneDonations() {
  donations = donations.filter(d => !d.done);
  saveDonations();
  renderDonations();
}

function clearAllDonations() {
  donations = [];
  chatMessages = [];
  saveDonations();
  saveChatMessages();
  renderDonations();
  renderChatMessages();
}

function toggleDone(id) {
  const donation = donations.find(d => d.id === id);
  if (donation) {
    donation.done = !donation.done;
    saveDonations();
    updateDonationElement(id);
    updateStats();
    document.getElementById('count').textContent = donations.filter(d => !d.belowThreshold && !d.done).length;
  }
}

function updateDonationElement(id) {
  const donation = donations.find(d => d.id === id);
  if (!donation) return;
  const el = document.querySelector(`.donation[onclick*="${id}"]`);
  if (!el) return;

  const isCollapsed = donation.done || donation.belowThreshold;
  el.classList.toggle('collapsed', isCollapsed);

  const showChar = donation.type === 'survivor' || donation.type === 'killer' || donation.character === 'Identificando...';
  const charDisplay = donation.character || donation.type;

  const donorEl = el.querySelector('.donor');
  let charInline = donorEl.querySelector('.char-name-inline');
  let msgPreview = donorEl.querySelector('.msg-preview');

  if (isCollapsed) {
    if (!charInline && showChar) {
      charInline = document.createElement('span');
      charInline.className = 'char-name-inline';
      charInline.textContent = charDisplay;
      donorEl.insertBefore(charInline, donorEl.querySelector('.amount'));
    }
    if (!msgPreview) {
      msgPreview = document.createElement('span');
      msgPreview.className = 'msg-preview';
      msgPreview.textContent = donation.message.slice(0, 40) + (donation.message.length > 40 ? '…' : '');
      donorEl.insertBefore(msgPreview, donorEl.querySelector('.amount'));
    }
  } else {
    charInline?.remove();
    msgPreview?.remove();
  }

  const checkBtn = el.querySelector('.row-btn:not(.danger)');
  if (checkBtn) {
    checkBtn.classList.toggle('active', donation.done);
    checkBtn.title = donation.done ? 'Desmarcar' : 'Marcar feito';
  }
}

let contextMenuTarget = null;
const contextMenu = document.getElementById('contextMenu');

function showContextMenu(e, id) {
  e.preventDefault();
  e.stopPropagation();
  contextMenuTarget = id;
  const donation = donations.find(d => d.id === id);
  document.getElementById('contextMenuDoneText').textContent = donation?.done ? 'Marcar como não feito' : 'Marcar como feito';
  contextMenu.style.left = e.clientX + 'px';
  contextMenu.style.top = e.clientY + 'px';
  contextMenu.classList.add('show');
}

function hideContextMenu() {
  contextMenu.classList.remove('show');
  contextMenuTarget = null;
}

document.addEventListener('click', hideContextMenu);
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('.donation')) hideContextMenu();
});

function deleteDonation(id) {
  donations = donations.filter(d => d.id !== id);
  saveDonations();
  renderDonations();
}

async function rerunExtraction(id) {
  const donation = donations.find(d => d.id === id);
  if (donation) {
    donation.character = 'Identificando...';
    donation.type = 'unknown';
    renderDonations();
    await identifyCharacter(donation);
  }
}

async function reidentifyAll() {
  for (const d of donations) {
    d.character = 'Identificando...';
    d.type = 'unknown';
  }
  renderDonations();
  for (const d of donations) {
    await identifyCharacter(d);
  }
}

function contextMenuAction(action) {
  if (!contextMenuTarget) return;
  switch (action) {
    case 'done': toggleDone(contextMenuTarget); break;
    case 'rerun': rerunExtraction(contextMenuTarget); break;
    case 'delete': deleteDonation(contextMenuTarget); break;
  }
  hideContextMenu();
}

function showToast(msg, duration = 5000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<div class="toast-title">Erro LLM</div><div class="toast-msg">${msg}</div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

function loadChatMessages() {
  const saved = localStorage.getItem('dbd_chat');
  if (saved) {
    chatMessages = JSON.parse(saved);
    renderChatMessages();
  }
}

function saveChatMessages() {
  localStorage.setItem('dbd_chat', JSON.stringify(chatMessages.slice(-100)));
}

function renderChatMessages() {
  const chatlog = document.getElementById('chatlog');
  if (chatMessages.length === 0) {
    chatlog.innerHTML = '<div class="empty">Mensagens do chat aparecerão aqui...</div>';
    return;
  }
  chatlog.innerHTML = chatMessages.map(m => {
    const userStyle = m.isDonate ? '' : (m.color ? `style="color:${m.color}"` : '');
    return `<div class="chat-msg${m.isDonate ? ' donate' : ''}"><span class="chat-user ${m.isDonate ? 'donate' : ''}" ${userStyle}>${m.user}:</span><span class="chat-text">${m.message}</span></div>`;
  }).join('');
  chatlog.scrollTop = chatlog.scrollHeight;
}

function parseAmount(amountStr) {
  const match = amountStr.match(/[\d,\.]+/);
  if (!match) return 0;
  return parseFloat(match[0].replace(',', '.'));
}

function toggleSettings() {
  document.getElementById('settingsPanel').classList.toggle('open');
}

function toggleDebug() {
  document.getElementById('debugPanel').classList.toggle('open');
}

function getApiKey() { return localStorage.getItem('gemini_key'); }
function getGeminiModels() {
  const saved = localStorage.getItem('gemini_models');
  if (saved) return JSON.parse(saved);
  return ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
}
let currentModelIndex = 0;

function updateApiStatus() {
  const key = getApiKey();
  const el = document.getElementById('apiStatus');
  el.className = key ? 'api-status set' : 'api-status missing';
  el.textContent = key ? '✓ Configurado' : '⚠ Sem API key';
}

function updateApiKeyDisplay() {
  document.getElementById('apiKeyInput').value = getApiKey() || '';
}

function saveApiKeyFromInput() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (key) {
    localStorage.setItem('gemini_key', key);
  } else {
    localStorage.removeItem('gemini_key');
  }
  updateApiStatus();
  updateLLMStatus();
}

function saveGeminiModels() {
  const text = document.getElementById('geminiModelsInput').value.trim();
  const models = text.split('\n').map(m => m.trim()).filter(m => m);
  if (models.length === 0) models.push('gemini-2.0-flash');
  localStorage.setItem('gemini_models', JSON.stringify(models));
  currentModelIndex = 0;
}

function loadGeminiModels() {
  document.getElementById('geminiModelsInput').value = getGeminiModels().join('\n');
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('apiKeyInput');
  input.type = input.type === 'password' ? 'text' : 'password';
}

function getBotName() {
  return (localStorage.getItem('dbd_bot_name') || 'livepix').toLowerCase();
}

function saveBotName() {
  const name = document.getElementById('botNameInput').value.trim() || 'livepix';
  localStorage.setItem('dbd_bot_name', name);
  document.getElementById('footerBotName').textContent = name;
}

function loadBotName() {
  const name = localStorage.getItem('dbd_bot_name') || 'livepix';
  document.getElementById('botNameInput').value = name;
  document.getElementById('footerBotName').textContent = name;
}

function setLLMStatus(state, text) {
  const dot = document.getElementById('llmStatusDot');
  const label = document.getElementById('llmStatusText');
  dot.className = 'status-dot ' + state;
  label.textContent = text;
}

function updateLLMStatus() {
  if (!getApiKey()) {
    setLLMStatus('error', 'Sem API key');
  } else {
    setLLMStatus('idle', getGeminiModels()[0]);
  }
}

function openSettingsModal() {
  updateApiKeyDisplay();
  loadGeminiModels();
  loadBotName();
  document.getElementById('settingsModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSettingsModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('settingsModal').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSettingsModal();
});

function setStatus(text, state = 'disconnected') {
  const dot = document.getElementById('statusDot');
  const btn = document.getElementById('connectBtn');
  dot.className = 'status-dot ' + state;
  btn.classList.toggle('connected', state === 'connected');
  document.getElementById('status').textContent = text;
}

function toggleConnection() {
  if (ws) { ws.close(); ws = null; document.getElementById('connectBtn').textContent = 'Conectar'; setStatus('Desconectado'); }
  else { connect(); }
}

function connect() {
  const channel = document.getElementById('channelInput').value.trim().toLowerCase();
  if (!channel) return;
  setStatus('Conectando...', 'connecting');
  document.getElementById('connectBtn').textContent = 'Desconectar';
  ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
  ws.onopen = () => {
    ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
    ws.send('NICK justinfan' + Math.floor(Math.random() * 99999));
    ws.send(`JOIN #${channel}`);
  };
  ws.onmessage = (event) => {
    for (const line of event.data.split('\r\n')) {
      if (line.startsWith('PING')) ws.send('PONG :tmi.twitch.tv');
      else if (line.includes('366')) setStatus(`t.tv/${channel}`, 'connected');
      else if (line.includes('PRIVMSG')) handleMessage(line);
    }
  };
  ws.onclose = () => { setStatus('Desconectado', 'error'); document.getElementById('connectBtn').textContent = 'Conectar'; ws = null; };
  ws.onerror = () => setStatus('Erro', 'error');
}

function handleMessage(raw) {
  const userMatch = raw.match(/display-name=([^;]*)/i);
  const msgMatch = raw.match(/PRIVMSG #\w+ :(.+)$/);
  const colorMatch = raw.match(/color=(#[0-9A-Fa-f]{6})/i);
  if (!userMatch || !msgMatch) return;
  const displayName = userMatch[1] || 'unknown';
  const username = displayName.toLowerCase();
  const message = msgMatch[1].trim();
  const color = colorMatch ? colorMatch[1] : null;
  const botName = getBotName();
  addToChatLog(displayName, message, username === botName, color);
  if (username !== botName) return;
  const match = message.match(/^(.+?)\s+(?:doou|mandou)\s+(R\$\s?[\d,\.]+)(?::\s*|\s+e disse:\s*)(.*)$/i);
  if (!match) return;

  const amountVal = parseAmount(match[2]);
  const minDonation = getMinDonation();
  const belowThreshold = amountVal < minDonation;

  const donation = {
    id: Date.now(),
    timestamp: new Date(),
    donor: match[1].trim(),
    amount: match[2],
    amountVal,
    message: match[3].trim(),
    character: belowThreshold ? 'Ignorado' : 'Identificando...',
    type: belowThreshold ? 'skipped' : 'unknown',
    belowThreshold
  };

  donations.unshift(donation);
  saveDonations();
  renderDonations();

  if (!belowThreshold) {
    identifyCharacter(donation);
  }
}

function addToChatLog(user, message, isDonate, color) {
  chatMessages.push({ user, message, isDonate, color });
  if (chatMessages.length > 100) chatMessages.shift();
  saveChatMessages();

  const chatlog = document.getElementById('chatlog');
  if (chatlog.querySelector('.empty')) chatlog.innerHTML = '';
  const div = document.createElement('div');
  div.className = `chat-msg${isDonate ? ' donate' : ''}`;
  const userStyle = isDonate ? '' : (color ? `style="color:${color}"` : '');
  div.innerHTML = `<span class="chat-user ${isDonate ? 'donate' : ''}" ${userStyle}>${user}:</span><span class="chat-text">${message}</span>`;
  chatlog.appendChild(div);
  chatlog.scrollTop = chatlog.scrollHeight;
  while (chatlog.children.length > 100) chatlog.removeChild(chatlog.firstChild);
}

const RETRIABLE_CODES = [429, 500, 502, 503, 504];
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

async function callLLM(message, attempt = 0, modelIdx = currentModelIndex, startModelIdx = currentModelIndex) {
  const apiKey = getApiKey();
  const models = getGeminiModels();
  const model = models[modelIdx];
  if (!apiKey) return { character: 'Sem API key', type: 'unknown' };

  const chars = getCharacters();
  const prompt = `Identify the Dead by Daylight character from the user message.
<survivors>
${chars.survivors.join('\n')}
</survivors>

<killers>
${chars.killers.join('\n')}
</killers>

<user_message>
${message}
</user_message>

Return ONLY the JSON with the character name and type. If you can identify the exact character, return its name. If you can only tell if it's a survivor or killer but not which one, return empty character. If no character is mentioned, return type "none".`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
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
              character: { type: 'string', description: 'Exact character name or empty if unknown' },
              type: { type: 'string', enum: ['survivor', 'killer', 'none'] }
            },
            required: ['character', 'type']
          }
        }
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || `HTTP ${response.status}`;
      if (RETRIABLE_CODES.includes(response.status)) {
        const nextModelIdx = (modelIdx + 1) % models.length;
        if (nextModelIdx !== startModelIdx) {
          console.log(`Switching to model: ${models[nextModelIdx]} (${msg})`);
          currentModelIndex = nextModelIdx;
          return callLLM(message, 0, nextModelIdx, startModelIdx);
        }
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt];
          console.log(`LLM retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms: ${msg}`);
          await new Promise(r => setTimeout(r, delay));
          return callLLM(message, attempt + 1, modelIdx, startModelIdx);
        }
      }
      showToast(msg);
      setLLMStatus('error', `${model} ✗`);
      return { character: 'Erro na API', type: 'unknown' };
    }
    currentModelIndex = modelIdx;
    setLLMStatus('connected', model);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return JSON.parse(text);
  } catch (e) {
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS[attempt];
      console.log(`LLM retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms: ${e.message}`);
      await new Promise(r => setTimeout(r, delay));
      return callLLM(message, attempt + 1, modelIdx, startModelIdx);
    }
    showToast(e.message || 'Erro desconhecido');
    setLLMStatus('error', `${model} ✗`);
    return { character: 'Erro', type: 'unknown' };
  }
}

async function identifyCharacter(donation) {
  const result = await callLLM(donation.message);
  donation.character = result.character || '';
  donation.type = result.type === 'none' ? 'unknown' : (result.type || 'unknown');
  saveDonations();
  renderDonations();
}

async function testExtraction() {
  const input = document.getElementById('debugInput').value.trim();
  const resultDiv = document.getElementById('debugResult');
  const addToQueue = document.getElementById('addToQueue').checked;
  if (!input) return;
  resultDiv.classList.add('show');
  resultDiv.innerHTML = 'Identificando...';
  const result = await callLLM(input);
  const type = result.type === 'none' ? 'unknown' : (result.type || 'unknown');
  const color = type === 'survivor' ? 'var(--blue)' : type === 'killer' ? 'var(--red)' : 'var(--text-muted)';
  const display = result.character || type;
  resultDiv.innerHTML = `<span style="color:${color}">${type}</span> → <strong>${display}</strong>`;

  if (addToQueue && type !== 'unknown') {
    const donation = {
      id: Date.now(),
      timestamp: new Date(),
      donor: 'Teste',
      amount: 'R$ 0,00',
      amountVal: 0,
      message: input,
      character: result.character || '',
      type: type,
      belowThreshold: false
    };
    donations.unshift(donation);
    saveDonations();
    renderDonations();
    document.getElementById('debugInput').value = '';
  }
}

function updateStats() {
  const pending = donations.filter(d => !d.belowThreshold && !d.done);
  document.getElementById('survivorCount').textContent = pending.filter(d => d.type === 'survivor').length;
  document.getElementById('killerCount').textContent = pending.filter(d => d.type === 'killer').length;
}

function renderDonations() {
  const container = document.getElementById('donations');
  const validDonations = donations.filter(d => !d.belowThreshold);
  const pendingDonations = validDonations.filter(d => !d.done);
  document.getElementById('count').textContent = pendingDonations.length;
  updateStats();
  if (donations.length === 0) { container.innerHTML = '<div class="empty">Aguardando doações...</div>'; return; }
  container.innerHTML = donations.map(d => {
    const showChar = d.type === 'survivor' || d.type === 'killer' || d.character === 'Identificando...';
    const portrait = d.type === 'killer' && d.character && getKillerPortrait(d.character);
    const portraitHtml = portrait ? `<div class="char-portrait-wrapper"><div class="char-portrait-bg killer"></div><img src="${portrait}" alt="" class="char-portrait"></div>` : '';
    const charDisplay = d.character || d.type;
    const charHtml = showChar ? `
      <div class="character">
        ${portraitHtml}
        <span class="char-name ${d.character === 'Identificando...' ? 'identifying' : ''} ${!d.character && d.type !== 'unknown' ? 'type-only' : ''}">${charDisplay}</span>
      </div>` : '';
    const isCollapsed = d.done || d.belowThreshold;
    const collapsedClass = isCollapsed ? ' collapsed' : '';
    const collapsedCharHtml = isCollapsed && showChar ? `<span class="char-name-inline">${charDisplay}</span>` : '';
    const msgPreview = isCollapsed ? `<span class="msg-preview">${d.message.slice(0, 40)}${d.message.length > 40 ? '…' : ''}</span>` : '';
    const actionBtns = `<div class="row-actions">
      <button class="row-btn ${d.done ? 'active' : ''}" onclick="event.stopPropagation(); toggleDone(${d.id})" title="${d.done ? 'Desmarcar' : 'Marcar feito'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </button>
      <button class="row-btn danger" onclick="event.stopPropagation(); deleteDonation(${d.id})" title="Excluir">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
      </button>
    </div>`;
    return `
    <div class="donation ${d.belowThreshold ? 'below-threshold' : ''}${collapsedClass}" onclick="toggleDone(${d.id})" oncontextmenu="showContextMenu(event, ${d.id})">
      <div class="donation-top">
        <div class="donor"><span class="donor-name">${d.donor}</span>${collapsedCharHtml}${msgPreview}<span class="amount ${d.belowThreshold ? 'below' : ''}">${d.amount}</span></div>
        <div class="time-actions">
          ${actionBtns}
          <span class="time">${new Date(d.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${new Date(d.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
      <p class="message">${d.message}</p>${charHtml}
    </div>`;
  }).join('');
}

const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
let vodReplayAbort = null;

async function fetchVODChat(vodId, offsetSeconds = 0) {
  const gqlQuery = `query VideoCommentsByOffsetOrCursor($videoID: ID!, $contentOffsetSeconds: Int) {
    video(id: $videoID) {
      id
      comments(contentOffsetSeconds: $contentOffsetSeconds, first: 100) {
        edges {
          node {
            id
            contentOffsetSeconds
            commenter { id login displayName }
            message { fragments { text } }
          }
        }
      }
    }
  }`;
  const query = {
    query: gqlQuery,
    variables: { videoID: vodId, contentOffsetSeconds: offsetSeconds }
  };

  const tryFetch = async (url, opts) => {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const opts = {
    method: 'POST',
    headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Content-Type': 'application/json' },
    body: JSON.stringify(query)
  };

  try {
    return await tryFetch('https://gql.twitch.tv/gql', opts);
  } catch (e) {
    const proxyOpts = { ...opts, headers: { 'Content-Type': 'application/json' } };
    return await tryFetch('https://corsproxy.io/?url=' + encodeURIComponent('https://gql.twitch.tv/gql'), proxyOpts);
  }
}

async function loadAndReplayVOD() {
  const vodId = document.getElementById('vodIdInput').value.trim();
  const speed = parseInt(document.getElementById('replaySpeed').value);
  const statusEl = document.getElementById('vodReplayStatus');
  const btn = document.getElementById('vodReplayBtn');

  if (!vodId) return;

  if (vodReplayAbort) {
    vodReplayAbort = true;
    btn.textContent = 'Replay';
    statusEl.textContent = 'Cancelled';
    return;
  }

  vodReplayAbort = false;
  btn.textContent = 'Stop';
  statusEl.textContent = 'Fetching...';

  try {
    const botName = getBotName();
    let offsetSeconds = 0;
    let totalMessages = 0;
    let donateMessages = 0;
    const seenIds = new Set();

    while (!vodReplayAbort) {
      const data = await fetchVODChat(vodId, offsetSeconds);
      const comments = data?.data?.video?.comments;
      if (!comments) {
        statusEl.textContent = 'No chat found for this VOD';
        break;
      }

      const edges = comments.edges || [];
      if (edges.length === 0) break;

      let newMessages = 0;
      let lastOffset = offsetSeconds;

      for (const edge of edges) {
        if (vodReplayAbort) break;

        const node = edge.node;
        if (seenIds.has(node.id)) continue;
        seenIds.add(node.id);
        newMessages++;

        const username = node.commenter?.login?.toLowerCase() || '';
        const displayName = node.commenter?.displayName || username;
        const message = node.message?.fragments?.map(f => f.text).join('') || '';
        lastOffset = node.contentOffsetSeconds || lastOffset;

        totalMessages++;
        const isDonate = username === botName;
        if (isDonate) donateMessages++;

        addToChatLog(displayName, message, isDonate, null);

        if (isDonate) {
          const match = message.match(/^(.+?)\s+(?:doou|mandou)\s+(R\$\s?[\d,\.]+)(?::\s*|\s+e disse:\s*)(.*)$/i);
          if (match) {
            const amountVal = parseAmount(match[2]);
            const minDonation = getMinDonation();
            const belowThreshold = amountVal < minDonation;
            const donation = {
              id: Date.now() + Math.random(),
              timestamp: new Date(),
              donor: match[1].trim(),
              amount: match[2],
              amountVal,
              message: match[3].trim(),
              character: belowThreshold ? '' : 'Identificando...',
              type: belowThreshold ? 'skipped' : 'unknown',
              belowThreshold
            };
            donations.unshift(donation);
            saveDonations();
            renderDonations();
            if (!belowThreshold) await identifyCharacter(donation);
          }
        }

        statusEl.textContent = `${totalMessages} msgs, ${donateMessages} donates`;
        if (speed > 0) await new Promise(r => setTimeout(r, speed));
      }

      if (newMessages === 0) break;
      offsetSeconds = lastOffset + 1;
    }

    if (!vodReplayAbort) statusEl.textContent = `Done: ${totalMessages} msgs, ${donateMessages} donates`;
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
  }

  vodReplayAbort = null;
  btn.textContent = 'Replay';
}

// Init
loadMinDonation();
loadChannel();
loadGeminiModels();
loadBotName();
loadDonations();
loadChatMessages();
updateApiStatus();
updateLLMStatus();

function toggleChat() {
  const grid = document.querySelector('.grid');
  const btn = document.getElementById('toggleChatBtn');
  const hidden = grid.classList.toggle('chat-hidden');
  btn.textContent = hidden ? 'Mostrar chat' : 'Esconder chat';
  localStorage.setItem('dbd_chat_hidden', hidden);
}

function loadChatVisibility() {
  const hidden = localStorage.getItem('dbd_chat_hidden') !== 'false';
  if (hidden) {
    document.querySelector('.grid').classList.add('chat-hidden');
    document.getElementById('toggleChatBtn').textContent = 'Mostrar chat';
  }
}

loadChatVisibility();
setTimeout(() => connect(), 500);
