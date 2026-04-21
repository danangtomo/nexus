export async function listArchive(archivePath) {
  return window.nexus.archive.list(archivePath)
}

export async function extractArchive(archivePath, outputDir) {
  return window.nexus.archive.extract({ archivePath, outputDir })
}

export async function compressFiles(files, outputPath, format) {
  return window.nexus.archive.compress({ files, outputPath, format })
}

export const COMPRESS_FORMATS = [
  { ext: 'zip',    label: 'ZIP',    mime: 'application/zip' },
  { ext: 'tar.gz', label: 'TAR.GZ', mime: 'application/gzip' },
]

export function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
}
