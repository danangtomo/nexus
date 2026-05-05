"""
NEXUS — Cross-platform OCR sidecar build script (used by CI / build.yml).
Run: python python/ocr-reader/build_sidecar_ci.py  (from the project root)

Produces python/dist/nexus-ocr-{platform}.zip which is uploaded as a
GitHub Release asset and downloaded by the app on first OCR use.
"""
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0

import subprocess, sys, zipfile
from pathlib import Path

HIDDEN = [
    'mineru.cli.common',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'fastapi',
    'pydantic',
    'starlette',
    'anyio',
    'anyio._backends._asyncio',
]

here     = Path(__file__).parent
dist_dir = here.parent / 'dist'
script   = here / 'server.py'

# ── Build --onedir (directory mode compresses much better than --onefile) ──
args = [
    sys.executable, '-m', 'PyInstaller',
    '--onedir',
    '--name', 'ocr-server',
    '--distpath', str(dist_dir),
    '--collect-all', 'mineru',
    '--collect-all', 'paddlex',
    '--collect-all', 'paddleocr',
    *[item for h in HIDDEN for item in ('--hidden-import', h)],
    str(script),
]

print('[OCR] Building sidecar (onedir)...')
result = subprocess.run(args, cwd=here)
if result.returncode != 0:
    print('[OCR] Build FAILED', file=sys.stderr)
    sys.exit(result.returncode)

sidecar_dir = dist_dir / 'ocr-server'

# ── Fix permissions on Unix ────────────────────────────────────────────────
if sys.platform != 'win32':
    import stat
    bin_path = sidecar_dir / 'ocr-server'
    bin_path.chmod(bin_path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

# ── Zip the directory (ZIP compression works well on separate files) ────────
platform_name = 'win' if sys.platform == 'win32' else 'mac' if sys.platform == 'darwin' else 'linux'
zip_path = dist_dir / f'nexus-ocr-{platform_name}.zip'

print(f'[OCR] Zipping {sidecar_dir} -> {zip_path} ...')
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for f in sidecar_dir.rglob('*'):
        zf.write(f, f.relative_to(sidecar_dir.parent))

mb = zip_path.stat().st_size / 1_048_576
print(f'[OCR] Zip ready: {zip_path}  ({mb:.0f} MB)')
