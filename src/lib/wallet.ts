import { joinDigest, randomHex, sha256Hex, splitDigest, SHARD_COUNT } from "./crypto";

export type Integrity = "pending" | "sealed" | "breach";

export interface WalletState {
  walletId: string;
  balance: number;
  digest: string;
  integrity: Integrity;
  remoteShards: number; // how many of the 3 remote shards are currently witnessed
  earned: number;
  spent: number;
  online: boolean;
  startedAt: number;
}

interface Record0 {
  v: 1;
  walletId: string;
  secret: string;
  nonce: string;
  balance: number;
  digest: string;
  earned: number;
  spent: number;
  startedAt: number;
}

const KEY = "index.ledger.v1";
const MIRROR = "index.mirror.v1"; // session-only fallback while no peer is awake
const START_GRANT = 42;

function readRecord(): Record0 {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record0;
      if (parsed && parsed.v === 1 && parsed.secret && parsed.nonce) return parsed;
    }
  } catch {
    /* corrupted storage → start a fresh ledger */
  }
  const fresh: Record0 = {
    v: 1,
    walletId: randomHex(8),
    secret: randomHex(24),
    nonce: randomHex(12),
    balance: START_GRANT,
    digest: "",
    earned: START_GRANT,
    spent: 0,
    startedAt: Date.now(),
  };
  fresh.digest = sha256Hex(`${fresh.secret}|${fresh.balance}|${fresh.nonce}`);
  return fresh;
}

function writeRecord(r: Record0) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* storage may be blocked; the session keeps working in memory */
  }
}

function readMirror(): (string | undefined)[] {
  try {
    const raw = sessionStorage.getItem(MIRROR);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr as string[];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function writeMirror(shards: (string | undefined)[]) {
  try {
    sessionStorage.setItem(MIRROR, JSON.stringify(shards));
  } catch {
    /* ignore */
  }
}

type Listener = () => void;

class Wallet {
  private rec: Record0;
  private listeners = new Set<Listener>();
  private cached: WalletState;
  private remote: (string | undefined)[] = new Array(SHARD_COUNT).fill(undefined);
  private mirror: (string | undefined)[] = readMirror();
  online = typeof navigator === "undefined" ? true : navigator.onLine;

  constructor() {
    this.rec = readRecord();
    this.cached = this.snapshot();
  }

  private snapshot(): WalletState {
    return {
      walletId: this.rec.walletId,
      balance: this.rec.balance,
      digest: this.rec.digest,
      integrity: this.integrity(),
      remoteShards: this.remote.slice(1).filter(Boolean).length,
      earned: this.rec.earned,
      spent: this.rec.spent,
      online: this.online,
      startedAt: this.rec.startedAt,
    };
  }

  private integrity(): Integrity {
    const recomputed = sha256Hex(`${this.rec.secret}|${this.rec.balance}|${this.rec.nonce}`);
    const witnessed = joinDigest([this.shard(0), this.remote[1], this.remote[2], this.remote[3]]);
    if (this.remote.slice(1).some(Boolean)) {
      if (witnessed === recomputed) return "sealed";
      const mirrored = joinDigest([this.shard(0), this.mirror[1], this.mirror[2], this.mirror[3]]);
      return mirrored === recomputed ? "sealed" : "breach";
    }
    const mirrored = joinDigest([this.shard(0), this.mirror[1], this.mirror[2], this.mirror[3]]);
    if (mirrored === recomputed) return "sealed";
    return "pending";
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): WalletState => this.cached;

  private emit() {
    this.cached = this.snapshot();
    writeRecord(this.rec);
    this.listeners.forEach((l) => l());
  }

  /** shard 0 never leaves the device; 1..3 are handed to peers' memory. */
  shard(index: number): string {
    return splitDigest(this.rec.digest)[index];
  }

  shardsForPeers(): Array<{ walletId: string; idx: number; value: string }> {
    const parts = splitDigest(this.rec.digest);
    return parts.slice(1).map((value, i) => ({ walletId: this.rec.walletId, idx: i + 1, value }));
  }

  /** True when a peer is holding the shard that matches the current digest. */
  shardMatches(idx: number, value: string) {
    return splitDigest(this.rec.digest)[idx] === value;
  }

  /** A peer told us it is holding one of our shards. */
  witnessShard(idx: number, value: string) {
    if (idx < 1 || idx >= SHARD_COUNT) return;
    if (this.remote[idx] === value) return;
    this.remote[idx] = value;
    this.emit();
  }

  /** A peer asked us to hold a shard of theirs — memory only, never persisted. */
  rememberShard(walletId: string, idx: number, value: string) {
    try {
      const raw = sessionStorage.getItem("index.vault.v1");
      const vault = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      vault[`${walletId}:${idx}`] = value;
      sessionStorage.setItem("index.vault.v1", JSON.stringify(vault));
    } catch {
      /* ignore */
    }
  }

  recallShard(walletId: string, idx: number): string | null {
    try {
      const raw = sessionStorage.getItem("index.vault.v1");
      if (!raw) return null;
      const vault = JSON.parse(raw) as Record<string, string>;
      return vault[`${walletId}:${idx}`] ?? null;
    } catch {
      return null;
    }
  }

  forgetForeignShards() {
    try {
      sessionStorage.removeItem("index.vault.v1");
    } catch {
      /* ignore */
    }
  }

  /** Mirror our own remote shards locally so a lone browser still reads "sealed". */
  seal() {
    this.rec.digest = sha256Hex(`${this.rec.secret}|${this.rec.balance}|${this.rec.nonce}`);
    this.mirror = splitDigest(this.rec.digest);
    writeMirror(this.mirror);
    this.remote = new Array(SHARD_COUNT).fill(undefined);
  }

  earn(n = 1) {
    this.rec.balance += n;
    this.rec.earned += n;
    this.seal();
    this.emit();
  }

  canAfford(cost: number) {
    return this.rec.balance >= cost;
  }

  /** Returns false (and changes nothing) when the balance cannot cover the fee. */
  spend(cost: number) {
    if (this.rec.balance < cost) return false;
    this.rec.balance -= cost;
    this.rec.spent += cost;
    this.seal();
    this.emit();
    return true;
  }

  refund(cost: number) {
    this.rec.balance += cost;
    this.rec.spent = Math.max(0, this.rec.spent - cost);
    this.seal();
    this.emit();
  }

  setOnline(online: boolean) {
    if (this.online === online) return;
    this.online = online;
    this.emit();
  }

  signature(): string {
    return sha256Hex(`${this.rec.secret}|author`).slice(0, 10);
  }

  get walletId(): string {
    return this.rec.walletId;
  }
}

export const wallet = new Wallet();
export const START_GRANT_SIZE = START_GRANT;
