import { useEffect, useState } from "react";
import { isOwn, relativeTime, renewCost, stripScheme, type LinkRecord } from "../lib/links";
import { internalLink, prettyRoute, routeToLink } from "../lib/router";
import type { LangCode, T } from "../i18n";
import { Micro } from "./Chrome";
import {
  IconArrowUpRight,
  IconClock,
  IconCopy,
  IconEye,
  IconFlame,
  IconHourglass,
  IconLink,
  IconPlus,
  IconSearch,
  IconSpark,
  IconTrash,
  IconUsers,
} from "./Icons";

function timeAgo(ts: number, now: number, t: T) {
  const r = relativeTime(ts, now);
  if (r.unit === "now") return t("list.now");
  const key = r.unit === "ago" ? "list.ago" : r.unit === "agoH" ? "list.agoH" : "list.agoD";
  return t(key, { n: r.n });
}

/** Human wording for the time a link has left. */
function timeLeft(expiresAt: number, now: number, t: T) {
  const mins = Math.max(0, Math.floor((expiresAt - now) / 60_000));
  if (mins <= 0) return t("list.expiresNow");
  if (mins < 60) return t("list.expiresM", { n: mins });
  return t("list.expiresH", { n: Math.floor(mins / 60) });
}

/** Share of the 24-hour life still remaining, 0…1 */
function lifeLeft(link: LinkRecord, now: number) {
  const total = link.expiresAt - link.createdAt;
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (link.expiresAt - now) / total));
}

/** Within an hour of the end, the row should read as urgent. */
function isUrgent(link: LinkRecord, now: number) {
  return link.expiresAt - now < 60 * 60 * 1000;
}

function LifeRing({ ratio, urgent }: { ratio: number; urgent: boolean }) {
  const r = 6.5;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 18 18"
      className={`h-3.5 w-3.5 -rotate-90 ${urgent ? "text-clay breathe" : "text-sage"}`}
      aria-hidden
    >
      <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.25" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - ratio)}
      />
    </svg>
  );
}

const chipBtn =
  "grid h-7 w-7 place-items-center rounded-full border hairline text-ink-soft transition-colors duration-300 hover:bg-sage hover:text-paper hover:border-sage disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-ink-soft disabled:hover:border-rule";

function Row({
  link,
  now,
  rank,
  index,
  me,
  t,
  lang,
  balance,
  onRemove,
  onCopied,
  onRenew,
}: {
  link: LinkRecord;
  now: number;
  rank?: number;
  index: number;
  me: string;
  t: T;
  lang: LangCode;
  balance: number;
  onRemove: (id: string) => void;
  onCopied: () => void;
  onRenew: (link: LinkRecord) => void;
}) {
  const own = isOwn(link, me);
  const fmt = new Intl.NumberFormat(lang);
  const href = routeToLink(link.url);
  const ratio = lifeLeft(link, now);
  const urgent = isUrgent(link, now);
  const fee = renewCost(link.url);
  const canRenew = balance >= fee;

  return (
    <li
      className="group relative border-b hairline last:border-b-0"
      style={
        index < 14
          ? { animation: `fade-rise 560ms cubic-bezier(0.22,1,0.36,1) ${index * 45}ms both` }
          : undefined
      }
    >
      <a
        {...internalLink(href)}
        className="block px-1 pb-5 pt-4 pr-16 transition-colors duration-300 hover:bg-mist/45"
      >
        <div className="flex items-start justify-between gap-4">
          <span className="min-w-0">
            {rank !== undefined ? (
              <span className="mr-2 font-mono text-[0.65rem] text-ink-faint tabular-nums">
                {String(rank).padStart(2, "0")}
              </span>
            ) : null}
            <span className="font-display text-xl leading-snug text-ink sm:text-[1.3rem]">
              {link.title}
            </span>
            <IconArrowUpRight
              size={14}
              className="ml-1.5 inline-block align-middle text-ink-faint opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          </span>
          <span className="mt-1 flex shrink-0 flex-col items-end">
            <span className="flex items-center gap-1 font-display text-base tabular-nums text-ink">
              <IconEye size={13} className="text-ink-faint" />
              {fmt.format(link.opens)}
            </span>
          </span>
        </div>

        <span className="mt-1.5 flex items-center gap-1.5 truncate font-mono text-xs text-ink-faint">
          <IconLink size={12} />
          <span className="truncate">{stripScheme(link.url)}</span>
        </span>

        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-1 rounded-full border hairline px-2 py-0.5 text-[0.55rem] uppercase tracking-luxe text-ink-soft">
            {own ? <IconSpark size={10} /> : <IconUsers size={10} />}
            {own ? t("list.you") : t("list.net")}
          </span>
          <span className="flex items-center gap-1 text-ink-faint">
            <IconClock size={11} />
            <Micro>{timeAgo(link.createdAt, now, t)}</Micro>
          </span>
          <span
            className={`flex items-center gap-1.5 ${urgent ? "text-clay" : "text-ink-faint"}`}
            title={t("renew.one")}
          >
            <LifeRing ratio={ratio} urgent={urgent} />
            <Micro className={urgent ? "text-clay" : undefined}>
              {timeLeft(link.expiresAt, now, t)}
            </Micro>
          </span>
        </span>
      </a>

      {/* how much of the 24 h lifetime is left, draining left to right */}
      <span
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] bg-rule/40"
        aria-hidden
      >
        <span
          className={`block h-full transition-[width] duration-1000 ease-linear ${
            urgent ? "bg-clay" : "bg-sage/70"
          }`}
          style={{ width: `${ratio * 100}%`, opacity: 0.75 }}
        />
      </span>

      <div className="absolute right-1 top-4 flex gap-1.5 opacity-80 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onRenew(link)}
          disabled={!canRenew}
          title={`${t("renew.one")} · ${t("form.costValue", { n: fee })}`}
          aria-label={t("renew.one")}
          className={chipBtn}
        >
          <IconHourglass size={13} />
        </button>
        <button
          type="button"
          title={t("list.copy")}
          aria-label={t("list.copy")}
          onClick={() => {
            const value = prettyRoute(link.url);
            navigator.clipboard?.writeText(value).then(onCopied, onCopied);
          }}
          className={chipBtn}
        >
          <IconCopy size={13} />
        </button>
        {own ? (
          <button
            type="button"
            title={t("list.remove")}
            aria-label={t("list.remove")}
            onClick={() => onRemove(link.id)}
            className={chipBtn}
          >
            <IconTrash size={13} />
          </button>
        ) : null}
      </div>
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <li className="px-1 py-12">
      <span className="mb-3 block text-ink-faint/60">
        <IconHourglass size={26} />
      </span>
      <p className="max-w-xs font-display text-lg leading-relaxed text-ink-faint">{text}</p>
    </li>
  );
}

function ColumnHead({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <header className="flex items-baseline justify-between gap-3 border-b hairline pb-3">
      <h2 className="flex items-center gap-2 font-display text-2xl">
        <span className="text-sage">{icon}</span>
        {title}
      </h2>
      <Micro className="tabular-nums">{count}</Micro>
    </header>
  );
}

export function LinkColumns({
  t,
  lang,
  all,
  me,
  balance,
  onRemove,
  onCopied,
  onRenewAll,
  onRenew,
}: {
  t: T;
  lang: LangCode;
  all: LinkRecord[];
  me: string;
  balance: number;
  onRemove: (id: string) => void;
  onCopied: () => void;
  onRenewAll: () => void;
  onRenew: (link: LinkRecord) => void;
}) {
  const [q, setQ] = useState("");
  const [now, setNow] = useState(() => Date.now());

  /* Ticks every 30 s so the countdowns and draining bars stay honest. */
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? all.filter(
        (l) => l.title.toLowerCase().includes(needle) || l.url.toLowerCase().includes(needle),
      )
    : all;

  const newest = filtered.slice(0, 40);
  const top = [...filtered].sort((a, b) => b.opens - a.opens || b.createdAt - a.createdAt).slice(0, 40);

  /* Renewing costs the same per link as publishing it did. */
  const renewTotal = all.reduce((sum, l) => sum + renewCost(l.url), 0);
  const canRenewAll = all.length > 0 && balance >= renewTotal;

  return (
    <section className="px-4 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="relative flex w-full items-center sm:max-w-xs">
            <IconSearch size={14} className="pointer-events-none absolute left-0 text-ink-faint" />
            <label htmlFor="q" className="sr-only">
              {t("search.ph")}
            </label>
            <input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search.ph")}
              className="w-full border-b hairline bg-transparent pb-2 pl-6 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-sage"
            />
          </div>

          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <Micro className="tabular-nums">
              {filtered.length} / {all.length}
            </Micro>

            <button
              type="button"
              onClick={onRenewAll}
              disabled={!canRenewAll}
              title={
                all.length === 0
                  ? t("renew.empty")
                  : canRenewAll
                    ? `${t("renew.allLong")} · ${t("form.costValue", { n: renewTotal })}`
                    : t("renew.needMore", { n: renewTotal - balance })
              }
              className="flex shrink-0 items-center gap-2 rounded-full border border-sage px-4 py-2 text-[0.65rem] uppercase tracking-luxe text-sage transition-all duration-300 hover:bg-sage hover:text-paper disabled:cursor-not-allowed disabled:border-rule disabled:text-ink-faint disabled:hover:bg-transparent disabled:hover:text-ink-faint"
            >
              <IconHourglass size={13} />
              <span>{t("renew.all")}</span>
              <span className="rounded-full border border-current/40 px-1.5 py-px text-[0.6rem] tabular-nums opacity-80">
                {t("renew.plus")}
              </span>
              <span className="tabular-nums opacity-70">
                {all.length > 0 ? renewTotal : "—"}
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-10 pb-4 lg:grid-cols-2 lg:gap-0">
          <div className="lg:border-r lg:hairline lg:pr-8">
            <ColumnHead icon={<IconSpark size={18} />} title={t("col.newest")} count={newest.length} />
            <ul className="lg:max-h-[62vh] lg:overflow-y-auto lg:pr-2">
              {newest.length === 0 ? (
                <Empty text={needle ? t("col.empty.filtered", { q }) : t("col.empty.new")} />
              ) : (
                newest.map((l, i) => (
                  <Row
                    key={l.id}
                    link={l}
                    now={now}
                    index={i}
                    me={me}
                    t={t}
                    lang={lang}
                    balance={balance}
                    onRemove={onRemove}
                    onCopied={onCopied}
                    onRenew={onRenew}
                  />
                ))
              )}
            </ul>
          </div>

          <div className="lg:pl-8">
            <ColumnHead icon={<IconFlame size={18} />} title={t("col.top")} count={top.length} />
            <ul className="lg:max-h-[62vh] lg:overflow-y-auto lg:pr-2">
              {top.length === 0 ? (
                <Empty text={needle ? t("col.empty.filtered", { q }) : t("col.empty.top")} />
              ) : (
                top.map((l, i) => (
                  <Row
                    key={l.id}
                    link={l}
                    now={now}
                    index={i}
                    rank={i + 1}
                    me={me}
                    t={t}
                    lang={lang}
                    balance={balance}
                    onRemove={onRemove}
                    onCopied={onCopied}
                    onRenew={onRenew}
                  />
                ))
              )}
            </ul>
          </div>
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-[0.65rem] text-ink-faint lg:hidden">
          <IconPlus size={11} />
          {t("renew.allLong")}
        </p>
      </div>
    </section>
  );
}
