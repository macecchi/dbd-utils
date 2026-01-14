import { createStore } from './createStore';

const DEFAULT_MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

export interface Settings {
  apiKey: string;
  models: string[];
  botName: string;
}

const baseStore = createStore<Settings>({
  key: 'dbd_settings',
  defaultValue: {
    apiKey: '',
    models: DEFAULT_MODELS,
    botName: 'livepix'
  },
  load: () => ({
    apiKey: localStorage.getItem('gemini_key') || '',
    models: JSON.parse(localStorage.getItem('gemini_models') || 'null') || DEFAULT_MODELS,
    botName: localStorage.getItem('dbd_bot_name') || 'livepix'
  }),
  save: (settings) => {
    if (settings.apiKey) {
      localStorage.setItem('gemini_key', settings.apiKey);
    } else {
      localStorage.removeItem('gemini_key');
    }
    localStorage.setItem('gemini_models', JSON.stringify(settings.models));
    localStorage.setItem('dbd_bot_name', settings.botName);
    return JSON.stringify(settings);
  }
});

export const settingsStore = {
  ...baseStore,

  setApiKey: (key: string) => {
    baseStore.set({ ...baseStore.get(), apiKey: key });
  },

  setModels: (models: string[]) => {
    baseStore.set({ ...baseStore.get(), models: models.length ? models : DEFAULT_MODELS });
  },

  setBotName: (name: string) => {
    baseStore.set({ ...baseStore.get(), botName: name || 'livepix' });
  }
};
