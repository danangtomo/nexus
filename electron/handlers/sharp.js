const { ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

// sharp is a native module — require lazily so missing install gives a clear error
let sharp
function getSharp() {
  if (!sharp) sharp = require('sharp')
  return sharp
}

/**
 * sharp:process
 * opts: {
 *   input: string          — absolute input file path
 *   output: string         — absolute output file path
 *   format?: string        — 'jpeg'|'png'|'webp'|'avif'|'bmp'|'tiff'
 *   quality?: number       — 1–100
 *   width?: number
 *   height?: number
 *   fit?: string           — 'cover'|'contain'|'fill'|'inside'|'outside'
 *   withoutEnlargement?: boolean
 *   stripExif?: boolean    — strip all metadata
 *   watermark?: {
 *     text?: string
 *     imagePath?: string
 *     position?: 'top-left'|'top-right'|'bottom-left'|'bottom-right'|'center'
 *     opacity?: number     — 0–1
 *     fontSize?: number
 *     color?: string       — hex color for text
 *   }
 * }
 */
ipcMain.handle('sharp:process', async (_e, opts) => {
  const s = getSharp()
  let pipeline = s(opts.input)

  // Resize
  if (opts.width || opts.height) {
    pipeline = pipeline.resize({
      width: opts.width || undefined,
      height: opts.height || undefined,
      fit: opts.fit || 'inside',
      withoutEnlargement: opts.withoutEnlargement !== false,
    })
  }

  // Strip metadata
  if (opts.stripExif) {
    pipeline = pipeline.withMetadata({})
  } else {
    pipeline = pipeline.withMetadata()
  }

  // Watermark (text via SVG overlay, or image composite)
  if (opts.watermark) {
    const wm = opts.watermark
    const meta = await s(opts.input).metadata()
    const imgW = meta.width || 800
    const imgH = meta.height || 600

    if (wm.text) {
      const fontSize = wm.fontSize || Math.max(20, Math.round(imgW * 0.04))
      const color = wm.color || '#ffffff'
      const opacity = wm.opacity !== undefined ? wm.opacity : 0.7

      const svgText = `
        <svg width="${imgW}" height="${imgH}">
          <style>
            text {
              font-family: Arial, sans-serif;
              font-size: ${fontSize}px;
              fill: ${color};
              opacity: ${opacity};
            }
          </style>
          ${buildWatermarkTextEl(wm.position || 'bottom-right', wm.text, imgW, imgH, fontSize)}
        </svg>`

      pipeline = pipeline.composite([{
        input: Buffer.from(svgText),
        gravity: positionToGravity(wm.position || 'bottom-right'),
      }])
    } else if (wm.imagePath && fs.existsSync(wm.imagePath)) {
      pipeline = pipeline.composite([{
        input: wm.imagePath,
        gravity: positionToGravity(wm.position || 'bottom-right'),
        blend: 'over',
      }])
    }
  }

  // Output format + quality
  if (opts.format) {
    const fmt = opts.format.toLowerCase()
    const quality = opts.quality || 85
    if (fmt === 'jpeg' || fmt === 'jpg') {
      pipeline = pipeline.jpeg({ quality })
    } else if (fmt === 'png') {
      pipeline = pipeline.png({ compressionLevel: Math.round((100 - quality) / 11) })
    } else if (fmt === 'webp') {
      pipeline = pipeline.webp({ quality })
    } else if (fmt === 'avif') {
      pipeline = pipeline.avif({ quality })
    } else if (fmt === 'tiff') {
      pipeline = pipeline.tiff({ quality })
    } else {
      throw new Error(`Unsupported output format: ${fmt}`)
    }
  }

  fs.mkdirSync(path.dirname(opts.output), { recursive: true })
  const info = await pipeline.toFile(opts.output)
  return { success: true, info }
})

/**
 * sharp:metadata — read image metadata (dimensions, format, EXIF, etc.)
 */
ipcMain.handle('sharp:metadata', async (_e, filePath) => {
  const meta = await getSharp()(filePath).metadata()
  meta.size = fs.statSync(filePath).size
  return meta
})

/**
 * sharp:thumbnail — fast thumbnail for preview (returns base64 data URL)
 */
ipcMain.handle('sharp:thumbnail', async (_e, filePath, size = 200) => {
  const buf = await getSharp()(filePath)
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function positionToGravity(pos) {
  const map = {
    'top-left': 'northwest',
    'top-right': 'northeast',
    'bottom-left': 'southwest',
    'bottom-right': 'southeast',
    'center': 'center',
  }
  return map[pos] || 'southeast'
}

function buildWatermarkTextEl(position, text, w, h, fontSize) {
  const pad = fontSize
  const positions = {
    'top-left':     { x: pad, y: fontSize + pad, anchor: 'start' },
    'top-right':    { x: w - pad, y: fontSize + pad, anchor: 'end' },
    'bottom-left':  { x: pad, y: h - pad, anchor: 'start' },
    'bottom-right': { x: w - pad, y: h - pad, anchor: 'end' },
    'center':       { x: w / 2, y: h / 2, anchor: 'middle' },
  }
  const p = positions[position] || positions['bottom-right']
  return `<text x="${p.x}" y="${p.y}" text-anchor="${p.anchor}">${escapeXml(text)}</text>`
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
