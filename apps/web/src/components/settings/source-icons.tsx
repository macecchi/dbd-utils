import type { ReactNode } from 'react';
import type { SourceType as AllSourceTypes } from '../../store/channel';

export type SourceType = Exclude<AllSourceTypes, 'manual'>;

export const SOURCE_LABEL_KEYS: Record<SourceType, 'sources.donation' | 'sources.resub' | 'sources.chat'> = {
  donation: 'sources.donation',
  resub: 'sources.resub',
  chat: 'sources.chat',
};

export const SOURCE_ICONS: Record<SourceType, ReactNode> = {
  donation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  resub: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
};
