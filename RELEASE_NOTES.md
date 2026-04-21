# NEXUS v0.3.0

## Added
- **PDF Splitter** — split any PDF by page range (e.g. `1-3, 5, 7-9`) or into equal chunks of N pages. Each range saves as a separate named file (e.g. `document_p1-3.pdf`). Shows per-chunk page count after splitting.
- **PDF Compressor** — reduce PDF file size using Ghostscript image resampling. Three presets: Small (~72 DPI), Balanced (~150 DPI), Quality (~300 DPI). Shows before/after file size with % saved.
- **PDF Encryptor** — password-protect PDFs with real RC4-128 encryption via Ghostscript. Every viewer (Edge, Chrome, Acrobat, Preview, Foxit) enforces the password. Supports user password + optional separate owner password. Decrypt mode removes password protection from files you own.
- **Ghostscript engine** — bundled inside the installer on all platforms. End users do not need to install Ghostscript separately.

## Changed
- PDF Encryptor: replaced unreliable pdf-lib encryption with Ghostscript — passwords are now universally enforced across all PDF viewers.
- License updated to AGPL-3.0 (required for Ghostscript distribution).

## Fixed
- PDF Encryptor: page count no longer shows "null pages" on heavily encrypted files.
