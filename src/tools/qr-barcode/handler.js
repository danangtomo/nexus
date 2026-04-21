import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'

export const QR_SIZES = [
  { label: 'Small',  value: 128 },
  { label: 'Medium', value: 256 },
  { label: 'Large',  value: 512 },
]

export const QR_LEVELS = [
  { label: 'L — Low (7%)',       value: 'L' },
  { label: 'M — Medium (15%)',   value: 'M' },
  { label: 'Q — Quartile (25%)', value: 'Q' },
  { label: 'H — High (30%)',     value: 'H' },
]

export const BARCODE_FORMATS = [
  { id: 'CODE128', label: 'Code 128', hint: 'Any printable ASCII' },
  { id: 'CODE39',  label: 'Code 39',  hint: 'A–Z 0–9 - . $ / + %' },
  { id: 'EAN13',   label: 'EAN-13',   hint: '12 or 13 digits' },
  { id: 'EAN8',    label: 'EAN-8',    hint: '7 or 8 digits' },
  { id: 'UPC',     label: 'UPC-A',    hint: '11 or 12 digits' },
  { id: 'ITF14',   label: 'ITF-14',   hint: '13 or 14 digits' },
]

// Render QR code onto a <canvas> element. Returns null on success, error string on failure.
export async function renderQR(canvasEl, text, { size = 256, level = 'M', dark = '#000000', light = '#ffffff' } = {}) {
  if (!canvasEl || !text.trim()) return null
  try {
    await QRCode.toCanvas(canvasEl, text.trim(), {
      width: size,
      errorCorrectionLevel: level,
      color: { dark, light },
      margin: 2,
    })
    return null
  } catch (err) {
    return err.message
  }
}

// Render barcode onto a <svg> element. Returns null on success, error string on failure.
export function renderBarcode(svgEl, value, { format = 'CODE128', displayValue = true, lineColor = '#000000', background = '#ffffff' } = {}) {
  if (!svgEl || !value.trim()) return null
  try {
    let isValid = true
    JsBarcode(svgEl, value.trim(), {
      format,
      displayValue,
      lineColor,
      background,
      margin: 10,
      width: 2,
      height: 80,
      valid: (v) => { isValid = v },
    })
    if (!isValid) return `"${value.trim()}" is not valid for ${format}`
    return null
  } catch (err) {
    return err.message
  }
}

// Convert a <canvas> to a PNG Uint8Array for saving via IPC.
export function canvasToPng(canvasEl) {
  return new Promise((resolve, reject) => {
    canvasEl.toBlob(async (blob) => {
      if (!blob) { reject(new Error('Canvas export produced no data')); return }
      const buf = await blob.arrayBuffer()
      resolve(new Uint8Array(buf))
    }, 'image/png')
  })
}

// Convert a rendered <svg> to a PNG Uint8Array via an offscreen canvas.
export function svgToPng(svgEl) {
  return new Promise((resolve, reject) => {
    const w = parseFloat(svgEl.getAttribute('width'))  || svgEl.getBoundingClientRect().width  || 400
    const h = parseFloat(svgEl.getAttribute('height')) || svgEl.getBoundingClientRect().height || 150

    const svgData = new XMLSerializer().serializeToString(svgEl)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    const img = new Image()
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width  = w * scale
      canvas.height = h * scale
      const ctx = canvas.getContext('2d')
      ctx.scale(scale, scale)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(async (blob) => {
        if (!blob) { reject(new Error('SVG-to-PNG export failed')); return }
        const buf = await blob.arrayBuffer()
        resolve(new Uint8Array(buf))
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not render SVG to image'))
    }
    img.src = url
  })
}
