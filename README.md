<div align="center">

<img src="assets/logo.svg" width="100" alt="NEXUS logo" />

# NEXUS

**All-in-one offline productivity desktop app**

[![Version](https://img.shields.io/badge/version-0.5.1-007AFF?style=flat-square)](https://github.com/danangtomo/nexus/releases)
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
| Image Converter | Convert between JPG, PNG, WEBP, AVIF, TIFF |
| Image Resizer | Resize by pixels or percent, aspect-lock, batch |
| Image Compressor | Quality slider with live size savings preview |
| Background Remover | Remove backgrounds locally via WASM |
| Watermark Tool | Add text or image overlays |
| Metadata Remover | Strip EXIF data from images |

### PDF
| Tool | What it does |
|------|-------------|
| PDF Merger | Drag-to-reorder pages, merge multiple PDFs |
| PDF Splitter | Split by page range or every N pages |
| PDF Compressor | Compress via Ghostscript (Screen / eBook / Printer) |
| PDF Encryptor | Encrypt with user + owner password, or decrypt |
| OCR Reader | Extract text from images or PDFs — 20 languages |

### Video & Audio
| Tool | What it does |
|------|-------------|
| Video Converter | Convert to MP4, WebM, MKV, AVI, MOV, GIF |
| Audio Converter | Convert to MP3, AAC, OGG, FLAC, WAV, M4A |

### Documents & Data
| Tool | What it does |
|------|-------------|
| Doc Converter | Convert DOCX, PDF, MD, HTML, TXT |
| Spreadsheet Converter | Convert XLSX, CSV, JSON, ODS |
| Archive Manager | Compress and extract ZIP, TAR, 7z |
| QR & Barcode | Generate QR codes and barcodes |

### Office
| Tool | What it does |
|------|-------------|
| Rich Text Editor | Write, format, export DOCX/PDF |
| Markdown Editor | Split-pane live preview |
| CSV Editor | Sort, filter, edit, export |
| JSON Formatter | Format, validate, tree view |
| Diff Checker | Compare two files side by side |
| Chart Builder | Bar, line, pie, scatter from CSV |
| SQL Runner | Run SQL on CSV/JSON files |
| Formula Calculator | Excel-style formula evaluator |
| Kanban Board | Drag & drop, saved to SQLite |
| Pomodoro Timer | Focus + break cycles, session log |
| Gantt Chart | Tasks, dependencies, drag resize |
| Timezone Converter | Compare cities side by side |

### Security & Utilities
| Tool | What it does |
|------|-------------|
| Password Generator | Length, symbols, passphrase mode |
| File Encryptor | AES-256 client-side |
| Hash Generator | MD5 / SHA-1 / SHA-256 for text and files |
| Unit Converter | Length, weight, temperature |
| Color Converter | HEX ↔ RGB ↔ HSL ↔ CMYK |
| Base64 Encoder | Text, file, URL encoding |
| Regex Tester | Live match highlight, flags |
| Word Counter | Words, chars, sentences, reading time |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | [Electron 41](https://www.electronjs.org/) |
| UI | [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) |
| Storage | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Video / Audio | [FFmpeg](https://ffmpeg.org/) via [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) |
| PDF compression / encryption | [Ghostscript](https://www.ghostscript.com/) (bundled) |
| OCR | [Tesseract.js](https://tesseract.projectnaptha.com/) (WASM, 20 languages) |
| Image processing | [Sharp](https://sharp.pixelplumbing.com/) |
| PDF manipulation | [pdf-lib](https://pdf-lib.js.org/) |
| Spreadsheets | [SheetJS](https://sheetjs.com/) |
| DOCX parsing | [mammoth.js](https://github.com/mwilliamson/mammoth.js) |
| Archives | [JSZip](https://stuk.github.io/jszip/) + [archiver](https://github.com/archiverjs/node-archiver) |
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

## License

NEXUS is open source under the [AGPL-3.0 License](LICENSE).

Bundled components have their own licenses:
- FFmpeg — LGPL 2.1+
- Ghostscript — AGPL-3.0
- Tesseract — Apache 2.0

---

<div align="center">

Designed by [Danang Estutomoaji](https://github.com/danangtomo) · Built with Electron + React

</div>
