/**
 * Nexus - Offline productivity suite
 * Copyright (C) 2026 Danang Estutomoaji
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

'use strict'

const { ipcMain, app } = require('electron')
const http             = require('http')
const path             = require('path')
const fs               = require('fs')
const { spawn }        = require('child_process')

const PORT    = 7863
const TIMEOUT = 600_000  // 10 min — covers first-run MinerU model download + slow CPU inference

// ── Sidecar state ─────────────────────────────────────────────────────────────

let _proc        = null
let _killPromise = null
let _webContents = null

// ── Sidecar path resolution ───────────────────────────────────────────────────

function _getDevPython(sidecarDir) {
  const venvPython = process.platform === 'win32'
    ? path.join(sidecarDir, '.venv', 'Scripts', 'python.exe')
    : path.join(sidecarDir, '.venv', 'bin', 'python3')
  if (fs.existsSync(venvPython)) return venvPython
  return process.env.NEXUS_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
}

function _getSidecar() {
  if (process.env.NODE_ENV === 'development') {
    const sidecarDir = path.join(__dirname, '../../python/ocr-reader')
    const script     = path.join(sidecarDir, 'server.py')
    return { cmd: _getDevPython(sidecarDir), args: [script], checkPath: script }
  }
  const bin = process.platform === 'win32' ? 'ocr-server.exe' : 'ocr-server'
  const cmd = path.join(process.resourcesPath, 'sidecar', bin)
  return { cmd, args: [], checkPath: cmd }
}

// ── Process lifecycle ─────────────────────────────────────────────────────────

function _spawnSidecar() {
  if (_proc) return

  const { cmd, args, checkPath } = _getSidecar()
  if (!fs.existsSync(checkPath)) {
    console.warn('[OCR] sidecar not found at', checkPath)
    return
  }

  _proc = spawn(cmd, args, {
    env: {
      ...process.env,
      NEXUS_OCR_PORT:                  String(PORT),
      NEXUS_MODEL_DIR:                 path.join(app.getPath('userData'), 'models'),
      NEXUS_BUNDLED_MODELS_DIR:        path.join(process.resourcesPath, 'models', 'mineru'),
      PYTHONUTF8:                      '1',
      PYTHONIOENCODING:                'utf-8',
      HF_HUB_DISABLE_SYMLINKS_WARNING: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  _proc.stdout.on('data', (chunk) => {
    const text = chunk.toString()
    if (text.includes('NEXUS_READY') && _webContents && !_webContents.isDestroyed()) {
      _webContents.send('ocr:engine-ready')
    }
    process.stdout.write('[OCR] ' + text)
  })
  _proc.stderr.on('data', (d) => process.stderr.write('[OCR] ' + d))
  _proc.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.warn(`[OCR] process exited — code=${code} signal=${signal}`)
    }
    _proc = null
  })
}

function _killSidecar() {
  if (_killPromise) return _killPromise
  if (!_proc) return Promise.resolve()

  _killPromise = new Promise((resolve) => {
    const proc  = _proc
    const timer = setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL')
      resolve()
    }, 5_000)
    proc.once('exit', () => { clearTimeout(timer); resolve() })
    proc.kill('SIGTERM')
  }).finally(() => { _killPromise = null })

  return _killPromise
}

app.on('before-quit', () => _killSidecar())

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function _get(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { hostname: '127.0.0.1', port: PORT, path: urlPath, timeout: 5_000 },
      (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => resolve(res.statusCode))
      }
    )
    req.on('error', reject)
    req.on('timeout', () => reject(new Error('timeout')))
  })
}

function _post(urlPath, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const req  = http.request(
      {
        hostname: '127.0.0.1',
        port:     PORT,
        path:     urlPath,
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: TIMEOUT,
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}: ${data}`))
          }
          try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
        })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
    req.write(body)
    req.end()
  })
}

async function _waitForServer(maxMs = 180_000) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    try {
      if (await _get('/ready') === 200) return
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 800))
  }
  throw new Error('OCR server did not become ready in time.')
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('ocr:page-enter', async (event) => {
  _webContents = event.sender
  if (_killPromise) await _killPromise
  _spawnSidecar()
})

ipcMain.handle('ocr:page-leave', async () => {
  _webContents = null
  await _killSidecar()
})

ipcMain.handle('ocr:parse', async (event, filePath, lang, startPage, endPage, forceOcr, tableEnable, formulaEnable) => {
  if (!_proc) {
    if (_killPromise) await _killPromise
    _webContents = event.sender
    _spawnSidecar()
  }
  await _waitForServer()
  return _post('/parse', {
    file_path:  filePath,
    lang:       lang      || 'ch',
    start_page: startPage ?? 0,
    end_page:   endPage   ?? -1,
    force_ocr:      forceOcr      ?? false,
    table_enable:   tableEnable   ?? true,
    formula_enable: formulaEnable ?? true,
  })
})
