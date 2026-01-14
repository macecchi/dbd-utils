import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionState } from '../types';

interface ConnectionStore {
  channel: string;
  minDonation: number;
  status: ConnectionState;
  statusText: string;
  chatHidden: boolean;
  setChannel: (channel: string) => void;
  setMinDonation: (min: number) => void;
  setStatus: (status: ConnectionState, text: string) => void;
  setChatHidden: (hidden: boolean) => void;
}

export const useConnection = create<ConnectionStore>()(
  persist(
    (set) => ({
      channel: '',
      minDonation: 10,
      status: 'disconnected',
      statusText: 'Desconectado',
      chatHidden: false,
      setChannel: (channel) => set({ channel }),
      setMinDonation: (minDonation) => set({ minDonation }),
      setStatus: (status, statusText) => set({ status, statusText }),
      setChatHidden: (chatHidden) => set({ chatHidden }),
    }),
    {
      name: 'dbd-connection',
      partialize: (state) => ({ channel: state.channel, minDonation: state.minDonation, chatHidden: state.chatHidden }),
      onRehydrateStorage: () => () => {
        // Migrate old keys
        const oldChannel = localStorage.getItem('dbd_channel');
        const oldMin = localStorage.getItem('dbd_min_donation');
        const oldChatHidden = localStorage.getItem('dbd_chat_hidden');
        if (oldChannel || oldChatHidden) {
          localStorage.removeItem('dbd_channel');
          localStorage.removeItem('dbd_min_donation');
          localStorage.removeItem('dbd_chat_hidden');
          useConnection.setState({
            channel: oldChannel || '',
            minDonation: parseFloat(oldMin || '10'),
            chatHidden: oldChatHidden === 'true',
          });
        }
      },
    }
  )
);
