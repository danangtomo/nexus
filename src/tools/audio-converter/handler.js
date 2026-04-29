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

export const FORMATS = [
  { ext: 'mp3',  label: 'MP3',  args: (q) => ['-c:a', 'libmp3lame', '-q:a', q] },
  { ext: 'aac',  label: 'AAC',  args: (q) => ['-c:a', 'aac', '-vbr', q] },
  { ext: 'ogg',  label: 'OGG',  args: (q) => ['-c:a', 'libvorbis', '-q:a', q] },
  { ext: 'flac', label: 'FLAC', args: ()  => ['-c:a', 'flac'] },
  { ext: 'wav',  label: 'WAV',  args: ()  => ['-c:a', 'pcm_s16le'] },
  { ext: 'm4a',  label: 'M4A',  args: (q) => ['-c:a', 'aac', '-vbr', q] },
]

// quality maps: high/medium/low
// MP3/OGG use -q:a (0=best, 9=worst); AAC/M4A use -vbr (5=best, 1=worst)
const Q_LAME    = { high: '2', medium: '4', low: '7' }
const Q_AAC_VBR = { high: '5', medium: '3', low: '1' }

export const QUALITIES = [
  { id: 'high',   label: 'High'   },
  { id: 'medium', label: 'Medium' },
  { id: 'low',    label: 'Low'    },
]

export async function getAudioInfo(filePath) {
  const probe  = await window.nexus.ffmpeg.probe(filePath)
  const stream = probe.streams?.find((s) => s.codec_type === 'audio')
  const dur    = parseFloat(probe.format?.duration ?? 0)
  return {
    codec:      stream?.codec_name?.toUpperCase() ?? null,
    sampleRate: stream?.sample_rate ? `${Math.round(stream.sample_rate / 1000)} kHz` : null,
    channels:   stream?.channels === 1 ? 'Mono' : stream?.channels === 2 ? 'Stereo' : null,
    duration:   dur > 0 ? formatDuration(dur) : null,
    size:       probe.format?.size ? `${(probe.format.size / 1024 / 1024).toFixed(2)} MB` : null,
  }
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function getQualityArg(ext, qualityId) {
  if (ext === 'mp3' || ext === 'ogg') return Q_LAME[qualityId]
  if (ext === 'aac' || ext === 'm4a') return Q_AAC_VBR[qualityId]
  return null
}

export async function convertAudio(inputPath, outputPath, format, qualityId, onProgress) {
  const fmt  = FORMATS.find((f) => f.ext === format)
  if (!fmt) throw new Error(`Unknown format: ${format}`)

  const qArg = getQualityArg(format, qualityId)
  const args  = ['-vn', ...fmt.args(qArg)]

  const unsub = window.nexus.ffmpeg.onProgress((data) => {
    onProgress(data.percent ?? 0)
  })

  try {
    await window.nexus.ffmpeg.run({ input: inputPath, output: outputPath, args })
  } finally {
    unsub()
  }
}
