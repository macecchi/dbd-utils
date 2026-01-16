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
  minDonation: number;
  setEnabled: (enabled: SourcesEnabled) => void;
  toggleSource: (source: keyof SourcesEnabled) => void;
  setChatCommand: (cmd: string) => void;
  setChatTiers: (tiers: number[]) => void;
  setPriority: (priority: SourceType[]) => void;
  setSortMode: (mode: SortMode) => void;
  setMinDonation: (min: number) => void;
}

export const DEFAULTS = {
  sources: {
    donation: true,
    chat: true,
    resub: false,
    manual: true,
  },
  chatCommand: '!fila',
  chatTiers: [2, 3],
  priority: ['donation', 'chat', 'resub', 'manual'] as SourceType[],
  sortMode: 'fifo' as SortMode,
  minDonation: 5,
};

export const useSources = create<SourcesStore>()(
  persist(
    (set) => ({
      enabled: DEFAULTS.sources,
      chatCommand: DEFAULTS.chatCommand,
      chatTiers: DEFAULTS.chatTiers,
      priority: DEFAULTS.priority,
      sortMode: DEFAULTS.sortMode,
      minDonation: DEFAULTS.minDonation,
      setEnabled: (enabled) => set({ enabled }),
      toggleSource: (source) => set((s) => ({
        enabled: { ...s.enabled, [source]: !s.enabled[source] }
      })),
      setChatCommand: (chatCommand) => set({ chatCommand }),
      setChatTiers: (chatTiers) => set({ chatTiers }),
      setPriority: (priority) => set({ priority }),
      setSortMode: (sortMode) => set({ sortMode }),
      setMinDonation: (minDonation) => set({ minDonation }),
    }),
    {
      name: 'dbd-sources',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (str) return JSON.parse(str);

          // Migrate from legacy key
          const legacyMin = localStorage.getItem('dbd_min_donation');
          if (!legacyMin) return null;

          console.log('Migrating legacy minDonation to sources');
          localStorage.removeItem('dbd_min_donation');
          return { state: { minDonation: parseFloat(legacyMin) } };
        },
        setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);

