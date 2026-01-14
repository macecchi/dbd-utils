export interface ChatMessage {
  user: string;
  message: string;
  isDonate: boolean;
  color: string | null;
}

const STORAGE_KEY = 'dbd_chat';
const MAX_MESSAGES = 100;

let messages: ChatMessage[] = [];
const listeners = new Set<() => void>();

function load(): ChatMessage[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
}

export const chatStore = {
  get: () => messages,

  add: (msg: ChatMessage) => {
    messages.push(msg);
    if (messages.length > MAX_MESSAGES) messages.shift();
    save();
    listeners.forEach(fn => fn());
  },

  clear: () => {
    messages = [];
    save();
    listeners.forEach(fn => fn());
  },

  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  init: () => {
    messages = load();
  }
};

// Expose to vanilla JS
(window as any).chatStore = chatStore;
