import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Ambient, Footer, Header, Micro, ScrollRule, Toasts, WalletBar, useToasts } from "./components/Chrome";
import { LinkColumns } from "./components/LinkColumns";
import { LinkForm } from "./components/LinkForm";
import { ErrorPage, GoPage, HelpSheet } from "./components/Pages";
import { IconCoin, IconEye, IconGlobe, IconHourglass, IconLink, IconUsers } from "./components/Icons";
import { detectLang, LANGS, translate, type Key, type LangCode } from "./i18n";
import {
  isOwn,
  linkKey,
  makeLink,
  renewCost,
  RENEW_MS,
  stripScheme,
  type LinkRecord,
} from "./lib/links";
import {
  canonicalFor,
  goToError,
  homeUrl,
  prettyRoute,
  publicBase,
  readRoute,
  reflectLang,
  subscribeAddress,
  type Route,
} from "./lib/router";
import { applySeo, LANG_PARAM } from "./lib/seo";
import { linkStore } from "./lib/store";
import { Mesh, type MeshState, type Shard } from "./lib/mesh";
import { useTheme } from "./lib/theme";
import { wallet } from "./lib/wallet";
import { cn } from "./utils/cn";

const LANG_KEY = "index.lang.v1";

export default function App() {
  const [lang, setLang] = useState<LangCode>(() => {
    // ?lang=xx wins: it is what the hreflang alternates point at.
    const fromQuery = new URLSearchParams(window.location.search).get(LANG_PARAM);
    if (fromQuery && LANGS.some((l) => l.code === fromQuery)) {
      return fromQuery as LangCode;
    }
    try {
      const saved = localStorage.getItem(LANG_KEY) as LangCode | null;
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    return detectLang();
  });

  const t = useCallback(
    (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );

  const { choice: themeChoice, setChoice: setThemeChoice } = useTheme();
  const w = useSyncExternalStore(wallet.subscribe, wallet.getSnapshot);
  const snapshot = useSyncExternalStore(linkStore.subscribe, linkStore.getSnapshot);
  const [meshState, setMeshState] = useState<MeshState>({
    status: "booting",
    slot: 0,
    peers: [],
    deliveries: 0,
    note: "",
  });
  const [route, setRoute] = useState<Route>(() => readRoute());
  const [help, setHelp] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [pulse, setPulse] = useState(0);
  const { items, push } = useToasts();
  const meshRef = useRef<Mesh | null>(null);
  const busRef = useRef<BroadcastChannel | null>(null);
  const tick = useRef(0);
  const langTouched = useRef(false);
  /* This visitor's author signature: the only thing that makes a link "yours". */
  const me = useMemo(() => wallet.signature(), []);

  /* ---------- language ---------- */
  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;
    // Only rewrite the address bar once the visitor actively picks a language,
    // so a first load never grows a ?lang= nobody asked for.
    if (langTouched.current) reflectLang(lang);
    langTouched.current = true;
  }, [lang]);

  /* ---------- document head: title, canonical, hreflang, JSON-LD ---------- */
  useEffect(() => {
    const canonical = canonicalFor(route);
    // Public root as the visitor sees it (correct even when the app is framed).
    const root = publicBase();
    const origin = root.replace(/\/$/, "");

    if (route.name === "go") {
      const record = linkStore.byUrl(route.href);
      applySeo({
        title: `${route.href} — index-z.`,
        description: record?.title ?? t("go.safety"),
        canonical,
        lang,
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: route.href,
            url: canonical,
            description: record?.title ?? undefined,
            inLanguage: lang,
            isPartOf: { "@type": "WebSite", name: "index-z.", url: `${origin}/` },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "index-z.", item: `${origin}/` },
              { "@type": "ListItem", position: 2, name: stripScheme(route.href), item: canonical },
            ],
          },
        ],
      });
      return;
    }

    if (route.name === "error") {
      applySeo({
        title: `${t("go.errTitle")} — index-z.`,
        description: t("go.errBody", { q: route.value }),
        canonical,
        lang,
      });
      return;
    }

    // Home: advertise the live ledger as structured data as well as anchors.
    const items = snapshot.all.slice(0, 60).map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: l.title,
      url: prettyRoute(l.url),
    }));

    applySeo({
      title: `index-z. — ${t("app.tagline")}`,
      description: t("hero.sub"),
      canonical,
      lang,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "index-z.",
          url: `${origin}/`,
          description: t("hero.sub"),
          inLanguage: LANGS.map((l) => l.code),
        },
        items.length > 0
          ? { "@context": "https://schema.org", "@type": "ItemList", name: "index-z.", itemListElement: items }
          : null,
      ].filter(Boolean),
    });
  }, [route, lang, t, snapshot.all]);

  /* ---------- routing: /YY.net, navigated without a reload ---------- */
  useEffect(() => {
    const sync = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    // Watches the address the visitor actually sees (the top window when framed).
    return subscribeAddress(sync);
  }, []);

  /* ---------- fold incoming links in, and say so when the network speaks ---------- */
  const ingest = useCallback(
    (list: LinkRecord[]) => {
      const known = new Set(linkStore.getSnapshot().all.map((l) => linkKey(l.url)));
      linkStore.mergeMany(list);
      const fresh = linkStore.getSnapshot().all.filter((l) => !known.has(linkKey(l.url))).length;
      if (fresh > 0) {
        setPulse(Date.now());
        push(t("toast.network", { n: fresh }));
      }
    },
    [push, t],
  );

  const ingestRef = useRef(ingest);
  useEffect(() => {
    ingestRef.current = ingest;
  }, [ingest]);

  /* ---------- keyboard: / search, N new link, ? help ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

      if (e.key === "Escape") {
        if (typing) (el as HTMLElement).blur();
        setHelp(false);
        return;
      }
      if (typing) return;

      const focus = (id: string) => {
        const node = document.getElementById(id) as HTMLInputElement | null;
        if (!node) return false;
        node.focus();
        node.select?.();
        return true;
      };

      if (e.key === "?") {
        e.preventDefault();
        setHelp((open) => !open);
      } else if (e.key === "/") {
        if (focus("q")) e.preventDefault();
      } else if (e.key === "n" || e.key === "N") {
        if (focus("url")) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- peer mesh: the only place links live ---------- */
  useEffect(() => {
    const mesh = new Mesh({
      onLinks: (list) => ingestRef.current(list),
      onShard: (s) => {
        if (s.walletId === wallet.walletId) wallet.witnessShard(s.idx, s.value);
        else wallet.rememberShard(s.walletId, s.idx, s.value);
      },
      onShardRequest: (walletId, idx) => wallet.recallShard(walletId, idx),
      onSelfShards: () => wallet.shardsForPeers(),
    });
    mesh.exporter = () => linkStore.exportAll();
    mesh.subscribe(() => setMeshState(mesh.getSnapshot()));
    setMeshState(mesh.getSnapshot());
    mesh.start();
    meshRef.current = mesh;
    return () => {
      mesh.destroy();
      meshRef.current = null;
    };
  }, []);

  /* ---------- sweep links past their 24 hour life ---------- */
  useEffect(() => {
    const sweep = () => {
      linkStore.sweep();
    };
    const id = window.setInterval(sweep, 30_000);
    return () => window.clearInterval(id);
  }, []);

  /* ---------- tab-to-tab bus ---------- */
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("index-z.commons.v1");
    ch.onmessage = (e: MessageEvent) => {
      const msg = e.data as {
        t: string;
        link?: LinkRecord;
        links?: LinkRecord[];
        shard?: Shard;
      };
      if (!msg || typeof msg.t !== "string") return;
      if (msg.t === "hello") {
        ch.postMessage({ t: "links", links: linkStore.exportAll().slice(0, 60) });
      } else if (msg.t === "links" && msg.links) {
        ingestRef.current(msg.links);
      } else if (msg.t === "link" && msg.link) {
        ingestRef.current([msg.link]);
      } else if (msg.t === "shard" && msg.shard) {
        if (msg.shard.walletId === wallet.walletId) wallet.witnessShard(msg.shard.idx, msg.shard.value);
        else wallet.rememberShard(msg.shard.walletId, msg.shard.idx, msg.shard.value);
      }
    };
    ch.postMessage({ t: "hello" });
    busRef.current = ch;
    return () => {
      ch.onmessage = null;
      ch.close();
      busRef.current = null;
    };
  }, []);

  /* ---------- prove the balance against peer-held shards ---------- */
  useEffect(() => {
    let alive = true;
    const verify = async () => {
      const mesh = meshRef.current;
      if (!mesh || mesh.peerCount() === 0) return;
      for (const idx of [1, 2, 3]) {
        const value = await mesh.requestShard(wallet.walletId, idx);
        if (!alive) return;
        if (!value) continue;
        if (wallet.shardMatches(idx, value)) wallet.witnessShard(idx, value);
        else mesh.publishShards(wallet.shardsForPeers());
      }
    };
    const id = window.setInterval(verify, 9000);
    window.setTimeout(verify, 4000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  /* ---------- one index per ten seconds online ---------- */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      tick.current += 1;
      setSeconds(tick.current % 10);
      if (tick.current % 10 === 0) {
        wallet.earn(1);
        meshRef.current?.publishShards(wallet.shardsForPeers());
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  /* ---------- connectivity ---------- */
  useEffect(() => {
    wallet.setOnline(navigator.onLine);
    const on = () => {
      wallet.setOnline(true);
      push(t("toast.online"));
    };
    const off = () => {
      wallet.setOnline(false);
      push(t("toast.offline"));
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [t, push]);

  /* ---------- count an open when a destination route is reached ---------- */
  // After a full-page arrival (e.g. top-level navigation from a frame) the ledger
  // is empty until peers sync, so wait for the record to exist before counting.
  const goKnown =
    route.name === "go" && snapshot.all.some((l) => linkKey(l.url) === linkKey(route.href));

  useEffect(() => {
    if (route.name !== "go" || !goKnown) return;
    const key = `index.seen.${route.href}`;
    try {
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last < 15_000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      /* storage blocked — count it anyway, it is only a tally */
    }
    linkStore.bump(route.href, me);
    const record = linkStore.byUrl(route.href);
    if (record) {
      meshRef.current?.broadcastLink(record);
      busRef.current?.postMessage({ t: "link", link: record });
    }
  }, [route, goKnown, me]);

  /* ---------- actions ---------- */
  const handleAdd = useCallback(
    (href: string, title: string, cost: number) => {
      if (linkStore.has(href)) {
        push(t("toast.dupe"));
        return;
      }
      if (!wallet.spend(cost)) {
        push(t("toast.poor"));
        return;
      }
      const link = makeLink({ href, title, author: wallet.signature(), origin: "you", lang });
      linkStore.add(link);
      meshRef.current?.broadcastLink(link);
      meshRef.current?.publishShards(wallet.shardsForPeers());
      busRef.current?.postMessage({ t: "link", link });
      push(t("toast.added", { n: cost }));
    },
    [lang, push, t],
  );

  /* Only the author can take a link down. The removal is broadcast as a tombstone
     so peers cannot hand the live copy back, and the fee is refunded once. */
  const handleRemove = useCallback(
    (id: string) => {
      const link = linkStore.get(id);
      if (!link || !isOwn(link, me)) return;
      const fee = renewCost(link.url);
      const tomb = linkStore.remove(id);
      if (!tomb) return;
      meshRef.current?.broadcastLink(tomb);
      busRef.current?.postMessage({ t: "link", link: tomb });
      wallet.refund(fee);
      push(t("toast.removed", { n: fee }));
    },
    [me, push, t],
  );

  /* Renewing one link: +24 h for the same fee it cost to publish. */
  const handleRenewOne = useCallback(
    (link: LinkRecord) => {
      const fee = renewCost(link.url);
      if (!wallet.spend(fee)) {
        push(t("renew.poor"));
        return;
      }
      const next = linkStore.renew(link.id, RENEW_MS);
      if (!next) {
        wallet.refund(fee);
        return;
      }
      meshRef.current?.broadcastLink(next);
      busRef.current?.postMessage({ t: "link", link: next });
      push(t("renew.doneOne", { c: fee }));
    },
    [push, t],
  );

  /* Renewing everything at once — your links and everyone else's. */
  const handleRenewAll = useCallback(() => {
    const live = linkStore.getSnapshot().all;
    if (live.length === 0) return;
    const total = live.reduce((sum, l) => sum + renewCost(l.url), 0);
    if (!wallet.spend(total)) {
      push(t("renew.needMore", { n: total - wallet.getSnapshot().balance }));
      return;
    }
    const extended = linkStore.renewAll(RENEW_MS);
    if (extended.length === 0) {
      wallet.refund(total);
      return;
    }
    for (const l of extended) meshRef.current?.broadcastLink(l);
    busRef.current?.postMessage({ t: "links", links: extended });
    push(t("renew.doneAll", { n: extended.length, c: total }));
  }, [push, t]);

  const handleCopy = useCallback(
    (value: string) => {
      navigator.clipboard?.writeText(value).then(
        () => push(t("toast.copied")),
        () => push(t("toast.copied")),
      );
    },
    [push, t],
  );

  const handleTheme = useCallback(
    (choice: "light" | "dark" | "browser") => {
      setThemeChoice(choice);
      push(
        choice === "light"
          ? t("toast.themeLight")
          : choice === "dark"
            ? t("toast.themeDark")
            : t("toast.themeBrowser"),
      );
    },
    [setThemeChoice, push, t],
  );

  const totalOpens = useMemo(
    () => snapshot.all.reduce((sum, l) => sum + l.opens, 0),
    [snapshot.all],
  );

  const goRecord =
    route.name === "go"
      ? snapshot.all.find((l) => linkKey(l.url) === linkKey(route.href))
      : undefined;

  const homeHref = homeUrl();

  return (
    <div className="relative min-h-screen">
      <Ambient />
      <ScrollRule />
      <Header
        lang={lang}
        onLang={setLang}
        onHelp={() => setHelp(true)}
        theme={themeChoice}
        onSetTheme={handleTheme}
        t={t}
      />

      {route.name === "home" ? (
        <>
          <WalletBar
            w={w}
            mesh={meshState}
            links={snapshot.all.length}
            opens={totalOpens}
            seconds={seconds}
            t={t}
            lang={lang}
            onCopySite={() => handleCopy(prettyRoute("https://example.com"))}
            pulse={pulse}
          />

          <section className="px-4 pb-2 pt-10 sm:px-8 sm:pt-14">
            <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-end">
              <div>
                <span className="flex items-center gap-2 text-sage">
                  <IconLink size={14} />
                  <Micro className="text-sage">{t("hero.kicker")}</Micro>
                </span>
                <h1 className="mt-3 font-display text-[clamp(2rem,6.4vw,4rem)] leading-[1.06]">
                  {t("hero.title")}
                </h1>
              </div>
              <div className="max-w-md lg:pb-2">
                <p className="text-sm leading-relaxed text-ink-soft">{t("hero.sub")}</p>
                <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-faint">
                  <li className="flex items-center gap-1.5">
                    <IconCoin size={13} className="text-sage" />
                    {t("form.cost")}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <IconHourglass size={13} className="text-sage" />
                    {t("wallet.volatile")}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <IconUsers size={13} className="text-sage" />
                    <span className={cn("transition-opacity duration-500", pulse && "opacity-100")}>
                      {meshState.status === "online"
                        ? t("wallet.peers", { n: meshState.peers.length })
                        : t("wallet.solo")}
                    </span>
                  </li>
                </ul>
                <p className="mt-4 hidden items-center gap-1.5 font-mono text-[0.62rem] text-ink-faint sm:flex">
                  {t("hint.shortcuts").split("·").map((part) => (
                    <span key={part} className="flex items-center gap-1.5">
                      <kbd className="rounded border hairline px-1.5 py-0.5 text-[0.6rem] not-italic text-ink-soft">
                        {part.trim().split(" ")[0]}
                      </kbd>
                      {part.trim().split(" ").slice(1).join(" ")}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          </section>

          {/* Global network statistics */}
          <section className="border-y hairline bg-paper-2/40 px-4 py-5 sm:px-8">
            <div className="mx-auto grid w-full max-w-6xl gap-4 sm:grid-cols-3 sm:gap-8">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border hairline text-sage">
                  <IconLink size={18} />
                </span>
                <div>
                  <p className="font-display text-2xl leading-none tabular-nums">
                    {snapshot.all.length}
                  </p>
                  <Micro>{t("stats.networkLinks")}</Micro>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border hairline text-sage">
                  <IconEye size={18} />
                </span>
                <div>
                  <p className="font-display text-2xl leading-none tabular-nums">
                    {totalOpens}
                  </p>
                  <Micro>{t("stats.networkOpens")}</Micro>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border hairline text-sage">
                  <IconGlobe size={18} />
                </span>
                <div>
                  <p className="font-display text-2xl leading-none tabular-nums">
                    {meshState.peers.length + 1}
                  </p>
                  <Micro>{t("stats.networkPeers")}</Micro>
                </div>
              </div>
            </div>
          </section>

          <div className="pt-8">
            <LinkForm
              t={t}
              balance={w.balance}
              onAdd={handleAdd}
              onInvalid={(value) => goToError(value)}
            />
          </div>

          <div className="pt-4">
            <LinkColumns
              t={t}
              lang={lang}
              all={snapshot.all}
              me={me}
              onRemove={handleRemove}
              balance={w.balance}
              onCopied={() => push(t("toast.copied"))}
              onRenewAll={handleRenewAll}
              onRenew={handleRenewOne}
            />
          </div>

          <Footer t={t} />
        </>
      ) : null}

      {route.name === "go" ? (
        <>
          <GoPage
            href={route.href}
            title={goRecord?.title}
            opens={goRecord?.opens ?? 0}
            createdAt={goRecord?.createdAt}
            expiresAt={goRecord?.expiresAt}
            known={Boolean(goRecord)}
            t={t}
            lang={lang}
            onCopy={() => handleCopy(prettyRoute(route.href))}
          />
          <Footer t={t} />
        </>
      ) : null}

      {route.name === "error" ? (
        <>
          <ErrorPage value={route.value} t={t} />
          <Footer t={t} />
        </>
      ) : null}

      <HelpSheet open={help} onClose={() => setHelp(false)} t={t} />
      <Toasts items={items} />

      {/* keeps a crawlable, real anchor back to the root document */}
      <a href={homeHref} className="sr-only">
        index-z.
      </a>
    </div>
  );
}
