# Copilot Instructions for Runway

## Build, Lint, Run
- Install: `npm install` (CI uses Node 20 and `npm ci`).
- Dev app: `npm run dev` (webpack dev server on http://localhost:2112 + Electron). Renderer-only: `npm start`; attach Electron separately with `npm run electron` if the dev server is already running.
- Prod bundle: `npm run build`.
- Packaging: `npm run dist` (all), `npm run dist:mac`, `npm run dist:win`, `npm run dist:linux`, `npm run dist:mac:dmg` (create-dmg workaround). electron-builder requires `GH_TOKEN`.
- Lint: `npm run lint` (or `npm run lint:fix`).
- Tests: none automated; validate by running the app and exercising parsing/diagram, search/find usages, lint/spellcheck, analysis, and exports.

## Architecture
- Electron main (`src/main.js`): creates window/menus, stores app settings and recent folders in userData, watches `.sql/.md/.runway-db` via chokidar, classifies files (`table/enum/markdown/other`), manages file CRUD/search/find-usages/go-to-definition IPC, loads/saves `.runway` project settings and `.runway-db` markers, handles export save dialogs, auto-opens last folder.
- Preload (`src/preload.js`): exposes `window.electron` APIs for the above (folder/file events, saves, exports, search, analyze-schema/go-to-definition/find-usages toggles, preferences, project settings, spell-check dictionaries, db-root CRUD).
- Renderer entry (`src/index.js` → `App` → `Layout`): Ant Design dark theme; contexts (Schema, Editor, Selection, ProjectSettings, UserPreferences, DatabaseRoots) coordinate schema state, open files, selection, splitter sizes, prefs, and DB grouping. Panels: Search, Find Usages, Schema Analysis, Problems, Schema Diff.
- Parsing (`src/parser/index.js`): pgsql-ast-parser + regex fallback for CREATE INDEX; collects tables/types/sequences/indexes, applies ALTER TABLE FKs, filters out FKs to missing tables.
- Services/analysis: `SqlLintService` (dt-sql-parser), `SpellCheckService` (Typo.js en_US, custom dictionary persisted), schema drift detection across same-named tables/DB roots, `utils/docGenerator` for markdown/data dictionary, `ExportService` for PlantUML/SVG.
- Project metadata: `.runway` stores per-project layout/node positions and splitter sizes (debounced saves). `.runway-db` JSON marks database root folders (name/color/description) for grouping and drift comparisons. User prefs saved globally in userData.

## Conventions & Pitfalls
- Always go through `window.electron` IPC for filesystem/search/export/db-root writes (contextIsolation on, nodeIntegration off).
- Diagram input is limited to DDL with CREATE TABLE/TYPE/SEQUENCE; hidden dirs and `node_modules` are skipped by the watcher/scan.
- File typing: markdown is highlighted separately; other files are ignored by the diagram; new SQL files are seeded with a template.
- Dev server is fixed at port 2112 (set in `webpack.config.js`).
- electron-builder mac DMG background has a known issue; use `npm run dist:mac:dmg` (scripts/build-dmg.sh) if you need a backgrounded DMG.
- CI: GitHub Actions workflow `.github/workflows/build-mac.yml` builds on macos-latest with Node 20, `npm ci`, then `npm run dist:mac`, uploads DMG/ZIP, creates a release when on main/master.
