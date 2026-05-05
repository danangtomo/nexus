"""
NEXUS — Cross-platform OCR sidecar build script (used by CI / build.yml).
Run: python python/ocr-reader/build_sidecar_ci.py  (from the project root)

Produces python/dist/ocr-server[.exe] which electron-builder copies
into extraResources/sidecar/ via electron-builder.yml.
"""
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0

import subprocess
import sys
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

args = [
    sys.executable, '-m', 'PyInstaller',
    '--onefile',
    '--name', 'ocr-server',
    '--distpath', str(dist_dir),
    '--collect-all', 'mineru',
    '--collect-all', 'paddlex',
    '--collect-all', 'paddleocr',
    *[item for h in HIDDEN for item in ('--hidden-import', h)],
    str(script),
]

print('[OCR] Building sidecar binary...')
result = subprocess.run(args, cwd=here)
if result.returncode != 0:
    print('[OCR] Build FAILED', file=sys.stderr)
    sys.exit(result.returncode)

out = dist_dir / ('ocr-server.exe' if sys.platform == 'win32' else 'ocr-server')
print(f'[OCR] Sidecar ready: {out}  ({out.stat().st_size / 1_048_576:.0f} MB)')
