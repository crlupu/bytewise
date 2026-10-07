# Bytewise

A personal, Brilliant-style learning app for software engineering. Short interactive
lessons: you predict or manipulate something first, and the explanation follows.

Next.js (static export) on GitHub Pages. No server and no accounts: lessons are YAML
files in this repo, validated and rendered at build time, and progress lives in the
browser's localStorage.

## Running it

```sh
npm install
npm run dev        # http://localhost:3000
npm run build      # static site in out/
npx tsc --noEmit   # type check
```

## Deployment

Every push to `main` runs `.github/workflows/deploy-pages.yml`: it builds the site with
`GITHUB_PAGES=true` (which sets the `/bytewise` base path) and publishes the result —
`index.html` and everything it needs — to the `gh-pages` branch. GitHub Pages serves that
branch: **Settings → Pages → Build and deployment → Deploy from a branch → `gh-pages` / (root)**.

The site is at https://crlupu.github.io/bytewise/.

## What's in v1

| Area | Where |
|---|---|
| Topic → Course → Lesson → Step, prerequisites, file validation (FR-1–5) | `content/`, `lib/schema.ts`, `lib/content.ts` |
| Step types: explanation, multiple choice, predict the output, ordering, matching, fill in the blank, widget (FR-6–12) | `components/steps/` |
| Immediate feedback, per-answer explanations, unlimited retries, progressive hints (FR-13–17) | `components/steps/StepView.tsx`, `lib/grade.ts` |
| Widgets with step back / forward / reset, reporting state against a goal (FR-18–21) | `lib/widgets/` (logic), `components/widgets/` (UI) |
| Home with Continue, course screens with lock/override, lesson progress and resume (FR-22–28) | `components/HomeView.tsx`, `CourseView.tsx`, `LessonPlayer.tsx` |
| Per-step and per-lesson records, reset, export/import (FR-29–33) | `lib/progress.ts`, `components/SettingsView.tsx` |
| Spaced repetition and mixed review sessions (FR-34–37) | `lib/progress.ts`, `ReviewView.tsx`, `SessionView.tsx` |
| Streak and activity history (FR-38–39) | `ProgressView.tsx` |
| Search by title, summary and tags (FR-40) | `SearchView.tsx` |
| Light/dark/system theme, reduced motion (FR-41–42) | `lib/settings.ts`, `SettingsView.tsx` |

Widgets, one or more per topic: thread interleaving (Java), B-tree insert and search
(databases), CPU scheduling — FIFO/SJF/STCF/RR — and page replacement — FIFO/LRU/OPT
(operating systems), TCP handshake and teardown and the congestion window (networking),
trade-off scenarios (architecture).

## Content and the books behind it

177 lessons in 39 courses. Most courses follow a standard book; each lesson names the
chapter or item it teaches in `sources`, shown on the course page, on the lesson's
completion screen and in Search's Library. The lessons are written fresh — the books
are where to go for the full treatment.

**Effective Java** and **Java Concurrency in Practice** each have their own section, with a
course per chapter: one lesson for each of Effective Java's 90 items, and one lesson per
major section of JCIP's 16 chapters (61 lessons, ending with a follow-up on Java 21 virtual
threads). Each lesson has a short explanation and practice exercises.

| Topic | Books |
|---|---|
| Effective Java | *Effective Java*, 3rd ed. (Bloch) — every item |
| Java Concurrency in Practice | *Java Concurrency in Practice* (Goetz et al.) — every chapter |
| Databases | *SQL Performance Explained* (Winand), *High-Performance Java Persistence* (Mihalcea), *Database Internals* (Petrov) |
| Operating systems | *Operating Systems: Three Easy Pieces* (Arpaci-Dusseau) |
| Networking | *Computer Networking: A Top-Down Approach* (Kurose & Ross) |
| Architecture | *Fundamentals of Software Architecture* (Richards & Ford), *Release It!* (Nygard), *Learning Domain-Driven Design* (Khononov) |

Books are declared once in `content/books.yaml`; a lesson cites one with
`sources: [{ book: effective-java, ref: "Item 17" }]`, and the build rejects unknown ids.

### Glossary tooltips

`content/glossary.yaml` defines the books' terms (telescoping constructor, happens-before,
ssthresh…), grouped by book. At build time the first mention of each term in a step's text
becomes a dotted-underlined button; tap or hover it for the definition. Terms that appear
only in answers (which are buttons themselves) are listed as *Key terms* under the question.
A topic explains the terms of the books its lessons cite, plus any listed under `glossary:`
in its `topic.yaml`, so "index" means a database index only in database lessons.

```yaml
effective-java:
  - term: Telescoping constructor
    aliases: [telescopic constructor]   # plurals match automatically
    def: A chain of constructors, each adding one more optional parameter…
  - term: transient
    code: true                          # only match inside `inline code`, case-sensitive
    def: Marks a field to be left out of the serialized form.
```

The open questions were settled as the requirements assumed: predict-the-output compares
against authored answers, progress is per device with export/import as the bridge, and
every topic has several courses (see below).

## Writing lessons

Adding a lesson is adding a file — no code changes.

```
content/
  <topic>/topic.yaml               title, summary, order, courses: [course ids in order]
  <topic>/<course>/course.yaml     title, summary, lessons: [ids in order]
  <topic>/<course>/<lesson>.yaml   the lesson
```

A lesson in `course.yaml` is either an id or `{ id, requires: [other-lesson | course/lesson] }`.
Course ids are unique across topics.

```yaml
title: Race conditions
summary: One line shown in lists and search.
duration: 8               # minutes
tags: [java, threads]
sources:                  # optional; ids from content/books.yaml
  - { book: jcip, ref: "Chapter 2, Thread Safety" }
steps:                    # 5 to 15
  - type: explanation
    title: One line, three steps   # the idea, as a heading
    body: |
      `count++` looks like one action.
      The JVM does it in three: read, add one, write back.
      A thread can be paused between any two.
```

**Each lesson teaches 2–3 main ideas, one explanation slide per idea** — the build rejects
a lesson with fewer or more. Put each slide just before the exercises that practise it.
Write the body as a few short sentences, **one per line**; each line is shown as its own
paragraph. A small code block, table or list is fine when an exercise needs it.

Every exercise takes `prompt`, plus optional `explanation` (shown when right), `feedback`
(shown when wrong and nothing more specific applies), `hints: [...]` (revealed one at a
time) and `id` (keeps progress stable if steps are reordered; defaults to `step-N`).

| `type` | Fields |
|---|---|
| `choice` | `options: [{ text, correct, feedback }]`; several `correct` makes it multi-select. Optional `code`, `language`. |
| `predict` | `code`, `language`, then either `answer` (string or list, typed; `wrong: [{ answer, feedback }]`) or `options` (selected). |
| `order` | `items` in the correct order; shown shuffled. |
| `match` | `pairs: [{ left, right }]`. |
| `blank` | `template` with `[[answer]]` or `[[answer\|alternative]]`; `code: true` for monospace. |
| `widget` | `widget`, `config`, and a `goal`, a `question` (`{ prompt, options }`), or both. |

Widget configs and goals:

| Widget | `config` | `goal` |
|---|---|---|
| `threads` | `threads` (2–3), `increments`, `synchronized`, `cas`, `variable`, `initial` | `count`, `retries` |
| `btree` | `order` (3–6), `initial`, `sequence`, `custom`, `search` | `height`, `splits`, `contains`, `found` |
| `paging` | `reference`, `frames`, `frameChoices`, `algorithms` (FIFO, LRU, OPT) | `algorithm`, `frames` (and played to the end) |
| `tcp` | `start` (closed/established), `teardown`, `clientIsn`, `serverIsn` | `client`, `server` (TCP states) |
| `scheduler` | `jobs: [{ name, arrival, burst }]`, `algorithms` (FIFO, SJF, STCF, RR), `quantum`, `quantumChoices` | `algorithm`, `quantum`, `avgTurnaroundAtMost`, `avgResponseAtMost` (and played to the end) |
| `congestion` | `variant` (reno/tahoe), `ssthresh`, `switchable`, `maxRounds` | `rounds`, `cwndAtLeast`, `events` (dupack, timeout), `variant` |
| `locks` | `threads: [{ name, ops }]`, ops being `lock X`, `unlock X`, `trylock X` (backs off on failure) or plain steps | `deadlock: true`, `finished: true` |
| `tradeoff` | `metrics: [{ id, label, start, better }]`, `decisions: [{ id, label, options: [{ id, label, effects, consequence }] }]` | `require: [{ metric, min, max }]` |

A mistake stops the build (and shows in `npm run dev`) with every problem found, each
naming its file and field:

```
content/networking/tcp/handshake.yaml: steps[2].goal.client: Invalid enum value …
```

To add a widget: put its logic and zod schemas in `lib/widgets/<name>.ts`, register them in
`lib/widgets/registry.ts`, and add the component to `components/widgets/index.tsx`.

## Design

The interface uses the Grove palette in a bento layout. It's black and white, lit by
one green (`#2F8F2C` light, `#8FE25A` dark), which only ever means progress: a correct
answer, a filled meter, a finished lesson. The one filled button on a screen is black
in light mode and lime (`#A6EE6A`) in dark mode. Amber means "not yet" (a wrong answer,
items due, the streak spark); red is for destructive actions only.

Home is a bento grid (continue, streak, review, accuracy) above the library: one card
per book or topic, marked with a monogram tile in the logo's style. A card opens the
topic's page (`/topic/<id>/`), which lists its courses as rows with thin progress bars; a course is a path of lessons joined by a line; a
lesson's actions sit in a bottom sheet. Type is Inter Tight with JetBrains Mono for
code and labels, self-hosted from `app/fonts` through `next/font/local`. A floating tab bar on
phones, a sidebar from 1056px, 44px touch targets, hover styles only behind
`(hover: hover)`. Design explorations are in `design/`. All tokens are in `app/globals.css`.

## Progress data

One JSON document in localStorage (`bytewise:v1`), changed only through the actions in
`lib/progress.ts`. Review intervals are 1, 3, 7, 14, 30, 60 and 120 days: an exercise
right first time without a hint starts on 3 days and climbs; a miss or a hint sends it
back to 1 day. Settings live separately (`bytewise:settings`) so the theme can be applied
before first paint.
