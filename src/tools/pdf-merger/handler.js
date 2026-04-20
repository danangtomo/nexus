import { PDFDocument } from 'pdf-lib'

export async function getPageCount(filePath) {
  const bytes = await window.nexus.readFile(filePath, null)
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  return doc.getPageCount()
}

export async function mergePdfs(files, outputPath) {
  const merged = await PDFDocument.create()

  for (const file of files) {
    const bytes = await window.nexus.readFile(file.path, null)
    const doc = await PDFDocument.load(bytes)
    const indices = doc.getPageIndices()
    const pages = await merged.copyPages(doc, indices)
    pages.forEach((page) => merged.addPage(page))
  }

  const mergedBytes = await merged.save()
  await window.nexus.writeFile(outputPath, mergedBytes)
}
