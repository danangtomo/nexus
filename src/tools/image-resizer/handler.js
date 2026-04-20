/**
 * resizeImages
 * @param {Array<{path:string, name:string}>} files
 * @param {{
 *   mode: 'pixels'|'percent',
 *   width: number, height: number,   // used in pixels mode
 *   percent: number,                  // used in percent mode
 *   fit: string,
 *   aspectLock: boolean,
 *   withoutEnlargement: boolean,
 *   outputDir: string,
 * }} opts
 * @param {(path:string, update:object) => void} onUpdate
 */
export async function resizeImages(files, opts, onUpdate) {
  const { mode, fit, withoutEnlargement, outputDir } = opts

  for (const file of files) {
    onUpdate(file.path, { status: 'converting' })

    try {
      let targetW = undefined
      let targetH = undefined

      if (mode === 'percent') {
        const meta = await window.nexus.sharp.metadata(file.path)
        const scale = opts.percent / 100
        targetW = Math.round((meta.width || 0) * scale) || undefined
        targetH = Math.round((meta.height || 0) * scale) || undefined
      } else {
        targetW = opts.width || undefined
        targetH = opts.height || undefined
      }

      const rawExt = file.name.split('.').pop().toLowerCase()
      // Sharp cannot write BMP — fall back to PNG for unsupported output formats
      const WRITABLE = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff', 'tif'])
      const ext = WRITABLE.has(rawExt) ? rawExt : 'png'
      const baseName = file.name.replace(/\.[^.]+$/, '')
      const suffix = mode === 'percent' ? `_${opts.percent}pct` : `_${targetW || 'auto'}x${targetH || 'auto'}`
      const output = `${outputDir}/${baseName}${suffix}.${ext}`

      await window.nexus.sharp.process({
        input: file.path,
        output,
        width: targetW,
        height: targetH,
        fit,
        withoutEnlargement,
      })

      const [inInfo, outInfo] = await Promise.all([
        window.nexus.getFileInfo(file.path),
        window.nexus.getFileInfo(output),
      ])

      // Read dimensions of output for display
      const outMeta = await window.nexus.sharp.metadata(output)

      onUpdate(file.path, {
        status: 'done',
        outputPath: output,
        inputSize: inInfo.size,
        outputSize: outInfo.size,
        outWidth: outMeta.width,
        outHeight: outMeta.height,
      })
    } catch (err) {
      onUpdate(file.path, { status: 'error', error: err.message })
    }
  }
}
