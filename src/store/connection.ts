import { createStore } from './createStore';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  statusText: string;
  channel: string;
  minDonation: number;
}

const KEYS = {
  channel: 'dbd_channel',
  minDonation: 'dbd_min_donation',
};

const baseStore = createStore<ConnectionState>({
  key: 'dbd_connection',
  defaultValue: {
    status: 'disconnected',
    statusText: 'Desconectado',
    channel: '',
    minDonation: 10,
  },
  load: () => ({
    status: 'disconnected' as ConnectionStatus,
    statusText: 'Desconectado',
    channel: localStorage.getItem(KEYS.channel) || '',
    minDonation: parseFloat(localStorage.getItem(KEYS.minDonation) || '10'),
  }),
  save: (state) => {
    localStorage.setItem(KEYS.channel, state.channel);
    localStorage.setItem(KEYS.minDonation, state.minDonation.toString());
    return JSON.stringify(state);
  }
});

export const connectionStore = {
  ...baseStore,
  getSnapshot: () => baseStore.get(),

  setStatus: (status: ConnectionStatus, statusText: string) => {
    const current = baseStore.get();
    baseStore.set({ ...current, status, statusText });
  },

  setChannel: (channel: string) => {
    baseStore.set({ ...baseStore.get(), channel });
  },

  setMinDonation: (val: number) => {
    baseStore.set({ ...baseStore.get(), minDonation: val });
  }
};
