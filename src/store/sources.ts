import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SourcesEnabled } from '../types';

type SourceType = 'donation' | 'resub' | 'chat' | 'manual';
type SortMode = 'priority' | 'fifo';

interface SourcesStore {
  enabled: SourcesEnabled;
  chatCommand: string;
  chatTiers: number[];
  priority: SourceType[];
  sortMode: SortMode;
  setEnabled: (enabled: SourcesEnabled) => void;
  toggleSource: (source: keyof SourcesEnabled) => void;
  setChatCommand: (cmd: string) => void;
  setChatTiers: (tiers: number[]) => void;
  setPriority: (priority: SourceType[]) => void;
  setSortMode: (mode: SortMode) => void;
}

const DEFAULTS = {
  sources: {
    donation: true,
    chat: true,
    resub: false,
    manual: true,
  },
  chatCommand: '!request',
  chatTiers: [2, 3],
  priority: ['donation', 'chat', 'resub', 'manual'] as SourceType[],
  sortMode: 'fifo' as SortMode,
};

export const useSources = create<SourcesStore>()(
  persist(
    (set) => ({
      enabled: DEFAULTS.sources,
      chatCommand: DEFAULTS.chatCommand,
      chatTiers: DEFAULTS.chatTiers,
      priority: DEFAULTS.priority,
      sortMode: DEFAULTS.sortMode,
      setEnabled: (enabled) => set({ enabled }),
      toggleSource: (source) => set((s) => ({
        enabled: { ...s.enabled, [source]: !s.enabled[source] }
      })),
      setChatCommand: (chatCommand) => set({ chatCommand }),
      setChatTiers: (chatTiers) => set({ chatTiers }),
      setPriority: (priority) => set({ priority }),
      setSortMode: (sortMode) => set({ sortMode }),
    }),
    { name: 'dbd-sources' }
  )
);
