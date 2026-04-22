import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  parseMarkdown, buildHTMLExport,
  toLatex, toMediaWiki, toDocx,
  importDocx, importHTML,
} from './handler'
import OutlinePanel from './OutlinePanel'
import styles from './index.module.css'

// ── Toolbar constants ──────────────────────────────────────────────────────
const TOOLBAR = [
  { label: 'B',   title: 'Bold (Ctrl+B)',     action: 'wrap',   pre: '**',          suf: '**'        },
  { label: 'I',   title: 'Italic (Ctrl+I)',   action: 'wrap',   pre: '*',           suf: '*'         },
  { label: 'S',   title: 'Strikethrough',     action: 'wrap',   pre: '~~',          suf: '~~'        },
  { label: '`',   title: 'Inline code',       action: 'wrap',   pre: '`',           suf: '`'         },
  { sep: true },
  { label: 'H1',  title: 'Heading 1',         action: 'line',   pre: '# '                            },
  { label: 'H2',  title: 'Heading 2',         action: 'line',   pre: '## '                           },
  { label: 'H3',  title: 'Heading 3',         action: 'line',   pre: '### '                          },
  { label: 'H4',  title: 'Heading 4',         action: 'line',   pre: '#### '                         },
  { sep: true },
  { label: 'UL',  title: 'Bullet list',       action: 'line',   pre: '- '                            },
  { label: 'OL',  title: 'Numbered list',     action: 'line',   pre: '1. '                           },
  { label: '☑',   title: 'Task list',         action: 'line',   pre: '- [ ] '                        },
  { label: '❝',   title: 'Blockquote',        action: 'line',   pre: '> '                            },
  { label: '{}',  title: 'Code block',        action: 'wrap',   pre: '```\n',       suf: '\n```'     },
  { label: '∑',   title: 'Math block',        action: 'wrap',   pre: '$$\n',        suf: '\n$$'      },
  { sep: true },
  { label: '🔗',  title: 'Link',              action: 'wrap',   pre: '[',           suf: '](url)'    },
  { label: '⊞',   title: 'Table',             action: 'insert', pre: '\n| Col 1 | Col 2 |\n|--------|--------|\n| Cell   | Cell   |\n' },
  { label: 'HR',  title: 'Horizontal rule',   action: 'insert', pre: '\n---\n'                       },
]

const EXPORT_ITEMS = [
  { key: 'html',      label: 'Export HTML (.html)' },
  { key: 'pdf',       label: 'Export PDF (.pdf)' },
  { key: 'docx',      label: 'Export Word (.docx)' },
  { key: 'latex',     label: 'Export LaTeX (.tex)' },
  { key: 'mediawiki', label: 'Export MediaWiki (.wiki)' },
]

const IMPORT_ITEMS = [
  { key: 'docx', label: 'Import Word (.docx)' },
  { key: 'html', label: 'Import HTML (.html)' },
  { key: 'txt',  label: 'Import Text (.txt)' },
]

// ── Small reusable dropdown ────────────────────────────────────────────────
function Dropdown({ label, items, onSelect, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className={styles.dropdown} ref={ref}>
      <button className={styles.actionBtn} disabled={disabled} onClick={() => setOpen(o => !o)}>
        {label} ▾
      </button>
      {open && (
        <div className={styles.dropMenu}>
          {items.map(it => (
            <button key={it.key} className={styles.dropItem}
              onClick={() => { setOpen(false); onSelect(it.key) }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────
function wordCount(t) { return t.trim() ? t.trim().split(/\s+/).length : 0 }
function getCursorPos(value, pos) {
  const before = value.slice(0, pos).split('\n')
  return { line: before.length, col: before[before.length - 1].length + 1 }
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MarkdownEditor() {
  const [markdown,  setMarkdown]  = useState('')
  const [fileName,  setFileName]  = useState('untitled.md')
  const [filePath,  setFilePath]  = useState(null)
  const [isDirty,   setIsDirty]   = useState(false)
  const [viewMode,  setViewMode]  = useState('split')
  const [cursor,    setCursor]    = useState({ line: 1, col: 1 })
  const [showOutline,  setShowOutline]  = useState(false)
  const [focusMode,    setFocusMode]    = useState(false)
  const [typewriter,   setTypewriter]   = useState(false)
  const textareaRef = useRef(null)
  const previewRef  = useRef(null)

  const html  = useMemo(() => parseMarkdown(markdown), [markdown])
  const stats = useMemo(() => ({
    words: wordCount(markdown),
    chars: markdown.length,
    lines: markdown ? markdown.split('\n').length : 0,
  }), [markdown])

  // ── Mermaid rendering ──────────────────────────────────────────────────
  useEffect(() => {
    if (!previewRef.current) return
    const pending = previewRef.current.querySelectorAll('.mermaid-pending')
    if (!pending.length) return
    import('mermaid').then(({ default: m }) => {
      m.initialize({ startOnLoad: false, theme: 'dark' })
      pending.forEach(d => { d.classList.remove('mermaid-pending'); d.classList.add('mermaid') })
      m.run({ nodes: Array.from(previewRef.current.querySelectorAll('.mermaid')) }).catch(() => {})
    })
  }, [html])

  // ── Typewriter: keep cursor line centered ──────────────────────────────
  const typewriterAdjust = useCallback(() => {
    if (!typewriter || !textareaRef.current) return
    const ta = textareaRef.current
    const lineH = parseFloat(getComputedStyle(ta).lineHeight) || 22
    const lines = ta.value.slice(0, ta.selectionStart).split('\n').length
    ta.scrollTop = (lines - 1) * lineH - ta.clientHeight / 2 + lineH / 2
  }, [typewriter])

  // ── Format apply ──────────────────────────────────────────────────────
  const applyFormat = useCallback((item) => {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const selected = value.slice(s, e)
    let newValue, newS, newE
    if (item.action === 'wrap') {
      const r = item.pre + selected + item.suf
      newValue = value.slice(0, s) + r + value.slice(e)
      newS = selected ? s : s + item.pre.length
      newE = selected ? s + r.length : s + item.pre.length
    } else if (item.action === 'line') {
      const ls = value.lastIndexOf('\n', s - 1) + 1
      newValue = value.slice(0, ls) + item.pre + value.slice(ls)
      newS = s + item.pre.length; newE = e + item.pre.length
    } else {
      newValue = value.slice(0, s) + item.pre + value.slice(e)
      newS = s + item.pre.length; newE = newS
    }
    setMarkdown(newValue); setIsDirty(true)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(newS, newE) }, 0)
  }, [])

  // ── File ops ───────────────────────────────────────────────────────────
  const openFile = useCallback(async () => {
    const path = await window.nexus.openFile({
      filters: [{ name: 'Markdown / Text', extensions: ['md', 'markdown', 'txt'] }],
    })
    if (!path) return
    const content = await window.nexus.readFile(path, 'utf8')
    setMarkdown(content); setFilePath(path); setFileName(path.split(/[\\/]/).pop()); setIsDirty(false)
  }, [])

  const saveFile = useCallback(async (saveAs = false) => {
    let path = filePath
    if (!path || saveAs) {
      path = await window.nexus.saveFile({ defaultPath: fileName, filters: [{ name: 'Markdown', extensions: ['md'] }] })
      if (!path) return
      setFilePath(path); setFileName(path.split(/[\\/]/).pop())
    }
    await window.nexus.writeFile(path, markdown)
    setIsDirty(false)
  }, [filePath, fileName, markdown])

  const insertImage = useCallback(async () => {
    const p = await window.nexus.openFile({ filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','gif','webp','svg','bmp'] }] })
    if (!p) return
    const norm = p.replace(/\\/g, '/')
    applyFormat({ action: 'insert', pre: `![image](file:///${norm})` })
  }, [applyFormat])

  // ── Export ─────────────────────────────────────────────────────────────
  const handleExport = useCallback(async (key) => {
    const base = fileName.replace(/\.(md|markdown|txt)$/i, '')
    if (key === 'html') {
      const path = await window.nexus.saveFile({ defaultPath: base + '.html', filters: [{ name: 'HTML', extensions: ['html'] }] })
      if (!path) return
      // Use live preview innerHTML if available (captures rendered mermaid SVGs)
      const body = previewRef.current ? previewRef.current.innerHTML : html
      await window.nexus.writeFile(path, buildHTMLExport(base, body))
    } else if (key === 'pdf') {
      const path = await window.nexus.saveFile({ defaultPath: base + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] })
      if (!path) return
      const body = previewRef.current ? previewRef.current.innerHTML : html
      await window.nexus.markdown.exportPDF(buildHTMLExport(base, body), path)
    } else if (key === 'docx') {
      const path = await window.nexus.saveFile({ defaultPath: base + '.docx', filters: [{ name: 'Word Document', extensions: ['docx'] }] })
      if (!path) return
      const buf = await toDocx(markdown)
      const b64 = btoa(String.fromCharCode(...buf))
      await window.nexus.writeFileBinary(path, b64)
    } else if (key === 'latex') {
      const path = await window.nexus.saveFile({ defaultPath: base + '.tex', filters: [{ name: 'LaTeX', extensions: ['tex'] }] })
      if (!path) return
      await window.nexus.writeFile(path, toLatex(markdown))
    } else if (key === 'mediawiki') {
      const path = await window.nexus.saveFile({ defaultPath: base + '.wiki', filters: [{ name: 'MediaWiki', extensions: ['wiki', 'txt'] }] })
      if (!path) return
      await window.nexus.writeFile(path, toMediaWiki(markdown))
    }
  }, [fileName, html, markdown])

  // ── Import ─────────────────────────────────────────────────────────────
  const handleImport = useCallback(async (key) => {
    if (key === 'docx') {
      const path = await window.nexus.openFile({ filters: [{ name: 'Word Document', extensions: ['docx'] }] })
      if (!path) return
      const b64 = await window.nexus.readFile(path, 'base64')
      const md = await importDocx(b64)
      setMarkdown(md); setFileName(path.split(/[\\/]/).pop().replace('.docx', '.md')); setFilePath(null); setIsDirty(true)
    } else if (key === 'html') {
      const path = await window.nexus.openFile({ filters: [{ name: 'HTML', extensions: ['html', 'htm'] }] })
      if (!path) return
      const content = await window.nexus.readFile(path, 'utf8')
      const md = await importHTML(content)
      setMarkdown(md); setFileName(path.split(/[\\/]/).pop().replace(/\.html?$/, '.md')); setFilePath(null); setIsDirty(true)
    } else if (key === 'txt') {
      const path = await window.nexus.openFile({ filters: [{ name: 'Text', extensions: ['txt'] }] })
      if (!path) return
      const content = await window.nexus.readFile(path, 'utf8')
      setMarkdown(content); setFileName(path.split(/[\\/]/).pop().replace('.txt', '.md')); setFilePath(null); setIsDirty(true)
    }
  }, [])

  // ── Heading click from outline ─────────────────────────────────────────
  const onHeadingClick = useCallback(({ line, text }) => {
    if (textareaRef.current && viewMode !== 'preview') {
      const ta = textareaRef.current
      const lines = ta.value.split('\n')
      let pos = lines.slice(0, line).join('\n').length + (line > 0 ? 1 : 0)
      ta.focus(); ta.setSelectionRange(pos, pos)
      const lineH = parseFloat(getComputedStyle(ta).lineHeight) || 22
      ta.scrollTop = line * lineH - ta.clientHeight / 2
    }
    if (previewRef.current && viewMode !== 'edit') {
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      const el = previewRef.current.querySelector(`[id="${id}"], h1, h2, h3, h4, h5, h6`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [viewMode])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && focusMode) { setFocusMode(false); return }
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === 'o') { e.preventDefault(); openFile() }
      if (e.key === 's') { e.preventDefault(); saveFile(e.shiftKey) }
      if (e.key === 'b') { e.preventDefault(); applyFormat(TOOLBAR[0]) }
      if (e.key === 'i') { e.preventDefault(); applyFormat(TOOLBAR[1]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openFile, saveFile, applyFormat, focusMode])

  // ── Textarea event handlers ────────────────────────────────────────────
  const handleChange = useCallback((e) => {
    setMarkdown(e.target.value); setIsDirty(true)
    const pos = getCursorPos(e.target.value, e.target.selectionStart)
    setCursor(pos)
    typewriterAdjust()
  }, [typewriterAdjust])

  const handleCursorMove = useCallback((e) => {
    setCursor(getCursorPos(e.target.value, e.target.selectionStart))
    typewriterAdjust()
  }, [typewriterAdjust])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.target
      const { selectionStart: s, selectionEnd: end, value } = ta
      const next = value.slice(0, s) + '  ' + value.slice(end)
      setMarkdown(next)
      setTimeout(() => ta.setSelectionRange(s + 2, s + 2), 0)
    }
  }, [])

  // ── Shared editor / preview panes ──────────────────────────────────────
  const showEditor  = focusMode ? true : viewMode !== 'preview'
  const showPreview = focusMode ? false : viewMode !== 'edit'

  const editorPane = showEditor && (
    <div className={`${styles.editorPane} ${!showPreview ? styles.fullPane : ''}`}>
      {!focusMode && <div className={styles.paneLabel}>Markdown</div>}
      <textarea
        ref={textareaRef}
        className={`${styles.editor} ${focusMode ? styles.editorFocus : ''}`}
        value={markdown}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleCursorMove}
        onSelect={handleCursorMove}
        placeholder="Start writing Markdown…"
        spellCheck={false}
      />
    </div>
  )

  const previewPane = showPreview && (
    <div className={`${styles.previewPane} ${!showEditor ? styles.fullPane : ''}`}>
      {!focusMode && <div className={styles.paneLabel}>Preview</div>}
      <div
        ref={previewRef}
        className={styles.preview}
        dangerouslySetInnerHTML={{ __html: html || '<p class="empty">Nothing to preview yet.</p>' }}
        onClick={e => {
          const a = e.target.closest('a')
          if (a?.href) { e.preventDefault(); window.nexus.openExternal(a.href) }
        }}
      />
    </div>
  )

  const toolbar = (
    <div className={`${styles.toolbar} ${focusMode ? styles.toolbarFocus : ''}`}>
      <div className={styles.toolbarLeft}>
        <button className={styles.actionBtn} onClick={openFile}>Open</button>
        <button className={styles.actionBtn} onClick={() => saveFile(false)}>Save</button>
        <button className={styles.actionBtn} onClick={() => saveFile(true)}>Save As</button>
        <Dropdown label="Import" items={IMPORT_ITEMS} onSelect={handleImport} />
        <Dropdown label="Export" items={EXPORT_ITEMS} onSelect={handleExport} disabled={!markdown.trim()} />
        <span className={styles.sep} />
        <button className={styles.fmtBtn} title="Insert image" onClick={insertImage}>Img</button>
        {TOOLBAR.map((item, i) =>
          item.sep
            ? <span key={i} className={styles.sep} />
            : <button key={i} className={styles.fmtBtn} title={item.title} onClick={() => applyFormat(item)}>
                {item.label}
              </button>
        )}
      </div>
      <div className={styles.toolbarRight}>
        <span className={styles.fileTag}>
          {isDirty && <span className={styles.dot} />}
          {fileName}
        </span>
        <div className={styles.modeGroup}>
          <button
            className={`${styles.modeBtn} ${showOutline ? styles.modeBtnActive : ''}`}
            onClick={() => setShowOutline(o => !o)} title="Outline panel">≡</button>
          <button
            className={`${styles.modeBtn} ${typewriter ? styles.modeBtnActive : ''}`}
            onClick={() => setTypewriter(t => !t)} title="Typewriter mode">TW</button>
          <button
            className={`${styles.modeBtn} ${focusMode ? styles.modeBtnActive : ''}`}
            onClick={() => setFocusMode(f => !f)} title="Focus mode (Esc to exit)">⊡</button>
        </div>
        <div className={styles.viewToggle}>
          {['edit', 'split', 'preview'].map(mode => (
            <button key={mode}
              className={`${styles.viewBtn} ${viewMode === mode ? styles.viewBtnActive : ''}`}
              onClick={() => { setViewMode(mode); setFocusMode(false) }}
              title={mode.charAt(0).toUpperCase() + mode.slice(1) + ' mode'}>
              {mode === 'edit' ? 'Edit' : mode === 'split' ? 'Split' : 'Preview'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const statusBar = (
    <div className={styles.statusBar}>
      <div className={styles.statusLeft}>
        <span>Words: <strong>{stats.words}</strong></span>
        <span className={styles.statusSep} />
        <span>Chars: <strong>{stats.chars}</strong></span>
        <span className={styles.statusSep} />
        <span>Lines: <strong>{stats.lines}</strong></span>
      </div>
      <div className={styles.statusRight}>Ln {cursor.line}, Col {cursor.col}</div>
    </div>
  )

  // ── Focus mode: full overlay ───────────────────────────────────────────
  if (focusMode) {
    return (
      <div className={styles.root}>
        <div className={styles.focusOverlay}>
          {toolbar}
          <div className={styles.panes}>
            {editorPane}
          </div>
          {statusBar}
        </div>
      </div>
    )
  }

  // ── Normal layout ──────────────────────────────────────────────────────
  return (
    <div className={styles.root}>
      {toolbar}
      <div className={styles.panesWrapper}>
        {showOutline && (
          <OutlinePanel markdown={markdown} onHeadingClick={onHeadingClick} />
        )}
        <div className={styles.panes}>
          {editorPane}
          {showPreview && showEditor && <div className={styles.paneDivider} />}
          {previewPane}
        </div>
      </div>
      {statusBar}
    </div>
  )
}
