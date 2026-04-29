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

import { useState, useCallback, useMemo } from 'react'
import { formatJSON, minifyJSON, validateJSON, parseJSON, getValueType, getStats } from './handler'
import styles from './index.module.css'

// ── Tree node ──────────────────────────────────────────────────────────────
function TreeNode({ keyName, value, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2)
  const type = getValueType(value)
  const isCollapsible = type === 'object' || type === 'array'
  const entries = isCollapsible
    ? (type === 'array' ? value.map((v, i) => [String(i), v]) : Object.entries(value))
    : null
  const isEmpty = isCollapsible && entries.length === 0
  const bracket = type === 'array' ? ['[', ']'] : ['{', '}']

  return (
    <div className={styles.treeNode} style={{ '--depth': depth }}>
      <span className={styles.treeLine}>
        {isCollapsible && !isEmpty
          ? <button className={styles.toggle} onClick={() => setOpen(o => !o)}>{open ? '▾' : '▸'}</button>
          : <span className={styles.toggleSpacer} />}
        {keyName !== null && (
          <span className={styles.treeKey}>"{keyName}"<span className={styles.colon}>: </span></span>
        )}
        {isCollapsible ? (
          isEmpty ? <span className={styles[`type-${type}`]}>{bracket[0]}{bracket[1]}</span>
          : open ? <span className={styles[`type-${type}`]}>{bracket[0]}</span>
          : (
            <span className={`${styles[`type-${type}`]} ${styles.collapsed}`} onClick={() => setOpen(true)}>
              {bracket[0]} {type === 'array' ? `${entries.length} items` : `${entries.length} keys`} {bracket[1]}
            </span>
          )
        ) : (
          <span className={styles[`type-${type}`]}>
            {type === 'string' ? `"${value}"` : String(value)}
          </span>
        )}
      </span>
      {isCollapsible && !isEmpty && open && (
        <>
          <div className={styles.treeChildren}>
            {entries.map(([k, v]) => <TreeNode key={k} keyName={k} value={v} depth={depth + 1} />)}
          </div>
          <span className={styles.treeLine}>
            <span className={styles.toggleSpacer} />
            <span className={styles[`type-${type}`]}>{bracket[1]}</span>
          </span>
        </>
      )}
    </div>
  )
}

// ── Stats panel ────────────────────────────────────────────────────────────
function StatsPanel({ parsed, formattedBytes, minifiedBytes }) {
  const stats = useMemo(() => (parsed ? getStats(parsed) : null), [parsed])

  function fmt(n) {
    return n === 0 ? '0 B' : n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`
  }

  if (!stats) return <div className={styles.statsEmpty}>Paste valid JSON to see statistics.</div>

  return (
    <div className={styles.statsGrid}>
      <div className={styles.statsSection}>
        <div className={styles.statsSectionTitle}>Structure</div>
        <div className={styles.statsRow}><span>Objects</span><strong>{stats.objects}</strong></div>
        <div className={styles.statsRow}><span>Arrays</span><strong>{stats.arrays}</strong></div>
        <div className={styles.statsRow}><span>Total keys</span><strong>{stats.keys}</strong></div>
        <div className={styles.statsRow}><span>Max nesting depth</span><strong>{stats.maxDepth}</strong></div>
      </div>
      <div className={styles.statsSection}>
        <div className={styles.statsSectionTitle}>Value types</div>
        <div className={styles.statsRow}><span>Strings</span><strong>{stats.strings}</strong></div>
        <div className={styles.statsRow}><span>Numbers</span><strong>{stats.numbers}</strong></div>
        <div className={styles.statsRow}><span>Booleans</span><strong>{stats.booleans}</strong></div>
        <div className={styles.statsRow}><span>Nulls</span><strong>{stats.nulls}</strong></div>
      </div>
      <div className={styles.statsSection}>
        <div className={styles.statsSectionTitle}>Size</div>
        <div className={styles.statsRow}><span>Formatted</span><strong>{fmt(formattedBytes)}</strong></div>
        <div className={styles.statsRow}><span>Minified</span><strong>{fmt(minifiedBytes)}</strong></div>
        <div className={styles.statsRow}>
          <span>Compression ratio</span>
          <strong>{formattedBytes ? `${Math.round((minifiedBytes / formattedBytes) * 100)}%` : '—'}</strong>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
const TABS = ['formatted', 'minified', 'tree', 'stats']

export default function JsonFormatter() {
  const [input,  setInput]  = useState('')
  const [tab,    setTab]    = useState('formatted')
  const [indent, setIndent] = useState(2)
  const [copied, setCopied] = useState(false)

  const validation = useMemo(() => validateJSON(input), [input])
  const isValid = validation.valid
  const isEmpty = !input.trim()

  const formatted = useMemo(() => {
    if (!isValid || isEmpty) return ''
    try { return formatJSON(input, indent) } catch { return '' }
  }, [input, indent, isValid, isEmpty])

  const minified = useMemo(() => {
    if (!isValid || isEmpty) return ''
    try { return minifyJSON(input) } catch { return '' }
  }, [input, isValid, isEmpty])

  const parsed = useMemo(() => {
    if (!isValid || isEmpty) return null
    try { return parseJSON(input) } catch { return null }
  }, [input, isValid, isEmpty])

  const formattedBytes = useMemo(() => (formatted ? new Blob([formatted]).size : 0), [formatted])
  const minifiedBytes  = useMemo(() => (minified  ? new Blob([minified]).size  : 0), [minified])

  const activeText = tab === 'formatted' ? formatted : tab === 'minified' ? minified : null

  const beautifyInput = useCallback(() => {
    if (!isValid || !formatted) return
    setInput(formatted)
    setTab('formatted')
  }, [isValid, formatted])

  const openFile = useCallback(async () => {
    const path = await window.nexus.openFile({ filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (!path) return
    setInput(await window.nexus.readFile(path, 'utf8'))
  }, [])

  const saveFile = useCallback(async () => {
    const path = await window.nexus.saveFile({
      defaultPath: 'output.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path) return
    await window.nexus.writeFile(path, formatted || input)
  }, [formatted, input])

  const copyOutput = useCallback(async () => {
    const text = activeText ?? input
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [activeText, input])

  const clear = useCallback(() => { setInput(''); setTab('formatted') }, [])

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button className={styles.actionBtn} onClick={openFile}>Open</button>
          <button className={styles.actionBtn} onClick={saveFile} disabled={isEmpty}>Save</button>
          <button className={styles.actionBtn} onClick={copyOutput} disabled={isEmpty}>
            {copied ? 'Copied!' : 'Copy Output'}
          </button>
          <span className={styles.sep} />
          <button className={styles.primaryBtn} onClick={beautifyInput} disabled={!isValid || isEmpty}>
            Beautify Input
          </button>
          <button className={styles.actionBtn} onClick={clear} disabled={isEmpty}>Clear</button>
          <span className={styles.sep} />
          <label className={styles.indentLabel}>
            Indent
            <select
              className={styles.indentSelect}
              value={indent}
              onChange={e => setIndent(Number(e.target.value))}
            >
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
              <option value="tab">Tab</option>
            </select>
          </label>
        </div>
        <div className={styles.statusArea}>
          {!isEmpty && (
            isValid
              ? <span className={styles.valid}>✓ Valid JSON</span>
              : <span className={styles.invalid}>✗ Invalid</span>
          )}
        </div>
      </div>

      {!isEmpty && !isValid && <div className={styles.errorBar}>{validation.error}</div>}

      <div className={styles.panes}>
        <div className={styles.inputPane}>
          <div className={styles.paneLabel}>Input</div>
          <textarea
            className={styles.editor}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Paste or type JSON here…"
            spellCheck={false}
          />
        </div>

        <div className={styles.outputPane}>
          <div className={styles.paneTabs}>
            {TABS.map(t => (
              <button
                key={t}
                className={`${styles.tabBtn} ${tab === t ? styles.tabActive : ''}`}
                onClick={() => setTab(t)}
                disabled={(t === 'tree' || t === 'stats') && (!isValid || isEmpty)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {(tab === 'formatted' || tab === 'minified') && (
            <textarea
              className={`${styles.editor} ${styles.output}`}
              value={activeText}
              readOnly
              placeholder={`${tab.charAt(0).toUpperCase() + tab.slice(1)} output will appear here…`}
              spellCheck={false}
            />
          )}
          {tab === 'tree' && (
            <div className={styles.treeView}>
              {parsed !== null && <TreeNode keyName={null} value={parsed} depth={0} />}
            </div>
          )}
          {tab === 'stats' && (
            <StatsPanel parsed={parsed} formattedBytes={formattedBytes} minifiedBytes={minifiedBytes} />
          )}
        </div>
      </div>
    </div>
  )
}
