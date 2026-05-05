<div align="center">

<img src="assets/logo.svg" width="100" alt="NEXUS logo" />

# NEXUS

**Intent-driven offline productivity workspace**

[![Version](https://img.shields.io/badge/version-0.15.1-007AFF?style=flat-square)](https://github.com/danangtomo/nexus/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blueviolet?style=flat-square)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-41-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)](https://github.com/danangtomo/nexus/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/danangtomo/nexus/pulls)

_The fastest way to turn messy files into structured insight. No internet. No cloud. No AI APIs._

</div>

---

## What is NEXUS?

NEXUS is a free, open-source desktop app built on an **intent-driven workspace model**. Instead of asking you which tool to pick, NEXUS asks what you want to accomplish — then takes you there in the fewest steps.

Open the app, click an outcome card ("Extract tables & insights from PDF", "Analyze my spreadsheet data", "Convert a batch of images"), drop your files, and get results — without reading documentation.

Built with an Apple HIG-inspired design system. Supports Light, Dark, and Auto themes on Windows, macOS, and Linux. All processing is 100% local — no subscriptions, no cloud uploads, no telemetry.

---

## Tools

### Data

| Tool          | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSV Editor    | A full-featured spreadsheet editor built on AG Grid Community. Open CSV, TSV, TXT, or XLSX files; paste CSV or TSV text directly from the clipboard (Ctrl+V on an empty grid); or start from a blank spreadsheet. **Core editing:** multi-column sort, per-column filter, resize and drag-reorder columns, rename columns with double-click, add/delete rows and columns, freeze columns via right-click context menu, auto-detected numeric and date column types for correct sort order, and a display-only row-number column excluded from exports. **Power features:** Excel-style formula engine (=SUM, =IF, =VLOOKUP, =AVERAGE, =COUNT, =LEN, =ROUND, =CONCATENATE, and hundreds more via fast-formula-parser) with a persistent formula bar; fill-handle drag and Ctrl+D fill-down shift row references in formulas; multi-cell fill; Find & Replace (Ctrl+F / Ctrl+H) with regex and case-sensitive modes; conditional formatting with empty-cell highlighting, IQR outlier detection, and custom numeric threshold; column stats panel; undo/redo with 50-step history. **Export:** CSV, TSV, JSON, XLSX, or SQL INSERT statements. |
| JSON Formatter | Paste or load a JSON file and instantly see four synchronized output tabs — Formatted (pretty-printed), Minified (single line), Tree (collapsible key/value explorer with type badges), and Stats (total keys, nesting depth, per-type count). The Beautify Input button normalises messy JSON in place. Full validation highlights the exact error position for invalid JSON.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Chart Builder  | Build charts from CSV, TSV, JSON, or freeform text data. **8 chart types:** Bar, Line, Area, Pie, Doughnut, Scatter, Radar, and Treemap (hierarchical, breadcrumb navigation). Smart recommendation engine analyses the data shape and suggests the most appropriate chart type. **6 color themes** including a Colorblind-safe palette (Wong). Download as 2× PNG.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| SQL Runner     | A full SQL workbench running entirely offline. **Local mode** loads CSV, JSON, or XLSX files into an in-browser SQLite engine (sql.js WASM). **Server mode** connects to live PostgreSQL, MySQL, and MSSQL databases via native Node.js drivers. Multi-tab query editor with syntax highlighting, live autocomplete, and Ctrl+Enter shortcuts. **Results:** sort, filter, copy, column stats, paginated view (200 rows), export as CSV / JSON / SQL INSERT. **Schema sidebar** with lazy-loaded indexes, database switcher, and search. **Toolbar:** Format SQL, Visual EXPLAIN tree, ER Diagram (draggable SVG with FK arrows), Pivot table, Chart mode (8 ECharts chart types). Connection health chip shows live ping latency.                                                                                                                                                                                                                                                                                                |

### Documents

| Tool                  | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rich Text Editor       | A Notion-style document editor powered by TipTap. Stores multiple named documents in SQLite with debounced auto-save. Full toolbar covering font family/size, headings, bold/italic/underline/strikethrough/code, subscript/superscript, multi-color highlight, font color, links, alignment, bullet/numbered/task lists, blockquote, code block, image insertion (base64), table with row/col management. Find bar (Ctrl+F). Export DOCX (with embedded images), PDF, and TXT. Import DOCX. Print-optimized layout. |
| Markdown Editor        | A Typora-level writing environment with Edit / Split / Preview modes. Renders KaTeX math (`$...$` and `$$...$$`), Mermaid diagrams, and GitHub Flavored Markdown. Outline panel, Focus Mode, Typewriter Mode. Export to PDF, DOCX, LaTeX, and MediaWiki; import DOCX and HTML. Live word and character count.                                                                                                                                                                                                       |
| Doc Converter          | Convert documents between formats without LibreOffice. DOCX → HTML or plain text (mammoth.js), Markdown → HTML or plain text (marked), TXT ↔ HTML / Markdown. Rendered HTML preview with source toggle.                                                                                                                                                                                                                                                                                                           |
| Spreadsheet Converter  | Convert spreadsheets between XLSX, CSV, TSV, JSON, and HTML. Multi-sheet selector for XLSX files. UTF-8 BOM output so Excel on Windows opens CSV files correctly.                                                                                                                                                                                                                                                                                                                                                  |
| Diff Checker           | Compare two text files or passages with a live unified diff. Character-level highlighting within changed lines. Collapsible unchanged sections, hunk navigation, Ignore Whitespace toggle. Copy unified diff to clipboard or download as `.patch` / `.diff`.                                                                                                                                                                                                                                                         |

### Images

| Tool               | What it does                                                                                                                                                                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image Converter    | Batch-convert images between JPG, PNG, WEBP, AVIF, and TIFF. Set output quality per format and convert entire batches in one click.                                                                                                                                                                                                     |
| Image Resizer      | Resize by exact pixels or percentage. Aspect-ratio lock and three fit modes (Contain, Cover, Fill). Shows calculated output dimensions before saving.                                                                                                                                                                                    |
| Image Compressor   | Compress with a per-file quality slider. Live before/after file-size preview shows exact bytes saved.                                                                                                                                                                                                                                   |
| Background Remover | Remove image backgrounds on-device using the BiRefNet neural network (ONNX Runtime with INT8 quantization — no GPU, no cloud, no API key). The INT8 model is **bundled with the installer** — no download required after installation. A Python sidecar launches when you open the page and shuts down after processing to free memory. Before/after compare slider. Choose transparent or solid-color background. Download as PNG. |
| Watermark Tool     | Stamp text watermarks onto images. 9 grid positions, font size/opacity/color sliders, live canvas preview. Applied via Sharp SVG overlay — original file never overwritten.                                                                                                                                                               |
| Metadata Remover   | Read and display EXIF, ICC, XMP, and IPTC metadata in a structured table. Strip all metadata in one click and download a clean copy.                                                                                                                                                                                                     |

### PDF

| Tool           | What it does                                                                                                                                                                                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDF Merger     | Upload any number of PDFs, drag into desired order, see page count per file, merge into a single document. All processing happens in-browser via pdf-lib.                                                                                                                                                                                                                  |
| PDF Splitter   | Split by custom page-range list (e.g. `1-3, 5, 8-10`) or automatically every N pages.                                                                                                                                                                                                                                                                                    |
| PDF Compressor | Reduce PDF size using Ghostscript with three quality presets — Screen (72 dpi), eBook (150 dpi), and Printer (300 dpi).                                                                                                                                                                                                                                                   |
| PDF Encryptor  | Set a user password (required to open) and optional owner password (restricts print/copy/edit). AES-256 encryption via pdf-lib. Also removes passwords from protected PDFs.                                                                                                                                                                                               |
| OCR Reader     | Extract text, tables, formulas, and images from PDF documents and image files (JPG, PNG, BMP, TIFF, WEBP). Powered by **MinerU** (Apache-2.0) via a Python sidecar — a CPU-based ONNX pipeline with no GPU required. Supports 17 languages including CJK, Arabic, Cyrillic, and Indic scripts. Layout-aware extraction preserves reading order, identifies tables as structured rows/columns (editable inline), and renders bounding-box overlays on the source preview. Tables export directly to the CSV Editor as a Data Table. All MinerU models are **bundled with the installer** — no download required after installation. |

### Media

| Tool            | What it does                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Video Converter | Convert video to MP4, WebM, MKV, AVI, MOV, or animated GIF via FFmpeg. Real-time progress bar.                                                            |
| Audio Converter | Convert audio to MP3, AAC, OGG, FLAC, WAV, or M4A. Quality settings per codec (bitrate for lossy, lossless passthrough for FLAC/WAV). Batch conversion.  |

### Files

| Tool            | What it does                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Archive Manager | Compress into ZIP or TAR.GZ (archiver). Extract ZIP (JSZip) with full file-listing preview before writing to disk.                              |

### Productivity

| Tool           | What it does        |
| -------------- | ------------------- |
| Kanban Board   | _(coming soon)_     |
| Pomodoro Timer | _(coming soon)_     |
| Gantt Chart    | _(coming soon)_     |

### Quick Tools _(accessible via URL, not in sidebar)_

| Tool               | What it does                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| QR & Barcode       | Generate QR codes or barcodes in Code 128, Code 39, EAN-13, EAN-8, UPC-A, and ITF-14. Live preview, PNG download.     |
| Timezone Converter | _(coming soon)_                                                                                                        |
| Word Counter       | Count words, characters, sentences, paragraphs, and reading time. Multi-script (CJK, Arabic, Cyrillic, Indic). Open TXT, DOCX, Markdown, or PDF. |

---

## Tech Stack

| Layer                  | Technology                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Shell                  | [Electron 41](https://www.electronjs.org/)                                                              |
| UI                     | [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)                                            |
| Storage                | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)                                            |
| Video / Audio          | [FFmpeg](https://ffmpeg.org/) via [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static)          |
| PDF compression        | [Ghostscript](https://www.ghostscript.com/) (bundled)                                                   |
| OCR & document parsing | [MinerU](https://github.com/opendatalab/MinerU) (Apache-2.0, CPU/ONNX, Python sidecar via PyInstaller) |
| AI background removal  | [BiRefNet](https://github.com/ZhengPeng7/BiRefNet) INT8 via [ONNX Runtime](https://onnxruntime.ai/) (Python sidecar) |
| Image processing       | [Sharp](https://sharp.pixelplumbing.com/)                                                               |
| PDF rendering          | [pdfjs-dist](https://mozilla.github.io/pdf.js/)                                                         |
| PDF manipulation       | [pdf-lib](https://pdf-lib.js.org/)                                                                      |
| Spreadsheets           | [SheetJS](https://sheetjs.com/)                                                                         |
| CSV parsing            | [Papa Parse](https://www.papaparse.com/)                                                                |
| Spreadsheet grid       | [AG Grid Community](https://www.ag-grid.com/)                                                           |
| Formula engine         | [fast-formula-parser](https://github.com/LesterLyu/fast-formula-parser)                                 |
| DOCX parsing           | [mammoth.js](https://github.com/mwilliamson/mammoth.js)                                                 |
| Rich text editor       | [TipTap](https://tiptap.dev/)                                                                           |
| Archives               | [JSZip](https://stuk.github.io/jszip/) + [archiver](https://github.com/archiverjs/node-archiver)       |
| Markdown rendering     | [marked](https://marked.js.org/)                                                                        |
| Math rendering         | [KaTeX](https://katex.org/)                                                                             |
| Diagram rendering      | [Mermaid](https://mermaid.js.org/)                                                                      |
| HTML → Markdown        | [turndown](https://github.com/mixmark-io/turndown)                                                      |
| QR & barcodes          | [qrcode](https://github.com/soldair/node-qrcode) + [jsbarcode](https://github.com/lindell/JsBarcode)   |
| In-browser SQL         | [sql.js](https://sql.js.org/) (SQLite compiled to WASM)                                                 |
| PostgreSQL client      | [pg](https://node-postgres.com/)                                                                        |
| MySQL / MariaDB client | [mysql2](https://github.com/sidorares/node-mysql2)                                                      |
| MSSQL client           | [mssql](https://github.com/tediousjs/node-mssql)                                                       |
| Charting               | [Apache ECharts](https://echarts.apache.org/)                                                           |
| Diff engine            | [diff (jsdiff)](https://github.com/kpdecker/jsdiff)                                                     |
| Packaging              | [electron-builder](https://www.electron.build/)                                                         |

---

## Build from Source

**Prerequisites:** Node.js 18+, Python 3.10+, Git

```bash
# Clone
git clone https://github.com/danangtomo/nexus.git
cd nexus

# Install JS dependencies
npm install

# Set up Python sidecars (one-time, creates .venv in each sidecar directory)
python\setup.bat        # Windows
bash python/setup.sh    # macOS / Linux

# Run in development mode
npm run dev
```

**For PDF compression** (Ghostscript):

- Windows: `winget install ArtifexSoftware.GhostScript`
- macOS: `brew install ghostscript`
- Linux: `sudo apt install ghostscript`

**Python sidecars** (Background Remover and OCR Reader):

Each sidecar has its own virtual environment under `python/<sidecar>/.venv/`. The `setup.bat` / `setup.sh` scripts handle creating them and installing all dependencies, including CPU-only PyTorch (prevents a 2 GB CUDA download for MinerU).

In development mode, the handlers auto-detect the venv and run the Python server directly. Release builds bundle each sidecar as a standalone binary via PyInstaller — **end users do not need Python installed**.

**Build distributable:**

```bash
npm run build:win    # Windows (.exe installer)
npm run build:mac    # macOS (.dmg)
npm run build:linux  # Linux (.AppImage / .deb)
```

The build pipeline automatically:
1. Compiles the React frontend (Vite)
2. Generates `licenses.json` (npm dependency license report)
3. Bundles Ghostscript, FFmpeg, both Python sidecar binaries, BiRefNet INT8 model, and MinerU models into the installer via electron-builder

---

## Download

Pre-built installers are available on the [Releases](https://github.com/danangtomo/nexus/releases) page.

### Windows SmartScreen warning

When you run the installer on Windows, you may see a blue screen saying **"Windows protected your PC"**. This is expected — NEXUS is not malicious. The warning appears because the app is not signed with a paid code-signing certificate (these cost ~$200–500/year and are not practical for a free open-source project).

**How to install anyway:**

1. Click **"More info"** on the SmartScreen dialog
2. Click **"Run anyway"**

That's it. The warning will not appear again after the first install. The source code is fully open and auditable at this repository.

---

## Support

☕ [Support via Saweria](https://saweria.co/langdon) — GoPay, OVO, Dana, QRIS, Bank Transfer

---

## License

NEXUS is open source under the GNU Affero General Public License v3.0.

This means you can use, study, share, and modify this software freely — but any distributed or hosted version must also be open source under the same license.

**For organizations needing proprietary use, a commercial license is available.** Contact ajidanang9@gmail.com.

---

### Third-Party Licenses

Full npm dependency license details are in [licenses.json](licenses.json) (auto-generated at build time via `license-checker --production`).

**Bundled components and their licenses:**

| Component                         | License            |
| --------------------------------- | ------------------ |
| FFmpeg (ffmpeg-static)            | GPL-3.0            |
| Ghostscript                       | AGPL-3.0           |
| MinerU                            | Apache-2.0         |
| PaddleOCR / PaddleX               | Apache-2.0         |
| PyTorch (CPU)                     | BSD-3-Clause       |
| pdf.js (pdfjs-dist)               | Apache-2.0         |
| BiRefNet (onnx-community/BiRefNet-ONNX) | MIT           |
| ONNX Runtime                      | MIT                |
| FastAPI                           | MIT                |
| uvicorn                           | BSD-3-Clause       |
| Pillow                            | HPND               |
| NumPy                             | BSD-3-Clause       |
| SciPy                             | BSD-3-Clause       |
| KaTeX                             | MIT                |
| Mermaid                           | MIT                |
| sharp (libvips)                   | LGPL-3.0-or-later  |

---

<div align="center">

Designed by [Danang Estutomoaji](https://github.com/danangtomo)

</div>
