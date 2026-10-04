"use client";

import { useRef, useState } from "react";
import { ExportIcon, ImportIcon, TrashIcon } from "@/components/icons";
import { Confirm, PageHead } from "@/components/ui";
import { today } from "@/lib/dates";
import { progress } from "@/lib/progress";
import { setSettings, useSettings, type Motion, type Theme } from "@/lib/settings";

export function SettingsView({ counts }: { counts: { topics: number; courses: number; lessons: number } }) {
  const s = useSettings();
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [resetAll, setResetAll] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const doExport = () => {
    const blob = new Blob([progress.export()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bytewise-progress-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNote({ kind: "ok", text: "Progress exported." });
  };

  return (
    <>
      <PageHead title="Settings" />

      <section>
        <h2 className="group-label">Appearance</h2>
        <ul className="list">
          <li>
            <div className="list-row">
              <span className="list-row__body">Theme</span>
              <div className="seg" role="group" aria-label="Theme">
                {(["system", "light", "dark"] as Theme[]).map((t) => (
                  <button key={t} type="button" className="seg__btn" aria-pressed={s.theme === t} onClick={() => setSettings({ theme: t })}>
                    {t === "system" ? "System" : t === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
            </div>
          </li>
          <li>
            <div className="list-row">
              <span className="list-row__body">
                Reduce motion
                <span className="list-row__meta" style={{ display: "block" }}>
                  Turns off animations, including in simulations.
                </span>
              </span>
              <div className="seg" role="group" aria-label="Reduce motion">
                {(["system", "reduce", "full"] as Motion[]).map((m) => (
                  <button key={m} type="button" className="seg__btn" aria-pressed={s.motion === m} onClick={() => setSettings({ motion: m })}>
                    {m === "system" ? "System" : m === "reduce" ? "On" : "Off"}
                  </button>
                ))}
              </div>
            </div>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="group-label">Your progress</h2>
        <ul className="list">
          <li>
            <button type="button" className="list-row list-row--icon" onClick={doExport}>
              <ExportIcon style={{ width: 22, height: 22, color: "var(--accent)" }} aria-hidden />
              <span className="list-row__body">
                Export progress
                <span className="list-row__meta" style={{ display: "block" }}>
                  Save a file you can import on another device.
                </span>
              </span>
            </button>
          </li>
          <li>
            <button type="button" className="list-row list-row--icon" onClick={() => file.current?.click()}>
              <ImportIcon style={{ width: 22, height: 22, color: "var(--accent)" }} aria-hidden />
              <span className="list-row__body">
                Import progress
                <span className="list-row__meta" style={{ display: "block" }}>
                  Replaces what's on this device.
                </span>
              </span>
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) setPending(await f.text());
              }}
            />
          </li>
          <li>
            <button type="button" className="list-row list-row--icon" onClick={() => setResetAll(true)}>
              <TrashIcon style={{ width: 22, height: 22, color: "var(--danger)" }} aria-hidden />
              <span className="list-row__body" style={{ color: "var(--danger)" }}>
                Reset all progress
              </span>
            </button>
          </li>
        </ul>
        {note && (
          <p className={`notice${note.kind === "error" ? " notice--danger" : ""}`} style={{ marginTop: 12 }} role="status">
            {note.text}
          </p>
        )}
        <p className="caption" style={{ marginTop: 8, paddingInline: 4 }}>
          Progress is stored in this browser only. To reset a single lesson or course, open the course and choose Edit.
        </p>
      </section>

      <section>
        <h2 className="group-label">About</h2>
        <ul className="list">
          <li>
            <div className="list-row">
              <span className="list-row__body">Content</span>
              <span className="list-row__end figure">
                {counts.topics} topics · {counts.courses} courses · {counts.lessons} lessons
              </span>
            </div>
          </li>
        </ul>
      </section>

      <Confirm
        open={pending !== null}
        title="Import progress?"
        body="This replaces all progress on this device with the file's."
        action="Import"
        onConfirm={() => {
          try {
            progress.import(pending ?? "");
            setNote({ kind: "ok", text: "Progress imported." });
          } catch (err) {
            setNote({ kind: "error", text: (err as Error).message });
          }
        }}
        onClose={() => setPending(null)}
      />
      <Confirm
        open={resetAll}
        title="Reset all progress?"
        body="Every lesson, review item and streak on this device will be forgotten. Export first if you might want it back."
        action="Reset everything"
        danger
        onConfirm={() => {
          progress.resetAll();
          setNote({ kind: "ok", text: "All progress reset." });
        }}
        onClose={() => setResetAll(false)}
      />
    </>
  );
}
