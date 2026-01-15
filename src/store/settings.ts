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

// Migrate from old localStorage keys
function migrateOldSettings(): Partial<SettingsState> {
  const apiKey = localStorage.getItem('gemini_key') || '';
  const models = JSON.parse(localStorage.getItem('gemini_models') || 'null') || DEFAULT_MODELS;
  const botName = localStorage.getItem('dbd_bot_name') || 'livepix';
  const minDonation = parseFloat(localStorage.getItem('dbd_min_donation') || '10');
  localStorage.removeItem('gemini_key');
  localStorage.removeItem('gemini_models');
  localStorage.removeItem('dbd_bot_name');
  localStorage.removeItem('dbd_min_donation');
  return { apiKey, models, botName, minDonation };
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
    {
      name: 'dbd-settings',
      onRehydrateStorage: () => (state) => {
        if (state && !state.apiKey && localStorage.getItem('gemini_key')) {
          const migrated = migrateOldSettings();
          state.setApiKey(migrated.apiKey || '');
          state.setModels(migrated.models || DEFAULT_MODELS);
          state.setBotName(migrated.botName || 'livepix');
          state.setMinDonation(migrated.minDonation || 10);
        }
      },
    }
  )
);
