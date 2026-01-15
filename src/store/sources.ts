import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SourcesEnabled } from '../types';

type SourceType = 'donation' | 'resub' | 'chat' | 'manual';

interface SourcesStore {
  enabled: SourcesEnabled;
  chatCommand: string;
  chatTiers: number[];
  priority: SourceType[];
  sessionRequests: Record<string, number>;
  setEnabled: (enabled: SourcesEnabled) => void;
  toggleSource: (source: keyof SourcesEnabled) => void;
  setChatCommand: (cmd: string) => void;
  setChatTiers: (tiers: number[]) => void;
  setPriority: (priority: SourceType[]) => void;
  hasSessionRequest: (user: string) => boolean;
  addSessionRequest: (user: string) => void;
  clearSessionRequests: () => void;
}

const DEFAULT_ENABLED: SourcesEnabled = { donation: true, resub: true, chat: true, manual: true };
const DEFAULT_PRIORITY: SourceType[] = ['donation', 'resub', 'chat', 'manual'];

export const useSources = create<SourcesStore>()(
  persist(
    (set, get) => ({
      enabled: DEFAULT_ENABLED,
      chatCommand: '!request',
      chatTiers: [1, 2, 3],
      priority: DEFAULT_PRIORITY,
      sessionRequests: {},
      setEnabled: (enabled) => set({ enabled }),
      toggleSource: (source) => set((s) => ({
        enabled: { ...s.enabled, [source]: !s.enabled[source] }
      })),
      setChatCommand: (chatCommand) => set({ chatCommand }),
      setChatTiers: (chatTiers) => set({ chatTiers }),
      setPriority: (priority) => set({ priority }),
      hasSessionRequest: (user) => get().sessionRequests[user] != null,
      addSessionRequest: (user) => set((s) => ({
        sessionRequests: { ...s.sessionRequests, [user]: Date.now() }
      })),
      clearSessionRequests: () => set({ sessionRequests: {} }),
    }),
    { name: 'dbd-sources' }
  )
);
