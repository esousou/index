import { mergeLink, isExpired, type LinkRecord } from "./links";

type Listener = () => void;

export interface LinkSnapshot {
  all: LinkRecord[];
  version: number;
}

const CAP = 300;

class LinkStore {
  private map = new Map<string, LinkRecord>();
  private listeners = new Set<Listener>();
  private cache: LinkSnapshot = { all: [], version: 0 };

  constructor() {
    // No localStorage - purely in-memory
    // Seed with nothing; links only exist in peer memory
  }

  private recompute() {
    const all = [...this.map.values()]
      .filter((l) => !isExpired(l))
      .sort((a, b) => b.createdAt - a.createdAt);
    this.cache = { all, version: this.cache.version + 1 };
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): LinkSnapshot => this.cache;

  private emit() {
    this.recompute();
    this.listeners.forEach((l) => l());
  }

  has(href: string) {
    return [...this.map.values()].some((l) => l.url === href);
  }

  byUrl(href: string) {
    return [...this.map.values()].find((l) => l.url === href);
  }

  add(link: LinkRecord) {
    const existing = [...this.map.values()].find((l) => l.url === link.url);
    if (existing) {
      this.map.set(existing.id, mergeLink(existing, link));
      this.emit();
      return { merged: true as const, link: this.map.get(existing.id)! };
    }
    this.map.set(link.id, link);
    this.emit();
    return { merged: false as const, link };
  }

  mergeMany(list: LinkRecord[]) {
    let changed = false;
    for (const incoming of list) {
      if (!incoming || !incoming.url || isExpired(incoming)) continue;
      const existing = [...this.map.values()].find((l) => l.url === incoming.url || l.id === incoming.id);
      if (!existing) {
        this.map.set(incoming.id, incoming);
        changed = true;
      } else if (
        existing.opens !== incoming.opens ||
        existing.title !== incoming.title ||
        existing.rev !== incoming.rev
      ) {
        this.map.set(existing.id, mergeLink(existing, incoming));
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  bump(href: string, by = 1) {
    const found = this.byUrl(href);
    if (!found) return;
    this.map.set(found.id, { ...found, opens: found.opens + by, rev: Date.now() });
    this.emit();
  }

  /** Push one link's expiry out by `ms`. Returns the record, or null. */
  renew(id: string, ms: number): LinkRecord | null {
    const found = this.map.get(id);
    if (!found) return null;
    // Never shorten: a renewal only ever moves the deadline further away.
    const next: LinkRecord = {
      ...found,
      expiresAt: Math.max(found.expiresAt, Date.now()) + ms,
      rev: Date.now(),
    };
    this.map.set(id, next);
    this.emit();
    return next;
  }

  /** Renew every live link. Returns the ones actually extended. */
  renewAll(ms: number): LinkRecord[] {
    const now = Date.now();
    const extended: LinkRecord[] = [];
    for (const l of [...this.map.values()]) {
      if (isExpired(l)) continue;
      const next: LinkRecord = {
        ...l,
        expiresAt: Math.max(l.expiresAt, now) + ms,
        rev: now,
      };
      this.map.set(l.id, next);
      extended.push(next);
    }
    if (extended.length > 0) this.emit();
    return extended;
  }

  remove(id: string) {
    this.map.delete(id);
    this.emit();
  }

  get(id: string) {
    return this.map.get(id);
  }

  clearNetwork() {
    for (const l of [...this.map.values()]) if (l.origin === "network") this.map.delete(l.id);
    this.emit();
  }

  size() {
    return this.map.size;
  }

  /** Get all non-expired links for sharing with peers */
  exportAll(): LinkRecord[] {
    return [...this.map.values()].filter((l) => !isExpired(l)).slice(0, CAP);
  }
}

export const linkStore = new LinkStore();
