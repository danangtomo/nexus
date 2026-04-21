import * as XLSX from 'xlsx'

export const INPUT_EXTS = ['xlsx', 'xls', 'csv', 'tsv', 'ods', 'json']

export const FORMATS = [
  { ext: 'xlsx', label: 'XLSX' },
  { ext: 'csv',  label: 'CSV'  },
  { ext: 'tsv',  label: 'TSV'  },
  { ext: 'json', label: 'JSON' },
  { ext: 'html', label: 'HTML' },
]

async function loadWorkbook(filePath) {
  const ext = filePath.split('.').pop().toLowerCase()

  // Text formats: read as UTF-8 to preserve encoding (avoids â€" garbling)
  if (ext === 'csv' || ext === 'tsv') {
    const text = await window.nexus.readFile(filePath, 'utf8')
    const sep  = ext === 'tsv' ? '\t' : ','
    return XLSX.read(text, { type: 'string', FS: sep })
  }

  // JSON: build a workbook from the array/object
  if (ext === 'json') {
    const text = await window.nexus.readFile(filePath, 'utf8')
    const data = JSON.parse(text)
    const rows = Array.isArray(data) ? data : [data]
    const ws   = XLSX.utils.json_to_sheet(rows)
    const wb   = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    return wb
  }

  // Binary formats (XLSX, XLS, ODS …)
  const bytes = await window.nexus.readFile(filePath, null)
  return XLSX.read(bytes, { type: 'buffer' })
}

export async function readSpreadsheet(filePath, sheetIndex = 0) {
  const wb         = await loadWorkbook(filePath)
  const sheetNames = wb.SheetNames
  const idx        = Math.min(sheetIndex, sheetNames.length - 1)
  const sheet      = wb.Sheets[sheetNames[idx]]
  const rows       = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  return { sheetNames, rows }
}

export async function convertSpreadsheet(filePath, outputFormat, savePath, sheetIndex = 0) {
  const wb    = await loadWorkbook(filePath)
  const idx   = Math.min(sheetIndex, wb.SheetNames.length - 1)
  const sheet = wb.Sheets[wb.SheetNames[idx]]

  let output
  switch (outputFormat) {
    case 'xlsx':
      // Export only the selected sheet
      output = (() => {
        const out = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(out, sheet, wb.SheetNames[idx])
        return XLSX.write(out, { bookType: 'xlsx', type: 'buffer' })
      })()
      break
    case 'csv':
      output = XLSX.utils.sheet_to_csv(sheet)
      break
    case 'tsv':
      output = XLSX.utils.sheet_to_csv(sheet, { FS: '\t' })
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
