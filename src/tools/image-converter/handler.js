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

// BMP intentionally omitted — Sharp can read BMP but cannot write it
export const FORMATS = ['jpeg', 'png', 'webp', 'avif', 'tiff']

/**
 * convertImages
 * @param {Array<{path:string, name:string}>} files
 * @param {{ format: string, quality: number, outputDir: string }} opts
 * @param {(path: string, update: object) => void} onUpdate  — per-file status callback
 */
export async function convertImages(files, opts, onUpdate) {
  const { format, quality, outputDir } = opts
  const ext = format === 'jpeg' ? 'jpg' : format

  for (const file of files) {
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const output = `${outputDir}/${baseName}.${ext}`

    onUpdate(file.path, { status: 'converting' })

    try {
      await window.nexus.sharp.process({
        input: file.path,
        output,
        format,
        quality,
        stripExif: false,
      })

      const [inInfo, outInfo] = await Promise.all([
        window.nexus.getFileInfo(file.path),
        window.nexus.getFileInfo(output),
      ])

      onUpdate(file.path, {
        status: 'done',
        outputPath: output,
        inputSize: inInfo.size,
        outputSize: outInfo.size,
      })
    } catch (err) {
      onUpdate(file.path, { status: 'error', error: err.message })
    }
  }
}
