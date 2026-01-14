import { useSyncExternalStore } from 'react';
import { chatStore } from '../store/chat';

export function useChat() {
  return useSyncExternalStore(chatStore.subscribe, chatStore.get);
}
