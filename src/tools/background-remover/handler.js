import { removeBackground } from '@imgly/background-removal'

export const INPUT_EXTS = ['jpg', 'jpeg', 'png', 'webp']

const MIME_MAP = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
}

export function extOf(filePath) {
  return filePath.split('.').pop().toLowerCase()
}

export async function stripBackground(filePath, onProgress) {
  const ext  = extOf(filePath)
  const mime = MIME_MAP[ext] ?? 'image/jpeg'

  // Read file as base64 via IPC, then create a blob URL (avoids file:// COEP issues)
  const b64  = await window.nexus.readFile(filePath, 'base64')
  const raw  = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const blob = new Blob([raw], { type: mime })
  const src  = URL.createObjectURL(blob)

  try {
    const resultBlob = await removeBackground(src, {
      model: 'medium',
      output: { format: 'image/png' },
      progress: (key, current, total) => {
        if (onProgress && total > 0) {
          onProgress({ key, pct: Math.round((current / total) * 100) })
        }
      },
    })
    return URL.createObjectURL(resultBlob)
  } finally {
    URL.revokeObjectURL(src)
  }
}
