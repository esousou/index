import { useCallback, useEffect, useRef, useState } from "react";
import { LANGS, type LangCode, type T } from "../i18n";
import { Logo } from "./Logo";
import { wallet, type WalletState } from "../lib/wallet";
import type { MeshState } from "../lib/mesh";
import { prettyRoute } from "../lib/router";
import type { ThemeChoice } from "../lib/theme";
import { homeUrl, internalLink } from "../lib/router";
import { cn } from "../utils/cn";
import {
  IconArchive,
  IconChevronDown,
  IconCoin,
  IconCopy,
  IconEye,
  IconHourglass,
  IconLanguage,
  IconLink,
  IconMonitor,
  IconMoon,
  IconQuestion,
  IconShield,
  IconSignal,
  IconSun,
  IconUsers,
  IconWifiOff,
} from "./Icons";

export function Micro({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("text-[0.62rem] uppercase tracking-luxe text-ink-faint", className)}>
      {children}
    </span>
  );
}

const roundBtn =
  "grid h-9 w-9 shrink-0 place-items-center rounded-full border hairline text-ink-soft transition-colors duration-300 hover:bg-sage hover:text-paper hover:border-sage";

/**
 * Ambient field: concentric arcs echoing the mark in the logo, drifting very
 * slowly behind everything. Purely decorative, never intercepts pointer events.
 */
export function Ambient() {
  const arcs = [26, 34, 42, 50, 58, 66];
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 40rem at 8% -10%, color-mix(in srgb, var(--c-sage) 12%, transparent), transparent 70%)," +
            "radial-gradient(50rem 36rem at 100% 108%, color-mix(in srgb, var(--c-clay) 14%, transparent), transparent 72%)",
        }}
      />
      <svg
        viewBox="0 0 200 120"
        preserveAspectRatio="xMidYMax slice"
        className="drift absolute -bottom-[38vh] left-1/2 h-[130vh] w-[190vw] -translate-x-1/2 text-sage"
      >
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          {arcs.map((r, i) => (
            <circle
              key={r}
              cx="100"
              cy="120"
              r={r}
              strokeWidth={0.22 + i * 0.04}
              opacity={0.3 - i * 0.035}
            />
          ))}
        </g>
      </svg>
      <svg
        viewBox="0 0 120 120"
        className="drift-slow absolute -right-24 -top-28 h-[34rem] w-[34rem] text-clay opacity-45"
      >
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          {[20, 30, 40, 50].map((r, i) => (
            <circle key={r} cx="60" cy="60" r={r} strokeWidth={0.3 + i * 0.06} opacity={0.4 - i * 0.07} />
          ))}
        </g>
      </svg>
    </div>
  );
}

/** Hairline that tracks how far the visitor has scrolled. */
export function ScrollRule() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setPct(max > 0 ? Math.min(1, doc.scrollTop / max) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-px" aria-hidden>
      <div
        className="h-full bg-sage transition-[width] duration-150 ease-out"
        style={{ width: `${pct * 100}%`, opacity: pct > 0.005 ? 0.85 : 0 }}
      />
    </div>
  );
}

export function Header({
  lang,
  onLang,
  onHelp,
  theme,
  onSetTheme,
  t,
}: {
  lang: LangCode;
  onLang: (l: LangCode) => void;
  onHelp: () => void;
  theme: ThemeChoice;
  onSetTheme: (c: ThemeChoice) => void;
  t: T;
}) {
  const themes: { key: ThemeChoice; icon: React.ReactNode; label: string }[] = [
    { key: "light", icon: <IconSun size={14} />, label: t("nav.light") },
    { key: "dark", icon: <IconMoon size={14} />, label: t("nav.dark") },
    { key: "browser", icon: <IconMonitor size={14} />, label: t("nav.browser") },
  ];

  return (
    <header className="sticky top-0 z-30 border-b hairline bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
        <a
          {...internalLink(homeUrl())}
          className="text-ink transition-opacity hover:opacity-70"
          aria-label="index-z."
        >
          <Logo />
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex items-center">
            <IconLanguage
              className="pointer-events-none absolute left-2.5 text-ink-faint"
              size={13}
            />
            <select
              aria-label={t("nav.lang")}
              value={lang}
              onChange={(e) => onLang(e.target.value as LangCode)}
              className="appearance-none rounded-full border hairline bg-transparent py-1.5 pl-8 pr-7 text-xs text-ink-soft transition-colors hover:border-sage"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <IconChevronDown
              className="pointer-events-none absolute right-2.5 text-ink-faint"
              size={11}
            />
          </div>

          <div
            role="group"
            aria-label={t("nav.theme")}
            className="hidden items-center rounded-full border hairline p-0.5 sm:flex"
          >
            {themes.map((o) => {
              const active = theme === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => onSetTheme(o.key)}
                  aria-pressed={active}
                  aria-label={o.label}
                  title={o.label}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full transition-colors duration-300",
                    active
                      ? "bg-sage text-paper"
                      : "text-ink-faint hover:text-ink",
                  )}
                >
                  {o.icon}
                </button>
              );
            })}
          </div>

          {/* compact control for small screens */}
          <button
            type="button"
            onClick={() =>
              onSetTheme(theme === "light" ? "dark" : theme === "dark" ? "browser" : "light")
            }
            aria-label={t("nav.theme")}
            title={`${t("nav.theme")}: ${themes.find((x) => x.key === theme)?.label ?? ""}`}
            className={cn(roundBtn, "sm:hidden")}
          >
            {theme === "light" ? (
              <IconSun size={16} />
            ) : theme === "dark" ? (
              <IconMoon size={16} />
            ) : (
              <IconMonitor size={16} />
            )}
          </button>

          <button
            type="button"
            onClick={onHelp}
            aria-label={t("nav.help")}
            title={t("nav.help")}
            className={roundBtn}
          >
            <IconQuestion size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}

function Ring({ seconds }: { seconds: number }) {
  const r = 8.5;
  const c = 2 * Math.PI * r;
  const pct = (10 - seconds) / 10;
  return (
    <svg viewBox="0 0 22 22" className="h-8 w-8 shrink-0 -rotate-90 text-sage">
      <circle cx="11" cy="11" r={r} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.22" />
      <circle
        cx="11"
        cy="11"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        style={{ transition: "stroke-dashoffset 950ms linear" }}
      />
    </svg>
  );
}

export function WalletBar({
  w,
  mesh,
  links,
  opens,
  seconds,
  t,
  lang,
  onCopySite,
  pulse,
}: {
  w: WalletState;
  mesh: MeshState;
  links: number;
  opens: number;
  seconds: number;
  t: T;
  lang: LangCode;
  onCopySite: () => void;
  pulse: number;
}) {
  /* Flash the peer indicator the moment the network hands us something. */
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (!pulse) return;
    setFlashing(true);
    const id = window.setTimeout(() => setFlashing(false), 1100);
    return () => window.clearTimeout(id);
  }, [pulse]);
  const fmt = new Intl.NumberFormat(lang);
  const integrityLabel =
    w.integrity === "sealed" ? t("wallet.sealed") : w.integrity === "pending" ? t("wallet.pending") : "⚠";

  const stats = [
    { k: t("stats.links"), v: fmt.format(links), icon: <IconLink size={13} /> },
    { k: t("stats.opens"), v: fmt.format(opens), icon: <IconEye size={13} /> },
    { k: t("stats.spent"), v: fmt.format(w.spent), icon: <IconCoin size={13} /> },
  ];

  return (
    <section className="border-b hairline bg-paper-2/60">
      <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.05fr_1fr_1fr] lg:items-center">
        <div className="flex items-end gap-3">
          <div>
            <span className="flex items-center gap-1.5 text-ink-faint">
              <IconCoin size={12} />
              <Micro>{t("wallet.balance")}</Micro>
            </span>
            <p className="font-display text-5xl leading-none tabular-nums sm:text-[3.3rem]">
              {fmt.format(w.balance)}
            </p>
          </div>
          <div className="flex items-center gap-2 pb-2 text-ink-soft">
            <Ring seconds={seconds} />
            <span className="text-xs leading-tight">
              {w.online ? t("wallet.earn", { s: 10 - seconds }) : t("wallet.offline")}
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-3 border-y hairline py-3 sm:border-y-0 sm:py-0">
          {stats.map((s) => (
            <div key={s.k}>
              <dd className="font-display text-2xl leading-none tabular-nums">{s.v}</dd>
              <dt className="mt-1.5 flex items-center gap-1.5 text-ink-faint">
                {s.icon}
                <Micro>{s.k}</Micro>
              </dt>
            </div>
          ))}
        </dl>

        <ul className="space-y-1.5 text-xs text-ink-soft">
          <li className="flex items-center gap-2">
            <span
              className={cn(
                "grid h-4 w-4 place-items-center rounded-full",
                flashing && "pulse-ring",
              )}
            >
              {mesh.status === "online" ? (
                <IconUsers size={13} className="text-sage" />
              ) : (
                <IconSignal size={13} className="text-ink-faint" />
              )}
            </span>
            <span className={cn("transition-opacity duration-500", flashing && "opacity-100")}>
              {mesh.status === "online"
                ? t("wallet.peers", { n: mesh.peers.length })
                : t("wallet.solo")}
            </span>
          </li>

          <li className="flex items-center gap-2">
            <IconShield size={13} className={w.integrity === "sealed" ? "text-sage" : "text-ink-faint"} />
            <span className="flex items-center gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 w-1 rounded-[1px] transition-colors",
                    i === 0 || (w.integrity !== "pending" && i <= w.remoteShards)
                      ? "bg-sage"
                      : "bg-ink-faint/40",
                  )}
                />
              ))}
            </span>
            <span>{integrityLabel}</span>
          </li>

          <li className="flex items-center gap-2">
            <IconHourglass size={13} className="text-ink-faint" />
            <span>{t("wallet.volatile")}</span>
          </li>

          <li className="flex items-center gap-2">
            {w.online ? (
              <IconArchive size={13} className="text-ink-faint" />
            ) : (
              <IconWifiOff size={13} className="text-ink-faint" />
            )}
            <button
              type="button"
              onClick={onCopySite}
              title={t("go.copy")}
              className="link-underline flex items-center gap-1.5 font-mono text-[0.68rem] text-ink-faint"
            >
              {t("wallet.format")}
              <IconCopy size={11} />
            </button>
          </li>
        </ul>
      </div>
    </section>
  );
}

export interface ToastItem {
  id: number;
  text: string;
}

export function Toasts({ items }: { items: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {items.map((i) => (
        <div
          key={i.id}
          className="fade-rise flex max-w-full items-center gap-2 rounded-full border border-sage bg-sage px-4 py-2 text-center text-xs text-paper shadow-lg"
        >
          <IconLink size={12} />
          {i.text}
        </div>
      ))}
    </div>
  );
}

export function useToasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const push = useCallback((text: string) => {
    seq.current += 1;
    const id = seq.current;
    setItems((prev) => [...prev.slice(-2), { id, text }]);
    const timer = window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 2800);
    timers.current.push(timer);
  }, []);

  return { items, push };
}

export function Footer({ t }: { t: T }) {
  return (
    <footer className="mt-16 border-t hairline">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Logo className="text-ink-faint" wordmark={false} />
        <p className="flex items-center gap-2">
          <IconHourglass size={13} />
          {t("footer.note")}
        </p>
      </div>
    </footer>
  );
}

export { wallet, prettyRoute };
