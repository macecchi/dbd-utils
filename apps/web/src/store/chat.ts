import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '../types';

const MAX_CHAT = 100;

interface ChatStore {
  messages: ChatMessage[];
  add: (msg: ChatMessage) => void;
  clear: () => void;
  setAll: (messages: ChatMessage[]) => void;
}

export const useChat = create<ChatStore>()(
  persist(
    (set) => ({
      messages: [],
      add: (msg) => set((s) => ({
        messages: [...s.messages.slice(-(MAX_CHAT - 1)), msg],
      })),
      clear: () => set({ messages: [] }),
      setAll: (messages) => set({ messages }),
    }),
    { name: 'dbd-chat' }
  )
);
