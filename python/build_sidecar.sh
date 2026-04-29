#!/usr/bin/env bash
# NEXUS — Build BiRefNet sidecar binary for macOS / Linux
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0
# Run from the project root: bash python/build_sidecar.sh
# Output: python/dist/birefnet-server  →  copy to extraResources/sidecar/
set -e
cd "$(dirname "$0")"

echo "[BiRefNet] Installing PyInstaller..."
pip install pyinstaller --quiet

echo "[BiRefNet] Building sidecar..."
pyinstaller --onefile \
  --name birefnet-server \
  --hidden-import=onnxruntime \
  --collect-all onnxruntime \
  --hidden-import=uvicorn.logging \
  --hidden-import=uvicorn.loops \
  --hidden-import=uvicorn.loops.auto \
  --hidden-import=uvicorn.protocols \
  --hidden-import=uvicorn.protocols.http \
  --hidden-import=uvicorn.protocols.http.auto \
  --hidden-import=uvicorn.protocols.websockets \
  --hidden-import=uvicorn.protocols.websockets.auto \
  --hidden-import=uvicorn.lifespan \
  --hidden-import=uvicorn.lifespan.on \
  --hidden-import=fastapi \
  --hidden-import=pydantic \
  --hidden-import=starlette \
  --hidden-import=anyio \
  --hidden-import=anyio._backends._asyncio \
  server.py

echo ""
echo "[BiRefNet] Build complete: dist/birefnet-server"
echo "Copy it to: ../resources/sidecar/birefnet-server"