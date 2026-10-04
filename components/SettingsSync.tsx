"use client";

import { useEffect } from "react";
import { applySettings, useSettings } from "@/lib/settings";

/** Keeps the page's theme and motion in step with Settings and, when those
 * follow the system, with the system's own changes. */
export function SettingsSync() {
  const s = useSettings();
  useEffect(() => {
    applySettings(s);
    const queries = ["(prefers-color-scheme: dark)", "(prefers-reduced-motion: reduce)"].map((q) => matchMedia(q));
    const on = () => applySettings(s);
    queries.forEach((q) => q.addEventListener("change", on));
    return () => queries.forEach((q) => q.removeEventListener("change", on));
  }, [s]);
  return null;
}
