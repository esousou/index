import { LANGS, type LangCode } from "../i18n";

export const LANG_PARAM = "lang";

const LOCALES: Record<LangCode, string> = {
  en: "en_US",
  zh: "zh_CN",
  ko: "ko_KR",
  ja: "ja_JP",
  es: "es_ES",
  fr: "fr_FR",
};

export interface SeoInput {
  title: string;
  description: string;
  /** Absolute canonical URL, without the lang parameter. */
  canonical: string;
  lang: LangCode;
  type?: "website" | "article";
  jsonLd?: unknown;
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]:not([hreflang])`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Append ?lang=xx (or &lang=xx) to an absolute URL. */
export function langUrl(canonical: string, lang: LangCode) {
  try {
    const u = new URL(canonical);
    u.searchParams.set(LANG_PARAM, lang);
    return u.toString();
  } catch {
    return canonical;
  }
}

/**
 * Rewrite the document head for the current view: title, description, robots,
 * canonical, Open Graph, Twitter, six hreflang alternates and JSON-LD.
 * Everything is derived from the live origin, so it is correct on any domain.
 */
export function applySeo(input: SeoInput) {
  const { title, description, canonical, lang } = input;
  const type = input.type ?? "website";

  document.title = title;
  document.documentElement.lang = lang;

  upsertMeta('meta[name="description"]', { name: "description", content: description });
  upsertMeta('meta[name="robots"]', {
    name: "robots",
    content: "index, follow, max-image-preview:large, max-snippet:-1",
  });

  upsertLink("canonical", canonical);

  upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "index." });
  upsertMeta('meta[property="og:type"]', { property: "og:type", content: type });
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
  upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
  upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
  upsertMeta('meta[property="og:locale"]', { property: "og:locale", content: LOCALES[lang] });

  upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary" });
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  upsertMeta('meta[name="twitter:description"]', {
    name: "twitter:description",
    content: description,
  });

  /* hreflang: one real, reachable URL per language, plus x-default. */
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((n) => n.remove());
  for (const l of LANGS) {
    const link = document.createElement("link");
    link.rel = "alternate";
    link.hreflang = l.code;
    link.href = langUrl(canonical, l.code);
    document.head.appendChild(link);
  }
  const dflt = document.createElement("link");
  dflt.rel = "alternate";
  dflt.hreflang = "x-default";
  dflt.href = canonical;
  document.head.appendChild(dflt);

  let script = document.head.querySelector<HTMLScriptElement>('script[data-seo="ld"]');
  if (input.jsonLd === undefined) {
    script?.remove();
    return;
  }
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-seo", "ld");
    document.head.appendChild(script);
  }
  try {
    script.textContent = JSON.stringify(input.jsonLd);
  } catch {
    script.remove();
  }
}
