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
const path = require('path')
const fs = require('fs')
const archiver = require('archiver')
const JSZip = require('jszip')

// ── List contents of a ZIP archive ───────────────────────────────────────────

ipcMain.handle('archive:list', async (_e, archivePath) => {
  const ext = path.extname(archivePath).toLowerCase()
  if (ext !== '.zip') throw new Error('Only ZIP archives are supported for extraction')
  const data = fs.readFileSync(archivePath)
  const zip = await JSZip.loadAsync(data)
  const entries = []
  zip.forEach((relativePath, file) => {
    entries.push({
      name: relativePath,
      isDir: file.dir,
      date: file.date ? file.date.toISOString() : null,
    })
  })
  return entries.sort((a, b) => a.name.localeCompare(b.name))
})

// ── Extract a ZIP archive ─────────────────────────────────────────────────────

ipcMain.handle('archive:extract', async (_e, { archivePath, outputDir }) => {
  fs.mkdirSync(outputDir, { recursive: true })
  const data = fs.readFileSync(archivePath)
  const zip = await JSZip.loadAsync(data)

  const promises = []
  zip.forEach((relativePath, file) => {
    const destPath = path.join(outputDir, relativePath)
    if (file.dir) {
      fs.mkdirSync(destPath, { recursive: true })
    } else {
      const p = file.async('nodebuffer').then((content) => {
        fs.mkdirSync(path.dirname(destPath), { recursive: true })
        fs.writeFileSync(destPath, content)
      })
      promises.push(p)
    }
  })

  await Promise.all(promises)
  return { count: promises.length }
})

// ── Compress files/folders into ZIP or TAR.GZ ─────────────────────────────────

ipcMain.handle('archive:compress', async (_e, { files, outputPath, format }) => {
  if (format !== 'zip' && format !== 'tar.gz') {
    throw new Error(`Unsupported format: ${format}`)
  }

  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    const output = fs.createWriteStream(outputPath)

    const arc = format === 'zip'
      ? archiver('zip', { zlib: { level: 9 } })
      : archiver('tar', { gzip: true, gzipOptions: { level: 9 } })

    const cleanup = () => {
      try { fs.unlinkSync(outputPath) } catch (_) {}
    }

    output.on('close', () => resolve({ size: arc.pointer() }))
    arc.on('error', (err) => { cleanup(); reject(err) })
    arc.pipe(output)

    try {
      for (const filePath of files) {
        const stat = fs.statSync(filePath)
        const name = path.basename(filePath)
        if (stat.isDirectory()) {
          arc.directory(filePath, name)
        } else {
          arc.file(filePath, { name })
        }
      }
    } catch (err) {
      arc.abort()
      output.destroy()
      cleanup()
      reject(err)
      return
    }

    arc.finalize()
  })
})
