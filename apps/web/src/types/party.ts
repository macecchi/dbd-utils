import type { Request } from '../types';

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
  | { type: 'sync-full'; requests: SerializedRequest[] }
  | { type: 'add-request'; request: SerializedRequest }
  | { type: 'update-request'; id: number; updates: Partial<SerializedRequest> }
  | { type: 'toggle-done'; id: number }
  | { type: 'reorder'; fromId: number; toId: number }
  | { type: 'delete-request'; id: number }
  | { type: 'set-all'; requests: SerializedRequest[] };

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
