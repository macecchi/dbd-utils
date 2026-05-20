import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
}

export const useSettings = create<SettingsState>()(
  persist(
    (_set) => ({
    }),
    {
      name: 'dbd-settings',
    }
  )
);
