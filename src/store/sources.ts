import { createStore } from './createStore';

export type SourceType = 'donation' | 'resub' | 'chat' | 'manual';

export interface SourcesEnabled {
  donation: boolean;
  resub: boolean;
  chat: boolean;
  manual: boolean;
}

export interface SourcesState {
  enabled: SourcesEnabled;
  chatCommand: string;
  chatTiers: number[];
  priority: SourceType[];
  sessionRequests: Record<string, number>;
}

const STORAGE_KEYS = {
  enabled: 'dbd_sources_enabled',
  chatCommand: 'dbd_chat_command',
  chatTiers: 'dbd_chat_tiers',
  priority: 'dbd_source_priority',
  session: 'dbd_session_requests'
};

const DEFAULTS: SourcesState = {
  enabled: { donation: true, resub: true, chat: true, manual: true },
  chatCommand: '!request',
  chatTiers: [1, 2, 3],
  priority: ['donation', 'resub', 'chat', 'manual'],
  sessionRequests: {}
};

const baseStore = createStore<SourcesState>({
  key: 'dbd_sources',
  defaultValue: DEFAULTS,
  load: () => {
    try {
      const enabled = localStorage.getItem(STORAGE_KEYS.enabled);
      const chatCommand = localStorage.getItem(STORAGE_KEYS.chatCommand);
      const chatTiers = localStorage.getItem(STORAGE_KEYS.chatTiers);
      const priority = localStorage.getItem(STORAGE_KEYS.priority);
      const session = localStorage.getItem(STORAGE_KEYS.session);

      return {
        enabled: enabled ? JSON.parse(enabled) : { ...DEFAULTS.enabled },
        chatCommand: chatCommand || DEFAULTS.chatCommand,
        chatTiers: chatTiers ? JSON.parse(chatTiers) : [...DEFAULTS.chatTiers],
        priority: priority ? JSON.parse(priority) : [...DEFAULTS.priority],
        sessionRequests: session ? JSON.parse(session) : {}
      };
    } catch {
      return { ...DEFAULTS };
    }
  },
  save: (state) => {
    localStorage.setItem(STORAGE_KEYS.enabled, JSON.stringify(state.enabled));
    localStorage.setItem(STORAGE_KEYS.chatCommand, state.chatCommand);
    localStorage.setItem(STORAGE_KEYS.chatTiers, JSON.stringify(state.chatTiers));
    localStorage.setItem(STORAGE_KEYS.priority, JSON.stringify(state.priority));
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(state.sessionRequests));
    return JSON.stringify(state);
  }
});

export const sourcesStore = {
  ...baseStore,

  getEnabled: () => baseStore.get().enabled,
  getChatCommand: () => baseStore.get().chatCommand,
  getChatTiers: () => baseStore.get().chatTiers,
  getPriority: () => baseStore.get().priority,

  setEnabled: (source: SourceType, value: boolean) => {
    const state = baseStore.get();
    baseStore.set({ ...state, enabled: { ...state.enabled, [source]: value } });
  },

  setChatCommand: (cmd: string) => {
    baseStore.set({ ...baseStore.get(), chatCommand: cmd || DEFAULTS.chatCommand });
  },

  setChatTiers: (tiers: number[]) => {
    baseStore.set({ ...baseStore.get(), chatTiers: tiers });
  },

  setPriority: (priority: SourceType[]) => {
    baseStore.set({ ...baseStore.get(), priority });
  },

  hasSessionRequest: (username: string) => !!baseStore.get().sessionRequests[username],

  addSessionRequest: (username: string) => {
    const state = baseStore.get();
    baseStore.set({
      ...state,
      sessionRequests: { ...state.sessionRequests, [username]: Date.now() }
    });
  },

  resetSession: () => {
    baseStore.set({ ...baseStore.get(), sessionRequests: {} });
  }
};
