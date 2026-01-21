import { useSettings, useChannel } from '../store';

/**
 * Connection states:
 * - connected: fully operational
 * - connecting: establishing connection
 * - partial: PartyKit connected but IRC not synced to server yet
 * - disconnected: not connected
 * - error: connection failed
 */
export type ConnectionState = 'connected' | 'connecting' | 'partial' | 'disconnected' | 'error';

/** Queue only has binary state: open or closed */
export type QueueState = 'connected' | 'disconnected';

interface StatusInfo {
  connection: { state: ConnectionState; text: string };
  queue: { state: QueueState; text: string };
}

export function useConnectionStatus(): StatusInfo {
  const { status } = useSettings();
  const { isOwnChannel, useRequests, useSources } = useChannel();
  const partyConnected = useRequests((s) => s.partyConnected);
  const serverIrcConnected = useSources((s) => s.serverIrcConnected);
  const enabled = useSources((s) => s.enabled);

  // Connection (1st dot)
  let connection: { state: ConnectionState; text: string };
  if (isOwnChannel) {
    if (status === 'error') {
      connection = { state: 'error', text: 'Erro de conexão' };
    } else if (!partyConnected || status === 'connecting') {
      connection = { state: 'connecting', text: 'Conectando' };
    } else if (status === 'connected' && !serverIrcConnected) {
      connection = { state: 'partial', text: 'Aguardando servidor' };
    } else if (status === 'connected' && serverIrcConnected) {
      connection = { state: 'connected', text: 'Conectado' };
    } else {
      connection = { state: 'disconnected', text: 'Desconectado' };
    }
  } else {
    if (!partyConnected) {
      connection = { state: 'connecting', text: 'Conectando' };
    } else if (serverIrcConnected) {
      connection = { state: 'connected', text: 'Streamer online' };
    } else {
      connection = { state: 'disconnected', text: 'Streamer offline' };
    }
  }

  // Queue (2nd dot)
  const { manual, ...autoSources } = enabled;
  const takingRequests = serverIrcConnected && Object.values(autoSources).some(Boolean);
  const queue: { state: QueueState; text: string } = takingRequests
    ? { state: 'connected', text: 'Fila aberta' }
    : { state: 'disconnected', text: 'Fila fechada' };

  return { connection, queue };
}
