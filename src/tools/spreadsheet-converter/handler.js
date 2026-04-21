import * as XLSX from 'xlsx'

export const INPUT_EXTS = ['xlsx', 'xls', 'csv', 'tsv', 'ods', 'json']

export const FORMATS = [
  { ext: 'xlsx', label: 'XLSX' },
  { ext: 'csv',  label: 'CSV'  },
  { ext: 'tsv',  label: 'TSV'  },
  { ext: 'json', label: 'JSON' },
  { ext: 'html', label: 'HTML' },
]

// Read file as raw bytes → decode with TextDecoder in renderer.
// Using base64 round-trip avoids any Node.js / IPC string encoding quirks.
async function readTextSafe(filePath) {
  const b64    = await window.nexus.readFile(filePath, 'base64')
  const binary = atob(b64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  // Decode as UTF-8 (non-fatal: bad bytes become U+FFFD instead of throwing)
  const text = new TextDecoder('utf-8').decode(bytes)
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1) // strip BOM
  return text
}

// Parse CSV/TSV into array-of-arrays, preserving Unicode strings
function parseTextToAOA(text, sep) {
  const rows = []
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim()) continue
    const cells = []
    let cell = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cell += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === sep && !inQuote) {
        cells.push(cell); cell = ''
      } else {
        cell += ch
      }
    }
    cells.push(cell)
    rows.push(cells)
  }
  return rows
}

// readSpreadsheet: for CSV/TSV returns rows directly (bypasses SheetJS string path entirely)
export async function readSpreadsheet(filePath, sheetIndex = 0) {
  const ext = filePath.split('.').pop().toLowerCase()

  if (ext === 'csv' || ext === 'tsv') {
    const text = await readTextSafe(filePath)
    const sep  = ext === 'tsv' ? '\t' : ','
    const rows = parseTextToAOA(text, sep)
    return { sheetNames: ['Sheet1'], rows }
  }

  const wb         = await loadWorkbook(filePath)
  const sheetNames = wb.SheetNames
  const idx        = Math.min(sheetIndex, sheetNames.length - 1)
  const sheet      = wb.Sheets[sheetNames[idx]]
  const rows       = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  return { sheetNames, rows }
}

// loadWorkbook: used only for conversion (needs a SheetJS workbook object)
async function loadWorkbook(filePath) {
  const ext = filePath.split('.').pop().toLowerCase()

  if (ext === 'csv' || ext === 'tsv') {
    const text = await readTextSafe(filePath)
    const sep  = ext === 'tsv' ? '\t' : ','
    const rows = parseTextToAOA(text, sep)
    const ws   = XLSX.utils.aoa_to_sheet(rows)
    const wb   = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    return wb
  }

  if (ext === 'json') {
    const text = await window.nexus.readFile(filePath, 'utf8')
    const data = JSON.parse(text)
    const rows = Array.isArray(data) ? data : [data]
    const ws   = XLSX.utils.json_to_sheet(rows)
    const wb   = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    return wb
  }

  // Binary formats (XLSX, XLS, ODS …) — base64 avoids Buffer→Uint8Array IPC issues
  const b64 = await window.nexus.readFile(filePath, 'base64')
  return XLSX.read(b64, { type: 'base64' })
}

export async function convertSpreadsheet(filePath, outputFormat, savePath, sheetIndex = 0) {
  const wb    = await loadWorkbook(filePath)
  const idx   = Math.min(sheetIndex, wb.SheetNames.length - 1)
  const sheet = wb.Sheets[wb.SheetNames[idx]]

  let output
  switch (outputFormat) {
    case 'xlsx':
      output = (() => {
        const out = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(out, sheet, wb.SheetNames[idx])
        return XLSX.write(out, { bookType: 'xlsx', type: 'buffer' })
      })()
      break
    case 'csv':
      output = '\uFEFF' + XLSX.utils.sheet_to_csv(sheet)
      break
    case 'tsv':
      output = '\uFEFF' + XLSX.utils.sheet_to_csv(sheet, { FS: '\t' })
      break
    case 'json': {
      const data = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      output = JSON.stringify(data, null, 2)
      break
    }
    case 'html':
      output = XLSX.utils.sheet_to_html(sheet)
      break
    default:
      throw new Error(`Unknown format: ${outputFormat}`)
  }

  await window.nexus.writeFile(savePath, output)
}
