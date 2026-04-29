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

export async function listArchive(archivePath) {
  return window.nexus.archive.list(archivePath)
}

export async function extractArchive(archivePath, outputDir) {
  return window.nexus.archive.extract({ archivePath, outputDir })
}

export async function compressFiles(files, outputPath, format) {
  return window.nexus.archive.compress({ files, outputPath, format })
}

export const COMPRESS_FORMATS = [
  { ext: 'zip',    label: 'ZIP',    mime: 'application/zip' },
  { ext: 'tar.gz', label: 'TAR.GZ', mime: 'application/gzip' },
]

export function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
}
