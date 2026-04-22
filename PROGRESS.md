# NEXUS — Progress Log

## Last session: Session #16 — background-remover built
**Resume from:** Phase 3 — Build watermark-tool (`src/tools/watermark-tool/`)
**Status:** background-remover done — @imgly/background-removal WASM, before/after preview, PNG download. ONNX runtime WASM bundled by Vite. AI model (~25MB) downloaded from CDN on first use then cached by Chromium.

---

## How to read this file
- [x] = completed
- [~] = in progress / partially done
- [ ] = not started
- INTERRUPTED = session ended mid-task, see TODO.md for exact resume point

---

## Phase 1 — Project setup
- [x] Init repo (git init, .gitignore, MIT license)
- [x] Scaffold Electron + React + Vite (manual, not create-electron-vite)
- [x] Install core deps (electron, vite, @vitejs/plugin-react, concurrently, cross-env, @electron/rebuild)
- [x] Setup electron-builder config (electron-builder.yml, build targets: win, mac, linux)
- [x] Setup SQLite with better-sqlite3 (+ rebuilt for Electron native)
- [x] Create main process (electron/main.js) — dialogs, fs, db, kanban, pomodoro, shell IPC
- [x] Create preload script (electron/preload.js) — contextBridge with full API
- [x] Setup React Router (HashRouter, 37 routes)
- [x] Create base UI shell + sidebar nav (all 9 categories, 37 tools listed)
- [x] Create shared components: ToolLayout, DropZone, ProgressBar, Welcome
- [x] All 37 tool stubs created (index.jsx + handler.js + CSS)
- [x] Vite production build: ✓ 105 modules, 248KB JS

## Phase 2 — Bundle open source engines
- [x] Bundle FFmpeg binary (ffmpeg-static)
- [ ] Bundle LibreOffice headless (deferred — only needed for doc-converter)
- [x] Install Tesseract.js (WASM, loads in renderer — no IPC needed)
- [x] Install Sharp (rebuilt for Electron; IPC handler: electron/handlers/sharp.js)
- [x] Install pdf-lib (loads in renderer)
- [x] Install SheetJS (xlsx, loads in renderer)
- [x] Install mammoth.js (loads in renderer)
- [x] Install JSZip + archiver
- [x] FFmpeg IPC handler: electron/handlers/ffmpeg.js (ffmpeg:run, ffmpeg:probe, ffmpeg:thumbnail)
- [x] Sharp IPC handler: sharp:process, sharp:metadata, sharp:thumbnail
- [x] Both handlers wired into main.js + preload.js

## Phase 3 — File & image conversion tools (17 tools)
- [x] image-converter (JPG/PNG/WEBP/AVIF/TIFF batch — BMP removed as output, Sharp read-only)
- [x] image-resizer (px/% resize, aspect lock, fit modes, bulk, output dims shown)
- [x] image-compressor (quality slider, size preview, total bytes saved)
- [x] background-remover (@imgly/background-removal WASM; before/after preview, PNG download; ONNX runtime WASM bundled by Vite; model fetched from CDN first run then cached)
- [ ] watermark-tool (text/image overlay, position, opacity)
- [x] pdf-merger (drag-to-reorder, page count per file, merge via pdf-lib)
- [x] pdf-splitter (by page range or every N pages)
- [x] pdf-compressor (ghostscript via child_process)
- [x] pdf-encryptor (set/remove password with pdf-lib)
- [x] ocr-reader (image or PDF → extract text)
- [x] doc-converter (DOCX→HTML/TXT via mammoth; MD→HTML/TXT via marked; TXT↔HTML/MD; rendered HTML preview with source toggle)
- [x] spreadsheet-converter (XLSX/CSV/TSV/JSON/HTML — SheetJS, UTF-8 BOM fix, multi-sheet selector)
- [x] video-converter (MP4/MOV/AVI/MKV/GIF via FFmpeg)
- [x] audio-converter (MP3/AAC/OGG/FLAC/WAV/M4A convert via FFmpeg, quality per codec, lossless mode)
- [x] archive-manager (ZIP/TAR.GZ compress via archiver; ZIP extract via JSZip; file listing preview)
- [x] qr-barcode (QR Code + 6 barcode formats; live preview, PNG download; qrcode + jsbarcode)
- [x] metadata-remover (Sharp thumbnail + metadata read; strip EXIF/ICC/XMP/IPTC; shows metadata table)

## Phase 4 — Office productivity tools (12 tools)
- [ ] rich-text-editor (TipTap — write, format, export DOCX/PDF)
- [ ] markdown-editor (split pane live preview)
- [ ] csv-editor (AG Grid — sort, filter, edit, export)
- [ ] json-formatter (format, validate, tree view, query)
- [ ] diff-checker (compare two text files side by side)
- [ ] chart-builder (bar/line/pie/scatter from CSV data)
- [ ] sql-runner (run SQL on CSV/JSON files in browser)
- [ ] formula-calculator (Excel-style formula evaluator)
- [ ] kanban-board (drag & drop, saved to SQLite)
- [ ] pomodoro-timer (focus + break cycles, session log)
- [ ] gantt-chart (tasks, dependencies, drag resize)
- [ ] timezone-converter (compare cities side by side)

## Phase 5 — Security & utility tools (8 tools)
- [ ] password-generator (length, symbols, passphrase mode)
- [ ] file-encryptor (AES-256 client-side)
- [ ] hash-generator (MD5/SHA-1/SHA-256 for text and files)
- [ ] unit-converter (length/weight/temp/currency)
- [ ] color-converter (HEX↔RGB↔HSL↔CMYK)
- [ ] base64-encoder (text, file, URL encoding)
- [ ] regex-tester (live match highlight, flags)
- [ ] word-counter (words, chars, sentences, reading time)

## Phase 6 — Polish & distribution
- [ ] App icon & branding (512x512 → all platform formats)
- [ ] Auto-updater (electron-updater via GitHub releases)
- [ ] Onboarding screen (first launch welcome + feature tour)
- [ ] Settings page (theme, default paths, language)
- [ ] Build pipeline (GitHub Actions — win/mac/linux on push)
- [ ] Release/download landing page

---

## Session history

| Session | Date | Completed | Stopped at |
|---------|------|-----------|------------|
| #1 | 2026-04-20 | Phase 1 — full project scaffold, shell UI, 37 tool stubs | Phase 2 start |
| #2 | 2026-04-20 | Phase 2 — all engines installed, Sharp + FFmpeg IPC handlers | Phase 3 start |
| #3 | 2026-04-20 | Phase 3 — image-converter (format selector, quality, batch, size delta) | image-resizer |
| #4 | 2026-04-20 | Bug fix — removed BMP output (Sharp can't write it); verified JPEG=JPG same format | image-resizer |
| #5 | 2026-04-20 | Phase 3 — image-resizer (pixel/percent, aspect-lock, fit modes, batch, output dims) | image-compressor |
| #6 | 2026-04-20 | Phase 3 — image-compressor (quality slider, size preview, total bytes saved) | pdf-merger |
| #7 | 2026-04-20 | Phase 3 — pdf-merger (drag-to-reorder, page count per file, merge via pdf-lib) | pdf-splitter |
| #8 | 2026-04-21 | Phase 3 — pdf-splitter (range mode, every-N mode, output list, show in folder) | pdf-encryptor |
| #9 | 2026-04-21 | Phase 3 — pdf-encryptor (encrypt/decrypt, user+owner pass, show/hide, validation) | ocr-reader |
| #10 | 2026-04-21 | Ghostscript IPC handler + pdf-encryptor rewrite (real AES-256) + pdf-compressor | ocr-reader |
| #11 | 2026-04-21 | GS binary bundling (scripts/bundle-ghostscript.js + CI + extraResources) + ocr-reader | doc-converter |
| #12 | 2026-04-21 | video-converter (6 formats, per-codec quality args, VP9 fix, AVI mpeg4 fix) | audio-converter |
| #13 | 2026-04-21 | audio-converter (MP3/AAC/OGG/FLAC/WAV/M4A, quality per codec, lossless detection, FFmpeg IPC) | spreadsheet-converter |
| #16 | 2026-04-22 | background-remover (@imgly WASM, before/after preview, PNG download, COOP/COEP headers) | watermark-tool |
