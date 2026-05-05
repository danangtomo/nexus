@echo off
:: NEXUS — Build OCR sidecar binary for Windows (x64)
:: Copyright (C) 2026 Danang Estutomoaji — AGPL-3.0
:: Run from the project root: python\ocr-reader\build.bat
:: Output: python\dist\ocr-server.exe  →  copy to extraResources\sidecar\
:: Requires venv — run setup.bat first if it doesn't exist.

setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [OCR] Venv not found — running setup first...
  call setup.bat
)

echo [OCR] Installing PyInstaller into venv...
.venv\Scripts\pip install pyinstaller --quiet

echo [OCR] Building sidecar...
.venv\Scripts\pyinstaller --onefile ^
  --name ocr-server ^
  --distpath ..\dist ^
  --collect-all mineru ^
  --hidden-import=mineru.cli.common ^
  --hidden-import=uvicorn.logging ^
  --hidden-import=uvicorn.loops ^
  --hidden-import=uvicorn.loops.auto ^
  --hidden-import=uvicorn.protocols ^
  --hidden-import=uvicorn.protocols.http ^
  --hidden-import=uvicorn.protocols.http.auto ^
  --hidden-import=uvicorn.protocols.websockets ^
  --hidden-import=uvicorn.protocols.websockets.auto ^
  --hidden-import=uvicorn.lifespan ^
  --hidden-import=uvicorn.lifespan.on ^
  --hidden-import=fastapi ^
  --hidden-import=pydantic ^
  --hidden-import=starlette ^
  --hidden-import=anyio ^
  --hidden-import=anyio._backends._asyncio ^
  server.py

if %ERRORLEVEL% neq 0 (
  echo [OCR] Build FAILED
  exit /b 1
)

echo.
echo [OCR] Build complete: ..\dist\ocr-server.exe
echo Copy it to: ..\..\resources\sidecar\ocr-server.exe
endlocal
