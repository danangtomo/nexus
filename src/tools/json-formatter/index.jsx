import { useState, useCallback, useMemo } from 'react'
import { formatJSON, minifyJSON, validateJSON, parseJSON, getValueType } from './handler'
import styles from './index.module.css'

// ── Tree node (recursive) ──────────────────────────────────────────────────
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
        {isCollapsible && !isEmpty && (
          <button className={styles.toggle} onClick={() => setOpen(o => !o)}>
            {open ? '▾' : '▸'}
          </button>
        )}
        {!isCollapsible || isEmpty ? <span className={styles.toggleSpacer} /> : null}

        {keyName !== null && (
          <span className={styles.treeKey}>"{keyName}"<span className={styles.colon}>: </span></span>
        )}

        {isCollapsible ? (
          isEmpty ? (
            <span className={styles[`type-${type}`]}>{bracket[0]}{bracket[1]}</span>
          ) : open ? (
            <span className={styles[`type-${type}`]}>{bracket[0]}</span>
          ) : (
            <span
              className={`${styles[`type-${type}`]} ${styles.collapsed}`}
              onClick={() => setOpen(true)}
            >
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
        <div className={styles.treeChildren}>
          {entries.map(([k, v]) => (
            <TreeNode key={k} keyName={k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}

      {isCollapsible && !isEmpty && open && (
        <span className={styles.treeLine}>
          <span className={styles.toggleSpacer} />
          <span className={styles[`type-${type}`]}>{bracket[1]}</span>
        </span>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function JsonFormatter() {
  const [input,   setInput]   = useState('')
  const [tab,     setTab]     = useState('formatted') // 'formatted' | 'tree'
  const [indent,  setIndent]  = useState(2)
  const [copied,  setCopied]  = useState(false)

  const validation = useMemo(() => validateJSON(input), [input])

  const formatted = useMemo(() => {
    if (!validation.valid || !input.trim()) return ''
    try { return formatJSON(input, indent) } catch { return '' }
  }, [input, indent, validation.valid])

  const parsed = useMemo(() => {
    if (!validation.valid || !input.trim()) return null
    try { return parseJSON(input) } catch { return null }
  }, [input, validation.valid])

  const applyFormat = useCallback(() => {
    if (!validation.valid) return
    setInput(formatted)
  }, [validation.valid, formatted])

  const applyMinify = useCallback(() => {
    if (!validation.valid) return
    try { setInput(minifyJSON(input)) } catch {}
  }, [validation.valid, input])

  const openFile = useCallback(async () => {
    const path = await window.nexus.openFile({
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path) return
    const content = await window.nexus.readFile(path, 'utf8')
    setInput(content)
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
    const text = formatted || input
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [formatted, input])

  const clear = useCallback(() => setInput(''), [])

  const isEmpty = !input.trim()
  const showError = !isEmpty && !validation.valid

  return (
    <div className={styles.root}>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button className={styles.actionBtn} onClick={openFile}>Open</button>
          <button className={styles.actionBtn} onClick={saveFile} disabled={isEmpty}>Save</button>
          <button className={styles.actionBtn} onClick={copyOutput} disabled={isEmpty}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <span className={styles.sep} />
          <button className={styles.primaryBtn} onClick={applyFormat} disabled={!validation.valid || isEmpty}>
            Format
          </button>
          <button className={styles.actionBtn} onClick={applyMinify} disabled={!validation.valid || isEmpty}>
            Minify
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
            validation.valid
              ? <span className={styles.valid}>✓ Valid JSON</span>
              : <span className={styles.invalid}>✗ Invalid</span>
          )}
        </div>
      </div>

      {showError && (
        <div className={styles.errorBar}>{validation.error}</div>
      )}

      <div className={styles.panes}>
        {/* Left — input */}
        <div className={styles.inputPane}>
          <div className={styles.paneLabel}>Input</div>
          <textarea
            className={styles.editor}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder='Paste or type JSON here…'
            spellCheck={false}
          />
        </div>

        {/* Right — output */}
        <div className={styles.outputPane}>
          <div className={styles.paneTabs}>
            <button
              className={`${styles.tabBtn} ${tab === 'formatted' ? styles.tabActive : ''}`}
              onClick={() => setTab('formatted')}
            >Formatted</button>
            <button
              className={`${styles.tabBtn} ${tab === 'tree' ? styles.tabActive : ''}`}
              onClick={() => setTab('tree')}
              disabled={!validation.valid || isEmpty}
            >Tree</button>
          </div>

          {tab === 'formatted' ? (
            <textarea
              className={`${styles.editor} ${styles.output}`}
              value={formatted}
              readOnly
              placeholder='Formatted output will appear here…'
              spellCheck={false}
            />
          ) : (
            <div className={styles.treeView}>
              {parsed !== null && (
                <TreeNode keyName={null} value={parsed} depth={0} />
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
