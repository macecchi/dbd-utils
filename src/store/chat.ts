import { createStore } from './createStore';

export interface ChatMessage {
  user: string;
  message: string;
  isDonate: boolean;
  color: string | null;
}

const MAX_MESSAGES = 100;

const baseStore = createStore<ChatMessage[]>({
  key: 'dbd_chat',
  defaultValue: [],
  save: (msgs) => JSON.stringify(msgs.slice(-MAX_MESSAGES))
});

export const chatStore = {
  ...baseStore,

  add: (msg: ChatMessage) => {
    const msgs = baseStore.get();
    const updated = [...msgs, msg];
    if (updated.length > MAX_MESSAGES) updated.shift();
    baseStore.set(updated);
  },

  clear: () => {
    baseStore.set([]);
  }
};
