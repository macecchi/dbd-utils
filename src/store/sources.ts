import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SourcesEnabled } from '../types';

type SourceType = 'donation' | 'resub' | 'chat' | 'manual';

interface SourcesStore {
  enabled: SourcesEnabled;
  chatCommand: string;
  chatTiers: number[];
  priority: SourceType[];
  setEnabled: (enabled: SourcesEnabled) => void;
  toggleSource: (source: keyof SourcesEnabled) => void;
  setChatCommand: (cmd: string) => void;
  setChatTiers: (tiers: number[]) => void;
  setPriority: (priority: SourceType[]) => void;
}

const DEFAULT_ENABLED: SourcesEnabled = { donation: true, resub: false, chat: false, manual: true };
const DEFAULT_PRIORITY: SourceType[] = ['donation', 'chat', 'resub', 'manual'];

export const useSources = create<SourcesStore>()(
  persist(
    (set) => ({
      enabled: DEFAULT_ENABLED,
      chatCommand: '!request',
      chatTiers: [1, 2, 3],
      priority: DEFAULT_PRIORITY,
      setEnabled: (enabled) => set({ enabled }),
      toggleSource: (source) => set((s) => ({
        enabled: { ...s.enabled, [source]: !s.enabled[source] }
      })),
      setChatCommand: (chatCommand) => set({ chatCommand }),
      setChatTiers: (chatTiers) => set({ chatTiers }),
      setPriority: (priority) => set({ priority }),
    }),
    { name: 'dbd-sources' }
  )
);
