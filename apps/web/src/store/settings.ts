import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  chatHidden: boolean;
  setChatHidden: (hidden: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      chatHidden: true,
      setChatHidden: (chatHidden) => set({ chatHidden }),
    }),
    {
      name: 'dbd-settings',
    }
  )
);
