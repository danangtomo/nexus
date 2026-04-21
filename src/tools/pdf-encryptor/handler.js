import { PDFDocument } from 'pdf-lib'

export async function getPageCount(filePath) {
  try {
    const bytes = await window.nexus.readFile(filePath, null)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
    return doc.getPageCount()
  } catch {
    return null
  }
}

export async function encryptPdf(filePath, userPassword, ownerPassword, outputPath) {
  return window.nexus.gs.encrypt({ inputPath: filePath, userPassword, ownerPassword, outputPath })
}

export async function decryptPdf(filePath, password, outputPath) {
  return window.nexus.gs.decrypt({ inputPath: filePath, password, outputPath })
}
