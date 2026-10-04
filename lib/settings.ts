"use client";

import { useSyncExternalStore } from "react";

/**
 * Appearance and motion. Kept apart from progress because the theme has to
 * be applied by a tiny inline script before the first paint (see
 * THEME_SCRIPT), and an export of progress shouldn't carry it.
 */

export type Theme = "system" | "light" | "dark";
export type Motion = "system" | "reduce" | "full";
export type Settings = { theme: Theme; motion: Motion };

const KEY = "bytewise:settings";
const DEFAULTS: Settings = { theme: "system", motion: "system" };

let current: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  if (current) return current;
  try {
    current = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    current = DEFAULTS;
  }
  return current!;
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => DEFAULTS,
  );
}

export function setSettings(patch: Partial<Settings>) {
  current = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {}
  applySettings(current);
  listeners.forEach((l) => l());
}

export function applySettings(s: Settings) {
  const root = document.documentElement;
  const dark = s.theme === "dark" || (s.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  const reduce = s.motion === "reduce" || (s.motion === "system" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  root.dataset.motion = reduce ? "reduce" : "full";
}

/** True when animations should be skipped: the setting, or the system's. */
export function useReducedMotion(): boolean {
  const s = useSettings();
  const system = useSyncExternalStore(
    (l) => {
      const mq = matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", l);
      return () => mq.removeEventListener("change", l);
    },
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  return s.motion === "reduce" || (s.motion === "system" && system);
}
