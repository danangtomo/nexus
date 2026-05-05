@echo off
:: NEXUS — Create venv and install BiRefNet sidecar dependencies (Windows)
:: Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0
:: Run once before dev or before building:  python\background-remover\setup.bat

setlocal
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
  echo [BiRefNet] Venv already exists — updating deps...
) else (
  echo [BiRefNet] Creating virtual environment...
  python -m venv .venv
)

echo [BiRefNet] Installing dependencies...
.venv\Scripts\pip install -r requirements.txt --quiet

echo.
echo [BiRefNet] Done. Venv: python\background-remover\.venv
echo Start dev with: npm run dev  (handler auto-detects the venv)
endlocal
