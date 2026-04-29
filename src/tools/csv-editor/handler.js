/**
 * Nexus - Offline productivity suite
 * Copyright (C) 2026 Danang Estutomoaji
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import FormulaParser from 'fast-formula-parser'

export function parseCSV(text, delimiter = ',') {
  const result = Papa.parse(text, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    dynamicTyping: false,
  })
  const headers = result.meta.fields || []
  const rows = result.data.map(r => {
    const o = {}
    headers.forEach(h => { o[h] = r[h] ?? '' })
    return o
  })
  return { headers, rows }
}

export function parseXLSX(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  if (!raw.length) return { headers: [], rows: [] }
  const headers = raw[0].map(h => String(h ?? ''))
  const rows = raw.slice(1).map(row => {
    const o = {}
    headers.forEach((h, i) => { o[h] = String(row[i] ?? '') })
    return o
  })
  return { headers, rows }
}

export function unparseCSV(headers, rows, delimiter = ',') {
  return Papa.unparse({ fields: headers, data: rows }, { delimiter })
}

export function unparseXLSX(headers, rows) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  // Returns a Uint8Array
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}

export function unparseJSON(rows) {
  return JSON.stringify(rows, null, 2)
}

// Sanitize a name into a safe SQL identifier (no quotes needed after this).
function sqlIdent(name) {
  let s = String(name).replace(/[^a-zA-Z0-9_]/g, '_')
  if (/^\d/.test(s)) s = 't_' + s
  return s || 'data'
}

// Format a cell value for SQL: NULL for empty, bare number for numerics, 'quoted' for strings.
function sqlValue(v) {
  if (v == null || v === '') return 'NULL'
  const s = String(v)
  // Don't treat formula strings as numbers
  if (!s.startsWith('=') && s.trim() !== '' && isFinite(Number(s))) return String(Number(s))
  return `'${s.replace(/'/g, "''")}'`
}

export function unparseSQL(headers, rows, tableName = 'data') {
  const tbl = sqlIdent(tableName)
  const cols = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(', ')
  if (!rows.length) return `INSERT INTO "${tbl}" (${cols}) VALUES\n;`
  const valueRows = rows.map(row => {
    const vals = headers.map(h => sqlValue(row[h]))
    return `  (${vals.join(', ')})`
  })
  return `INSERT INTO "${tbl}" (${cols}) VALUES\n${valueRows.join(',\n')}\n;`
}

// 0-based column index → Excel letter(s): 0→'A', 25→'Z', 26→'AA', 51→'AZ', 52→'BA'
export function indexToColLetter(n) {
  let s = ''
  let i = n + 1
  while (i > 0) {
    i--
    s = String.fromCharCode(65 + (i % 26)) + s
    i = Math.floor(i / 26)
  }
  return s
}

// Evaluate all formula cells. Returns { [rid]: { [field]: result } }.
// colDefs: AG Grid column definitions (used to map col letter → field name)
// rowData: array of row objects (used to map row index → data)
export function computeFormulaResults(colDefs, rowData, RID_KEY, ROW_NUM_FIELD_KEY) {
  const results = {}

  // Build 1-based col index → field name map (A=1, B=2, …)
  const colMap = {}
  let ci = 1
  for (const c of colDefs) {
    if (c.field !== ROW_NUM_FIELD_KEY) colMap[ci++] = c.field
  }

  // Build 1-based row index → row object map
  const rowMap = {}
  rowData.forEach((r, i) => { rowMap[i + 1] = r })

  // Skip evaluation if there are no formula cells at all
  let hasFormulas = false
  outer: for (const row of rowData) {
    for (const key of Object.keys(row)) {
      if (key !== RID_KEY && key !== ROW_NUM_FIELD_KEY) {
        if (typeof row[key] === 'string' && row[key].startsWith('=')) {
          hasFormulas = true; break outer
        }
      }
    }
  }
  if (!hasFormulas) return {}

  // Resolve a single cell to its numeric/string value.
  // For formula cells, returns the already-cached result (breaks circular refs).
  function resolve(rowIdx, colIdx) {
    const row = rowMap[rowIdx]
    if (!row) return null
    const field = colMap[colIdx]
    if (!field) return null
    const raw = row[field]
    if (raw == null || raw === '') return null
    if (typeof raw === 'string' && raw.startsWith('=')) {
      const cached = results[row[RID_KEY]]?.[field]
      return cached !== undefined ? cached : null
    }
    const n = Number(raw)
    return isNaN(n) ? raw : n
  }

  const parser = new FormulaParser({
    onCell:  ({ row, col })        => resolve(row, col),
    onRange: ({ from, to })        => {
      const out = []
      for (let r = from.row; r <= to.row; r++) {
        const arr = []
        for (let c = from.col; c <= to.col; c++) arr.push(resolve(r, c))
        out.push(arr)
      }
      return out
    },
  })

  // Evaluate top-to-bottom, left-to-right.
  // Forward references resolve to null on first pass (acceptable limitation).
  rowData.forEach(row => {
    const rid = row[RID_KEY]
    for (const c of colDefs) {
      if (c.field === ROW_NUM_FIELD_KEY) continue
      const val = row[c.field]
      if (typeof val === 'string' && val.startsWith('=')) {
        if (!results[rid]) results[rid] = {}
        try {
          const res = parser.parse(val.slice(1))
          results[rid][c.field] = (res instanceof FormulaParser.FormulaError)
            ? res.toString()
            : res
        } catch {
          results[rid][c.field] = '#ERROR!'
        }
      }
    }
  })

  return results
}

// Adjust relative row references in a formula by dRow rows.
// Absolute references ($) are left unchanged.
// e.g. shiftFormula('=B1*C1', 2) → '=B3*C3'
export function shiftFormula(formula, dRow) {
  if (!dRow) return formula
  // Match both uppercase and lowercase column letters; preserve original case in output
  return formula.replace(/(\$?)([A-Za-z]{1,3})(\$?)(\d+)/g, (match, colAbs, col, rowAbs, row) => {
    if (rowAbs === '$') return match   // absolute row ref — don't shift
    return `${colAbs}${col}${rowAbs}${parseInt(row) + dRow}`
  })
}

// Returns { [field]: 'number' | 'date' | 'string' } for each header.
// A column is 'number' if every non-empty cell parses as a finite number.
// A column is 'date'   if every non-empty cell matches a date pattern and parses as a valid Date.
export function detectColTypes(headers, rows) {
  const DATE_RE = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}([\sT]\d{1,2}:\d{2}(:\d{2})?)?$/
  const types = {}
  for (const h of headers) {
    const vals = rows
      .map(r => { const v = r[h]; return v == null ? '' : String(v) })
      .filter(v => v.trim() !== '')
    if (vals.length === 0) { types[h] = 'string'; continue }
    if (vals.every(v => isFinite(Number(v)))) { types[h] = 'number'; continue }
    if (vals.every(v => DATE_RE.test(v.trim()) && !isNaN(Date.parse(v)))) { types[h] = 'date'; continue }
    types[h] = 'string'
  }
  return types
}
