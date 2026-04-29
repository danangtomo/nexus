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

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { buildDisplayRows, computeStats, countHunks, decodeText, createPatch } from './handler'
import styles from './index.module.css'

const TEXT_EXTS = [
  'txt','md','js','ts','jsx','tsx','css','html','json','yaml','yml',
  'py','java','c','cpp','go','rs','sh','log','csv','xml','sql',
  'diff','patch','env','ini','toml','rb','php','cs','kt','swift',
]

// ── Char-level span renderer ───────────────────────────────────────────────
function CharSpans({ charDiff, side }) {
  return charDiff.map((p, i) => {
    if (p.added   && side === 'right') return <mark key={i} className={styles.charAdded}>{p.value}</mark>
    if (p.removed && side === 'left')  return <mark key={i} className={styles.charRemoved}>{p.value}</mark>
    if (!p.added && !p.removed)        return <span key={i}>{p.value}</span>
    return null
  })
}

// ── Single diff row ────────────────────────────────────────────────────────
function Row({ row, hunkAttr }) {
  if (row.type === 'unchanged') {
    return (
      <div className={styles.diffRow}>
        <span className={styles.lineNum}>{row.leftNum}</span>
        <span className={styles.lineNum}>{row.rightNum}</span>
        <span className={styles.lineSign}> </span>
        <span className={styles.lineText}>{row.line}</span>
      </div>
    )
  }
  if (row.type === 'removed') {
    return (
      <div className={`${styles.diffRow} ${styles.rowRemoved}`} {...(hunkAttr || {})}>
        <span className={styles.lineNum}>{row.leftNum}</span>
        <span className={styles.lineNum} />
        <span className={styles.lineSign}>−</span>
        <span className={styles.lineText}>{row.line}</span>
      </div>
    )
  }
  if (row.type === 'added') {
    return (
      <div className={`${styles.diffRow} ${styles.rowAdded}`} {...(hunkAttr || {})}>
        <span className={styles.lineNum} />
        <span className={styles.lineNum}>{row.rightNum}</span>
        <span className={styles.lineSign}>+</span>
        <span className={styles.lineText}>{row.line}</span>
      </div>
    )
  }
  if (row.type === 'changed') {
    return (
      <>
        <div className={`${styles.diffRow} ${styles.rowRemoved}`} {...(hunkAttr || {})}>
          <span className={styles.lineNum}>{row.leftNum}</span>
          <span className={styles.lineNum} />
          <span className={styles.lineSign}>−</span>
          <span className={styles.lineText}><CharSpans charDiff={row.charDiff} side="left" /></span>
        </div>
        <div className={`${styles.diffRow} ${styles.rowAdded}`}>
          <span className={styles.lineNum} />
          <span className={styles.lineNum}>{row.rightNum}</span>
          <span className={styles.lineSign}>+</span>
          <span className={styles.lineText}><CharSpans charDiff={row.charDiff} side="right" /></span>
        </div>
      </>
    )
  }
  return null
}

// ── Collapse / expand rows ─────────────────────────────────────────────────
function CollapseRow({ row, onExpand }) {
  return (
    <div className={styles.collapseRow} onClick={() => onExpand(row.id)} title="Click to expand">
      <span className={styles.collapseLine} />
      <button className={styles.collapseBtn}>▶ {row.count} unchanged lines — click to expand</button>
      <span className={styles.collapseLine} />
    </div>
  )
}

function CollapseHeader({ row, onCollapse }) {
  return (
    <div className={styles.collapseRow} onClick={() => onCollapse(row.id)} title="Click to collapse">
      <span className={styles.collapseLine} />
      <button className={styles.collapseBtn}>▼ {row.count} lines — click to collapse</button>
      <span className={styles.collapseLine} />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function DiffChecker() {
  const [left,      setLeft]      = useState('')
  const [right,     setRight]     = useState('')
  const [leftName,  setLeftName]  = useState('Original')
  const [rightName, setRightName] = useState('Modified')
  const [ignoreWS,  setIgnoreWS]  = useState(false)
  const [expanded,  setExpanded]  = useState(new Set())
  const [hunkIdx,   setHunkIdx]   = useState(0)
  const [status,    setStatus]    = useState('')
  const diffRef = useRef(null)

  const rows      = useMemo(() => buildDisplayRows(left, right, { ignoreWhitespace: ignoreWS }), [left, right, ignoreWS])
  const stats     = useMemo(() => computeStats(rows), [rows])
  const hunkTotal = useMemo(() => countHunks(rows), [rows])

  const hasContent = left.length > 0 || right.length > 0
  const hasDiff    = stats.added + stats.removed + stats.changed > 0

  useEffect(() => { setHunkIdx(0); setExpanded(new Set()) }, [left, right, ignoreWS])

  const flash = useCallback((msg) => {
    setStatus(msg); setTimeout(() => setStatus(''), 2000)
  }, [])

  async function openFile(side) {
    const path = await window.nexus.openFile({ filters: [{ name: 'Text files', extensions: TEXT_EXTS }] })
    if (!path) return
    const text = decodeText(await window.nexus.readFile(path, 'base64'))
    const name = path.split(/[\\/]/).pop()
    if (side === 'left')  { setLeft(text);  setLeftName(name) }
    else                  { setRight(text); setRightName(name) }
  }

  function handleDrop(e, side) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target.result
      if (side === 'left')  { setLeft(text);  setLeftName(file.name) }
      else                  { setRight(text); setRightName(file.name) }
    }
    reader.readAsText(file, 'utf-8')
  }

  function swap() {
    setLeft(right); setRight(left)
    setLeftName(rightName); setRightName(leftName)
  }

  function clearAll() {
    setLeft(''); setRight(''); setLeftName('Original'); setRightName('Modified')
  }

  function copyDiff() {
    const patch = createPatch(leftName, left, right, leftName, rightName)
    navigator.clipboard.writeText(patch).then(() => flash('Copied to clipboard'))
  }

  async function downloadDiff() {
    const patch = createPatch(leftName, left, right, leftName, rightName)
    const path = await window.nexus.saveFile({
      defaultPath: 'changes.patch',
      filters: [{ name: 'Patch file', extensions: ['patch', 'diff'] }],
    })
    if (!path) return
    await window.nexus.writeFile(path, patch)
    flash(`Saved ${path.split(/[\\/]/).pop()}`)
  }

  function navigateHunk(dir) {
    if (!hunkTotal) return
    const next = Math.max(0, Math.min(hunkTotal - 1, hunkIdx + dir))
    setHunkIdx(next)
    const el = diffRef.current?.querySelector(`[data-hunk="${next}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function expandCollapse(id) {
    setExpanded(prev => { const s = new Set(prev); s.add(id); return s })
  }

  function collapseBack(id) {
    setExpanded(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  // ── Build display ──────────────────────────────────────────────────────
  let hunkNum = 0
  const displayRows = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    if (row.type === 'collapse') {
      if (expanded.has(row.id)) {
        displayRows.push(<CollapseHeader key={`hdr-${row.id}`} row={row} onCollapse={collapseBack} />)
        row.rows.forEach((r, j) => displayRows.push(<Row key={`${row.id}-${j}`} row={r} />))
      } else {
        displayRows.push(<CollapseRow key={row.id} row={row} onExpand={expandCollapse} />)
      }
      continue
    }

    const isDiff    = row.type !== 'unchanged'
    const prevRow   = rows[i - 1]
    const prevIsDiff = prevRow && prevRow.type !== 'unchanged' && prevRow.type !== 'collapse'
    const isStart   = isDiff && !prevIsDiff
    const myHunk    = isStart ? hunkNum++ : -1
    const hunkAttr  = isStart ? { 'data-hunk': myHunk } : null

    displayRows.push(<Row key={`${row.type}-${row.leftNum ?? row.rightNum ?? i}`} row={row} hunkAttr={hunkAttr} />)
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.root}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button className={styles.actionBtn} onClick={() => openFile('left')}>Open Original</button>
          <button className={styles.actionBtn} onClick={() => openFile('right')}>Open Modified</button>
          <div className={styles.sep} />
          <button className={styles.actionBtn} onClick={swap}     disabled={!hasContent} title="Swap panels">⇄ Swap</button>
          <button className={styles.actionBtn} onClick={clearAll} disabled={!hasContent}>Clear</button>
          <div className={styles.sep} />
          <label className={styles.wsLabel}>
            <input type="checkbox" checked={ignoreWS} onChange={e => setIgnoreWS(e.target.checked)} />
            Ignore whitespace
          </label>
        </div>
        <div className={styles.toolbarRight}>
          {hunkTotal > 0 && (
            <>
              <span className={styles.hunkCount}>{hunkIdx + 1} / {hunkTotal} hunks</span>
              <button className={styles.actionBtn} onClick={() => navigateHunk(-1)} disabled={hunkIdx === 0}>↑ Prev</button>
              <button className={styles.actionBtn} onClick={() => navigateHunk(1)} disabled={hunkIdx >= hunkTotal - 1}>Next ↓</button>
              <div className={styles.sep} />
            </>
          )}
          <button className={styles.actionBtn} onClick={copyDiff}      disabled={!hasDiff}>Copy Diff</button>
          <button className={styles.primaryBtn} onClick={downloadDiff}  disabled={!hasDiff}>Download .patch</button>
          {status && <span className={styles.statusMsg}>{status}</span>}
        </div>
      </div>

      {/* ── Input panes ─────────────────────────────────────────────────── */}
      <div className={styles.inputRow}>
        <div className={styles.inputPane}>
          <div className={styles.paneHeader}>
            <span className={styles.paneLabel}>{leftName}</span>
            {left && <button className={styles.clearBtn} onClick={() => { setLeft(''); setLeftName('Original') }}>✕</button>}
          </div>
          <textarea
            className={styles.textarea}
            value={left}
            onChange={e => setLeft(e.target.value)}
            onDrop={e => handleDrop(e, 'left')}
            onDragOver={e => e.preventDefault()}
            placeholder="Paste or type original text — or drag and drop any text file here"
            spellCheck={false}
          />
        </div>

        <div className={styles.inputDivider} />

        <div className={styles.inputPane}>
          <div className={styles.paneHeader}>
            <span className={styles.paneLabel}>{rightName}</span>
            {right && <button className={styles.clearBtn} onClick={() => { setRight(''); setRightName('Modified') }}>✕</button>}
          </div>
          <textarea
            className={styles.textarea}
            value={right}
            onChange={e => setRight(e.target.value)}
            onDrop={e => handleDrop(e, 'right')}
            onDragOver={e => e.preventDefault()}
            placeholder="Paste or type modified text — or drag and drop any text file here"
            spellCheck={false}
          />
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <div className={styles.statsBar}>
        {hasContent ? (
          <>
            <span className={`${styles.badge} ${styles.badgeAdded}`}>+{stats.added} added</span>
            <span className={`${styles.badge} ${styles.badgeRemoved}`}>−{stats.removed} removed</span>
            <span className={`${styles.badge} ${styles.badgeChanged}`}>~{stats.changed} changed</span>
            <span className={`${styles.badge} ${styles.badgeUnchanged}`}>{stats.unchanged} unchanged</span>
            {ignoreWS && <span className={styles.wsNote}>· whitespace ignored</span>}
          </>
        ) : (
          <span className={styles.statsHint}>Open files or paste text above to compare</span>
        )}
      </div>

      {/* ── Diff output ─────────────────────────────────────────────────── */}
      <div className={styles.diffOutput} ref={diffRef}>
        {!hasContent ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⇄</div>
            <div className={styles.emptyTitle}>Nothing to compare yet</div>
            <div className={styles.emptyHint}>
              Click <strong>Open Original / Open Modified</strong>, paste text,<br />
              or drag any text file into either panel above
            </div>
          </div>
        ) : !hasDiff ? (
          <div className={styles.identicalState}>
            <div className={styles.identicalIcon}>✓</div>
            <div className={styles.identicalTitle}>Files are identical</div>
            {ignoreWS && <div className={styles.emptyHint}>Whitespace differences are being ignored</div>}
          </div>
        ) : (
          <div className={styles.lineDiff}>{displayRows}</div>
        )}
      </div>

    </div>
  )
}
