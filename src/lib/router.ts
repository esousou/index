import type { MouseEvent } from "react";
import { LANG_PARAM } from "./seo";

export type Route =
  | { name: "home" }
  | { name: "go"; href: string }
  | { name: "error"; value: string };

export const URL_PARAM = "url";
const NAV_EVENT = "index:navigate";

/** Strip protocol + trailing slash for storage/display. */
export function stripScheme(href: string) {
  return href.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** Always show the canonical "https://YY.net" form. */
export function withScheme(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
}

/* ───────────────────────── frame awareness ─────────────────────────
   Many hosts serve a site inside an <iframe>. Inside a frame:
     • window.location is the FRAME's address, not the one in the bar,
       so "?url=YY.net" typed by the visitor is invisible to us;
     • history.pushState rewrites the frame, not the visible bar;
     • URLs built from window.location point at the frame's host.
   Everything below works from the address the visitor actually sees.     */

export type FrameMode = "none" | "same" | "cross";

function httpUrl(value?: string | null): URL | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

/** The top window, if it is same-origin and therefore readable/writable. */
function sameOriginTop(): Window | null {
  try {
    const top = window.top;
    if (!top || top === window) return null;
    return httpUrl(top.location.href) ? top : null; // throws when cross-origin
  } catch {
    return null;
  }
}

export function frameMode(): FrameMode {
  let framed: boolean;
  try {
    framed = window.self !== window.top;
  } catch {
    framed = true;
  }
  if (!framed) return "none";
  return sameOriginTop() ? "same" : "cross";
}

/** Best knowledge of the URL in the visitor's address bar. */
function visibleAddress(): URL {
  const mode = frameMode();
  if (mode === "same") {
    const u = httpUrl(sameOriginTop()?.location.href);
    if (u) return u;
  }
  if (mode === "cross") {
    const ref = httpUrl(document.referrer);
    const list = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
    const outermost = list && list.length > 0 ? httpUrl(list[list.length - 1]) : null;
    if (ref && (!outermost || ref.origin === outermost.origin)) return ref;
    if (outermost) return outermost;
  }
  return httpUrl(window.location.href) ?? new URL("https://localhost/");
}

/** Directory a path is served from; trims "index.html", a "/url" alias and dotted tails. */
function rootOf(pathname: string) {
  const segs = pathname.replace(/index\.html?$/i, "").split("/").filter(Boolean);
  while (segs.length > 0) {
    const last = segs[segs.length - 1];
    if (last === "url" || last.includes(".")) segs.pop();
    else break;
  }
  return segs.length > 0 ? `/${segs.join("/")}/` : "/";
}

export function appRootPath() {
  return rootOf(visibleAddress().pathname);
}

/** The public root of the site as the visitor sees it, e.g. https://index-z.pages.dev/ */
export function publicBase() {
  const a = visibleAddress();
  return `${a.origin}${rootOf(a.pathname)}`;
}
export const siteBase = publicBase;

/* ───────────────────── the logical address (query) ───────────────────── */

let virtualSearch: string | null = null; // used when no history can be written

function normSearch(search: string) {
  const qs = new URLSearchParams(search.replace(/^\?/, "")).toString();
  return qs ? `?${qs}` : "";
}

function readSearch(): string {
  const top = sameOriginTop();
  if (top) return top.location.search;
  if (virtualSearch !== null) return virtualSearch;
  return window.location.search;
}

/**
 * Write the query to wherever the visitor can see it. With a same-origin parent
 * the visible bar is the top window's; the frame is quietly kept in step.
 */
function commit(search: string, mode: "push" | "replace") {
  const s = normSearch(search);
  const top = sameOriginTop();

  const write = (w: Window, how: "push" | "replace") => {
    const u = new URL(w.location.href);
    u.pathname = rootOf(u.pathname);
    u.search = s;
    u.hash = "";
    if (how === "push") w.history.pushState({}, "", u.toString());
    else w.history.replaceState({}, "", u.toString());
  };

  if (top) {
    try {
      write(top, mode);
    } catch {
      /* fall through to the frame */
    }
  }
  try {
    write(window, top ? "replace" : mode);
    virtualSearch = null;
  } catch {
    virtualSearch = s;
  }
}

/**
 * Run once: pick up a destination the visitor typed but we could not see
 * directly — from a hash (#url=YY.net, survives servers that drop queries) or,
 * inside a cross-origin frame, from the outer page's address.
 */
let adopted = false;
function adoptInitialAddress() {
  if (adopted) return;
  adopted = true;

  const current = new URLSearchParams(readSearch().replace(/^\?/, ""));
  const before = current.toString();

  const hashes = [window.location.hash];
  try {
    const top = sameOriginTop();
    if (top) hashes.push(top.location.hash);
  } catch {
    /* ignore */
  }
  for (const h of hashes) {
    const p = new URLSearchParams((h || "").replace(/^#\/?\??/, ""));
    const v = p.get(URL_PARAM);
    if (v && !current.has(URL_PARAM)) current.set(URL_PARAM, v);
  }

  if (frameMode() === "cross") {
    const outer = visibleAddress();
    for (const key of [URL_PARAM, LANG_PARAM]) {
      const v = outer.searchParams.get(key);
      if (v && !current.has(key)) current.set(key, v);
    }
  }

  if (current.toString() !== before) commit(`?${current.toString()}`, "replace");
}

/* ───────────────────────────── building URLs ───────────────────────────── */

function langParam() {
  return new URLSearchParams(readSearch().replace(/^\?/, "")).get(LANG_PARAM);
}

/** Absolute public URL from params, carrying ?lang= forward when present. */
function buildUrl(params: Record<string, string>) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) next.set(k, v);
  const lang = langParam();
  if (lang) next.set(LANG_PARAM, lang);
  const qs = next.toString();
  return `${publicBase()}${qs ? `?${qs}` : ""}`;
}

/** https://index-z.pages.dev/YY.net — absolute, so it is right from any frame. */
export function routeToLink(target: string) {
  const bare = stripScheme(target);
  const lang = langParam();
  const qs = lang ? `?${LANG_PARAM}=${encodeURIComponent(lang)}` : "";
  return `${publicBase()}${encodeURIComponent(bare)}${qs}`;
}

/** The shareable address of a destination page (same as routeToLink). */
export function prettyRoute(target: string) {
  return routeToLink(target);
}

export function homeUrl() {
  return buildUrl({});
}

/** Canonical address of a view — lang stripped, alternates carry it. */
export function canonicalFor(route: Route) {
  const base = publicBase();
  if (route.name === "go") return `${base}${encodeURIComponent(stripScheme(route.href))}`;
  if (route.name === "error") return `${base}${encodeURIComponent(route.value)}`;
  return base;
}

/** Keep the visible bar in step with the chosen language (no reload). */
export function reflectLang(lang: string) {
  const p = new URLSearchParams(readSearch().replace(/^\?/, ""));
  if (p.get(LANG_PARAM) === lang) return;
  p.set(LANG_PARAM, lang);
  commit(`?${p.toString()}`, "replace");
}

/* ───────────────────────────── reading routes ───────────────────────────── */

function classify(raw: string): Route {
  const decoded = safeDecode(raw).trim();
  if (!decoded) return { name: "home" };
  try {
    const u = new URL(withScheme(decoded));
    const okProtocol = u.protocol === "http:" || u.protocol === "https:";
    const okHost = u.hostname.includes(".") || u.hostname === "localhost";
    if (okProtocol && okHost && u.hostname.length >= 3) {
      u.hash = "";
      return { name: "go", href: u.toString() };
    }
  } catch {
    /* fall through to the error page */
  }
  return { name: "error", value: decoded };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** index-z.pages.dev/YY.net typed into the bar → rewrite to index-z.pages.dev/?url=YY.net in place. */
function rescueLegacyPath(): string | null {
  const path = visibleAddress().pathname;
  const segs = path.split("/").filter(Boolean);
  const root = rootOf(path).split("/").filter(Boolean);
  if (segs.length <= root.length) return null;
  const last = segs[segs.length - 1];
  if (/^index\.html?$/i.test(last)) return null;
  if (!last.includes(".") && !last.includes("%") && !last.includes(":")) return null;
  return safeDecode(last);
}

export function readRoute(): Route {
  adoptInitialAddress();

  const target = new URLSearchParams(readSearch().replace(/^\?/, "")).get(URL_PARAM);
  if (target !== null) return classify(target);

  const legacy = rescueLegacyPath();
  if (legacy) {
    const clean = stripScheme(legacy);
    const p = new URLSearchParams(readSearch().replace(/^\?/, ""));
    p.set(URL_PARAM, clean);
    commit(`?${p.toString()}`, "replace");
    return classify(clean);
  }

  return { name: "home" };
}

/* ───────────────────────────── navigating ───────────────────────────── */

function notify() {
  window.dispatchEvent(new Event(NAV_EVENT));
}

/** Move the visible address to `to` without a reload (keeps the memory ledger). */
export function navigate(to: string) {
  let search = "";
  try {
    search = new URL(to, publicBase()).search;
  } catch {
    search = "";
  }
  if (normSearch(search) !== normSearch(readSearch())) commit(search, "push");
  notify();
}

export function goToLink(target: string) {
  navigate(routeToLink(target));
}

export function goToError(value: string) {
  navigate(buildUrl({ [URL_PARAM]: value }));
}

export function goHome() {
  navigate(homeUrl());
}

/** Listen for any change of the visible address (back/forward, our own pushes). */
export function subscribeAddress(cb: () => void) {
  const targets: Window[] = [window];
  const top = sameOriginTop();
  if (top) targets.push(top);
  for (const t of targets) {
    t.addEventListener("popstate", cb);
    t.addEventListener("hashchange", cb);
  }
  window.addEventListener(NAV_EVENT, cb);
  return () => {
    for (const t of targets) {
      try {
        t.removeEventListener("popstate", cb);
        t.removeEventListener("hashchange", cb);
      } catch {
        /* the top may have navigated away */
      }
    }
    window.removeEventListener(NAV_EVENT, cb);
  };
}

/** Where to open the external destination: a new tab, or the whole window if framed. */
export function externalTarget(): "_blank" | "_top" {
  return frameMode() === "none" ? "_blank" : "_top";
}

/**
 * Props for an in-site link. It is always a genuine <a href> to the absolute
 * public URL (crawlable, middle-clickable, copyable).
 *   • Not framed / same-origin frame → no reload: the bar is rewritten in place.
 *   • Cross-origin frame → target="_top" lets the browser take the WHOLE window
 *     to index-z.pages.dev/?url=YY.net (a frame cannot rewrite a foreign parent's bar).
 *     The view is also updated inside the frame in case top navigation is
 *     blocked by a sandbox, so the click never appears to do nothing.
 */
export function internalLink(href: string, before?: () => void) {
  const cross = frameMode() === "cross";
  return {
    href,
    target: cross ? ("_top" as const) : undefined,
    onClick: (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      before?.();
      if (cross) {
        window.setTimeout(() => navigate(href), 60);
        return;
      }
      e.preventDefault();
      navigate(href);
    },
  };
}
