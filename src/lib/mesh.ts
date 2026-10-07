import Peer from "peerjs";
import type { DataConnection } from "peerjs";
import type { LinkRecord } from "./links";
import { SHARD_COUNT } from "./crypto";

const SLOT_BASE = "indexdot-commons-";
const SLOT_MAX = 9;
const SLOT_KEY = "index.slot.v1";

/* Storage can be blocked outright (sandboxed frames, strict privacy modes).
   Nothing here is essential, so every touch is guarded. */
function readSlot(): number {
  try {
    const raw = window.localStorage.getItem(SLOT_KEY);
    if (raw !== null) {
      const saved = Number(raw);
      if (Number.isFinite(saved) && saved >= 0 && saved < SLOT_MAX) return saved;
    }
  } catch {
    /* ignore */
  }
  // Nothing remembered: start from a random seat so visitors spread out.
  return Math.floor(Math.random() * SLOT_MAX);
}

function writeSlot(slot: number) {
  try {
    window.localStorage.setItem(SLOT_KEY, String(slot));
  } catch {
    /* a random seat is fine */
  }
}

export interface Shard {
  walletId: string;
  idx: number;
  value: string;
}

export type MeshMessage =
  | { t: "hello"; links: LinkRecord[]; shards: Shard[] }
  | { t: "sync"; links: LinkRecord[] }
  | { t: "link"; link: LinkRecord }
  | { t: "shard-put"; shard: Shard }
  | { t: "shard-get"; walletId: string; idx: number; req: string }
  | { t: "shard-give"; walletId: string; idx: number; value: string | null; req: string }
  | { t: "ping"; at: number };

export type MeshStatus = "booting" | "online" | "dark";

export interface MeshState {
  status: MeshStatus;
  slot: number;
  peers: string[];
  deliveries: number;
  note: string;
}

interface Handlers {
  onLinks: (links: LinkRecord[]) => void;
  onShard: (s: Shard) => void;
  onShardRequest: (walletId: string, idx: number) => string | null;
  onSelfShards: () => Shard[];
}

export class Mesh {
  private peer: Peer | null = null;
  private conns = new Map<string, DataConnection>();
  private wanted = new Set<string>();
  private handlers: Handlers;
  private sweep: number | null = null;
  private shardWaiters = new Map<string, (value: string | null) => void>();
  private slot = 0;
  private state: MeshState = { status: "booting", slot: 0, peers: [], deliveries: 0, note: "" };
  private listeners = new Set<() => void>();
  private destroyed = false;
  private attempts = 0;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
    this.slot = readSlot();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.state;

  private set(patch: Partial<MeshState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  start() {
    if (this.peer || this.destroyed) return;
    this.boot(this.slot);
  }

  private boot(slot: number) {
    if (this.destroyed) return;
    this.attempts += 1;
    this.set({ status: "booting", note: `handshake ${slot}` });
    let peer: Peer;
    try {
      peer = new Peer(`${SLOT_BASE}${slot}`, { debug: 0 });
    } catch {
      this.set({ status: "dark", note: "webrtc unavailable" });
      return;
    }
    this.peer = peer;

    peer.on("open", () => {
      this.slot = slot;
      writeSlot(slot);
      this.set({ status: "online", slot, note: "" });
      this.dialAll();
      if (this.sweep) window.clearInterval(this.sweep);
      this.sweep = window.setInterval(() => this.dialAll(), 12_000);
      // Re-broadcast our ledger periodically so late arrivals converge.
      window.setTimeout(() => this.pushAll(), 1500);
    });

    peer.on("connection", (conn) => this.attach(conn));

    peer.on("error", (err: unknown) => {
      const type = (err as { type?: string })?.type ?? "";
      if (type === "unavailable-id") {
        this.teardownPeer();
        const next = slot + 1;
        if (next < SLOT_MAX) this.boot(next);
        else this.set({ status: "dark", note: "all seats taken" });
        return;
      }
      if (type === "peer-unavailable") {
        const msg = String((err as { message?: string })?.message ?? "");
        const id = msg.split(" ").pop() ?? "";
        if (id) {
          this.wanted.delete(id);
          this.conns.delete(id);
          this.publishPeers();
        }
        return;
      }
      if (type === "network" || type === "server-error" || type === "socket-error" || type === "socket-closed") {
        this.set({ status: "dark", note: "rendezvous unreachable" });
        window.setTimeout(() => {
          if (!this.destroyed) {
            this.teardownPeer();
            this.boot(slot);
          }
        }, 9000);
        return;
      }
      this.set({ status: "dark", note: type || "error" });
    });

    peer.on("disconnected", () => {
      if (this.destroyed) return;
      try {
        peer.reconnect();
      } catch {
        /* ignore */
      }
    });
  }

  private teardownPeer() {
    if (this.sweep) {
      window.clearInterval(this.sweep);
      this.sweep = null;
    }
    for (const c of this.conns.values()) {
      try {
        c.close();
      } catch {
        /* ignore */
      }
    }
    this.conns.clear();
    this.wanted.clear();
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        /* ignore */
      }
    }
    this.peer = null;
    this.set({ peers: [] });
  }

  private dialAll() {
    const peer = this.peer;
    if (!peer || peer.disconnected || peer.destroyed) return;
    for (let i = 0; i < SLOT_MAX; i++) {
      if (i === this.slot) continue;
      const id = `${SLOT_BASE}${i}`;
      if (this.conns.has(id) || this.wanted.has(id)) continue;
      this.wanted.add(id);
      try {
        const conn = peer.connect(id, { reliable: true });
        this.attach(conn);
      } catch {
        this.wanted.delete(id);
      }
    }
  }

  private attach(conn: DataConnection) {
    const id = conn.peer;
    conn.on("open", () => {
      this.conns.set(id, conn);
      this.wanted.delete(id);
      this.publishPeers();
      this.send(conn, {
        t: "hello",
        links: this.exportLinks(),
        shards: this.handlers.onSelfShards(),
      });
    });
    conn.on("data", (raw) => this.receive(conn, raw));
    conn.on("close", () => {
      this.conns.delete(id);
      this.wanted.delete(id);
      this.publishPeers();
    });
    conn.on("error", () => {
      this.conns.delete(id);
      this.wanted.delete(id);
      this.publishPeers();
    });
  }

  private publishPeers() {
    this.set({ peers: [...this.conns.keys()] });
  }

  private pushAll() {
    const msg: MeshMessage = { t: "sync", links: this.exportLinks() };
    for (const c of this.conns.values()) this.send(c, msg);
  }

  private send(conn: DataConnection, msg: MeshMessage) {
    try {
      if (conn.open) conn.send(msg);
    } catch {
      /* ignore */
    }
  }

  private receive(conn: DataConnection, raw: unknown) {
    const msg = raw as MeshMessage;
    if (!msg || typeof msg !== "object" || typeof (msg as { t?: string }).t !== "string") return;
    switch (msg.t) {
      case "hello": {
        this.set({ deliveries: this.state.deliveries + 1 });
        if (Array.isArray(msg.links)) this.handlers.onLinks(msg.links);
        if (Array.isArray(msg.shards)) for (const s of msg.shards) this.handlers.onShard(s);
        this.send(conn, { t: "sync", links: this.exportLinks() });
        break;
      }
      case "sync": {
        if (Array.isArray(msg.links)) {
          this.set({ deliveries: this.state.deliveries + 1 });
          this.handlers.onLinks(msg.links);
        }
        break;
      }
      case "link": {
        if (msg.link) {
          this.set({ deliveries: this.state.deliveries + 1 });
          this.handlers.onLinks([msg.link]);
        }
        break;
      }
      case "shard-put": {
        if (msg.shard) this.handlers.onShard(msg.shard);
        break;
      }
      case "shard-get": {
        const value = this.handlers.onShardRequest(msg.walletId, msg.idx);
        this.send(conn, {
          t: "shard-give",
          walletId: msg.walletId,
          idx: msg.idx,
          value,
          req: msg.req,
        });
        break;
      }
      case "shard-give": {
        const waiter = this.shardWaiters.get(msg.req);
        if (waiter) {
          this.shardWaiters.delete(msg.req);
          waiter(msg.value ?? null);
        }
        break;
      }
      case "ping":
        break;
    }
  }

  /** Provided by the app so the mesh can mirror the live ledger. */
  exporter: () => LinkRecord[] = () => [];

  private exportLinks() {
    return this.exporter().slice(0, 120);
  }

  broadcastLink(link: LinkRecord) {
    const msg: MeshMessage = { t: "link", link };
    for (const c of this.conns.values()) this.send(c, msg);
  }

  publishShards(shards: Shard[]) {
    for (const s of shards) {
      const msg: MeshMessage = { t: "shard-put", shard: s };
      for (const c of this.conns.values()) this.send(c, msg);
    }
  }

  /** Ask every peer for one of our remote shards; resolve with the first answer. */
  requestShard(walletId: string, idx: number): Promise<string | null> {
    if (idx < 1 || idx >= SHARD_COUNT) return Promise.resolve(null);
    const conns = [...this.conns.values()].filter((c) => c.open);
    if (conns.length === 0) return Promise.resolve(null);
    return new Promise((resolve) => {
      const req = Math.random().toString(36).slice(2);
      const timer = window.setTimeout(() => {
        this.shardWaiters.delete(req);
        resolve(null);
      }, 3500);
      this.shardWaiters.set(req, (value) => {
        window.clearTimeout(timer);
        resolve(value);
      });
      const msg: MeshMessage = { t: "shard-get", walletId, idx, req };
      for (const c of conns) this.send(c, msg);
    });
  }

  peerCount() {
    return this.conns.size;
  }

  destroy() {
    this.destroyed = true;
    if (this.sweep) window.clearInterval(this.sweep);
    this.teardownPeer();
  }
}
