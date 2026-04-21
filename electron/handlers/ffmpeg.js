const { ipcMain } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

let ffmpegPath
function getFfmpegPath() {
  if (!ffmpegPath) {
    ffmpegPath = require('ffmpeg-static')
    // ffmpeg-static returns null in some packaged contexts; fall back to PATH
    if (!ffmpegPath) ffmpegPath = 'ffmpeg'
  }
  return ffmpegPath
}

/**
 * ffmpeg:probe — get media info (duration, streams, format)
 * Returns parsed ffprobe JSON.
 */
ipcMain.handle('ffmpeg:probe', async (_e, filePath) => {
  return new Promise((resolve, reject) => {
    const ff = getFfmpegPath()
    // ffprobe is bundled alongside ffmpeg-static
    const ffprobePath = ff.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1')
    const probe = fs.existsSync(ffprobePath) ? ffprobePath : 'ffprobe'

    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]

    let out = ''
    const proc = spawn(probe, args)
    proc.stdout.on('data', (d) => { out += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exited ${code}`))
      try { resolve(JSON.parse(out)) } catch { resolve({}) }
    })
    proc.on('error', reject)
  })
})

/**
 * ffmpeg:run — run an FFmpeg conversion with real-time progress
 *
 * opts: {
 *   input: string           — input file path
 *   output: string          — output file path
 *   args?: string[]         — extra ffmpeg args inserted before output
 *   overwrite?: boolean     — default true
 * }
 *
 * Sends 'ffmpeg:progress' events to renderer: { percent, fps, speed, time }
 * Returns { success: true } or throws on error.
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

      // Parse progress line: "frame=  42 fps= 25 ... time=00:00:01.68 ..."
      const timeMatch = chunk.match(/time=(\d+):(\d+):(\d+\.\d+)/)
      if (timeMatch) {
        const elapsed =
          parseInt(timeMatch[1]) * 3600 +
          parseInt(timeMatch[2]) * 60 +
          parseFloat(timeMatch[3])
        const percent = totalSeconds > 0 ? Math.min(99, (elapsed / totalSeconds) * 100) : 0
        const fpsMatch = chunk.match(/fps=\s*([\d.]+)/)
        const speedMatch = chunk.match(/speed=\s*([\d.]+)x/)
        event.sender.send('ffmpeg:progress', {
          percent,
          fps: fpsMatch ? parseFloat(fpsMatch[1]) : 0,
          speed: speedMatch ? parseFloat(speedMatch[1]) : 0,
          time: `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`,
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
 * ffmpeg:thumbnail — extract a video frame at given timestamp as base64 JPEG
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
        const b64 = Buffer.concat(chunks).toString('base64')
        resolve(`data:image/jpeg;base64,${b64}`)
      } else {
        reject(new Error(`ffmpeg thumbnail failed (code ${code})`))
      }
    })
    proc.on('error', reject)
  })
})

// ── Helper ────────────────────────────────────────────────────────────────────

function probeDuration(filePath) {
  return new Promise((resolve) => {
    const ff = getFfmpegPath()
    const ffprobePath = ff.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1')
    const probe = fs.existsSync(ffprobePath) ? ffprobePath : 'ffprobe'
    const proc = spawn(probe, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ])
    let out = ''
    proc.stdout.on('data', (d) => { out += d.toString() })
    proc.on('close', () => {
      const dur = parseFloat(out.trim())
      resolve(isNaN(dur) ? 0 : dur)
    })
    proc.on('error', () => resolve(0))
  })
}
