export async function getFileSize(filePath) {
  const info = await window.nexus.getFileInfo(filePath)
  return info.size
}

export async function compressPdf(filePath, quality, outputPath) {
  return window.nexus.gs.compress({ inputPath: filePath, quality, outputPath })
}
