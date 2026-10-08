import { isExpired, linkKey, mergeLink, type LinkRecord } from "./links";

type Listener = () => void;

export interface LinkSnapshot {
  all: LinkRecord[];
  version: number;
}

const CAP = 300;

/**
 * The only place links live: a Map in this tab's memory, filled and kept
 * current by peers. Nothing is written to any storage.
 *
 * Removed links are kept as tombstones until their deadline so the removal
 * keeps propagating; otherwise a peer that still holds the live copy would
 * hand it back, and the author would have been refunded for a link that lives on.
 */
class LinkStore {
  private map = new Map<string, LinkRecord>();
  private listeners = new Set<Listener>();
  private cache: LinkSnapshot = { all: [], version: 0 };

  /** Drop records past their deadline (live or tombstoned). */
  private pruneExpired() {
    for (const l of [...this.map.values()]) {
      if (isExpired(l)) this.map.delete(l.id);
    }
  }

  private live(): LinkRecord[] {
    return [...this.map.values()].filter((l) => !isExpired(l) && !l.removed);
  }

  private recompute() {
    const all = this.live().sort((a, b) => b.createdAt - a.createdAt);
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
    const key = linkKey(href);
    return this.live().some((l) => linkKey(l.url) === key);
  }

  byUrl(href: string) {
    const key = linkKey(href);
    return this.live().find((l) => linkKey(l.url) === key);
  }

  add(link: LinkRecord) {
    this.pruneExpired();
    const key = linkKey(link.url);
    const existing = this.live().find((l) => linkKey(l.url) === key);
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

      if (incoming.removed) {
        // Tombstones match by id only: the same address may later be re-published under a new id.
        const held = this.map.get(incoming.id);
        this.map.set(incoming.id, held ? mergeLink(held, incoming) : incoming);
        changed = true;
        continue;
      }

      const key = linkKey(incoming.url);
      const existing = [...this.map.values()].find(
        (l) => l.id === incoming.id || (!l.removed && linkKey(l.url) === key),
      );
      if (!existing) {
        this.map.set(incoming.id, incoming);
        changed = true;
      } else if (
        existing.opens !== incoming.opens ||
        existing.title !== incoming.title ||
        existing.rev !== incoming.rev ||
        existing.expiresAt !== incoming.expiresAt ||
        existing.removed !== incoming.removed
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

  /** Push one link's expiry out by `ms`. Removed or expired links cannot be revived. */
  renew(id: string, ms: number): LinkRecord | null {
    const found = this.map.get(id);
    if (!found || isExpired(found) || found.removed) return null;
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
    for (const l of this.live()) {
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

  /** Tombstone a link. Returns the removal record so it can be broadcast. */
  remove(id: string): LinkRecord | null {
    const found = this.map.get(id);
    if (!found) return null;
    const tomb: LinkRecord = { ...found, removed: true, rev: Date.now() };
    this.map.set(id, tomb);
    this.emit();
    return tomb;
  }

  /** Delete expired records; returns how many went. */
  sweep(): number {
    const before = this.map.size;
    this.pruneExpired();
    const removed = before - this.map.size;
    if (removed > 0) this.emit();
    return removed;
  }

  get(id: string) {
    const l = this.map.get(id);
    return l && !l.removed ? l : undefined;
  }

  /** Everything worth sharing with peers: live links and tombstones, until they expire. */
  exportAll(): LinkRecord[] {
    return [...this.map.values()]
      .filter((l) => !isExpired(l))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, CAP);
  }
}

export const linkStore = new LinkStore();
