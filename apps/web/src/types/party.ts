import type { Request, SourcesEnabled } from '../types';

export interface SourcesSettings {
  enabled: SourcesEnabled;
  chatCommand: string;
  chatTiers: number[];
  priority: ('donation' | 'resub' | 'chat' | 'manual')[];
  sortMode: 'priority' | 'fifo';
  minDonation: number;
  ircConnected: boolean;
}

export interface SerializedRequest {
  id: number;
  timestamp: string;
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
  validating?: boolean;
  toastShown?: boolean;
}

export type PartyMessage =
  | { type: 'sync-full'; requests: SerializedRequest[]; sources: SourcesSettings }
  | { type: 'add-request'; request: SerializedRequest }
  | { type: 'update-request'; id: number; updates: Partial<SerializedRequest> }
  | { type: 'toggle-done'; id: number }
  | { type: 'reorder'; fromId: number; toId: number }
  | { type: 'delete-request'; id: number }
  | { type: 'set-all'; requests: SerializedRequest[] }
  | { type: 'update-sources'; sources: SourcesSettings };

export function serializeRequest(req: Request): SerializedRequest {
  return {
    ...req,
    timestamp: req.timestamp.toISOString(),
  };
}

export function deserializeRequest(req: SerializedRequest): Request {
  return {
    ...req,
    timestamp: new Date(req.timestamp),
  };
}

export function deserializeRequests(requests: SerializedRequest[]): Request[] {
  return requests.map(deserializeRequest);
}
