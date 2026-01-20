import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionState } from '../types';

interface SettingsState {
  botName: string;
  status: ConnectionState;
  statusText: string;
  chatHidden: boolean;
  setBotName: (name: string) => void;
  setStatus: (status: ConnectionState, text: string) => void;
  setChatHidden: (hidden: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      botName: 'livepix',
      status: 'disconnected',
      statusText: 'Desconectado',
      chatHidden: true,
      setBotName: (botName) => set({ botName: botName.trim() || 'livepix' }),
      setStatus: (status, statusText) => set({ status, statusText }),
      setChatHidden: (chatHidden) => set({ chatHidden }),
    }),
    {
      name: 'dbd-settings',
      partialize: (state) => ({
        botName: state.botName,
        chatHidden: state.chatHidden,
      }),
    }
  )
);
