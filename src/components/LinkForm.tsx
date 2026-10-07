import { useMemo, useState } from "react";
import { normalizeLink } from "../lib/links";
import { prettyRoute } from "../lib/router";
import type { T } from "../i18n";
import { Micro } from "./Chrome";
import { IconAlert, IconCoin, IconGlobe, IconLink, IconPlus, IconSpark } from "./Icons";

export function LinkForm({
  t,
  balance,
  onAdd,
  onInvalid,
}: {
  t: T;
  balance: number;
  onAdd: (href: string, title: string, cost: number) => void;
  onInvalid: (value: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const norm = useMemo(() => normalizeLink(url), [url]);
  const cost = norm.ok ? norm.cost : 0;
  const affordable = cost <= balance;
  const empty = url.trim().length === 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (empty) return;
    if (!norm.ok) {
      onInvalid(url.trim());
      return;
    }
    if (!affordable) return;
    onAdd(norm.href, title, cost);
    setUrl("");
    setTitle("");
  };

  return (
    <form onSubmit={submit} className="px-4 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-6 border-b hairline pb-7 sm:grid-cols-[1.5fr_1fr] sm:gap-8">
          <div className="space-y-2">
            <label htmlFor="url" className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-1.5 text-ink-faint">
                <IconLink size={12} />
                <Micro>{t("form.url")}</Micro>
              </span>
              {norm.ok ? (
                <span className="flex items-center gap-1 text-ink-faint">
                  <IconCoin size={12} />
                  <Micro className="tabular-nums">{t("form.costValue", { n: cost })}</Micro>
                </span>
              ) : null}
            </label>
            <div className="relative flex items-center">
              <IconGlobe size={15} className="pointer-events-none absolute left-0 text-ink-faint" />
              <input
                id="url"
                name="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t("form.urlPh")}
                className="w-full border-b hairline bg-transparent pb-2 pl-7 text-lg text-ink outline-none transition-colors placeholder:text-base focus:border-sage sm:text-xl"
              />
            </div>
            {!empty && !norm.ok ? (
              <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                <IconAlert size={12} />
                {t("go.errTitle")}
              </p>
            ) : (
              <p className="text-xs text-ink-faint">
                {norm.ok ? prettyRoute(norm.href) : t("form.hint")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="title" className="flex items-center gap-1.5 text-ink-faint">
              <IconSpark size={12} />
              <Micro>{t("form.title")}</Micro>
            </label>
            <input
              id="title"
              name="title"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("form.titlePh")}
              className="w-full border-b hairline bg-transparent pb-2 text-lg text-ink outline-none transition-colors focus:border-sage sm:text-xl"
            />
            <p className="text-xs text-ink-faint tabular-nums">{80 - title.length}</p>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            {norm.ok && !affordable ? (
              <>
                <IconAlert size={13} className="text-sage" />
                <span className="text-sage">{t("form.needMore", { n: cost - balance })}</span>
              </>
            ) : norm.ok ? (
              <>
                <IconCoin size={13} className="text-ink-faint" />
                <span>
                  {t("form.cost")} ·{" "}
                  <span className="tabular-nums">{t("form.costValue", { n: cost })}</span>
                </span>
              </>
            ) : (
              <span className="text-ink-faint">{t("form.urlPh")}</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setUrl("example.com");
                setTitle("");
              }}
              className="link-underline text-xs text-ink-faint"
            >
              example.com
            </button>
            <button
              type="submit"
              disabled={empty || (norm.ok && !affordable)}
              className="flex flex-1 items-center justify-center gap-2.5 rounded-full border border-sage bg-sage px-8 py-3 text-xs uppercase tracking-luxe text-paper transition-all duration-300 hover:bg-transparent hover:text-sage disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-sage disabled:hover:text-paper sm:flex-none"
            >
              <IconPlus size={14} />
              <span>{t("form.add")}</span>
              <span className="tabular-nums opacity-60">{norm.ok ? cost : "—"}</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
