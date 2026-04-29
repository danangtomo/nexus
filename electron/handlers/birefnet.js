/**
 * Nexus - Offline productivity suite
 * Copyright (C) 2026 Danang Estutomoaji
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

'use strict'

const { ipcMain, app } = require('electron')
const http             = require('http')
const path             = require('path')
const fs               = require('fs')
const { spawn }        = require('child_process')

const PORT    = 7862
const TIMEOUT = 300_000  // 5 min — covers first-run download + quantisation + inference

// ── Sidecar state ─────────────────────────────────────────────────────────────

let _proc        = null   // ChildProcess | null
let _killPromise = null   // Promise | null  — in-flight kill operation
let _webContents = null   // WebContents of the renderer that owns the page

// ── Sidecar path resolution ───────────────────────────────────────────────────

function _getSidecar() {
  if (process.env.NODE_ENV === 'development') {
    const script = path.join(__dirname, '../../python/server.py')
    return {
      cmd:       process.platform === 'win32' ? 'python' : 'python3',
      args:      [script],
      checkPath: script,   // existence check uses the script, not the interpreter
    }
  }
  const bin = process.platform === 'win32' ? 'birefnet-server.exe' : 'birefnet-server'
  const cmd = path.join(process.resourcesPath, 'sidecar', bin)
  return { cmd, args: [], checkPath: cmd }
}

// ── Process lifecycle ─────────────────────────────────────────────────────────

function _spawnSidecar() {
  if (_proc) return  // already running

  const { cmd, args, checkPath } = _getSidecar()
  if (!fs.existsSync(checkPath)) {
    console.warn('[BiRefNet] sidecar not found at', checkPath)
    return
  }

  _proc = spawn(cmd, args, {
    env: {
      ...process.env,
      NEXUS_BIREFNET_PORT: String(PORT),
      NEXUS_MODEL_DIR:     path.join(app.getPath('userData'), 'models'),
      // Force UTF-8 stdout/stderr on Windows (prevents cp1252 UnicodeEncodeError)
      PYTHONUTF8:          '1',
      PYTHONIOENCODING:    'utf-8',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  _proc.stdout.on('data', (chunk) => {
    const text = chunk.toString()
    // Sentinel printed by server.py after model finishes loading
    if (text.includes('NEXUS_READY') && _webContents && !_webContents.isDestroyed()) {
      _webContents.send('birefnet:engine-ready')
    }
    process.stdout.write('[BiRefNet] ' + text)
  })
  _proc.stderr.on('data', (d) => process.stderr.write('[BiRefNet] ' + d))
  _proc.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.warn(`[BiRefNet] process exited — code=${code} signal=${signal}`)
    }
    _proc = null
  })
}

function _killSidecar() {
  // If a kill is already in flight, join it instead of starting another
  if (_killPromise) return _killPromise
  if (!_proc) return Promise.resolve()

  _killPromise = new Promise((resolve) => {
    const proc = _proc

    // Escalate to SIGKILL after 5 s if SIGTERM is ignored (should not happen on Unix;
    // on Windows, kill() immediately terminates the process so the timer is a safety net)
    const timer = setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL')
      resolve()
    }, 5_000)

    proc.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })

    proc.kill('SIGTERM')
  }).finally(() => { _killPromise = null })

  return _killPromise
}

// Kill on app quit — zombie prevention
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
    req.on('error',   reject)
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
    req.on('error',   reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
    req.write(body)
    req.end()
  })
}

async function _waitForServer(maxMs = 120_000) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    try {
      if (await _get('/health') === 200) return
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 800))
  }
  throw new Error(
    'BiRefNet server did not become ready in time. ' +
    'Ensure Python 3 and requirements.txt are installed, or use the bundled sidecar.'
  )
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

// Called when the renderer mounts the BackgroundRemover page.
// Spawns the sidecar so the model starts loading in the background while
// the user drops their image — by the time they click Remove Background,
// the engine is likely already warm.
ipcMain.handle('birefnet:page-enter', async (event) => {
  _webContents = event.sender
  // If a previous kill is still in progress (rapid navigate-away-return),
  // wait for it to finish so we don't spawn over a dying process.
  if (_killPromise) await _killPromise
  _spawnSidecar()
})

// Called when the renderer unmounts the page (navigation away).
// Kills the sidecar immediately — scenario (b).
ipcMain.handle('birefnet:page-leave', async () => {
  _webContents = null
  await _killSidecar()
})

// Trigger inference. Handles three cases:
//   1. Normal: server warm from page-enter → fast response
//   2. Re-run: server was killed after previous processing → respawn + wait
//   3. Abandoned: user navigates away mid-flight → HTTP fails, error propagates to renderer
ipcMain.handle('birefnet:remove-bg', async (event, imagePath) => {
  // Respawn if killed after a previous run on this page visit
  if (!_proc) {
    if (_killPromise) await _killPromise
    _webContents = event.sender
    _spawnSidecar()
  }

  const progress = (pct) =>
    event.sender.send('birefnet:progress', { key: 'inference', pct })

  progress(5)
  await _waitForServer()
  progress(20)

  const { base64_png } = await _post('/remove-bg', { image_path: imagePath })
  progress(100)

  // Scenario (a): kill immediately after successful processing.
  // Memory is freed before the user interacts with the result.
  // "Run Again" re-spawns automatically on the next remove-bg call.
  _killSidecar()  // fire-and-forget

  return { base64: base64_png }
})
