import { PDFDocument } from 'pdf-lib'

export async function loadPdf(filePath) {
  const bytes = await window.nexus.readFile(filePath, null)
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  return { doc, bytes, pageCount: doc.getPageCount() }
}

// "1-3, 5, 7-9" → [[0,2],[4,4],[6,8]] (0-indexed, inclusive)
export function parseRanges(rangeStr, pageCount) {
  const parts = rangeStr.split(',').map((s) => s.trim()).filter(Boolean)
  const result = []
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/)
    if (!m) throw new Error(`Invalid range: "${part}"`)
    const start = parseInt(m[1], 10)
    const end   = m[2] ? parseInt(m[2], 10) : start
    if (start < 1 || end > pageCount || start > end)
      throw new Error(`Range "${part}" is out of bounds (1–${pageCount})`)
    result.push([start - 1, end - 1])
  }
  if (result.length === 0) throw new Error('No ranges entered')
  return result
}

// Returns array of { label, indices } — indices are 0-based
export function buildChunks(mode, rangeStr, chunkSize, pageCount) {
  if (mode === 'range') {
    return parseRanges(rangeStr, pageCount).map(([s, e]) => ({
      label: s === e ? `p${s + 1}` : `p${s + 1}-${e + 1}`,
      indices: Array.from({ length: e - s + 1 }, (_, i) => s + i),
    }))
  }
  // every-n mode
  const n = Math.max(1, Math.floor(chunkSize))
  const chunks = []
  for (let s = 0; s < pageCount; s += n) {
    const e = Math.min(s + n - 1, pageCount - 1)
    chunks.push({
      label: s === e ? `p${s + 1}` : `p${s + 1}-${e + 1}`,
      indices: Array.from({ length: e - s + 1 }, (_, i) => s + i),
    })
  }
  return chunks
}

export async function splitPdf(filePath, mode, rangeStr, chunkSize, outputDir) {
  const { bytes, pageCount } = await loadPdf(filePath)
  const baseName = filePath.split(/[\\/]/).pop().replace(/\.pdf$/i, '')
  const chunks = buildChunks(mode, rangeStr, chunkSize, pageCount)
  const outputs = []

  for (const chunk of chunks) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const dest = await PDFDocument.create()
    const pages = await dest.copyPages(src, chunk.indices)
    pages.forEach((p) => dest.addPage(p))
    const outBytes = await dest.save()
    const outPath = `${outputDir}/${baseName}_${chunk.label}.pdf`
    await window.nexus.writeFile(outPath, outBytes)
    outputs.push({ path: outPath, name: `${baseName}_${chunk.label}.pdf`, pages: chunk.indices.length })
  }

  return outputs
}
