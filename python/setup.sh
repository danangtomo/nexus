#!/usr/bin/env bash
# NEXUS — Set up all Python sidecars (macOS / Linux)
# Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0
# Run once after cloning:  bash python/setup.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================="
echo " NEXUS Python sidecar setup"
echo "============================================="
echo ""

echo "[1/2] Background Remover (BiRefNet)..."
bash "$SCRIPT_DIR/background-remover/setup.sh"
echo ""

echo "[2/2] OCR Reader (MinerU)..."
bash "$SCRIPT_DIR/ocr-reader/setup.sh"
echo ""

echo "============================================="
echo " All sidecars ready. Run: npm run dev"
echo "============================================="
