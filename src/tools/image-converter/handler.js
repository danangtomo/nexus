// BMP intentionally omitted — Sharp can read BMP but cannot write it
export const FORMATS = ['jpeg', 'png', 'webp', 'avif', 'tiff']

/**
 * convertImages
 * @param {Array<{path:string, name:string}>} files
 * @param {{ format: string, quality: number, outputDir: string }} opts
 * @param {(path: string, update: object) => void} onUpdate  — per-file status callback
 */
export async function convertImages(files, opts, onUpdate) {
  const { format, quality, outputDir } = opts
  const ext = format === 'jpeg' ? 'jpg' : format

  for (const file of files) {
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const output = `${outputDir}/${baseName}.${ext}`

    onUpdate(file.path, { status: 'converting' })

    try {
      await window.nexus.sharp.process({
        input: file.path,
        output,
        format,
        quality,
        stripExif: false,
      })

      const [inInfo, outInfo] = await Promise.all([
        window.nexus.getFileInfo(file.path),
        window.nexus.getFileInfo(output),
      ])

      onUpdate(file.path, {
        status: 'done',
        outputPath: output,
        inputSize: inInfo.size,
        outputSize: outInfo.size,
      })
    } catch (err) {
      onUpdate(file.path, { status: 'error', error: err.message })
    }
  }
}
