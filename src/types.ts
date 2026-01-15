export interface Character {
  name: string;
  aliases: string[];
  portrait?: string;
}

export interface CharacterData {
  survivors: Character[];
  killers: Character[];
}

export interface Request {
  id: number;
  timestamp: Date;
  donor: string;
  amount: string;
  amountVal: number;
  message: string;
  character: string;
  type: 'survivor' | 'killer' | 'unknown' | 'none';
  done?: boolean;
  source: 'donation' | 'resub' | 'chat' | 'manual';
  subTier?: number;
  needsIdentification?: boolean;
}

export type Donation = Request;

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
  undoHint?: string;
}

export interface SourcesEnabled {
  donation: boolean;
  resub: boolean;
  chat: boolean;
  manual: boolean;
}

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';
