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

const COMPRESSIBLE = new Set(['jpeg', 'jpg', 'png', 'webp', 'avif', 'tiff', 'tif'])

function qualityLabel(q) {
  if (q >= 90) return 'Lossless-like'
  if (q >= 70) return 'High'
  if (q >= 45) return 'Medium'
  return 'Low'
}

export { qualityLabel }

export async function compressImages(files, opts, onUpdate) {
  const { quality } = opts

  for (const file of files) {
    onUpdate(file.path, { status: 'compressing' })
    try {
      const meta = await window.nexus.sharp.metadata(file.path)
      const fmt = meta.format // 'jpeg', 'png', 'webp', etc.

      if (!COMPRESSIBLE.has(fmt)) {
        onUpdate(file.path, { status: 'error', error: `Format .${fmt} not compressible` })
        continue
      }

      const inputPath = file.path
      const lastDot = inputPath.lastIndexOf('.')
      const base = inputPath.slice(0, lastDot)
      const ext = inputPath.slice(lastDot)
      const outputPath = `${base}_compressed${ext}`

      const sharpFmt = fmt === 'jpg' ? 'jpeg' : fmt

      const inputSize = meta.size
      await window.nexus.sharp.process({
        input: inputPath,
        output: outputPath,
        format: sharpFmt,
        quality,
      })

      const outMeta = await window.nexus.sharp.metadata(outputPath)
      onUpdate(file.path, {
        status: 'done',
        outputPath,
        inputSize,
        outputSize: outMeta.size,
      })
    } catch (err) {
      onUpdate(file.path, { status: 'error', error: err.message })
    }
  }
}
