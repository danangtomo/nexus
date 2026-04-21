// CRF maps: high/medium/low per codec family
const CRF  = { high: '18', medium: '23', low: '28' }    // H.264 / H.265
const QP   = { high: '18', medium: '33', low: '42' }    // VP9 (same scale, needs -b:v 0)
const QS   = { high: '2',  medium: '5',  low: '8'  }    // MPEG-4 qscale

export const FORMATS = [
  {
    ext: 'mp4', label: 'MP4',
    getArgs: (q) => ['-c:v', 'libx264', '-crf', CRF[q], '-preset', 'fast', '-c:a', 'aac', '-movflags', '+faststart'],
  },
  {
    ext: 'webm', label: 'WebM',
    getArgs: (q) => ['-c:v', 'libvpx-vp9', '-crf', QP[q], '-b:v', '0', '-c:a', 'libopus'],
  },
  {
    ext: 'mkv', label: 'MKV',
    getArgs: (q) => ['-c:v', 'libx264', '-crf', CRF[q], '-preset', 'fast', '-c:a', 'aac'],
  },
  {
    ext: 'avi', label: 'AVI',
    getArgs: (q) => ['-c:v', 'mpeg4', '-qscale:v', QS[q], '-c:a', 'libmp3lame'],
  },
  {
    ext: 'mov', label: 'MOV',
    getArgs: (q) => ['-c:v', 'libx264', '-crf', CRF[q], '-preset', 'fast', '-c:a', 'aac'],
  },
  {
    ext: 'gif', label: 'GIF',
    getArgs: () => ['-vf', 'fps=15,scale=480:-1:flags=lanczos', '-loop', '0'],
  },
]

export const QUALITIES = [
  { id: 'high',   label: 'High'   },
  { id: 'medium', label: 'Medium' },
  { id: 'low',    label: 'Low'    },
]

export async function getVideoInfo(filePath) {
  return window.nexus.ffmpeg.probe(filePath)
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

export async function convertVideo(inputPath, outputPath, format, qualityId, onProgress) {
  const fmt = FORMATS.find((f) => f.ext === format)
  if (!fmt) throw new Error(`Unknown format: ${format}`)

  const unsub = window.nexus.ffmpeg.onProgress((data) => {
    onProgress(data.percent ?? 0)
  })

  try {
    await window.nexus.ffmpeg.run({
      input: inputPath,
      output: outputPath,
      args: fmt.getArgs(qualityId),
    })
  } finally {
    unsub()
  }
}
