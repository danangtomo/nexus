@echo off
:: NEXUS — Set up all Python sidecars (Windows)
:: Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0
:: Run once after cloning:  python\setup.bat

echo =============================================
echo  NEXUS Python sidecar setup
echo =============================================
echo.

echo [1/2] Background Remover (BiRefNet)...
call "%~dp0background-remover\setup.bat"
echo.

echo [2/2] OCR Reader (MinerU)...
call "%~dp0ocr-reader\setup.bat"
echo.

echo =============================================
echo  All sidecars ready. Run: npm run dev
echo =============================================
