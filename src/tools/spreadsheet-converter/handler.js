import * as XLSX from 'xlsx'

export const INPUT_EXTS = ['xlsx', 'xls', 'csv', 'tsv', 'ods', 'json']

export const FORMATS = [
  { ext: 'xlsx', label: 'XLSX', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { ext: 'csv',  label: 'CSV',  mime: 'text/csv' },
  { ext: 'tsv',  label: 'TSV',  mime: 'text/tab-separated-values' },
  { ext: 'json', label: 'JSON', mime: 'application/json' },
  { ext: 'html', label: 'HTML', mime: 'text/html' },
]

export async function readSpreadsheet(filePath) {
  const bytes = await window.nexus.readFile(filePath, null)
  const wb = XLSX.read(bytes, { type: 'buffer' })
  const sheetNames = wb.SheetNames
  const firstSheet = wb.Sheets[sheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' })
  return { sheetNames, rows, wb }
}

export async function convertSpreadsheet(filePath, outputFormat, savePath) {
  const bytes = await window.nexus.readFile(filePath, null)
  const wb = XLSX.read(bytes, { type: 'buffer' })

  let output
  const sheet = wb.Sheets[wb.SheetNames[0]]

  switch (outputFormat) {
    case 'xlsx':
      output = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
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

  if (typeof output === 'string') {
    await window.nexus.writeFile(savePath, output)
  } else {
    await window.nexus.writeFile(savePath, output)
  }
}
