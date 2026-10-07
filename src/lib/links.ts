import { randomHex } from "./crypto";

export type LinkOrigin = "you" | "network";

export interface LinkRecord {
  id: string;
  url: string; // canonical absolute url, used as href
  title: string;
  createdAt: number;
  rev: number; // last edit, decides conflict winners
  opens: number;
  origin: LinkOrigin;
  author: string; // short wallet signature
  lang: string;
  expiresAt: number; // 24 hours from creation
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
  const host = parsed.hostname;
  if (!host || host.includes(" ") || !HOST_RE.test(host)) return { ok: false, reason: "bad" };
  if (host.length < 3) return { ok: false, reason: "bad" };

  parsed.hash = "";
  const href = parsed.toString();
  if (href.length > 512) return { ok: false, reason: "bad" };
  return { ok: true, href, host, cost: priceOf(href) };
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

/** Conflict-free merge: highest opens wins, earliest creation wins, newest edit names it. */
export function mergeLink(a: LinkRecord, b: LinkRecord): LinkRecord {
  const newer = a.rev >= b.rev ? a : b;
  const older = newer === a ? b : a;
  return {
    ...newer,
    createdAt: Math.min(a.createdAt, b.createdAt),
    opens: Math.max(a.opens, b.opens),
    rev: Math.max(a.rev, b.rev),
    title: newer.title || older.title,
    origin: a.origin === "you" || b.origin === "you" ? "you" : newer.origin,
    expiresAt: Math.max(a.expiresAt, b.expiresAt),
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
