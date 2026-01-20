// apps/web/src/store/ChannelContext.tsx
import { createContext, useContext, useMemo, useEffect } from 'react';
import { createChannelStores, type ChannelStores } from './channel';
import { setActiveStores } from '../services/twitch';
import { connectParty, disconnectParty } from '../services/party';
import { useAuth } from './auth';

interface ChannelContextValue extends ChannelStores {
  channel: string;
  isOwnChannel: boolean;
}

const ChannelContext = createContext<ChannelContextValue | null>(null);

interface ChannelProviderProps {
  channel: string;
  children: React.ReactNode;
}

export function ChannelProvider({ channel, children }: ChannelProviderProps) {
  const stores = useMemo(() => createChannelStores(channel), [channel]);
  const { user, isAuthenticated, getAccessToken } = useAuth();
  const isOwnChannel = isAuthenticated && !!user && channel.toLowerCase() === user.login.toLowerCase();

  useEffect(() => {
    setActiveStores(stores);
    return () => setActiveStores(null);
  }, [stores]);

  // Connect to PartySocket
  useEffect(() => {
    const { setPartyConnected, setIsOwner, handlePartyMessage } = stores.useRequests.getState();
    setIsOwner(isOwnChannel);

    let cancelled = false;

    async function connect() {
      const token = await getAccessToken();
      if (cancelled) return;

      connectParty(
        channel,
        token,
        handlePartyMessage,
        () => setPartyConnected(true),
        () => setPartyConnected(false)
      );
    }

    connect();

    return () => {
      cancelled = true;
      disconnectParty();
      setPartyConnected(false);
    };
  }, [channel, isOwnChannel, stores, getAccessToken]);

  const value = useMemo(
    () => ({ channel, isOwnChannel, ...stores }),
    [channel, isOwnChannel, stores]
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
