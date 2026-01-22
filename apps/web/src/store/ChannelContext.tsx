// apps/web/src/store/ChannelContext.tsx
import { createContext, useContext, useMemo, useEffect } from 'react';
import { createRoomStores, type ChannelStores } from './channel';
import { setActiveStores, connect as connectIrc, disconnect as disconnectIrc } from '../services/twitch';
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
  const { user, isAuthenticated, getAccessToken } = useAuth();
  const isOwnChannel = isAuthenticated && !!user && channel.toLowerCase() === user.login.toLowerCase();
  const stores = useMemo(() => createRoomStores(channel), [channel]);

  useEffect(() => {
    setActiveStores(stores);
    return () => setActiveStores(null);
  }, [stores]);

  // Connect to Twitch IRC (only for owners)
  useEffect(() => {
    if (isOwnChannel) {
      connectIrc(channel);
      return () => disconnectIrc();
    }
  }, [channel, isOwnChannel]);

  // Connect to PartySocket
  useEffect(() => {
    const { setIsOwner, setPartyConnected, handlePartyMessage: handleRequestsMessage } = stores.useRequests.getState();
    const { handlePartyMessage: handleSourcesMessage } = stores.useSources.getState();
    const { handlePartyMessage: handleChannelInfoMessage, setPartyConnectionState } = stores.useChannelInfo.getState();
    setIsOwner(isOwnChannel);

    let cancelled = false;

    async function connect() {
      const token = await getAccessToken();
      if (cancelled) return;

      console.log('Connecting to PartyKit...');
      setPartyConnectionState('connecting');
      connectParty(
        channel,
        token,
        (msg) => {
          handleRequestsMessage(msg);
          handleSourcesMessage(msg);
          handleChannelInfoMessage(msg);
        },
        () => {
          console.log('Connected to PartyKit');
          setPartyConnectionState('connected');
          setPartyConnected(true);
        },
        () => {
          console.log('Disconnected from PartyKit');
          setPartyConnectionState('disconnected');
          setPartyConnected(false);
        },
        () => {
          console.log('Error connecting to PartyKit');
          setPartyConnectionState('error');
          setPartyConnected(false);
        }
      );
    }

    connect();

    return () => {
      cancelled = true;
      disconnectParty();
      setPartyConnectionState('disconnected');
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
