import { randomHex } from "./crypto";

export type LinkOrigin = "you" | "network";

export interface LinkRecord {
  id: string;
  url: string; // canonical absolute url, used as href
  title: string;
  createdAt: number;
  rev: number; // last edit, decides conflict winners
  opens: number;
  /** Per-peer G-counter. Merged component-wise to form the global open total. */
  openCounts?: Record<string, number>;
  origin: LinkOrigin;
  author: string; // short wallet signature
  lang: string;
  expiresAt: number; // 24 hours from creation
  /** Tombstone: the author removed it. Wins every merge until expiresAt. */
  removed?: boolean;
}

export type NormResult =
  | { ok: true; href: string; host: string; cost: number }
  | { ok: false; reason: "empty" | "bad" };

const HOST_RE =
  /^(localhost|[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\])$/i;

/** Normalise loose user input into an absolute http(s) address. */
export function normalizeLink(raw: string): NormResult {
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (!trimmed) return { ok: false, reason: "empty" };
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: "bad" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { ok: false, reason: "bad" };
  // Path routes intentionally omit the protocol. Keep their destination
  // unambiguous and secure by publishing the canonical HTTPS form.
  if (parsed.protocol === "http:") parsed.protocol = "https:";
  const host = parsed.hostname;
  if (!host || host.includes(" ") || !HOST_RE.test(host)) return { ok: false, reason: "bad" };
  if (host.length < 3) return { ok: false, reason: "bad" };

  parsed.hash = "";
  // Drop trailing slashes on the path so path routes identify one destination
  // (https://a.com/x/ and https://a.com/x are one link).
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  const href = parsed.toString();
  if (href.length > 512) return { ok: false, reason: "bad" };
  return { ok: true, href, host, cost: priceOf(href) };
}

/** Identity of a link, shared by the store, the route and the destination page. */
export function linkKey(url: string): string {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    // Host names are case-insensitive; paths and query values are not.
    return `${u.host.toLowerCase()}${path === "/" ? "" : path}${u.search}`;
  } catch {
    return stripScheme(url);
  }
}

/** Ownership is decided by the author's signature, never by a shared flag. */
export function isOwn(link: LinkRecord, me: string): boolean {
  return link.author === me;
}

/**
 * The fee for an address: one index per character, counting only what the
 * visitor actually has to type. "https://" is added by us, never by them, so
 *   https://example.com/aiueo → "example.com/aiueo" → 17 index
 */
export function priceOf(href: string): number {
  const bare = stripScheme(href);
  return Math.max(1, bare.length);
}

/** How much renewing one link for a further 24 hours costs. */
export const RENEW_MS = 24 * 60 * 60 * 1000;

export function renewCost(href: string): number {
  return priceOf(href);
}

/** Only a bare word like "example", no dot anywhere. */
export function looksLikeBareWord(value: string) {
  return /^[a-z0-9-]+$/i.test(value.trim());
}

export function makeLink(input: {
  href: string;
  title: string;
  author: string;
  origin: LinkOrigin;
  lang: string;
}): LinkRecord {
  const now = Date.now();
  return {
    id: randomHex(8),
    url: input.href,
    title: input.title.trim().slice(0, 80) || prettifyHost(input.href),
    createdAt: now,
    rev: now,
    opens: 0,
    openCounts: {},
    origin: input.origin,
    author: input.author,
    lang: input.lang,
    expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours
  };
}

export function prettifyHost(href: string) {
  try {
    return new URL(href).host.replace(/^www\./, "");
  } catch {
    return href;
  }
}

function counterOf(link: LinkRecord): Record<string, number> {
  // Links created by older clients had only `opens`; preserve their total as a
  // distinct immutable component instead of losing it during the first merge.
  if (link.openCounts && Object.keys(link.openCounts).length > 0) return link.openCounts;
  return link.opens > 0 ? { legacy: link.opens } : {};
}

export function totalOpens(link: Pick<LinkRecord, "opens" | "openCounts">): number {
  const counts = link.openCounts;
  if (!counts || Object.keys(counts).length === 0) return link.opens;
  return Object.values(counts).reduce((sum, n) => sum + Math.max(0, n || 0), 0);
}

export function mergeOpenCounts(a: LinkRecord, b: LinkRecord): Record<string, number> {
  const merged: Record<string, number> = { ...counterOf(a) };
  for (const [peer, count] of Object.entries(counterOf(b))) {
    merged[peer] = Math.max(merged[peer] ?? 0, count);
  }
  return merged;
}

/** Conflict-free merge: G-counter opens, earliest creation, newest metadata. */
export function mergeLink(a: LinkRecord, b: LinkRecord): LinkRecord {
  const newer = a.rev >= b.rev ? a : b;
  const older = newer === a ? b : a;
  const openCounts = mergeOpenCounts(a, b);
  return {
    ...newer,
    createdAt: Math.min(a.createdAt, b.createdAt),
    openCounts,
    opens: totalOpens({ opens: 0, openCounts }),
    rev: Math.max(a.rev, b.rev),
    title: newer.title || older.title,
    expiresAt: Math.max(a.expiresAt, b.expiresAt),
    // A removal is final: once any copy says "removed", no merge revives it.
    removed: Boolean(a.removed || b.removed),
  };
}

export function relativeTime(ts: number, now: number) {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return { unit: "now" as const, n: s };
  if (s < 3600) return { unit: "ago" as const, n: Math.floor(s / 60) };
  if (s < 86400) return { unit: "agoH" as const, n: Math.floor(s / 3600) };
  return { unit: "agoD" as const, n: Math.floor(s / 86400) };
}

export function isExpired(link: LinkRecord): boolean {
  return Date.now() > link.expiresAt;
}

export function stripScheme(href: string): string {
  return href.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
