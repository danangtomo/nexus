#!/usr/bin/env bash
# NEXUS — Create venv and install OCR sidecar dependencies (macOS / Linux)
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0
# Run once before dev or before building:  bash python/ocr-reader/setup.sh
#
# Installs CPU-only torch (~250 MB) before MinerU to prevent pip
# from pulling the CUDA build (~2 GB).

set -e
cd "$(dirname "$0")"

PYTHON=$(command -v python3 2>/dev/null || command -v python)

if [ -f ".venv/bin/python3" ] || [ -f ".venv/Scripts/python.exe" ]; then
  echo "[OCR] Venv already exists — updating deps..."
else
  echo "[OCR] Creating virtual environment..."
  "$PYTHON" -m venv .venv
fi

# Detect pip path after venv exists
if [ -f ".venv/Scripts/pip" ]; then
  VENV_PIP=".venv/Scripts/pip"
else
  VENV_PIP=".venv/bin/pip"
fi

echo "[OCR] Installing CPU-only torch (prevents 2 GB CUDA download)..."
"$VENV_PIP" install torch torchvision --index-url https://download.pytorch.org/whl/cpu --quiet

echo "[OCR] Installing remaining dependencies..."
"$VENV_PIP" install -r requirements.txt --quiet

echo ""
echo "[OCR] Done. Venv: python/ocr-reader/.venv"
echo "Start dev with: npm run dev  (handler auto-detects the venv)"
