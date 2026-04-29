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
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

let ffmpegPath
function getFfmpegPath() {
  if (!ffmpegPath) {
    ffmpegPath = require('ffmpeg-static')
    if (!ffmpegPath) ffmpegPath = 'ffmpeg'
  }
  return ffmpegPath
}

/**
 * ffmpeg:probe — get media info using ffmpeg -i (no ffprobe needed)
 * Returns a structure compatible with ffprobe JSON: { streams, format }
 */
ipcMain.handle('ffmpeg:probe', async (_e, filePath) => {
  return new Promise((resolve) => {
    const proc = spawn(getFfmpegPath(), ['-i', filePath])
    let stderr = ''
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('close', () => resolve(parseMediaInfo(stderr, filePath)))
    proc.on('error', () => resolve({ streams: [], format: {} }))
  })
})

/**
 * ffmpeg:run — run an FFmpeg conversion with real-time progress
 *
 * opts: { input, output, args?, overwrite? }
 * Sends 'ffmpeg:progress' events: { percent, fps, speed, time }
 */
ipcMain.handle('ffmpeg:run', async (event, opts) => {
  const { input, output, args = [], overwrite = true } = opts

  fs.mkdirSync(path.dirname(output), { recursive: true })

  const totalSeconds = await probeDuration(input)

  return new Promise((resolve, reject) => {
    const ffArgs = [
      '-i', input,
      ...args,
      ...(overwrite ? ['-y'] : []),
      output,
    ]

    const proc = spawn(getFfmpegPath(), ffArgs)
    let stderr = ''

    proc.stderr.on('data', (data) => {
      const chunk = data.toString()
      stderr += chunk

      const timeMatch = chunk.match(/time=(\d+):(\d+):(\d+\.\d+)/)
      if (timeMatch) {
        const elapsed =
          parseInt(timeMatch[1]) * 3600 +
          parseInt(timeMatch[2]) * 60 +
          parseFloat(timeMatch[3])
        const percent = totalSeconds > 0 ? Math.min(99, (elapsed / totalSeconds) * 100) : 0
        const fpsMatch   = chunk.match(/fps=\s*([\d.]+)/)
        const speedMatch = chunk.match(/speed=\s*([\d.]+)x/)
        event.sender.send('ffmpeg:progress', {
          percent,
          fps:   fpsMatch   ? parseFloat(fpsMatch[1])   : 0,
          speed: speedMatch ? parseFloat(speedMatch[1]) : 0,
          time:  `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`,
        })
      }
    })

    proc.on('close', (code) => {
      if (code === 0) {
        event.sender.send('ffmpeg:progress', { percent: 100 })
        resolve({ success: true })
      } else {
        reject(new Error(`FFmpeg exited with code ${code}\n${stderr.slice(-500)}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg: ${err.message}`))
    })
  })
})

/**
 * ffmpeg:thumbnail — extract a video frame as base64 JPEG
 */
ipcMain.handle('ffmpeg:thumbnail', async (_e, filePath, timestamp = '00:00:02') => {
  return new Promise((resolve, reject) => {
    const args = [
      '-ss', timestamp,
      '-i', filePath,
      '-frames:v', '1',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      'pipe:1',
    ]
    const proc = spawn(getFfmpegPath(), args)
    const chunks = []
    proc.stdout.on('data', (d) => chunks.push(d))
    proc.on('close', (code) => {
      if (code === 0 || chunks.length > 0) {
        resolve(`data:image/jpeg;base64,${Buffer.concat(chunks).toString('base64')}`)
      } else {
        reject(new Error(`ffmpeg thumbnail failed (code ${code})`))
      }
    })
    proc.on('error', reject)
  })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Get duration in seconds by running `ffmpeg -i <file>` and parsing stderr.
 * ffmpeg-static does not bundle ffprobe, so we avoid it entirely.
 */
function probeDuration(filePath) {
  return new Promise((resolve) => {
    const proc = spawn(getFfmpegPath(), ['-i', filePath])
    let stderr = ''
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('close', () => resolve(parseDuration(stderr)))
    proc.on('error', () => resolve(0))
  })
}

/** Parse "Duration: HH:MM:SS.cc" from ffmpeg -i stderr */
function parseDuration(stderr) {
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
  if (!m) return 0
  return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])
}

/**
 * Build a ffprobe-compatible object from ffmpeg -i stderr output.
 * Covers the fields that video-converter and audio-converter actually read.
 */
function parseMediaInfo(stderr, filePath) {
  const result = { streams: [], format: {} }

  // Duration → format.duration (seconds as string)
  const dur = parseDuration(stderr)
  if (dur > 0) result.format.duration = String(dur)

  // File size via fs (ffmpeg doesn't print it reliably)
  try { result.format.size = String(fs.statSync(filePath).size) } catch {}

  // Video stream: "Stream #0:0: Video: h264 ..., 1920x1080 ..."
  const videoRe = /Stream #\d+:\d+[^:]*: Video: (\w+)[^\n]*?(\d{2,5})x(\d{2,5})/
  const vm = stderr.match(videoRe)
  if (vm) {
    result.streams.push({
      codec_type: 'video',
      codec_name: vm[1],
      width:  parseInt(vm[2]),
      height: parseInt(vm[3]),
    })
  }

  // Audio stream: "Stream #0:0: Audio: mp3, 44100 Hz, stereo"
  const audioRe = /Stream #\d+:\d+[^:]*: Audio: (\w+),\s*(\d+) Hz,\s*(\w+)/
  const am = stderr.match(audioRe)
  if (am) {
    const chStr = am[3].toLowerCase()
    const channels = chStr === 'mono' ? 1 : chStr === 'stereo' ? 2 : null
    result.streams.push({
      codec_type:  'audio',
      codec_name:  am[1],
      sample_rate: parseInt(am[2]),
      channels,
    })
  }

  return result
}
