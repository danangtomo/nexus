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

const { ipcMain } = require('electron')
const http        = require('http')

const PORT    = 7862
const TIMEOUT = 300_000  // 5 min — covers model download + inference on slow CPU

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: PORT, path, timeout: 5000 }, (res) => {
      let body = ''
      res.on('data', c => (body += c))
      res.on('end', () => resolve(res.statusCode))
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')))
  })
}

function httpPost(path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const req  = http.request({
      hostname: '127.0.0.1',
      port:     PORT,
      path,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout:  TIMEOUT,
    }, (res) => {
      let data = ''
      res.on('data', c => (data += c))
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    })
    req.on('error',   reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
    req.write(body)
    req.end()
  })
}

// ── Wait for Python server ────────────────────────────────────────────────────
// Polls /health until the server responds (model may still be downloading/loading).

async function waitForServer(maxMs = 120_000) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    try {
      const status = await httpGet('/health')
      if (status === 200) return
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 800))
  }
  throw new Error('BiRefNet Python server did not become ready in time. '
    + 'Make sure Python 3 and the requirements are installed.')
}

// ── IPC handler ───────────────────────────────────────────────────────────────

ipcMain.handle('birefnet:remove-bg', async (event, imagePath) => {
  const progress = (pct) =>
    event.sender.send('birefnet:progress', { key: 'inference', pct })

  progress(5)
  await waitForServer()
  progress(20)

  const { base64_png } = await httpPost('/remove-bg', { image_path: imagePath })
  progress(100)
  return { base64: base64_png }
})
