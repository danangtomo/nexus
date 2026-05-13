// Shared data helpers for Report Builder

export function parseNumericVal(raw) {
  const s = String(raw ?? '').replace(/[$,\s+]/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN
  const n = parseFloat(s)
  return isFinite(n) ? n : NaN
}

export function inferCols(rows, columns) {
  const sample = rows.slice(0, 40)
  return columns.map(col => {
    const vals = sample.map(r => r[col.name]).filter(v => v !== '' && v != null)
    const numCount = vals.filter(v => !isNaN(parseNumericVal(v))).length
    const fillRate = sample.length > 0 ? vals.length / sample.length : 0
    return { ...col, isNumeric: vals.length > 0 && numCount / vals.length > 0.6, fillRate }
  }).filter(c => c.fillRate > 0.3)
}

export function fmtVal(val, colName) {
  const name = (colName ?? '').toLowerCase()
  const abs = Math.abs(val)
  if (/\b(amount|revenue|price|cost|total|spend|income|profit|value|usd|eur|gbp|fee|charge)\b/.test(name)) {
    return `${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return abs % 1 === 0 ? abs.toLocaleString() : abs.toFixed(2)
}

export function buildKeyStats(rows, cols) {
  const numCols = cols.filter(c => c.isNumeric)
  const catCols = cols.filter(c => !c.isNumeric)
  const stats = [{ label: 'Records', value: rows.length.toLocaleString() }]

  for (const col of numCols.slice(0, 2)) {
    const vals = rows.map(r => parseNumericVal(r[col.name])).filter(v => !isNaN(v))
    if (!vals.length) continue
    const total = vals.reduce((a, b) => a + b, 0)
    const avg   = total / vals.length
    const min   = vals.reduce((a, b) => a < b ? a : b, vals[0])
    const max   = vals.reduce((a, b) => a > b ? a : b, vals[0])
    stats.push({ label: `Total ${col.name}`,   value: fmtVal(total, col.name) })
    stats.push({ label: `Average ${col.name}`, value: fmtVal(avg,   col.name) })
    stats.push({ label: `Max ${col.name}`,     value: fmtVal(max,   col.name) })
    stats.push({ label: `Min ${col.name}`,     value: fmtVal(min,   col.name) })
  }

  for (const col of catCols.slice(0, 1)) {
    const unique = new Set(rows.map(r => r[col.name]).filter(v => v != null && v !== '')).size
    stats.push({ label: `Unique ${col.name}`, value: unique.toLocaleString() })
  }

  return stats
}
