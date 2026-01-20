import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionState } from '../types';

const DEFAULTS = {
  models: ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  botName: 'livepix',
};

interface SettingsState {
  apiKey: string | null;
  models: string[];
  botName: string;
  status: ConnectionState;
  statusText: string;
  chatHidden: boolean;
  isLLMEnabled: () => boolean;
  setApiKey: (key: string | null) => void;
  setModels: (models: string[]) => void;
  setBotName: (name: string) => void;
  setStatus: (status: ConnectionState, text: string) => void;
  setChatHidden: (hidden: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      apiKey: null,
      models: DEFAULTS.models,
      botName: DEFAULTS.botName,
      status: 'disconnected',
      statusText: 'Desconectado',
      chatHidden: true,
      isLLMEnabled: () => !!get().apiKey,
      setApiKey: (apiKey) => set({ apiKey: apiKey?.trim() || null }),
      setModels: (models) => set({ models }),
      setBotName: (botName) => set({ botName: botName.trim() || 'livepix' }),
      setStatus: (status, statusText) => set({ status, statusText }),
      setChatHidden: (chatHidden) => set({ chatHidden }),
    }),
    {
      name: 'dbd-settings',
      partialize: (state) => ({
        apiKey: state.apiKey,
        models: state.models,
        botName: state.botName,
        chatHidden: state.chatHidden,
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (str) return JSON.parse(str);

          // Migrate from legacy keys
          const legacyKeys = ['gemini_key', 'gemini_models', 'dbd_bot_name'];
          if (!legacyKeys.some(k => localStorage.getItem(k))) return null;

          console.log('Migrating legacy settings');
          const state = {
            apiKey: localStorage.getItem('gemini_key') || null,
            models: JSON.parse(localStorage.getItem('gemini_models') || 'null') || DEFAULTS.models,
            botName: localStorage.getItem('dbd_bot_name') || DEFAULTS.botName,
            chatHidden: true,
          };
          legacyKeys.forEach(k => localStorage.removeItem(k));
          return { state };
        },
        setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
