import { diffLines, diffChars, createPatch } from 'diff'
export { createPatch }

export function decodeText(b64) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.slice(2))
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.slice(2))
  const start = (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) ? 3 : 0
  return new TextDecoder('utf-8').decode(bytes.slice(start))
}

function splitLines(value) {
  const lines = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

// Build unified display rows from two text inputs.
// Row types: 'unchanged' | 'removed' | 'added' | 'changed' | 'collapse'
// 'changed'  — adjacent remove+add pair with equal line count; carries charDiff
// 'collapse' — placeholder for a run of hidden unchanged lines
export function buildDisplayRows(left, right, opts = {}) {
  const { ignoreWhitespace = false, contextLines = 3 } = opts
  const changes = diffLines(left, right, { ignoreWhitespace, newlineIsToken: false })

  // ── Pass 1: flat rows with line numbers ──────────────────────────────────
  const raw = []
  let ln = 1, rn = 1
  let i = 0

  while (i < changes.length) {
    const c    = changes[i]
    const next = changes[i + 1]

    if (c.removed && next?.added) {
      const ls = splitLines(c.value)
      const rs = splitLines(next.value)

      if (ls.length === rs.length) {
        // Same count — pair each line as 'changed' with char-level diff
        for (let j = 0; j < ls.length; j++) {
          raw.push({
            type: 'changed',
            leftNum: ln++, rightNum: rn++,
            left: ls[j], right: rs[j],
            charDiff: diffChars(ls[j], rs[j]),
          })
        }
      } else {
        // Different counts — separate removed + added blocks
        for (const l of ls) raw.push({ type: 'removed', leftNum: ln++, rightNum: null, line: l })
        for (const r of rs) raw.push({ type: 'added',   leftNum: null, rightNum: rn++, line: r })
      }
      i += 2
      continue
    }

    const lines = splitLines(c.value)
    if (c.removed) {
      for (const l of lines) raw.push({ type: 'removed', leftNum: ln++, rightNum: null, line: l })
    } else if (c.added) {
      for (const r of lines) raw.push({ type: 'added',   leftNum: null, rightNum: rn++, line: r })
    } else {
      for (const l of lines) raw.push({ type: 'unchanged', leftNum: ln++, rightNum: rn++, line: l })
    }
    i++
  }

  // ── Pass 2: collapse long unchanged runs ─────────────────────────────────
  const MIN_COLLAPSE = contextLines * 2 + 2 // need at least this many lines to bother collapsing
  const result = []
  let ui = 0

  while (ui < raw.length) {
    const row = raw[ui]
    if (row.type !== 'unchanged') { result.push(row); ui++; continue }

    // Find full run of unchanged rows
    let end = ui
    while (end < raw.length && raw[end].type === 'unchanged') end++
    const runLen = end - ui

    if (runLen < MIN_COLLAPSE) {
      for (let j = ui; j < end; j++) result.push(raw[j])
    } else {
      // Context lines at start
      for (let j = ui; j < ui + contextLines; j++) result.push(raw[j])
      // Collapse node (carries the hidden rows for expand)
      result.push({
        type: 'collapse',
        count: runLen - contextLines * 2,
        id: `col-${ui}-${end}`,
        rows: raw.slice(ui + contextLines, end - contextLines),
      })
      // Context lines at end
      for (let j = end - contextLines; j < end; j++) result.push(raw[j])
    }
    ui = end
  }

  return result
}

export function computeStats(rows) {
  let added = 0, removed = 0, changed = 0, unchanged = 0
  for (const r of rows) {
    if      (r.type === 'added')     added++
    else if (r.type === 'removed')   removed++
    else if (r.type === 'changed')   changed++
    else if (r.type === 'unchanged') unchanged++
  }
  return { added, removed, changed, unchanged }
}

export function countHunks(rows) {
  let n = 0, inDiff = false
  for (const r of rows) {
    const diff = r.type !== 'unchanged' && r.type !== 'collapse'
    if (diff && !inDiff) { n++; inDiff = true }
    else if (!diff)      { inDiff = false }
  }
  return n
}
