<div align="center">

<img src="assets/logo.svg" width="100" alt="NEXUS logo" />

# NEXUS

**All-in-one offline productivity desktop app**

[![Version](https://img.shields.io/badge/version-0.13.1-007AFF?style=flat-square)](https://github.com/danangtomo/nexus/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blueviolet?style=flat-square)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-41-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)](https://github.com/danangtomo/nexus/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/danangtomo/nexus/pulls)

*37 tools. Zero internet. Everything local.*

</div>

---

## What is NEXUS?

NEXUS is a free, open-source desktop app that bundles 37 productivity tools into one clean interface. No subscriptions, no cloud uploads, no telemetry — everything runs on your machine.

Built with an Apple HIG-inspired design system, supporting Light, Dark, and Auto themes on Windows, macOS, and Linux.

---

## Tools

### Image

| Tool | What it does |
|------|-------------|
| Image Converter | Batch-convert images between JPG, PNG, WEBP, AVIF, and TIFF. Set output quality per format, choose an output folder, and convert an entire batch in one click. BMP files are accepted as input. |
| Image Resizer | Resize images by exact pixel dimensions or by percentage. Aspect-ratio lock keeps proportions intact. Three fit modes — Contain, Cover, and Fill — control how the image fills the target frame. Processes entire batches at once and shows the calculated output dimensions before saving. |
| Image Compressor | Compress images with a per-file quality slider. A live file-size preview shows before/after sizes and exact bytes saved, so you can tune the quality-vs-size tradeoff before committing. |
| Background Remover | Remove image backgrounds entirely on-device using the RMBG-1.4 neural network model (local ONNX — no cloud, no API key, no internet required). Displays a side-by-side before/after panel. The background can be replaced with a checkerboard (transparent PNG) or any solid fill color. Applies sigmoid mask sharpening for crisp edges around subjects. Download as PNG. |
| Watermark Tool | Stamp text watermarks onto images. Choose from 9 grid positions (top / middle / bottom × left / center / right). Sliders control font size, opacity, and color with a live canvas preview updating in real time. The watermark is applied via Sharp SVG overlay; the original file is never overwritten. |
| Metadata Remover | Read and display an image's embedded metadata — EXIF camera and GPS data, ICC color profile, XMP rights and description, IPTC captions — in a structured table. Strip all metadata in one click and download a clean, privacy-safe copy. |

### PDF

| Tool | What it does |
|------|-------------|
| PDF Merger | Upload any number of PDFs, drag them into the desired order, see the page count per file, then merge everything into a single document. All processing happens in-browser via pdf-lib — no upload needed. |
| PDF Splitter | Split a PDF two ways: by a custom page-range list (e.g. `1-3, 5, 8-10`) where each range becomes a separate file, or automatically every N pages for uniform chunks. |
| PDF Compressor | Reduce PDF file size using Ghostscript with three quality presets — Screen (72 dpi, smallest file, best for on-screen reading), eBook (150 dpi, balanced), and Printer (300 dpi, high quality for printing). |
| PDF Encryptor | Protect a PDF with a user password (required to open) and an optional owner password (restricts print, copy, and edit permissions). AES-256 encryption via pdf-lib. Also removes passwords from already-protected PDFs. |
| OCR Reader | Extract text from images (JPG, PNG, BMP, TIFF) or from individual PDF pages. Supports 20+ languages including CJK, Arabic, and Indic scripts via Tesseract.js, which runs as WASM entirely in-browser — fully local and offline. A per-page progress bar tracks longer documents. Copy all extracted text to clipboard in one click. |

### Video & Audio

| Tool | What it does |
|------|-------------|
| Video Converter | Convert video files to MP4, WebM, MKV, AVI, MOV, or animated GIF using FFmpeg. A real-time progress bar tracks the encoding process. |
| Audio Converter | Convert audio to MP3, AAC, OGG, FLAC, WAV, or M4A. Exposes quality settings appropriate to each codec — bitrate for lossy formats, lossless passthrough for FLAC and WAV. Batch-converts multiple files in one operation. |

### Documents & Data

| Tool | What it does |
|------|-------------|
| Doc Converter | Convert documents between formats without needing LibreOffice. Converts DOCX → HTML or plain text (via mammoth.js), Markdown → HTML or plain text (via marked), and TXT ↔ HTML / Markdown in either direction. Displays a rendered HTML preview for the converted output with a toggle to view the raw source. |
| Spreadsheet Converter | Convert spreadsheets between XLSX, CSV, TSV, JSON, and HTML. XLSX files with multiple sheets show a sheet selector so you can pick which sheet to convert. CSV output includes a UTF-8 BOM so Excel on Windows opens the file with correct character encoding. |
| Archive Manager | Compress files and folders into ZIP or TAR.GZ archives (via archiver). Extract ZIP archives (via JSZip) with a full file-listing preview shown before anything is written to disk. |
| QR & Barcode | Generate QR codes or barcodes in six symbologies — Code 128, Code 39, EAN-13, EAN-8, UPC-A, and ITF-14. The live preview updates as you type the input value. Download as PNG. |

### Office

| Tool | What it does |
|------|-------------|
| Markdown Editor | A Typora-level writing environment with three view modes — Edit (plain text), Split (editor and rendered preview side by side), and Preview (full render). Renders KaTeX math (inline `$...$` and display `$$...$$`), Mermaid diagrams (flowcharts, sequence diagrams, Gantt charts), and GitHub Flavored Markdown. The Outline panel lists all headings and jumps to any anchor on click. Focus Mode dims every paragraph except the one being typed in; Typewriter Mode keeps the cursor fixed at the vertical center of the window. A full toolbar covers bold, italic, headings, code blocks, tables, blockquotes, and more. Export to PDF (print-based), DOCX (via docx.js), LaTeX (.tex), or MediaWiki markup; import from DOCX or HTML. Live word and character count in the status bar. |
| CSV Editor | A full-featured spreadsheet editor built on AG Grid Community. Open CSV, TSV, TXT, or XLSX files; paste CSV or TSV text directly from the clipboard (Ctrl+V on an empty grid); or start from a blank spreadsheet. **Core editing:** multi-column sort, per-column filter, resize and drag-reorder columns, rename columns with double-click, add/delete rows and columns, freeze columns via right-click context menu, auto-detected numeric and date column types for correct sort order, and a display-only row-number column excluded from exports. **Power features:** Excel-style formula engine (=SUM, =IF, =VLOOKUP, =AVERAGE, =COUNT, =LEN, =ROUND, =CONCATENATE, and hundreds more via fast-formula-parser) with a persistent formula bar showing the A1-style cell address and column-letter badges in headers; fill-handle drag and Ctrl+D fill-down both shift row references automatically in formulas; multi-cell fill (edit one cell while multiple rows are selected to apply the value to the whole column selection at once); Find & Replace (Ctrl+F / Ctrl+H) with regex and case-sensitive modes that also match formula results; conditional formatting with empty-cell highlighting, IQR outlier detection (red = above Q3 + 1.5×IQR, green = below Q1 − 1.5×IQR), and a custom numeric threshold (>, <, >=, <=, =, !=); column stats panel (count, unique values, empty count, numeric min/max/avg); undo/redo with 50-step history. **Export:** CSV, TSV, JSON, XLSX, or SQL INSERT statements (ANSI-standard double-quote column names, empty cells → NULL, numbers unquoted). |
| JSON Formatter | Paste or load a JSON file and instantly see four synchronized output tabs — Formatted (pretty-printed with standard indentation), Minified (single line, minimum bytes), Tree (collapsible key/value explorer with type badges for strings, numbers, booleans, null, arrays, and objects), and Stats (total keys, maximum nesting depth, per-type count breakdown). The Beautify Input button normalises messy or compact JSON in place. Full validation highlights the exact error position for invalid JSON. File size is shown for each tab. |
| Word Counter | Count words, characters (with and without spaces), sentences, paragraphs, and estimated reading time. Handles multi-script content correctly — CJK characters (Chinese, Japanese, Korean) are counted individually per character, Arabic and Indic scripts use word-boundary tokenization, and Cyrillic is counted normally. Open TXT, DOCX, or Markdown files, or drag and drop. PDF files render visually page-by-page via pdfjs-dist. A reading-time table shows estimates at child, average adult, and speed-reader paces. Automatic content-type detection labels the text as prose, code, or mixed. |
| Rich Text Editor | *(coming soon)* |
| Diff Checker | Compare two text files or passages side by side with a live unified diff. Detects adjacent same-count remove/add pairs and applies character-level highlighting within each changed line — showing exactly which characters were modified, not just which lines changed. Long unchanged sections collapse automatically into "▶ N unchanged lines" blocks; click to expand, click again to re-collapse. Hunk navigation (↑ Prev / Next ↓) with a hunk counter jumps between each group of changes. Ignore Whitespace toggle reruns the diff discarding spaces and tabs. Paste or type directly into either panel, open files via the file picker (30+ text extensions), or drag and drop any text file. Stats bar shows added, removed, changed, and unchanged line counts as pill badges. Copy the full unified diff to the clipboard or download it as a standard `.patch` / `.diff` file via jsdiff. |
| Chart Builder | Build charts from CSV, TSV, JSON, or freeform text (`Label: value%`) data — paste it directly, import a file, or drag and drop. **8 chart types:** Bar (grouped multi-series, Y-axis always starts at zero), Line (time-series trends), Area (multi-series volume over time), Pie (auto-sorted largest→smallest, warns when more than 5 slices), Doughnut, Scatter (X/Y numeric relationships), Radar (multi-metric comparison profiles), and Treemap (hierarchical Parent → Child → Value data shown as nested area-proportional rectangles with breadcrumb navigation). **Smart recommendation engine** analyses the data shape — detects time-series labels, numeric-only columns, repeated parent categories, and proportional sums — and suggests the most appropriate chart type with a one-click "Use" button; Pie and Doughnut are treated as equivalent. File validation shows the detected row and column count after import. **6 color themes:** Default, Ocean, Sunset, Pastel, Mono, and Colorblind (Wong palette — safe for deuteranopia and protanopia). Settings: chart title, data source credit line, legend toggle, smooth-curve toggle. Download the current chart as a full-quality 2× PNG — the full legend is always included in the export even when scrolled, and the filename includes the chart title slug. |
| SQL Runner | A full SQL workbench that runs entirely offline. **Local mode** loads CSV, JSON, or XLSX files into an in-browser SQLite engine (sql.js WASM) — no server needed. **Server mode** connects to live PostgreSQL, MySQL, and MSSQL databases via native Node.js drivers (credentials stored locally in SQLite). The multi-tab query editor has syntax highlighting (keywords, functions, identifiers, strings, numbers, comments), live autocomplete for table and column names, and Ctrl+Enter / Ctrl+Shift+Enter run shortcuts. Multiple statements in one run each get their own persistent result tab. **Results table:** sort by any column, global row filter, copy cells or entire columns, column stats tooltip (count, distinct, nulls, min/max/avg), paginated view (200 rows per page), and export as CSV, JSON, or SQL INSERT. **Schema sidebar:** collapsible panel listing tables, views, functions, and procedures with column names and types; lazy-loaded indexes with PK / UQ / IX badges; database switcher for multi-database servers; sticky search to filter by object name; click any column to insert its name into the editor. **Toolbar:** Format SQL (uppercase keywords + structured indentation); Visual EXPLAIN tree (auto-detects SQLite, PostgreSQL, and MySQL EXPLAIN formats and renders a collapsible plan tree); ER Diagram (draggable SVG entity boxes with Bézier FK arrows for real foreign keys and dashed inferred arrows for `_id`-convention columns, pan + zoom); Pivot table (drag fields to Rows, Columns, and Values zones with COUNT / SUM / AVG / MIN / MAX aggregation); Chart mode (8 ECharts chart types — bar, line, area, pie, doughnut, scatter, radar, treemap — with mouse-wheel zoom and drag pan). Connection health chip shows live ping latency and pulses green / amber / red. Query history bar shows the last 10 executed statements. |
| Kanban Board | *(coming soon)* |
| Pomodoro Timer | *(coming soon)* |
| Gantt Chart | *(coming soon)* |
| Timezone Converter | *(coming soon)* |

### Security & Utilities

| Tool | What it does |
|------|-------------|
| Password Generator | *(coming soon)* |
| File Encryptor | *(coming soon)* |
| Hash Generator | *(coming soon)* |
| Unit Converter | *(coming soon)* |
| Color Converter | *(coming soon)* |
| Base64 Encoder | *(coming soon)* |
| Regex Tester | *(coming soon)* |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | [Electron 41](https://www.electronjs.org/) |
| UI | [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) |
| Storage | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Video / Audio | [FFmpeg](https://ffmpeg.org/) via [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) |
| PDF compression | [Ghostscript](https://www.ghostscript.com/) (bundled) |
| OCR | [Tesseract.js](https://tesseract.projectnaptha.com/) (WASM, 20+ languages) |
| Image processing | [Sharp](https://sharp.pixelplumbing.com/) |
| PDF rendering | [pdfjs-dist](https://mozilla.github.io/pdf.js/) |
| PDF manipulation | [pdf-lib](https://pdf-lib.js.org/) |
| Spreadsheets | [SheetJS](https://sheetjs.com/) |
| CSV parsing | [Papa Parse](https://www.papaparse.com/) |
| Spreadsheet grid | [AG Grid Community](https://www.ag-grid.com/) |
| Formula engine | [fast-formula-parser](https://github.com/LesterLyu/fast-formula-parser) |
| DOCX parsing | [mammoth.js](https://github.com/mwilliamson/mammoth.js) |
| Archives | [JSZip](https://stuk.github.io/jszip/) + [archiver](https://github.com/archiverjs/node-archiver) |
| AI background removal | [@huggingface/transformers](https://github.com/huggingface/transformers.js) (RMBG-1.4, local ONNX) |
| Markdown rendering | [marked](https://marked.js.org/) |
| Math rendering | [KaTeX](https://katex.org/) |
| Diagram rendering | [Mermaid](https://mermaid.js.org/) |
| HTML → Markdown | [turndown](https://github.com/mixmark-io/turndown) |
| QR & barcodes | [qrcode](https://github.com/soldair/node-qrcode) + [jsbarcode](https://github.com/lindell/JsBarcode) |
| In-browser SQL | [sql.js](https://sql.js.org/) (SQLite compiled to WASM) |
| PostgreSQL client | [pg](https://node-postgres.com/) |
| MySQL / MariaDB client | [mysql2](https://github.com/sidorares/node-mysql2) |
| MSSQL client | [mssql](https://github.com/tediousjs/node-mssql) |
| Charting | [Apache ECharts](https://echarts.apache.org/) |
| Diff engine | [diff (jsdiff)](https://github.com/kpdecker/jsdiff) |
| Packaging | [electron-builder](https://www.electron.build/) |

---

## Build from Source

**Prerequisites:** Node.js 18+, Git

```bash
# Clone
git clone https://github.com/danangtomo/nexus.git
cd nexus

# Install dependencies
npm install

# Run in development
npm run dev
```

**For PDF compression and encryption** (Ghostscript):
- Windows: `winget install ArtifexSoftware.GhostScript`
- macOS: `brew install ghostscript`
- Linux: `sudo apt install ghostscript`

**Build distributable:**
```bash
npm run build:win    # Windows (.exe installer)
npm run build:mac    # macOS (.dmg)
npm run build:linux  # Linux (.AppImage / .deb)
```

---

## Download

Pre-built installers are available on the [Releases](https://github.com/danangtomo/nexus/releases) page.

---

## Support

☕ [Support via Saweria](https://saweria.co/langdon) — GoPay, OVO, Dana, QRIS, Bank Transfer

---

## License

NEXUS is open source under the [GNU Affero General Public License v3.0](LICENSE).

This means you can use, study, share, and modify this software freely — but any distributed or hosted version must also be open source under the same license.

Bundled components have their own licenses:
- FFmpeg — LGPL 2.1+
- Ghostscript — AGPL-3.0
- Tesseract.js — Apache 2.0
- pdf.js (pdfjs-dist) — Apache 2.0
- @huggingface/transformers — MIT
- KaTeX — MIT
- Mermaid — MIT

---

<div align="center">

Designed by [Danang Estutomoaji](https://github.com/danangtomo) · Built with Electron + React

</div>
