export type {
  Character,
  CharacterData,
  Request,
  CharacterRequest,
  SourcesEnabled,
  ConnectionState,
  SerializedRequest,
  SourcesSettings,
  ChannelStatus,
  ChannelState,
  PartyMessage,
} from '@dbd-utils/shared';

export {
  serializeRequest,
  deserializeRequest,
  deserializeRequests,
} from '@dbd-utils/shared';

export interface ChatMessage {
  user: string;
  message: string;
  isDonate: boolean;
  color: string | null;
}

export interface Toast {
  id: number;
  message: string;
  title?: string;
  color?: string;
  duration: number;
  type: 'default' | 'info' | 'undo';
  undoCallback?: () => void;
}
