// apps/web/src/store/ChannelContext.tsx
import { createContext, useContext, useMemo, useEffect } from 'react';
import { createRoomStores, type ChannelStores } from './channel';
import { setActiveStores, connect as connectIrc, disconnect as disconnectIrc } from '../services/twitch';
import { connectParty, disconnectParty, broadcastIrcStatus } from '../services/party';
import { useAuth } from './auth';
import { useToasts } from './toasts';

interface ChannelContextValue extends ChannelStores {
  channel: string;
  isOwnChannel: boolean;
  canManageChannel: boolean;
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

  // Subscribe to owner conflict state
  const ownerConflict = stores.useChannelInfo((s) => s.ownerConflict);
  const showToast = useToasts((s) => s.show);

  // Connect to Twitch IRC (only for owners without conflict)
  useEffect(() => {
    if (isOwnChannel && !ownerConflict) {
      connectIrc(channel);
      return () => disconnectIrc();
    }
  }, [channel, isOwnChannel, ownerConflict]);

  // Show toast when owner conflict is detected
  useEffect(() => {
    if (ownerConflict) {
      disconnectIrc();
      showToast(
        'Outra aba já está gerenciando este canal. Esta aba está em modo somente leitura.',
        'Canal já aberto',
        '#f59e0b',
        10000
      );
    }
  }, [ownerConflict, showToast]);

  // Connect to PartySocket
  useEffect(() => {
    const { handlePartyMessage: handleRequestsMessage } = stores.useRequests.getState();
    const { handlePartyMessage: handleSourcesMessage } = stores.useSources.getState();
    const { handlePartyMessage: handleChannelInfoMessage, setPartyConnectionState, setIsOwner } = stores.useChannelInfo.getState();
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
          // Re-send IRC status in case IRC connected before PartySocket
          const { localIrcConnectionState, isOwner } = stores.useChannelInfo.getState();
          if (isOwner && localIrcConnectionState === 'connected') {
            broadcastIrcStatus(true);
          }
        },
        () => {
          console.log('Disconnected from PartyKit');
          setPartyConnectionState('disconnected');
        },
        () => {
          console.log('Error connecting to PartyKit');
          setPartyConnectionState('error');
        }
      );
    }

    connect();

    return () => {
      cancelled = true;
      disconnectParty();
      setPartyConnectionState('disconnected');
    };
  }, [channel, isOwnChannel, stores, getAccessToken]);

  // canManageChannel is true when user owns the channel AND no other tab is managing it
  const canManageChannel = isOwnChannel && !ownerConflict;

  const value = useMemo(
    () => ({ channel, isOwnChannel, canManageChannel, ...stores }),
    [channel, isOwnChannel, canManageChannel, stores]
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
