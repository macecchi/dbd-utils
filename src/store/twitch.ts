import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionState } from '../types';

interface TwitchStore {
  channel: string;
  status: ConnectionState;
  statusText: string;
  chatHidden: boolean;
  setChannel: (channel: string) => void;
  setStatus: (status: ConnectionState, text: string) => void;
  setChatHidden: (hidden: boolean) => void;
}

export const useTwitch = create<TwitchStore>()(
  persist(
    (set) => ({
      channel: '',
      status: 'disconnected',
      statusText: 'Desconectado',
      chatHidden: false,
      setChannel: (channel) => set({ channel }),
      setStatus: (status, statusText) => set({ status, statusText }),
      setChatHidden: (chatHidden) => set({ chatHidden }),
    }),
    {
      name: 'dbd-twitch',
      partialize: (state) => ({ channel: state.channel, chatHidden: state.chatHidden }),
    }
  )
);
