import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "browser";
export type Effective = "light" | "dark";

const KEY = "index.theme.v1";

function systemDark(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "browser") return v;
  } catch {
    /* ignore */
  }
  return "browser";
}

function apply(effective: Effective) {
  const root = document.documentElement;
  root.classList.toggle("dark", effective === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", effective === "dark" ? "#1d1f1d" : "#efe8de");
}

export function useTheme() {
  const [choice, setChoiceState] = useState<ThemeChoice>(read);
  const [system, setSystem] = useState<boolean>(systemDark);

  const effective: Effective = choice === "browser" ? (system ? "dark" : "light") : choice;

  useEffect(() => {
    apply(effective);
  }, [effective]);

  /* Follow the OS while "Browser" is chosen. */
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* ignore */
    }
  }, []);

  return { choice, setChoice, effective };
}
