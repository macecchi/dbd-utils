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
      onRehydrateStorage: () => () => {
        const oldChannel = localStorage.getItem('dbd_channel');
        const oldChatHidden = localStorage.getItem('dbd_chat_hidden');
        if (oldChannel || oldChatHidden) {
          localStorage.removeItem('dbd_channel');
          localStorage.removeItem('dbd_chat_hidden');
          useTwitch.setState({
            channel: oldChannel || '',
            chatHidden: oldChatHidden === 'true',
          });
        }
      },
    }
  )
);
