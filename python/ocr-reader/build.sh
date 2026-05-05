#!/usr/bin/env bash
# NEXUS — Build OCR sidecar binary for macOS / Linux
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0
# Run from the project root: bash python/ocr-reader/build.sh
# Output: python/dist/ocr-server  →  copy to resources/sidecar/
# Requires venv — run setup.sh first if it doesn't exist.

set -e
cd "$(dirname "$0")"

if [ ! -f ".venv/bin/python3" ]; then
  echo "[OCR] Venv not found — running setup first..."
  bash setup.sh
fi

echo "[OCR] Installing PyInstaller into venv..."
.venv/bin/pip install pyinstaller --quiet

echo "[OCR] Building sidecar..."
.venv/bin/pyinstaller --onefile \
  --name ocr-server \
  --distpath ../dist \
  --collect-all mineru \
  --hidden-import=mineru.cli.common \
  --hidden-import=uvicorn.logging \
  --hidden-import=uvicorn.loops \
  --hidden-import=uvicorn.loops.auto \
  --hidden-import=uvicorn.protocols \
  --hidden-import=uvicorn.protocols.http \
  --hidden-import=uvicorn.protocols.http.auto \
  --hidden-import=uvicorn.lifespan \
  --hidden-import=uvicorn.lifespan.on \
  --hidden-import=fastapi \
  --hidden-import=pydantic \
  --hidden-import=starlette \
  --hidden-import=anyio \
  --hidden-import=anyio._backends._asyncio \
  server.py

echo ""
echo "[OCR] Build complete: ../dist/ocr-server"
echo "Copy it to: ../../resources/sidecar/ocr-server"
