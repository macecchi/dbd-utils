// apps/web/src/store/ChannelContext.tsx
import { createContext, useContext, useMemo, useEffect, useRef } from 'react';
import { createRoomStores, type ChannelStores } from './channel';
import { setActiveStores, connect as connectIrc, disconnect as disconnectIrc } from '../services/twitch';
import { connectParty, disconnectParty, broadcastIrcStatus, claimOwnership } from '../services/party';
import { useAuth } from './auth';
import { useToasts } from './toasts';

function sendPushNotification(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, tag: 'dbd-disconnect' });
  } else {
    console.log(`[push] permission=${Notification.permission}, skipped: ${title}`);
  }
}

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
  const isOwnChannel = (import.meta.env.DEV && isAuthenticated && !!user) || (isAuthenticated && !!user && channel.toLowerCase() === user.login.toLowerCase());
  const stores = useMemo(() => createRoomStores(channel), [channel]);

  useEffect(() => {
    setActiveStores(stores);
    return () => setActiveStores(null);
  }, [stores]);

  // Subscribe to ownership state
  const isOwner = stores.useChannelInfo((s) => s.isOwner);
  const owner = stores.useChannelInfo((s) => s.owner);
  const localIrcState = stores.useChannelInfo((s) => s.localIrcConnectionState);
  const partyConnected = stores.useChannelInfo((s) => s.localPartyConnectionState) === 'connected';
  const showToast = useToasts((s) => s.show);

  // Derive: someone else is managing (we're room owner but don't have the lock)
  const someoneElseIsOwner = isOwnChannel && !isOwner && owner !== null;

  // Auto-claim ownership once on initial connect if no one owns the channel
  const hasTriedAutoClaim = useRef(false);
  useEffect(() => {
    if (isOwnChannel && partyConnected && !hasTriedAutoClaim.current) {
      hasTriedAutoClaim.current = true;
      if (!owner && !isOwner) {
        claimOwnership();
      }
    }
  }, [isOwnChannel, partyConnected, owner, isOwner]);

  // Auto-connect to IRC once when ownership is first granted
  const hasAutoConnectedIrc = useRef(false);
  useEffect(() => {
    if (isOwner && !hasAutoConnectedIrc.current) {
      hasAutoConnectedIrc.current = true;
      if (localIrcState === 'disconnected') {
        connectIrc(channel);
      }
    }
    // Reset when ownership is lost so next grant auto-connects again
    if (!isOwner) {
      hasAutoConnectedIrc.current = false;
    }
  }, [isOwner, localIrcState, channel]);

  // Cleanup IRC when we lose ownership
  useEffect(() => {
    if (someoneElseIsOwner) {
      disconnectIrc();
    }
    return () => disconnectIrc();
  }, [someoneElseIsOwner]);

  // Show toast when someone else takes ownership
  const prevSomeoneElseIsOwner = useRef(false);
  useEffect(() => {
    if (someoneElseIsOwner && !prevSomeoneElseIsOwner.current) {
      showToast(
        'Outra aba já está gerenciando este canal. Esta aba está em modo somente leitura.',
        'Canal já aberto',
        '#f59e0b',
        10000
      );
    }
    prevSomeoneElseIsOwner.current = someoneElseIsOwner;
  }, [someoneElseIsOwner, showToast]);

  // Request notification permission + show toast if denied (reactive to permission changes)
  const notifToastId = useRef<number | null>(null);
  useEffect(() => {
    if (!isOwnChannel || !('Notification' in window)) return;

    const { add, remove } = useToasts.getState();

    const handlePermission = (state: string) => {
      if (state === 'default') {
        Notification.requestPermission();
      } else if (state === 'denied') {
        if (notifToastId.current === null) {
          notifToastId.current = add({
            message: 'Ative as notificações do navegador para ser alertado se a conexão cair.',
            title: 'Notificações bloqueadas',
            color: '#f59e0b',
            duration: 0,
            type: 'default',
          });
        }
      } else if (state === 'granted' && notifToastId.current !== null) {
        remove(notifToastId.current);
        notifToastId.current = null;
      }
    };

    handlePermission(Notification.permission);

    let permStatus: PermissionStatus | null = null;
    const onChange = () => {
      if (permStatus) handlePermission(permStatus.state);
    };

    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' }).then((status) => {
        permStatus = status;
        status.addEventListener('change', onChange);
      });
    }

    return () => {
      permStatus?.removeEventListener('change', onChange);
      if (notifToastId.current !== null) {
        remove(notifToastId.current);
        notifToastId.current = null;
      }
    };
  }, [isOwnChannel]);

  // Toast + push notification on disconnect (only for channel owner)
  const prevIrcState = useRef(localIrcState);
  const prevPartyState = useRef(partyConnected);
  const ircEverConnected = useRef(false);
  const partyEverConnected = useRef(false);
  const partyPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PARTY_PUSH_DELAY = 30_000; // only push after 30s disconnected

  useEffect(() => {
    if (!isOwnChannel) {
      prevIrcState.current = localIrcState;
      prevPartyState.current = partyConnected;
      return;
    }

    const wasIrcConnected = prevIrcState.current === 'connected';

    // IRC: connected → connecting (auto-reconnecting)
    if (wasIrcConnected && localIrcState === 'connecting') {
      showToast('Conexão com o chat caiu. Reconectando...', 'Twitch IRC', '#f59e0b');
    }

    // IRC: connected/connecting → error (retries exhausted)
    if (wasIrcConnected && localIrcState === 'error') {
      showToast('Conexão com o chat perdida. Reconecte manualmente.', 'Twitch IRC', '#ef4444', 0);
      sendPushNotification(
        'Fila DBD - Conexão perdida',
        'Conexão com o chat da Twitch caiu. Reconecte para continuar recebendo pedidos.',
      );
    }

    // IRC: reconnected successfully (not initial connect)
    if (prevIrcState.current === 'connecting' && localIrcState === 'connected' && ircEverConnected.current) {
      showToast('Reconectado ao chat.', 'Twitch IRC', '#22c55e');
    }
    if (localIrcState === 'connected') ircEverConnected.current = true;

    // PartyKit: disconnected — toast immediately, push after delay
    if (prevPartyState.current && !partyConnected) {
      showToast('Conexão com o servidor caiu. Reconectando...', 'Servidor', '#f59e0b');
      if (!partyPushTimer.current) {
        partyPushTimer.current = setTimeout(() => {
          partyPushTimer.current = null;
          sendPushNotification(
            'Fila DBD - Conexão perdida',
            'Conexão com o servidor caiu. Tentando reconectar...',
          );
        }, PARTY_PUSH_DELAY);
      }
    }

    // PartyKit: reconnected — cancel pending push, show toast (not initial connect)
    if (!prevPartyState.current && partyConnected) {
      if (partyPushTimer.current) {
        clearTimeout(partyPushTimer.current);
        partyPushTimer.current = null;
      }
      if (partyEverConnected.current) {
        showToast('Reconectado ao servidor.', 'Servidor', '#22c55e');
      }
    }
    if (partyConnected) partyEverConnected.current = true;

    prevIrcState.current = localIrcState;
    prevPartyState.current = partyConnected;
  }, [localIrcState, partyConnected, isOwnChannel, showToast]);

  // Cleanup party push timer on unmount
  useEffect(() => {
    return () => {
      if (partyPushTimer.current) {
        clearTimeout(partyPushTimer.current);
        partyPushTimer.current = null;
      }
    };
  }, []);

  // Connect to PartySocket
  useEffect(() => {
    const { handlePartyMessage: handleRequestsMessage } = stores.useRequests.getState();
    const { handlePartyMessage: handleSourcesMessage } = stores.useSources.getState();
    const { handlePartyMessage: handleChannelInfoMessage, setPartyConnectionState } = stores.useChannelInfo.getState();

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

  // canManageChannel: we're on our own channel and either have ownership or can claim it
  const canManageChannel = isOwnChannel && !someoneElseIsOwner;

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
