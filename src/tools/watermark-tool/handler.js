export const INPUT_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'avif']

export const POSITIONS = [
  { id: 'top-left',      label: '↖' },
  { id: 'top-center',    label: '↑' },
  { id: 'top-right',     label: '↗' },
  { id: 'middle-left',   label: '←' },
  { id: 'center',        label: '·' },
  { id: 'middle-right',  label: '→' },
  { id: 'bottom-left',   label: '↙' },
  { id: 'bottom-center', label: '↓' },
  { id: 'bottom-right',  label: '↘' },
]

export function extOf(name) {
  return name.split('.').pop().toLowerCase()
}

// Canvas-based live preview — draws image + watermark text
export function drawPreview(canvas, imgEl, opts) {
  const { text, fontSize, color, opacity, position } = opts
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height

  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(imgEl, 0, 0, w, h)

  if (!text) return

  ctx.save()
  ctx.font = `bold ${fontSize}px Arial, sans-serif`
  ctx.globalAlpha = opacity
  ctx.fillStyle = color

  const pad = fontSize
  const metrics = ctx.measureText(text)
  const textW = metrics.width
  const textH = fontSize

  let x, y
  const col = position.startsWith('top') ? 'top' : position.startsWith('bottom') ? 'bottom' : 'middle'
  const row = position.endsWith('left') ? 'left' : position.endsWith('right') ? 'right' : 'center'

  if (col === 'top')    y = pad + textH
  else if (col === 'middle') y = h / 2 + textH / 2
  else                  y = h - pad

  if (row === 'left')   { x = pad;         ctx.textAlign = 'left' }
  else if (row === 'center') { x = w / 2;  ctx.textAlign = 'center' }
  else                  { x = w - pad;     ctx.textAlign = 'right' }

  // Shadow for visibility on any background
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur  = Math.max(2, fontSize * 0.06)

  ctx.fillText(text, x, y)
  ctx.restore()
}

// Sharp IPC save
export async function saveWatermark(inputPath, outputPath, opts) {
  const ext = extOf(inputPath)
  const fmt = (ext === 'jpg' ? 'jpeg' : ext) || 'jpeg'
  return window.nexus.sharp.process({
    input:  inputPath,
    output: outputPath,
    format: fmt,
    quality: 90,
    watermark: {
      text:     opts.text,
      fontSize: opts.fontSize,
      color:    opts.color,
      opacity:  opts.opacity,
      position: opts.position,
    },
  })
}
