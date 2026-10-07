import { useEffect } from "react";
import { relativeTime, stripScheme } from "../lib/links";
import { externalTarget, homeUrl, internalLink, prettyRoute } from "../lib/router";
import type { LangCode, T } from "../i18n";
import { Micro } from "./Chrome";
import { Logo } from "./Logo";
import {
  IconAlert,
  IconArrowUpRight,
  IconClock,
  IconClose,
  IconCoin,
  IconCopy,
  IconExternal,
  IconEye,
  IconFlame,
  IconGlobe,
  IconHome,
  IconHourglass,
  IconLink,
  IconQuestion,
  IconShield,
  IconShare,
  IconSpark,
  IconUsers,
} from "./Icons";

function timeAgo(ts: number, now: number, t: T) {
  const r = relativeTime(ts, now);
  if (r.unit === "now") return t("list.now");
  const key = r.unit === "ago" ? "list.ago" : r.unit === "agoH" ? "list.agoH" : "list.agoD";
  return t(key, { n: r.n });
}

function HomeLink({ label }: { label: string }) {
  return (
    <a
      {...internalLink(homeUrl())}
      className="link-underline inline-flex items-center gap-1.5 py-2 text-xs uppercase tracking-luxe text-ink-faint sm:py-0"
    >
      <IconHome size={13} />
      {label}
    </a>
  );
}

/**
 * The page living at index-z.pages.dev/?url=YY.net
 * Nothing is forwarded automatically: the visitor must follow the
 * https://YY.net anchor below to reach the destination.
 */
export function GoPage({
  href,
  title,
  opens,
  createdAt,
  expiresAt,
  known,
  t,
  lang,
  onCopy,
}: {
  href: string;
  title?: string;
  opens: number;
  createdAt?: number;
  expiresAt?: number;
  known: boolean;
  t: T;
  lang: LangCode;
  onCopy: () => void;
}) {
  const fmt = new Intl.NumberFormat(lang);
  const host = stripScheme(href);
  const now = Date.now();
  const minsLeft = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 60_000)) : null;

  return (
    <main className="grain relative flex min-h-[82vh] flex-col items-center justify-center px-4 py-16 text-center sm:px-8">
      <div className="fade-rise w-full max-w-4xl">
        {/* where you are, in this site's own address form */}
        <p className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 font-mono text-[0.7rem] text-ink-faint">
          <IconGlobe size={12} />
          <span className="break-all">{prettyRoute(href)}</span>
        </p>

        <span className="mt-8 flex items-center justify-center gap-2 text-sage">
          <IconExternal size={15} />
          <Micro className="text-sage">{t("go.target")}</Micro>
        </span>

        {/* The destination, written out in full as a plain anchor */}
        <a
          href={href}
          target={externalTarget()}
          rel="noopener noreferrer nofollow"
          className="group mt-5 block break-words font-display text-[clamp(1.7rem,6.4vw,4rem)] leading-[1.08] text-ink transition-opacity duration-500 hover:opacity-70"
        >
          <span className="text-ink-faint">https://</span>
          <span className="underline decoration-sage decoration-1 underline-offset-[0.16em]">
            {host}
          </span>
          <IconArrowUpRight
            size="0.5em"
            className="ml-2 inline-block align-middle text-sage transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </a>

        {title ? (
          <p className="mx-auto mt-6 flex max-w-xl items-center justify-center gap-2 font-display text-lg text-ink-soft">
            <IconLink size={14} className="text-ink-faint" />
            {title}
          </p>
        ) : null}

        <p className="mx-auto mt-6 flex max-w-md items-start justify-center gap-2 text-left text-xs leading-relaxed text-ink-faint">
          <IconShield size={14} className="mt-0.5 shrink-0" />
          <span>{known ? t("go.safety") : t("go.gone")}</span>
        </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={href}
              target={externalTarget()}
              rel="noopener noreferrer nofollow"
              className="flex w-full items-center justify-center gap-2 rounded-full border border-sage bg-sage px-8 py-3 text-center text-xs uppercase tracking-luxe text-paper transition-all duration-300 hover:bg-transparent hover:text-sage sm:w-auto"
            >
              <IconExternal size={14} />
              {t("go.open")}
            </a>
            {typeof navigator !== "undefined" && navigator.share ? (
              <button
                type="button"
                onClick={() =>
                  navigator
                    .share?.({ title, url: prettyRoute(href) })
                    .catch(() => undefined)
                }
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border hairline text-ink-soft transition-colors duration-300 hover:border-sage hover:text-sage"
                aria-label={t("go.share")}
                title={t("go.share")}
              >
                <IconShare size={15} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onCopy}
              className="flex w-full items-center justify-center gap-2 rounded-full border hairline px-8 py-3 text-xs uppercase tracking-luxe text-ink-soft transition-colors duration-300 hover:border-sage hover:text-sage sm:w-auto"
            >
              <IconCopy size={14} />
              {t("go.copy")}
            </button>
            <HomeLink label={t("go.back")} />
          </div>

        <p className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ink-faint">
          <span className="flex items-center gap-1.5 tabular-nums">
            <IconEye size={13} />
            {fmt.format(opens)} {t("stats.opens")}
          </span>
          {createdAt ? (
            <span className="flex items-center gap-1.5">
              <IconClock size={13} />
              {t("go.sharedBy", { ago: timeAgo(createdAt, now, t) })}
            </span>
          ) : null}
          {minsLeft !== null ? (
            <span className="flex items-center gap-1.5">
              <IconHourglass size={13} />
              {minsLeft >= 60
                ? t("list.expiresH", { n: Math.floor(minsLeft / 60) })
                : t("list.expiresM", { n: minsLeft })}
            </span>
          ) : null}
        </p>
      </div>
    </main>
  );
}

export function ErrorPage({ value, t }: { value: string; t: T }) {
  return (
    <main className="grain relative flex min-h-[82vh] flex-col items-center justify-center px-4 py-16 text-center sm:px-8">
      <div className="fade-rise w-full max-w-2xl">
        <span className="inline-grid h-14 w-14 place-items-center rounded-full border hairline text-ink-faint">
          <IconAlert size={24} />
        </span>
        <h1 className="mt-7 font-display text-[clamp(1.7rem,5.6vw,3rem)] leading-tight">
          {t("go.errTitle")}
        </h1>
        <p className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border hairline px-4 py-1.5 font-mono text-xs text-ink-soft">
          <IconLink size={12} />
          <span className="break-all">{value}</span>
        </p>
        <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-ink-faint">
          {t("go.errBody", { q: value })}
        </p>
        <div className="mt-9 flex justify-center">
          <HomeLinkButton label={t("go.errHome")} />
        </div>
      </div>
    </main>
  );
}

function HomeLinkButton({ label }: { label: string }) {
  return (
    <a
      {...internalLink(homeUrl())}
      className="inline-flex items-center gap-2 rounded-full border border-sage bg-sage px-8 py-3 text-xs uppercase tracking-luxe text-paper transition-all duration-300 hover:bg-transparent hover:text-sage"
    >
      <IconHome size={14} />
      {label}
    </a>
  );
}

const NOTES = [
  { n: 1, icon: <IconSpark size={16} /> },
  { n: 2, icon: <IconCoin size={16} /> },
  { n: 3, icon: <IconClock size={16} /> },
  { n: 4, icon: <IconShield size={16} /> },
  { n: 5, icon: <IconUsers size={16} /> },
  { n: 6, icon: <IconExternal size={16} /> },
  { n: 7, icon: <IconAlert size={16} /> },
  { n: 8, icon: <IconFlame size={16} /> },
] as const;

export function HelpSheet({ open, onClose, t }: { open: boolean; onClose: () => void; t: T }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button
        type="button"
        aria-label={t("help.close")}
        onClick={onClose}
        className="fade-in absolute inset-0 cursor-default bg-black/35 backdrop-blur-sm"
      />
      <div className="fade-rise relative z-10 max-h-[88vh] w-full max-w-2xl overflow-y-auto border hairline bg-paper px-5 pb-10 pt-6 shadow-2xl sm:px-10 sm:pb-14">
        <div className="flex items-start justify-between gap-6">
          <div>
            <span className="flex items-center gap-2 text-sage">
              <IconQuestion size={14} />
              <Micro className="text-sage">index-z.</Micro>
            </span>
            <h2 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{t("help.title")}</h2>
            <p className="mt-1 text-xs text-ink-faint">{t("help.sub")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border hairline text-ink-soft transition-colors duration-300 hover:border-sage hover:bg-sage hover:text-paper"
          >
            <IconClose size={15} />
          </button>
        </div>

        <ol className="mt-8 space-y-5">
          {NOTES.map(({ n, icon }) => (
            <li key={n} className="grid gap-2 border-t hairline pt-4 sm:grid-cols-[2.2rem_1fr] sm:gap-4">
              <span className="text-sage">{icon}</span>
              <div>
                <h3 className="font-display text-lg leading-snug">{t(`help.${n}.t` as never)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  {t(`help.${n}.b` as never)}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 border hairline bg-paper-2/70 p-4">
            <IconCoin size={22} className="shrink-0 text-sage" />
            <p className="text-left font-mono text-[0.8rem] leading-snug">
              example.com/aiueo
              <span className="mt-1 block text-sage">= 17 index</span>
              <span className="mt-1 block text-xs text-ink-faint">https:// not counted</span>
              <span className="mt-1 block text-xs text-ink-faint">10 s online = +1 index</span>
            </p>
          </div>
          <div className="flex items-center gap-3 border hairline bg-paper-2/70 p-4">
            <IconHourglass size={22} className="shrink-0 text-sage" />
            <p className="text-left text-sm leading-snug">
              24 h lifetime
              <span className="mt-0.5 block text-xs text-ink-faint">
                renewable · memory only · no database
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-sage bg-sage px-8 py-3 text-xs uppercase tracking-luxe text-paper transition-all duration-300 hover:bg-transparent hover:text-sage"
        >
          <IconClose size={14} />
          {t("help.close")}
        </button>
      </div>
    </div>
  );
}

export { Logo };
