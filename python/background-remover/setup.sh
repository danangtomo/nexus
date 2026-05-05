#!/usr/bin/env bash
# NEXUS — Create venv and install BiRefNet sidecar dependencies (macOS / Linux)
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0
# Run once before dev or before building:  bash python/background-remover/setup.sh

set -e
cd "$(dirname "$0")"

PYTHON=$(command -v python3 2>/dev/null || command -v python)

if [ -f ".venv/bin/python3" ] || [ -f ".venv/Scripts/python.exe" ]; then
  echo "[BiRefNet] Venv already exists — updating deps..."
else
  echo "[BiRefNet] Creating virtual environment..."
  "$PYTHON" -m venv .venv
fi

if [ -f ".venv/Scripts/pip" ]; then
  VENV_PIP=".venv/Scripts/pip"
else
  VENV_PIP=".venv/bin/pip"
fi

echo "[BiRefNet] Installing dependencies..."
"$VENV_PIP" install -r requirements.txt --quiet

echo ""
echo "[BiRefNet] Done. Venv: python/background-remover/.venv"
echo "Start dev with: npm run dev  (handler auto-detects the venv)"
