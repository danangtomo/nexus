const COMPRESSIBLE = new Set(['jpeg', 'jpg', 'png', 'webp', 'avif', 'tiff', 'tif'])

function qualityLabel(q) {
  if (q >= 90) return 'Lossless-like'
  if (q >= 70) return 'High'
  if (q >= 45) return 'Medium'
  return 'Low'
}

export { qualityLabel }

export async function compressImages(files, opts, onUpdate) {
  const { quality } = opts

  for (const file of files) {
    onUpdate(file.path, { status: 'compressing' })
    try {
      const meta = await window.nexus.sharp.metadata(file.path)
      const fmt = meta.format // 'jpeg', 'png', 'webp', etc.

      if (!COMPRESSIBLE.has(fmt)) {
        onUpdate(file.path, { status: 'error', error: `Format .${fmt} not compressible` })
        continue
      }

      const inputPath = file.path
      const lastDot = inputPath.lastIndexOf('.')
      const base = inputPath.slice(0, lastDot)
      const ext = inputPath.slice(lastDot)
      const outputPath = `${base}_compressed${ext}`

      const sharpFmt = fmt === 'jpg' ? 'jpeg' : fmt

      const inputSize = meta.size
      await window.nexus.sharp.process({
        input: inputPath,
        output: outputPath,
        format: sharpFmt,
        quality,
      })

      const outMeta = await window.nexus.sharp.metadata(outputPath)
      onUpdate(file.path, {
        status: 'done',
        outputPath,
        inputSize,
        outputSize: outMeta.size,
      })
    } catch (err) {
      onUpdate(file.path, { status: 'error', error: err.message })
    }
  }
}
