export const INPUT_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'tif', 'avif']

const FORMAT_MAP = {
  jpg: 'jpeg', jpeg: 'jpeg', png: 'png',
  webp: 'webp', tiff: 'tiff', tif: 'tiff', avif: 'avif',
}

export async function loadMetadata(filePath) {
  return window.nexus.sharp.metadata(filePath)
}

export async function stripAndSave(inputPath, outputPath) {
  const ext = inputPath.split('.').pop().toLowerCase()
  const format = FORMAT_MAP[ext] ?? 'jpeg'
  return window.nexus.sharp.process({ input: inputPath, output: outputPath, format, stripExif: true })
}

export function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(2)} MB`
}

// Build a display-friendly list of rows from Sharp's metadata object.
export function buildMetaRows(meta) {
  const rows = []
  const add = (label, value) => { if (value !== undefined && value !== null) rows.push({ label, value: String(value) }) }

  add('Format',       meta.format?.toUpperCase())
  add('Dimensions',   meta.width && meta.height ? `${meta.width} × ${meta.height} px` : undefined)
  add('Color space',  meta.space)
  add('Channels',     meta.channels)
  add('Bit depth',    meta.depth ? `${meta.depth}-bit` : undefined)
  add('DPI',          meta.density ? `${meta.density} dpi` : undefined)
  add('Has alpha',    meta.hasAlpha ? 'Yes' : 'No')
  add('File size',    formatBytes(meta.size))
  add('EXIF data',    meta.exif ? `Yes (${formatBytes(meta.exif.byteLength ?? meta.exif.length)})` : 'None')
  add('ICC profile',  meta.icc  ? `Yes (${formatBytes(meta.icc.byteLength  ?? meta.icc.length)})`  : 'None')
  add('XMP data',     meta.xmp  ? `Yes (${formatBytes(meta.xmp.byteLength  ?? meta.xmp.length)})`  : 'None')
  add('IPTC data',    meta.iptc ? `Yes (${formatBytes(meta.iptc.byteLength ?? meta.iptc.length)})` : 'None')

  return rows
}

export function hasAnyMetadata(meta) {
  return !!(meta.exif || meta.icc || meta.xmp || meta.iptc)
}
