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

export const INPUT_EXTS = ['jpg', 'jpeg', 'png', 'webp']

export function extOf(filePath) {
  return filePath.split('.').pop().toLowerCase()
}

// Inference runs in the Electron main process via onnxruntime-node.
// No WebAssembly memory limits — handles the full BiRefNet fp32 model.
export async function stripBackground(filePath, onProgress) {
  const cleanup = window.nexus.birefnet.onProgress(onProgress)
  try {
    const { base64 } = await window.nexus.birefnet.removeBg(filePath)
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const blob  = new Blob([bytes], { type: 'image/png' })
    return URL.createObjectURL(blob)
  } finally {
    cleanup()
  }
}
