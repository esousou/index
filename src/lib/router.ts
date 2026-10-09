import type { MouseEvent } from "react";
import { LANG_PARAM } from "./seo";

export type Route =
  | { name: "home" }
  | { name: "go"; href: string }
  | { name: "error"; value: string };

export const URL_PARAM = "url";
const NAV_EVENT = "index:navigate";
const PRODUCTION_ORIGIN = "https://index-z.pages.dev";

/** Strip protocol + trailing slash for storage and route display. */
export function stripScheme(href: string) {
  return href.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** Restore a route value to an absolute http(s) URL. */
export function withScheme(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
}

/* ───────────────────────── frame awareness ─────────────────────────
   When framed, the document's URL can differ from the visitor's address bar.
   Same-origin parents can be updated directly; cross-origin frames keep a
   virtual route so a sandboxed embed still shows the correct destination. */

export type FrameMode = "none" | "same" | "cross";

interface LocationState {
  pathname: string;
  search: string;
  hash: string;
  origin: string;
}

function httpUrl(value?: string | null): URL | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

function sameOriginTop(): Window | null {
  try {
    const top = window.top;
    if (!top || top === window) return null;
    return httpUrl(top.location.href) ? top : null;
  } catch {
    return null;
  }
}

export function frameMode(): FrameMode {
  try {
    if (window.self === window.top) return "none";
  } catch {
    return "cross";
  }
  return sameOriginTop() ? "same" : "cross";
}

function outerAddress(): URL {
  const mode = frameMode();
  if (mode === "same") {
    const u = httpUrl(sameOriginTop()?.location.href);
    if (u) return u;
  }
  if (mode === "cross") {
    const ref = httpUrl(document.referrer);
    const ancestors = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
    const outermost = ancestors?.length ? httpUrl(ancestors[ancestors.length - 1]) : null;
    if (ref && (!outermost || ref.origin === outermost.origin)) return ref;
    if (outermost) return outermost;
  }
  return httpUrl(window.location.href) ?? new URL("https://index-z.pages.dev/");
}

function isHostSegment(segment: string) {
  const decoded = safeDecode(segment).toLowerCase();
  return decoded === "localhost" || decoded.includes(".");
}

/**
 * Split a pathname into the app root and the destination path after it.
 * On the root deploy the first segment is already the destination; earlier
 * segments are only treated as app root when a host-like segment follows.
 */
function splitLocation(pathname: string) {
  const segments = pathname.replace(/index\.html?$/i, "").split("/").filter(Boolean);
  const destinationAt = segments.findIndex(isHostSegment);
  if (destinationAt > 0) {
    return {
      root: `/${segments.slice(0, destinationAt).join("/")}/`,
      rest: segments.slice(destinationAt).join("/"),
    };
  }
  return { root: "/", rest: segments.join("/") };
}

/** App directory before a destination host segment. */
function rootPath(pathname: string) {
  return splitLocation(pathname).root;
}

function pathAfterRoot(pathname: string) {
  return splitLocation(pathname).rest;
}

let virtual: LocationState | null = null;

function activeLocation(): LocationState {
  if (virtual) return virtual;
  const outer = outerAddress();
  return {
    pathname: outer.pathname,
    search: outer.search,
    hash: outer.hash,
    origin: outer.origin,
  };
}

export function appRootPath() {
  return rootPath(activeLocation().pathname);
}

export function publicBase() {
  const runtime = httpUrl(window.location.href);
  const local = runtime?.hostname === "localhost" || runtime?.hostname === "127.0.0.1";
  // The deployed service has one public home. In an embedded preview the outer
  // page is often a different host, so never let it leak into shared URLs.
  const origin = local && runtime ? runtime.origin : PRODUCTION_ORIGIN;
  const pathname = runtime?.pathname ?? activeLocation().pathname;
  return `${origin}${rootPath(pathname)}`;
}
export const siteBase = publicBase;

function paramsFrom(search: string) {
  return new URLSearchParams(search.replace(/^\?/, ""));
}

function currentLang() {
  return paramsFrom(activeLocation().search).get(LANG_PARAM);
}

/** Escape each path component while preserving destination path separators. */
function encodeRoutePath(value: string) {
  return value
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

/** index-z.pages.dev/YY.net/path — the preferred public link format. */
export function routeToLink(target: string) {
  const bare = stripScheme(target);
  const lang = currentLang();
  const query = lang ? `?${LANG_PARAM}=${encodeURIComponent(lang)}` : "";
  return `${publicBase()}${encodeRoutePath(bare)}${query}`;
}

export function prettyRoute(target: string) {
  return routeToLink(target);
}

export function homeUrl() {
  const lang = currentLang();
  return `${publicBase()}${lang ? `?${LANG_PARAM}=${encodeURIComponent(lang)}` : ""}`;
}

/** Canonical address of a view — language variants are carried by hreflang. */
export function canonicalFor(route: Route) {
  if (route.name === "go") return `${publicBase()}${encodeRoutePath(stripScheme(route.href))}`;
  if (route.name === "error") return `${publicBase()}?${URL_PARAM}=${encodeURIComponent(route.value)}`;
  return publicBase();
}

/** Preserve the active path while switching language. */
export function reflectLang(lang: string) {
  const loc = activeLocation();
  const p = paramsFrom(loc.search);
  if (p.get(LANG_PARAM) === lang) return;
  p.set(LANG_PARAM, lang);
  write({ ...loc, search: `?${p.toString()}` }, "replace");
}

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
    /* fall through */
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

/**
 * A fallback host may hand the app /?url=YY.net/path instead of the typed path.
 * Put the address back into its preferred path form once the app is running, so
 * the bar ends up showing exactly /YY.net/path. Error routes keep the query form.
 */
export function canonicalizeAddress() {
  const loc = activeLocation();
  const params = paramsFrom(loc.search);
  const target = params.get(URL_PARAM);
  if (target === null) return;

  if (classify(target).name !== "go") return;

  const lang = params.get(LANG_PARAM);
  const raw = target.replace(/^https?:\/\//i, "");
  const trailing = /\/$/.test(raw) ? "/" : "";
  write(
    {
      ...loc,
      pathname: `${rootPath(loc.pathname)}${encodeRoutePath(raw)}${trailing}`,
      search: lang ? `?${LANG_PARAM}=${encodeURIComponent(lang)}` : "",
      hash: "",
    },
    "replace",
  );
}

export function readRoute(): Route {
  const loc = activeLocation();
  const target = paramsFrom(loc.search).get(URL_PARAM);
  if (target !== null) return classify(target);

  const pathTarget = pathAfterRoot(loc.pathname);
  if (pathTarget) return classify(safeDecode(pathTarget));

  const hashTarget = paramsFrom(loc.hash.replace(/^#\/?\??/, "")).get(URL_PARAM);
  if (hashTarget) return classify(hashTarget);

  return { name: "home" };
}

function emitNavigation() {
  window.dispatchEvent(new Event(NAV_EVENT));
}

/** Write the actual path and query, preferring the visible same-origin top window. */
function write(next: LocationState, mode: "push" | "replace") {
  const target = `${next.pathname}${next.search}${next.hash}`;
  const top = sameOriginTop();
  const apply = (w: Window, how: "push" | "replace") => {
    if (how === "push") w.history.pushState({}, "", target);
    else w.history.replaceState({}, "", target);
  };

  let written = false;
  if (top) {
    try {
      apply(top, mode);
      written = true;
    } catch {
      /* fall back to the frame */
    }
  }
  try {
    apply(window, top ? "replace" : mode);
    written = true;
  } catch {
    /* virtual state still lets the app show the correct view */
  }
  // In a cross-origin frame activeLocation deliberately reads the outer address.
  // Keep a local route even if the frame history write itself succeeded.
  virtual = written && frameMode() !== "cross" ? null : next;
}

/** Move to an in-site URL without losing the in-memory ledger. */
export function navigate(to: string) {
  try {
    const u = new URL(to, publicBase());
    const next: LocationState = {
      pathname: u.pathname,
      search: u.search,
      hash: u.hash,
      origin: u.origin,
    };
    const current = activeLocation();
    if (current.pathname !== next.pathname || current.search !== next.search || current.hash !== next.hash) {
      write(next, "push");
    }
  } catch {
    /* leave the current route alone on malformed internal URLs */
  }
  emitNavigation();
}

export function goToLink(target: string) {
  navigate(routeToLink(target));
}

export function goToError(value: string) {
  const lang = currentLang();
  const query = new URLSearchParams({ [URL_PARAM]: value });
  if (lang) query.set(LANG_PARAM, lang);
  navigate(`${publicBase()}?${query.toString()}`);
}

export function goHome() {
  navigate(homeUrl());
}

/** Listen to the actual visible address and to internal SPA navigation. */
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
        /* the parent may have gone away */
      }
    }
    window.removeEventListener(NAV_EVENT, cb);
  };
}

export function externalTarget(): "_blank" | "_top" {
  return frameMode() === "none" ? "_blank" : "_top";
}

/** A real crawlable anchor to an in-site view. */
export function internalLink(href: string, before?: () => void) {
  const cross = frameMode() === "cross";
  return {
    href,
    target: cross ? ("_top" as const) : undefined,
    onClick: (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
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
