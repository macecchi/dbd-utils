import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionState } from '../types';

const DEFAULT_MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

interface SettingsState {
  apiKey: string;
  models: string[];
  botName: string;
  minDonation: number;
  channel: string;
  status: ConnectionState;
  statusText: string;
  chatHidden: boolean;
  setApiKey: (key: string) => void;
  setModels: (models: string[]) => void;
  setBotName: (name: string) => void;
  setMinDonation: (min: number) => void;
  setChannel: (channel: string) => void;
  setStatus: (status: ConnectionState, text: string) => void;
  setChatHidden: (hidden: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      models: DEFAULT_MODELS,
      botName: 'livepix',
      minDonation: 10,
      channel: 'mandymess',
      status: 'disconnected',
      statusText: 'Desconectado',
      chatHidden: true,
      setApiKey: (apiKey) => set({ apiKey: apiKey.trim() }),
      setModels: (models) => set({ models }),
      setBotName: (botName) => set({ botName: botName.trim() || 'livepix' }),
      setMinDonation: (minDonation) => set({ minDonation }),
      setChannel: (channel) => set({ channel }),
      setStatus: (status, statusText) => set({ status, statusText }),
      setChatHidden: (chatHidden) => set({ chatHidden }),
    }),
    {
      name: 'dbd-settings',
      partialize: (state) => ({
        apiKey: state.apiKey,
        models: state.models,
        botName: state.botName,
        minDonation: state.minDonation,
        channel: state.channel,
        chatHidden: state.chatHidden,
      }),
    }
  )
);
