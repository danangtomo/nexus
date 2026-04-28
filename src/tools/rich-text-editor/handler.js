import mammoth from 'mammoth'
import HTMLtoDOCX from 'html-to-docx'

export async function importDocx(filePath) {
  const buf = await window.nexus.readFile(filePath, null)
  const result = await mammoth.convertToHtml({ arrayBuffer: buf })
  return result.value
}

export async function exportDocx(html, filePath) {
  const fullHtml = `<!DOCTYPE html><html><body>${html}</body></html>`
  const buf = await HTMLtoDOCX(fullHtml, null, {
    title: 'Document',
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
  })
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  await window.nexus.writeFileBinary(filePath, base64)
}
