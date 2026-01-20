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
}

interface SourcesSettings {
  enabled: { donation: boolean; chat: boolean; resub: boolean; manual: boolean };
  chatCommand: string;
  chatTiers: number[];
  priority: ('donation' | 'resub' | 'chat' | 'manual')[];
  sortMode: 'priority' | 'fifo';
  minDonation: number;
  ircConnected: boolean;
}

const SOURCES_DEFAULTS: SourcesSettings = {
  enabled: { donation: true, chat: true, resub: false, manual: true },
  chatCommand: '!fila',
  chatTiers: [2, 3],
  priority: ['donation', 'chat', 'resub', 'manual'],
  sortMode: 'fifo',
  minDonation: 5,
  ircConnected: false,
};

type PartyMessage =
  | { type: 'sync-full'; requests: SerializedRequest[]; sources: SourcesSettings }
  | { type: 'add-request'; request: SerializedRequest }
  | { type: 'update-request'; id: number; updates: Partial<SerializedRequest> }
  | { type: 'toggle-done'; id: number }
  | { type: 'reorder'; fromId: number; toId: number }
  | { type: 'delete-request'; id: number }
  | { type: 'set-all'; requests: SerializedRequest[] }
  | { type: 'update-sources'; sources: SourcesSettings };

interface ConnectionInfo {
  isOwner: boolean;
  user: JwtPayload | null;
}

export default class PartyServer implements Party.Server {
  requests: SerializedRequest[] = [];
  sources: SourcesSettings = SOURCES_DEFAULTS;
  connections: Map<string, ConnectionInfo> = new Map();

  constructor(public room: Party.Room) { }

  async onStart() {
    console.log(`${this.tag} Starting`);
    const storedRequests = await this.room.storage.get<SerializedRequest[]>('requests');
    if (storedRequests) {
      this.requests = storedRequests;
      console.log(`${this.tag} Loaded ${storedRequests.length} requests from storage`);
    }
    const storedSources = await this.room.storage.get<Partial<SourcesSettings>>('sources');
    if (storedSources) {
      // Merge with defaults, always reset ircConnected to false on start
      this.sources = { ...SOURCES_DEFAULTS, ...storedSources, ircConnected: false };
      console.log(`${this.tag} Loaded sources config:`, JSON.stringify(this.sources.enabled));
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
      if (!jwtSecret) {
        console.warn(`${this.tag} JWT_SECRET not configured`);
      } else {
        user = await verifyJwt(token, jwtSecret);
        if (user) {
          const userLogin = user.login.toLowerCase();
          isOwner = userLogin === roomOwner;
          console.log(`${this.tag} Auth: ${userLogin}, isOwner=${isOwner}`);
        } else {
          console.warn(`${this.tag} JWT verification failed for conn ${conn.id}`);
        }
      }
    } else {
      console.log(`${this.tag} Anonymous connection ${conn.id}`);
    }

    this.connections.set(conn.id, { isOwner, user });
    console.log(`${this.tag} Connected: ${conn.id} (${user?.login ?? 'anon'}) - ${this.connections.size} total`);

    const syncMsg: PartyMessage = { type: 'sync-full', requests: this.requests, sources: this.sources };
    conn.send(JSON.stringify(syncMsg));
  }

  onClose(conn: Party.Connection) {
    const info = this.connections.get(conn.id);
    this.connections.delete(conn.id);
    console.log(`${this.tag} Disconnected: ${conn.id} (${info?.user?.login ?? 'anon'}) - ${this.connections.size} remaining`);
  }

  async onMessage(message: string, sender: Party.Connection) {
    const connInfo = this.connections.get(sender.id);
    if (!connInfo?.isOwner) {
      console.warn(`${this.tag} Rejected msg from non-owner ${sender.id}`);
      return;
    }

    let msg: PartyMessage;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      console.error(`${this.tag} Invalid JSON from ${sender.id}:`, e);
      return;
    }

    const user = connInfo.user?.login ?? 'unknown';
    switch (msg.type) {
      case 'add-request': {
        if (!this.requests.some(r => r.id === msg.request.id)) {
          this.requests.push(msg.request);
          await this.persist();
          this.broadcast(message, sender.id);
          console.log(`${this.tag} ${user}: add-request #${msg.request.id} "${msg.request.character}" (${msg.request.source})`);
        } else {
          console.log(`${this.tag} ${user}: add-request #${msg.request.id} skipped (duplicate)`);
        }
        break;
      }
      case 'update-request': {
        const idx = this.requests.findIndex(r => r.id === msg.id);
        if (idx !== -1) {
          this.requests[idx] = { ...this.requests[idx], ...msg.updates };
          await this.persist();
          this.broadcast(message, sender.id);
          console.log(`${this.tag} ${user}: update-request #${msg.id}`, Object.keys(msg.updates));
        }
        break;
      }
      case 'toggle-done': {
        const idx = this.requests.findIndex(r => r.id === msg.id);
        if (idx !== -1) {
          this.requests[idx].done = !this.requests[idx].done;
          await this.persist();
          this.broadcast(message, sender.id);
          console.log(`${this.tag} ${user}: toggle-done #${msg.id} → ${this.requests[idx].done}`);
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
          console.log(`${this.tag} ${user}: reorder #${msg.fromId} → position of #${msg.toId}`);
        }
        break;
      }
      case 'delete-request': {
        const idx = this.requests.findIndex(r => r.id === msg.id);
        if (idx !== -1) {
          this.requests.splice(idx, 1);
          await this.persist();
          this.broadcast(message, sender.id);
          console.log(`${this.tag} ${user}: delete-request #${msg.id}`);
        }
        break;
      }
      case 'set-all': {
        this.requests = msg.requests;
        await this.persist();
        this.broadcast(message, sender.id);
        console.log(`${this.tag} ${user}: set-all (${msg.requests.length} requests)`);
        break;
      }
      case 'update-sources': {
        this.sources = msg.sources;
        await this.room.storage.put('sources', this.sources);
        this.broadcast(message, sender.id);
        console.log(`${this.tag} ${user}: update-sources`, JSON.stringify(msg.sources.enabled));
        break;
      }
    }
  }

  private async persist() {
    await this.room.storage.put('requests', this.requests);
    console.log(`${this.tag} Persisted ${this.requests.length} requests`);
  }

  private broadcast(message: string, excludeId: string) {
    let count = 0;
    for (const conn of this.room.getConnections()) {
      if (conn.id !== excludeId) {
        conn.send(message);
        count++;
      }
    }
    if (count > 0) {
      console.log(`${this.tag} Broadcast to ${count} client(s)`);
    }
  }

  private get tag() {
    return `[${this.room.id}]`;
  }
}
