export interface Donation {
  id: number;
  timestamp: Date | string;
  donor: string;
  amount: string;
  amountVal: number;
  message: string;
  character: string;
  type: 'survivor' | 'killer' | 'unknown' | 'skipped' | 'none';
  belowThreshold: boolean;
  done?: boolean;
  source: 'donation' | 'resub' | 'chat' | 'manual';
  subTier?: number;
}

const STORAGE_KEY = 'dbd_donations';

let donations: Donation[] = [];
const listeners = new Set<() => void>();

function load(): Donation[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    return JSON.parse(saved).map((d: any) => ({
      ...d,
      timestamp: new Date(d.timestamp),
      source: d.source || 'donation'
    }));
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(donations));
}

function notify() {
  listeners.forEach(fn => fn());
}

export const donationStore = {
  get: () => donations,

  set: (newDonations: Donation[]) => {
    donations = newDonations;
    save();
    notify();
  },

  add: (donation: Donation) => {
    donations.push(donation);
    save();
    notify();
  },

  update: (id: number, updates: Partial<Donation>) => {
    const idx = donations.findIndex(d => d.id === id);
    if (idx !== -1) {
      donations[idx] = { ...donations[idx], ...updates };
      save();
      notify();
    }
  },

  remove: (id: number) => {
    donations = donations.filter(d => d.id !== id);
    save();
    notify();
  },

  clear: () => {
    donations = [];
    save();
    notify();
  },

  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  init: () => {
    donations = load();
  }
};

(window as any).donationStore = donationStore;
