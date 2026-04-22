import { useState, useRef, useCallback, useEffect } from 'react'
import { parseMarkdown, buildHTMLExport } from './handler'
import styles from './index.module.css'

const TOOLBAR = [
  { label: 'B',  title: 'Bold (Ctrl+B)',        action: 'wrap',  pre: '**',  suf: '**' },
  { label: 'I',  title: 'Italic (Ctrl+I)',       action: 'wrap',  pre: '*',   suf: '*'  },
  { label: 'S',  title: 'Strikethrough',         action: 'wrap',  pre: '~~',  suf: '~~' },
  { label: '<>', title: 'Inline code',            action: 'wrap',  pre: '`',   suf: '`'  },
  { sep: true },
  { label: 'H1', title: 'Heading 1',             action: 'line',  pre: '# '             },
  { label: 'H2', title: 'Heading 2',             action: 'line',  pre: '## '            },
  { label: 'H3', title: 'Heading 3',             action: 'line',  pre: '### '           },
  { sep: true },
  { label: 'UL', title: 'Unordered list',        action: 'line',  pre: '- '             },
  { label: 'OL', title: 'Ordered list',          action: 'line',  pre: '1. '            },
  { label: '❝',  title: 'Blockquote',            action: 'line',  pre: '> '             },
  { label: '{}', title: 'Code block',            action: 'wrap',  pre: '```\n', suf: '\n```' },
  { label: '🔗', title: 'Link',                  action: 'wrap',  pre: '[',    suf: '](url)' },
  { sep: true },
  { label: 'HR', title: 'Horizontal rule',       action: 'insert', pre: '\n---\n'        },
]

export default function MarkdownEditor() {
  const [markdown,  setMarkdown]  = useState('')
  const [fileName,  setFileName]  = useState('untitled.md')
  const [filePath,  setFilePath]  = useState(null)
  const [isDirty,   setIsDirty]   = useState(false)
  const textareaRef = useRef(null)

  const html = parseMarkdown(markdown)

  const applyFormat = useCallback((item) => {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const selected = value.slice(s, e)
    let newValue, newS, newE

    if (item.action === 'wrap') {
      const replacement = item.pre + selected + item.suf
      newValue = value.slice(0, s) + replacement + value.slice(e)
      newS = selected ? s : s + item.pre.length
      newE = selected ? s + replacement.length : s + item.pre.length
    } else if (item.action === 'line') {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1
      newValue = value.slice(0, lineStart) + item.pre + value.slice(lineStart)
      newS = s + item.pre.length
      newE = e + item.pre.length
    } else {
      newValue = value.slice(0, s) + item.pre + value.slice(e)
      newS = s + item.pre.length
      newE = newS
    }

    setMarkdown(newValue)
    setIsDirty(true)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(newS, newE) }, 0)
  }, [])

  const openFile = useCallback(async () => {
    const path = await window.nexus.openFile({
      filters: [{ name: 'Markdown / Text', extensions: ['md', 'markdown', 'txt'] }],
    })
    if (!path) return
    const content = await window.nexus.readFile(path, 'utf8')
    setMarkdown(content)
    setFilePath(path)
    setFileName(path.split(/[\\/]/).pop())
    setIsDirty(false)
  }, [])

  const saveFile = useCallback(async (saveAs = false) => {
    let path = filePath
    if (!path || saveAs) {
      path = await window.nexus.saveFile({
        defaultPath: fileName,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })
      if (!path) return
      setFilePath(path)
      setFileName(path.split(/[\\/]/).pop())
    }
    await window.nexus.writeFile(path, markdown)
    setIsDirty(false)
  }, [filePath, fileName, markdown])

  const exportHTML = useCallback(async () => {
    const base = fileName.replace(/\.(md|markdown|txt)$/i, '')
    const path = await window.nexus.saveFile({
      defaultPath: base + '.html',
      filters: [{ name: 'HTML', extensions: ['html'] }],
    })
    if (!path) return
    await window.nexus.writeFile(path, buildHTMLExport(base, html))
  }, [fileName, html])

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === 'o') { e.preventDefault(); openFile() }
      if (e.key === 's') { e.preventDefault(); saveFile(e.shiftKey) }
      if (e.key === 'b') { e.preventDefault(); applyFormat(TOOLBAR[0]) }
      if (e.key === 'i') { e.preventDefault(); applyFormat(TOOLBAR[1]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openFile, saveFile, applyFormat])

  return (
    <div className={styles.root}>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button className={styles.actionBtn} onClick={openFile}>Open</button>
          <button className={styles.actionBtn} onClick={() => saveFile(false)}>Save</button>
          <button className={styles.actionBtn} onClick={() => saveFile(true)}>Save As</button>
          <button className={styles.actionBtn} onClick={exportHTML}>Export HTML</button>
          <span className={styles.sep} />
          {TOOLBAR.map((item, i) =>
            item.sep
              ? <span key={i} className={styles.sep} />
              : <button
                  key={i}
                  className={styles.fmtBtn}
                  title={item.title}
                  onClick={() => applyFormat(item)}
                >{item.label}</button>
          )}
        </div>
        <span className={styles.fileTag}>
          {isDirty && <span className={styles.dot} />}
          {fileName}
        </span>
      </div>

      <div className={styles.panes}>
        <div className={styles.editorPane}>
          <div className={styles.paneLabel}>Markdown</div>
          <textarea
            ref={textareaRef}
            className={styles.editor}
            value={markdown}
            onChange={e => { setMarkdown(e.target.value); setIsDirty(true) }}
            placeholder="Start writing Markdown…"
            spellCheck={false}
          />
        </div>

        <div className={styles.previewPane}>
          <div className={styles.paneLabel}>Preview</div>
          <div
            className={styles.preview}
            dangerouslySetInnerHTML={{ __html: html || '<p class="empty">Nothing to preview yet.</p>' }}
            onClick={e => {
              const a = e.target.closest('a')
              if (a?.href) { e.preventDefault(); window.nexus.openExternal(a.href) }
            }}
          />
        </div>
      </div>

    </div>
  )
}
