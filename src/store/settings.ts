import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

interface SettingsState {
  apiKey: string;
  models: string[];
  botName: string;
  minDonation: number;
  setApiKey: (key: string) => void;
  setModels: (models: string[]) => void;
  setBotName: (name: string) => void;
  setMinDonation: (min: number) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      models: DEFAULT_MODELS,
      botName: 'livepix',
      minDonation: 10,
      setApiKey: (apiKey) => set({ apiKey: apiKey.trim() }),
      setModels: (models) => set({ models }),
      setBotName: (botName) => set({ botName: botName.trim() || 'livepix' }),
      setMinDonation: (minDonation) => set({ minDonation }),
    }),
    { name: 'dbd-settings' }
  )
);
