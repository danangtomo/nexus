@echo off
:: NEXUS — Create venv and install OCR sidecar dependencies (Windows)
:: Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0
:: Run once before dev or before building:  python\ocr-reader\setup.bat
::
:: Installs CPU-only torch (~250 MB) before MinerU to prevent pip
:: from pulling the CUDA build (~2 GB).

setlocal
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
  echo [OCR] Venv already exists — updating deps...
) else (
  echo [OCR] Creating virtual environment...
  python -m venv .venv
)

echo [OCR] Installing CPU-only torch (prevents 2 GB CUDA download)...
.venv\Scripts\pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu --quiet

echo [OCR] Installing remaining dependencies...
.venv\Scripts\pip install -r requirements.txt --quiet

echo.
echo [OCR] Done. Venv: python\ocr-reader\.venv
echo Start dev with: npm run dev  (handler auto-detects the venv)
endlocal
