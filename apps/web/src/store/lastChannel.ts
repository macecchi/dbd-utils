import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LastChannelState {
  lastChannel: string;
  setLastChannel: (channel: string) => void;
}

export const useLastChannel = create<LastChannelState>()(
  persist(
    (set) => ({
      lastChannel: '',
      setLastChannel: (lastChannel) => set({ lastChannel }),
    }),
    { name: 'dbd-last-channel' }
  )
);
