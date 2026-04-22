<div align="center">

<img src="assets/logo.svg" width="100" alt="NEXUS logo" />

# NEXUS

**All-in-one offline productivity desktop app**

[![Version](https://img.shields.io/badge/version-0.11.0-007AFF?style=flat-square)](https://github.com/danangtomo/nexus/releases)
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
| Image Converter | Convert between JPG, PNG, WEBP, AVIF, TIFF — batch, quality control |
| Image Resizer | Resize by pixels or percent, aspect-lock, fit modes, batch |
| Image Compressor | Quality slider with live size savings preview, total bytes saved |
| Background Remover | AI background removal (RMBG-1.4, local ONNX) — before/after preview, background color switcher |
| Watermark Tool | Text watermark, 9 positions, font size / opacity / color — live canvas preview |
| Metadata Remover | Strip EXIF, ICC, XMP, IPTC — shows metadata table |

### PDF
| Tool | What it does |
|------|-------------|
| PDF Merger | Drag-to-reorder, page count per file, merge via pdf-lib |
| PDF Splitter | Split by page range or every N pages |
| PDF Compressor | Compress via Ghostscript — Screen / eBook / Printer quality |
| PDF Encryptor | Set / remove user + owner password (AES-256 via pdf-lib) |
| OCR Reader | Extract text from images or PDFs — 20+ languages via Tesseract.js |

### Video & Audio
| Tool | What it does |
|------|-------------|
| Video Converter | Convert to MP4, WebM, MKV, AVI, MOV, GIF via FFmpeg |
| Audio Converter | Convert to MP3, AAC, OGG, FLAC, WAV, M4A — quality per codec, lossless mode |

### Documents & Data
| Tool | What it does |
|------|-------------|
| Doc Converter | DOCX → HTML / TXT, MD → HTML / TXT, TXT ↔ HTML / MD — rendered preview |
| Spreadsheet Converter | Convert XLSX, CSV, TSV, JSON, HTML — multi-sheet selector, UTF-8 BOM support |
| Archive Manager | Compress ZIP / TAR.GZ via archiver; extract ZIP — file listing preview |
| QR & Barcode | Generate QR codes + 6 barcode formats (Code 128, Code 39, EAN-13, EAN-8, UPC-A, ITF-14) |

### Office
| Tool | What it does |
|------|-------------|
| Markdown Editor | Typora-level: KaTeX math, Mermaid diagrams, Outline Panel, Focus Mode, Typewriter Mode; export PDF / DOCX / LaTeX / MediaWiki; import DOCX / HTML |
| JSON Formatter | Format, minify, validate — 4 live tabs (Formatted / Minified / Tree / Stats), Beautify Input |
| Rich Text Editor | *(coming soon)* |
| CSV Editor | *(coming soon)* |
| Diff Checker | *(coming soon)* |
| Chart Builder | *(coming soon)* |
| SQL Runner | *(coming soon)* |
| Formula Calculator | *(coming soon)* |
| Kanban Board | *(coming soon)* |
| Pomodoro Timer | *(coming soon)* |
| Gantt Chart | *(coming soon)* |
| Timezone Converter | *(coming soon)* |

### Security & Utilities
| Tool | What it does |
|------|-------------|
| Word Counter | Words, chars, sentences, reading time — CJK / Arabic / Cyrillic / Indic support, PDF visual render, per-reader WPM table |
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
| DOCX parsing | [mammoth.js](https://github.com/mwilliamson/mammoth.js) |
| Archives | [JSZip](https://stuk.github.io/jszip/) + [archiver](https://github.com/archiverjs/node-archiver) |
| AI background removal | [@huggingface/transformers](https://github.com/huggingface/transformers.js) (RMBG-1.4, local ONNX) |
| Markdown rendering | [marked](https://marked.js.org/) |
| Math rendering | [KaTeX](https://katex.org/) |
| Diagram rendering | [Mermaid](https://mermaid.js.org/) |
| HTML → Markdown | [turndown](https://github.com/mixmark-io/turndown) |
| QR & barcodes | [qrcode](https://github.com/soldair/node-qrcode) + [jsbarcode](https://github.com/lindell/JsBarcode) |
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
