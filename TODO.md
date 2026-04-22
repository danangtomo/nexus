# NEXUS — TODO & Next Task

## ⚡ NEXT TASK (start here)
**Phase 3 — Build watermark-tool** (`src/tools/watermark-tool/`)

- Drop an image (JPG/PNG/WEBP)
- Add text watermark: content, font size, color, opacity, position (9 presets)
- Preview watermarked image
- Save output via Sharp (IPC)

**Done when:** Drop a photo, watermark applied and saved.

---

## Backlog (in order)

### Phase 3 — Conversion tools remaining
1. background-remover — @imgly/background-removal WASM
4. watermark-tool — Sharp overlay
5. qr-barcode — qrcode.js + JsBarcode
6. metadata-remover — Sharp metadata strip
7. doc-converter — mammoth.js + marked (LibreOffice deferred)

### Phase 4 — Office tools (do in this order)
1. word-counter — simplest, pure JS
2. markdown-editor — marked.js, straightforward
3. json-formatter — jsoneditor
4. diff-checker — jsdiff
5. csv-editor — AG Grid Community
6. formula-calculator — HyperFormula
7. chart-builder — Apache ECharts
8. sql-runner — sql.js
9. rich-text-editor — TipTap
10. pomodoro-timer
11. timezone-converter
12. kanban-board — SortableJS + SQLite
13. gantt-chart — frappe-gantt

### Phase 5 — Security & utilities (do in this order)
1. password-generator — Web Crypto API
2. hash-generator — crypto-js
3. base64-encoder — pure JS
4. color-converter — chroma.js
5. unit-converter — mathjs
6. regex-tester
7. file-encryptor — AES-256
8. word-counter (if not done in Phase 4)

### Phase 6 — Distribution
1. Design app icon (ask user to provide or generate placeholder)
2. Configure electron-builder.yml for all 3 platforms
3. Setup GitHub Actions workflow (.github/workflows/build.yml)
4. Add electron-updater
5. Create onboarding screen
6. Create settings page
7. Write README.md with download + install instructions

---

## Notes & decisions
- Use `contextBridge` — never set `nodeIntegration: true` (security)
- SQLite file location: `app.getPath('userData')/nexus.db`
- FFmpeg path: use `require('ffmpeg-static')` to get binary path at runtime
- LibreOffice path: detect per OS, document in README
- All file processing returns progress events via IPC for UI progress bars
- Drag & drop: use HTML5 drag events, not a library
- Theme: support light/dark mode via CSS variables, default system preference
- HashRouter used (not BrowserRouter) for Electron file:// compatibility
- better-sqlite3 rebuilt with @electron/rebuild after every electron version change
- Ghostscript bundled in resources/ghostscript/ for pdf-encryptor & pdf-compressor
- Release notes written directly on GitHub release page via gh CLI (no RELEASE_NOTES.md file)
- No co-author in commit messages
