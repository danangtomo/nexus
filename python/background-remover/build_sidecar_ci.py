"""
NEXUS — Cross-platform sidecar build script (used by CI / release.yml).
Run: python python/background-remover/build_sidecar_ci.py  (from the project root)

Produces python/dist/birefnet-server[.exe] which electron-builder copies
into extraResources/sidecar/ via electron-builder.yml.
"""
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0

import subprocess
import sys
from pathlib import Path

HIDDEN = [
    'onnxruntime',
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
    '--name', 'birefnet-server',
    '--distpath', str(dist_dir),
    '--collect-all', 'onnxruntime',
    *[item for h in HIDDEN for item in ('--hidden-import', h)],
    str(script),
]

print('[BiRefNet] building sidecar binary…')
result = subprocess.run(args, cwd=here)
if result.returncode != 0:
    print('[BiRefNet] build FAILED', file=sys.stderr)
    sys.exit(result.returncode)

out = dist_dir / ('birefnet-server.exe' if sys.platform == 'win32' else 'birefnet-server')
print(f'[BiRefNet] sidecar ready: {out}  ({out.stat().st_size / 1_048_576:.0f} MB)')
