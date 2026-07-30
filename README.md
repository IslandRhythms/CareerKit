# CareerKit

A desktop app for job hunting — track applications, keep a master resume, and discover ranked job recommendations.

Built with Electron Forge, React, TypeScript, better-sqlite3, and Bulma.

## Features

- **Job Tracker** — kanban pipeline (Saved → Applied → Interview → Offer → Rejected) with drag-and-drop, notes, salary, and applied dates.
- **Job Preferences** — desired titles, skills, city/state locations (with a built-in US states list), remote preference, minimum salary, avoid-keywords, a company blacklist, and job-board sources.
- **Master Resume** — a content bank for everything you've done (summary, skills, experience, education, projects); toggle each entry on or off the generated resume, preview the formatted document live, and print/export to PDF. All banked skills feed the job-fit ranking.
- **Discover** — queries the Remotive and Jobicy remote-jobs APIs plus any Greenhouse boards and Lever companies you follow, scores each posting 0–100 against your preferences and resume (skills, title, location/remote, salary, recency, avoid-keywords), and shows results best-fit first in a dense card grid with a detail view. Blacklisted companies are flagged rather than hidden. One click saves a posting into the tracker.
- **Themes** — light/dark/system mode plus custom accent colors (presets or any color), applied live across the whole UI.

## Development

```bash
npm install
npm start        # run in development
npm run make     # build distributables
npm run lint
```

All data is stored locally in SQLite at Electron's `userData` directory (`%APPDATA%/careerkit/careerkit.db` on Windows).

## Architecture

- `src/index.ts` — main process entry: window creation, DB init, IPC registration.
- `src/main/db.ts` — better-sqlite3 schema and queries (jobs table + JSON documents for preferences/resume).
- `src/main/integrations/` — Greenhouse / Lever / Remotive public API clients.
- `src/main/ranking.ts` — the job-fit scoring model.
- `src/preload.ts` — context-isolated bridge exposing `window.careerkit`.
- `src/app/` — React renderer (pages: Tracker, Discover, Resume, Preferences).
