import type * as Party from 'partykit/server';
import { verifyJwt, type JwtPayload } from './jwt';

interface SerializedRequest {
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

type PartyMessage =
  | { type: 'sync-full'; requests: SerializedRequest[] }
  | { type: 'add-request'; request: SerializedRequest }
  | { type: 'update-request'; id: number; updates: Partial<SerializedRequest> }
  | { type: 'toggle-done'; id: number }
  | { type: 'reorder'; fromId: number; toId: number }
  | { type: 'delete-request'; id: number }
  | { type: 'set-all'; requests: SerializedRequest[] };

interface ConnectionInfo {
  isOwner: boolean;
  user: JwtPayload | null;
}

export default class PartyServer implements Party.Server {
  requests: SerializedRequest[] = [];
  connections: Map<string, ConnectionInfo> = new Map();

  constructor(public room: Party.Room) {}

  async onStart() {
    const stored = await this.room.storage.get<SerializedRequest[]>('requests');
    if (stored) {
      this.requests = stored;
    }
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const token = url.searchParams.get('token');
    const roomOwner = this.room.id.toLowerCase();

    let isOwner = false;
    let user: JwtPayload | null = null;

    if (token) {
      const jwtSecret = this.room.env.JWT_SECRET as string;
      if (jwtSecret) {
        user = await verifyJwt(token, jwtSecret);
        if (user && user.login.toLowerCase() === roomOwner) {
          isOwner = true;
        }
      }
    }

    this.connections.set(conn.id, { isOwner, user });

    const syncMsg: PartyMessage = { type: 'sync-full', requests: this.requests };
    conn.send(JSON.stringify(syncMsg));
  }

  onClose(conn: Party.Connection) {
    this.connections.delete(conn.id);
  }

  async onMessage(message: string, sender: Party.Connection) {
    const connInfo = this.connections.get(sender.id);
    if (!connInfo?.isOwner) {
      return;
    }

    let msg: PartyMessage;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'add-request': {
        if (!this.requests.some(r => r.id === msg.request.id)) {
          this.requests.push(msg.request);
          await this.persist();
          this.broadcast(message, sender.id);
        }
        break;
      }
      case 'update-request': {
        const idx = this.requests.findIndex(r => r.id === msg.id);
        if (idx !== -1) {
          this.requests[idx] = { ...this.requests[idx], ...msg.updates };
          await this.persist();
          this.broadcast(message, sender.id);
        }
        break;
      }
      case 'toggle-done': {
        const idx = this.requests.findIndex(r => r.id === msg.id);
        if (idx !== -1) {
          this.requests[idx].done = !this.requests[idx].done;
          await this.persist();
          this.broadcast(message, sender.id);
        }
        break;
      }
      case 'reorder': {
        const fromIdx = this.requests.findIndex(r => r.id === msg.fromId);
        const toIdx = this.requests.findIndex(r => r.id === msg.toId);
        if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = this.requests.splice(fromIdx, 1);
          this.requests.splice(toIdx, 0, moved);
          await this.persist();
          this.broadcast(message, sender.id);
        }
        break;
      }
      case 'delete-request': {
        const idx = this.requests.findIndex(r => r.id === msg.id);
        if (idx !== -1) {
          this.requests.splice(idx, 1);
          await this.persist();
          this.broadcast(message, sender.id);
        }
        break;
      }
      case 'set-all': {
        this.requests = msg.requests;
        await this.persist();
        this.broadcast(message, sender.id);
        break;
      }
    }
  }

  private async persist() {
    await this.room.storage.put('requests', this.requests);
  }

  private broadcast(message: string, excludeId: string) {
    for (const conn of this.room.getConnections()) {
      if (conn.id !== excludeId) {
        conn.send(message);
      }
    }
  }
}
