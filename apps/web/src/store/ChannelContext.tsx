// apps/web/src/store/ChannelContext.tsx
import { createContext, useContext, useMemo, useEffect } from 'react';
import { createChannelStores, type ChannelStores } from './channel';
import { setActiveStores } from '../services/twitch';

interface ChannelContextValue extends ChannelStores {
  channel: string;
}

const ChannelContext = createContext<ChannelContextValue | null>(null);

interface ChannelProviderProps {
  channel: string;
  children: React.ReactNode;
}

export function ChannelProvider({ channel, children }: ChannelProviderProps) {
  const stores = useMemo(() => createChannelStores(channel), [channel]);

  useEffect(() => {
    setActiveStores(stores);
    return () => setActiveStores(null);
  }, [stores]);

  const value = useMemo(
    () => ({ channel, ...stores }),
    [channel, stores]
  );

  return (
    <ChannelContext.Provider value={value}>
      {children}
    </ChannelContext.Provider>
  );
}

export function useChannel(): ChannelContextValue {
  const ctx = useContext(ChannelContext);
  if (!ctx) throw new Error('useChannel must be used inside ChannelProvider');
  return ctx;
}
