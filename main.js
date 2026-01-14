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
let sessionRequests = {};

function getDonations() {
  return window.donationStore?.get() || [];
}

function setDonations(arr) {
  window.donationStore?.set(arr);
}

const DEFAULT_SOURCES_ENABLED = { donation: true, resub: true, chat: true, manual: true };
const DEFAULT_CHAT_COMMAND = '!request';
const DEFAULT_CHAT_TIERS = [1, 2, 3];
const DEFAULT_SOURCE_PRIORITY = ['donation', 'resub', 'chat', 'manual'];

const SOURCE_ICONS = {
  donation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  resub: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  manual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'
};

function getSourcesEnabled() {
  const saved = localStorage.getItem('dbd_sources_enabled');
  return saved ? JSON.parse(saved) : DEFAULT_SOURCES_ENABLED;
}

function saveSourcesEnabled(sources) {
  localStorage.setItem('dbd_sources_enabled', JSON.stringify(sources));
}

function getChatCommand() {
  return localStorage.getItem('dbd_chat_command') || DEFAULT_CHAT_COMMAND;
}

function saveChatCommand(cmd) {
  localStorage.setItem('dbd_chat_command', cmd);
}

function getChatTiers() {
  const saved = localStorage.getItem('dbd_chat_tiers');
  return saved ? JSON.parse(saved) : DEFAULT_CHAT_TIERS;
}

function saveChatTiers(tiers) {
  localStorage.setItem('dbd_chat_tiers', JSON.stringify(tiers));
}

function getSourcePriority() {
  const saved = localStorage.getItem('dbd_source_priority');
  return saved ? JSON.parse(saved) : DEFAULT_SOURCE_PRIORITY;
}

function saveSourcePriority(priority) {
  localStorage.setItem('dbd_source_priority', JSON.stringify(priority));
}

function loadSessionRequests() {
  const saved = localStorage.getItem('dbd_session_requests');
  sessionRequests = saved ? JSON.parse(saved) : {};
}

function saveSessionRequests() {
  localStorage.setItem('dbd_session_requests', JSON.stringify(sessionRequests));
}

function resetSession() {
  sessionRequests = {};
  saveSessionRequests();
  showToastInfo('Sessão reiniciada');
}


function getAllCharacterNames() {
  const names = [];
  for (const type of ['killers', 'survivors']) {
    for (const char of CHARACTERS[type]) {
      names.push({ name: char.name, type: type === 'killers' ? 'killer' : 'survivor' });
    }
  }
  return names;
}

function addManualRequest(charName, charType) {
  if (!getSourcesEnabled().manual) return;
  if (!charName) return;

  const request = {
    id: Date.now() + Math.random(),
    timestamp: new Date(),
    donor: 'Manual',
    amount: '',
    amountVal: 0,
    message: charName,
    character: charName,
    type: charType || 'unknown',
    belowThreshold: false,
    source: 'manual'
  };

  window.donationStore.add(request);
  renderDonations();
}

let autocompleteChars = [];
let autocompleteIndex = -1;

function setupManualAutocomplete() {
  const input = document.getElementById('manualCharInput');
  const dropdown = document.getElementById('manualAutocomplete');
  if (!input || !dropdown) return;

  autocompleteChars = getAllCharacterNames();

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase().trim();
    dropdown.innerHTML = '';
    autocompleteIndex = -1;
    if (!val) { dropdown.classList.remove('show'); return; }

    const matches = autocompleteChars.filter(c => c.name.toLowerCase().includes(val)).slice(0, 8);
    if (matches.length === 0) { dropdown.classList.remove('show'); return; }

    matches.forEach((m, i) => {
      const div = document.createElement('div');
      div.className = `autocomplete-item ${m.type}`;
      div.textContent = m.name;
      div.onclick = () => selectAutocomplete(m);
      dropdown.appendChild(div);
    });
    dropdown.classList.add('show');
  });

  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      autocompleteIndex = Math.min(autocompleteIndex + 1, items.length - 1);
      updateAutocompleteHighlight(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      autocompleteIndex = Math.max(autocompleteIndex - 1, 0);
      updateAutocompleteHighlight(items);
    } else if (e.key === 'Enter' && autocompleteIndex >= 0) {
      e.preventDefault();
      const match = autocompleteChars.filter(c => c.name.toLowerCase().includes(input.value.toLowerCase().trim())).slice(0, 8)[autocompleteIndex];
      if (match) selectAutocomplete(match);
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('show');
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => dropdown.classList.remove('show'), 150);
  });
}

function updateAutocompleteHighlight(items) {
  items.forEach((item, i) => item.classList.toggle('active', i === autocompleteIndex));
}

function selectAutocomplete(match) {
  const input = document.getElementById('manualCharInput');
  const dropdown = document.getElementById('manualAutocomplete');
  addManualRequest(match.name, match.type);
  input.value = '';
  dropdown.classList.remove('show');
}

function toggleSourcesPanel() {
  document.getElementById('sourcesPanel').classList.toggle('open');
}

function loadSourcesPanel() {
  const sources = getSourcesEnabled();
  document.getElementById('srcDonation').checked = sources.donation;
  document.getElementById('srcResub').checked = sources.resub;
  document.getElementById('srcChat').checked = sources.chat;
  document.getElementById('srcManual').checked = sources.manual;

  document.getElementById('chatCommandInput').value = getChatCommand();

  const tiers = getChatTiers();
  document.getElementById('tierT1').checked = tiers.includes(1);
  document.getElementById('tierT2').checked = tiers.includes(2);
  document.getElementById('tierT3').checked = tiers.includes(3);

  renderPriorityList();
}

function saveSourceToggle(source, el) {
  const sources = getSourcesEnabled();
  sources[source] = el.checked;
  saveSourcesEnabled(sources);
}

function saveChatCommandInput() {
  const cmd = document.getElementById('chatCommandInput').value.trim() || '!request';
  saveChatCommand(cmd);
}

function saveTierCheckboxes() {
  const tiers = [];
  if (document.getElementById('tierT1').checked) tiers.push(1);
  if (document.getElementById('tierT2').checked) tiers.push(2);
  if (document.getElementById('tierT3').checked) tiers.push(3);
  saveChatTiers(tiers);
}

const SOURCE_LABELS = { donation: 'Doações', resub: 'Resubs', chat: 'Chat', manual: 'Manual' };

function renderPriorityList() {
  const list = document.getElementById('priorityList');
  const priority = getSourcePriority();
  list.innerHTML = priority.map(s => `
    <div class="priority-item" draggable="true" data-source="${s}">
      <span class="drag-handle">⠿</span>
      <span class="priority-icon">${SOURCE_ICONS[s]}</span>
      <span>${SOURCE_LABELS[s]}</span>
    </div>
  `).join('');

  setupPriorityDrag();
}

function setupPriorityDrag() {
  const list = document.getElementById('priorityList');
  let draggedItem = null;

  list.querySelectorAll('.priority-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedItem = null;
      savePriorityOrder();
      renderDonations();
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!draggedItem || draggedItem === item) return;
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        list.insertBefore(draggedItem, item);
      } else {
        list.insertBefore(draggedItem, item.nextSibling);
      }
    });
  });
}

function savePriorityOrder() {
  const list = document.getElementById('priorityList');
  const priority = [...list.querySelectorAll('.priority-item')].map(el => el.dataset.source);
  saveSourcePriority(priority);
}

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

function saveDonations() {
  window.donationStore?.set(getDonations());
}

function clearDoneDonations() {
  const all = getDonations();
  const done = all.filter(d => d.done);
  if (done.length === 0) return;
  lastDeletedDonations = done;
  lastDeletedDonation = null;
  setDonations(all.filter(d => !d.done));
  renderDonations();
  showUndoToast(done.length, undoDelete);
}

function clearAllDonations() {
  window.donationStore.clear();
  renderDonations();
  window.chatStore.clear();
}

function toggleDone(id) {
  const donations = getDonations();
  const donation = donations.find(d => d.id === id);
  if (donation) {
    donation.done = !donation.done;
    setDonations(donations);
    updateDonationElement(id);
    updateStats();
    document.getElementById('count').textContent = getDonations().filter(d => !d.belowThreshold && !d.done).length;
  }
}

function updateDonationElement(id) {
  const donation = getDonations().find(d => d.id === id);
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
let lastDeletedDonation = null;
let lastDeletedDonations = null;

function showContextMenu(e, id) {
  e.preventDefault();
  e.stopPropagation();
  contextMenuTarget = id;
  const donation = getDonations().find(d => d.id === id);
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
  const el = document.querySelector(`.donation[onclick*="${id}"]`);
  const donation = getDonations().find(d => d.id === id);
  const doDelete = () => {
    lastDeletedDonation = donation;
    lastDeletedDonations = null;
    setDonations(getDonations().filter(d => d.id !== id));
    renderDonations();
    showUndoToast(1, undoDelete);
  };
  if (el) {
    el.classList.add('deleting');
    el.addEventListener('animationend', doDelete, { once: true });
  } else {
    doDelete();
  }
}

function undoDelete() {
  if (lastDeletedDonations) {
    setDonations([...getDonations(), ...lastDeletedDonations]);
    lastDeletedDonations = null;
  } else if (lastDeletedDonation) {
    window.donationStore.add(lastDeletedDonation);
    lastDeletedDonation = null;
  } else {
    return;
  }
  renderDonations();
}


document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && (lastDeletedDonation || lastDeletedDonations)) {
    e.preventDefault();
    undoDelete();
  }
});

async function rerunExtraction(id) {
  const donations = getDonations();
  const donation = donations.find(d => d.id === id);
  if (donation) {
    donation.character = 'Identificando...';
    donation.type = 'unknown';
    setDonations(donations);
    renderDonations();
    await identifyCharacter(donation);
  }
}

async function reidentifyAll() {
  const donations = getDonations();
  for (const d of donations) {
    d.character = 'Identificando...';
    d.type = 'unknown';
  }
  setDonations(donations);
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
      else if (line.includes('USERNOTICE')) handleUserNotice(line);
      else if (line.includes('PRIVMSG')) handleMessage(line);
    }
  };
  ws.onclose = () => { setStatus('Desconectado', 'error'); document.getElementById('connectBtn').textContent = 'Conectar'; ws = null; };
  ws.onerror = () => setStatus('Erro', 'error');
}

function parseIrcTags(raw) {
  const tags = {};
  const tagMatch = raw.match(/^@([^ ]+)/);
  if (tagMatch) {
    tagMatch[1].split(';').forEach(pair => {
      const [k, v] = pair.split('=');
      tags[k] = v || '';
    });
  }
  return tags;
}

function getSubTierFromBadges(badges) {
  if (!badges) return 0;
  const match = badges.match(/subscriber\/(\d+)/);
  if (!match) return 0;
  const tier = parseInt(match[1]);
  if (tier >= 3000) return 3;
  if (tier >= 2000) return 2;
  return 1;
}

function handleUserNotice(raw) {
  const tags = parseIrcTags(raw);
  const msgId = tags['msg-id'];
  if (msgId !== 'resub' && msgId !== 'sub') return;
  if (!getSourcesEnabled().resub) return;

  const displayName = tags['display-name'] || tags.login || 'unknown';
  const msgMatch = raw.match(/USERNOTICE #\w+ :(.+)$/);
  const message = msgMatch ? msgMatch[1].trim() : '';

  if (!message) return;

  addToChatLog(displayName, `[${msgId}] ${message}`, false, null);

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
    type: 'unknown',
    belowThreshold: false,
    source: 'resub'
  };

  window.donationStore.add(request);
  renderDonations();
  identifyCharacter(request);
}

function handleChatCommand(raw, tags, displayName, username, requestText) {
  if (!getSourcesEnabled().chat) return;
  if (!requestText) return;

  if (sessionRequests[username]) return;

  const isSub = tags.subscriber === '1';
  const subTier = getSubTierFromBadges(tags.badges);
  const allowedTiers = getChatTiers();
  if (!isSub || !allowedTiers.includes(subTier)) return;

  const local = tryLocalMatch(requestText);
  if (!local && !getApiKey()) return;

  sessionRequests[username] = Date.now();
  saveSessionRequests();

  const request = {
    id: Date.now() + Math.random(),
    timestamp: new Date(),
    donor: displayName,
    amount: '',
    amountVal: 0,
    message: requestText,
    character: 'Identificando...',
    type: 'unknown',
    belowThreshold: false,
    source: 'chat',
    subTier
  };

  window.donationStore.add(request);
  renderDonations();
  identifyCharacter(request);
}

function handleMessage(raw) {
  const tags = parseIrcTags(raw);
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

  const chatCommand = getChatCommand();
  if (message.toLowerCase().startsWith(chatCommand.toLowerCase())) {
    handleChatCommand(raw, tags, displayName, username, message.slice(chatCommand.length).trim());
    return;
  }

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
    belowThreshold,
    source: 'donation'
  };

  if (!getSourcesEnabled().donation) return;

  window.donationStore.add(donation);
  renderDonations();

  if (!belowThreshold) {
    identifyCharacter(donation);
  }
}

function addToChatLog(user, message, isDonate, color) {
  window.chatStore.add({ user, message, isDonate, color });
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
      showToast(msg, 'Erro LLM', 'red');
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
    showToast(e.message || 'Erro desconhecido', 'Erro LLM', 'red');
    setLLMStatus('error', `${model} ✗`);
    return { character: 'Erro', type: 'unknown' };
  }
}

function tryLocalMatch(message) {
  const lower = message.toLowerCase();
  for (const type of ['killers', 'survivors']) {
    for (const char of CHARACTERS[type]) {
      const names = [char.name, ...char.aliases];
      for (const name of names) {
        const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (pattern.test(lower)) {
          return { character: char.name, type: type === 'killers' ? 'killer' : 'survivor' };
        }
      }
    }
  }
  return null;
}

async function identifyCharacter(donation) {
  const local = tryLocalMatch(donation.message);
  if (local) {
    window.donationStore.update(donation.id, { character: local.character, type: local.type });
    renderDonations();
    return;
  }
  if (!getApiKey()) {
    window.donationStore.update(donation.id, { character: '', type: 'unknown' });
    renderDonations();
    return;
  }
  const result = await callLLM(donation.message);
  const type = result.type === 'none' ? 'unknown' : (result.type || 'unknown');
  window.donationStore.update(donation.id, { character: result.character || '', type });
  renderDonations();
}

async function testExtraction() {
  const input = document.getElementById('debugInput').value.trim();
  const resultDiv = document.getElementById('debugResult');
  const addToQueue = document.getElementById('addToQueue').checked;
  if (!input) return;
  resultDiv.classList.add('show');

  let result = tryLocalMatch(input);
  var prefix;
  if (result) {
    prefix = '[local]';
    resultDiv.innerHTML = `<span style="color:var(--text-muted)">${prefix}</span>`;
  } else {
    prefix = '[IA]';
    resultDiv.innerHTML = `<span style="color:var(--text-muted)">${prefix}</span> Identificando...`;
    result = await callLLM(input);
    result = { character: result.character || '', type: result.type === 'none' ? 'unknown' : (result.type || 'unknown') };
  }

  const type = result.type;
  const color = type === 'survivor' ? 'var(--blue)' : type === 'killer' ? 'var(--red)' : 'var(--text-muted)';
  const display = result.character || type;
  resultDiv.innerHTML = `<span style="color:var(--text-muted)">${prefix}</span> <span style="color:${color}">${type}</span> → <strong>${display}</strong>`;

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
      belowThreshold: false,
      source: 'manual'
    };
    window.donationStore.add(donation);
    renderDonations();
    document.getElementById('debugInput').value = '';
  }
}

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

function formatRelativeTime(date) {
  const diff = (new Date(date) - new Date()) / 1000;
  if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), 'second');
  if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

function updateStats() {
  // Stats now rendered by React component
}

function getSortedDonations() {
  const donations = getDonations();
  const priority = getSourcePriority();
  return [...donations].sort((a, b) => {
    const aPrio = priority.indexOf(a.source || 'donation');
    const bPrio = priority.indexOf(b.source || 'donation');
    if (aPrio !== bPrio) return aPrio - bPrio;
    return new Date(a.timestamp) - new Date(b.timestamp);
  });
}

function renderDonations() {
  const donations = getDonations();
  const container = document.getElementById('donations');
  const validDonations = donations.filter(d => !d.belowThreshold);
  const pendingDonations = validDonations.filter(d => !d.done);
  document.getElementById('count').textContent = pendingDonations.length;
  updateStats();
  if (donations.length === 0) { container.innerHTML = '<div class="empty">Aguardando doações...</div>'; return; }
  const sortedDonations = getSortedDonations();
  container.innerHTML = sortedDonations.map(d => {
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
    const checkmarkHtml = d.done ? `<span class="done-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg></span>` : '';
    const collapsedCharHtml = isCollapsed && showChar ? `<span class="char-name-inline">${charDisplay}</span>` : '';
    const msgPreview = isCollapsed ? `<span class="msg-preview">${d.message.slice(0, 40)}${d.message.length > 40 ? '…' : ''}</span>` : '';
    const badgeText = d.source === 'donation' ? d.amount :
                      d.source === 'chat' ? `TIER ${d.subTier || 1}` :
                      d.source === 'resub' ? 'RESUB' : '';
    const badgeHtml = badgeText ? `<span class="amount source-${d.source} ${d.belowThreshold ? 'below' : ''}">${badgeText}</span>` : '';
    const actionBtns = `<div class="row-actions">
      <button class="row-btn danger" onclick="event.stopPropagation(); deleteDonation(${d.id})" title="Excluir">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
      </button>
    </div>`;
    return `
    <div class="donation ${d.belowThreshold ? 'below-threshold' : ''}${collapsedClass} source-${d.source || 'donation'}" onclick="toggleDone(${d.id})" oncontextmenu="showContextMenu(event, ${d.id})">
      <div class="donation-top">
        <div class="donor">${checkmarkHtml}<span class="donor-name">${d.donor}</span>${collapsedCharHtml}${msgPreview}${badgeHtml}</div>
        <div class="time-actions">
          ${actionBtns}
          <span class="time">${formatRelativeTime(d.timestamp)}</span>
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
              belowThreshold,
              source: 'donation'
            };
            if (!getSourcesEnabled().donation) continue;
            window.donationStore.add(donation);
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
loadSessionRequests();
loadSourcesPanel();
setupManualAutocomplete();
updateApiStatus();
updateLLMStatus();
renderDonations();

function toggleChat() {
  const grid = document.querySelector('.grid');
  const hidden = grid.classList.toggle('chat-hidden');
  localStorage.setItem('dbd_chat_hidden', hidden);
}

function loadChatVisibility() {
  const hidden = localStorage.getItem('dbd_chat_hidden') !== 'false';
  if (hidden) {
    document.querySelector('.grid').classList.add('chat-hidden');
  }
}

loadChatVisibility();
setTimeout(() => connect(), 500);
