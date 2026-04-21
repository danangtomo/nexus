import mammoth from 'mammoth'
import { marked } from 'marked'

export const INPUT_EXTS = ['docx', 'md', 'txt', 'html', 'htm']

export function getOutputFormats(ext) {
  switch (ext) {
    case 'docx': return [{ ext: 'html', label: 'HTML' }, { ext: 'txt', label: 'Plain Text' }]
    case 'md':   return [{ ext: 'html', label: 'HTML' }, { ext: 'txt', label: 'Plain Text' }]
    case 'txt':  return [{ ext: 'html', label: 'HTML' }, { ext: 'md',  label: 'Markdown'   }]
    case 'html':
    case 'htm':  return [{ ext: 'txt',  label: 'Plain Text' }]
    default:     return []
  }
}

export async function convert(filePath, inputExt, outputExt) {
  const key = `${inputExt}→${outputExt}`

  if (inputExt === 'docx') {
    const b64    = await window.nexus.readFile(filePath, 'base64')
    const bytes  = base64ToBytes(b64)
    const result = outputExt === 'html'
      ? await mammoth.convertToHtml({ arrayBuffer: bytes.buffer })
      : await mammoth.extractRawText({ arrayBuffer: bytes.buffer })
    return {
      output:   result.value,
      warnings: result.messages.filter((m) => m.type === 'warning').map((m) => m.message),
    }
  }

  const text = await window.nexus.readFile(filePath, 'utf8')

  switch (key) {
    case 'md→html':
      return { output: marked(text), warnings: [] }

    case 'md→txt':
      return { output: stripHtml(marked(text)), warnings: [] }

    case 'txt→html': {
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return { output: `<pre style="white-space:pre-wrap">${escaped}</pre>`, warnings: [] }
    }

    case 'txt→md':
      return { output: text, warnings: [] }

    case 'html→txt':
    case 'htm→txt':
      return { output: stripHtml(text), warnings: [] }

    default:
      throw new Error(`Conversion .${inputExt} → .${outputExt} is not supported`)
  }
}

function base64ToBytes(b64) {
  const binary = atob(b64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi,  '\n')
    .replace(/<\/p>/gi,       '\n\n')
    .replace(/<\/div>/gi,     '\n')
    .replace(/<\/li>/gi,      '\n')
    .replace(/<\/h[1-6]>/gi,  '\n\n')
    .replace(/<[^>]+>/g,      '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g,  "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
