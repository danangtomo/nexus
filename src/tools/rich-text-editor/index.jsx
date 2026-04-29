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

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { Color } from '@tiptap/extension-color'
import { TextStyle, FontFamily, FontSize } from '@tiptap/extension-text-style'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Image } from '@tiptap/extension-image'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { exportDocx, importDocx, exportPdf } from './handler'
import styles from './index.module.css'

const DEBOUNCE_MS = 1000

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Sans-serif', value: 'ui-sans-serif, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Monospace', value: '"Courier New", monospace' },
  { label: 'Cursive', value: 'cursive' },
]

const FONT_SIZES = [
  { label: 'Small', value: '12px' },
  { label: 'Normal', value: '' },
  { label: 'Large', value: '18px' },
  { label: 'Huge', value: '24px' },
]

const HIGHLIGHT_COLORS = [
  { color: '#fde68a', label: 'Yellow' },
  { color: '#a7f3d0', label: 'Green' },
  { color: '#bfdbfe', label: 'Blue' },
  { color: '#fbcfe8', label: 'Pink' },
  { color: '#fed7aa', label: 'Orange' },
  { color: '#ddd6fe', label: 'Purple' },
  { color: '#fecaca', label: 'Red' },
]

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const TbBtn = ({ onClick, active, disabled, title, children }) => (
  <button className={`${styles.tbBtn} ${active ? styles.active : ''}`}
    onClick={onClick} disabled={disabled} title={title} type="button"
  >{children}</button>
)

const Divider = () => <div className={styles.divider} />

export default function RichTextEditor() {
  const [docs, setDocs]             = useState([])
  const [activeId, setActiveId]     = useState(null)
  const [title, setTitle]           = useState('Untitled')
  const [saveStatus, setSaveStatus] = useState('idle')
  const [linkBar, setLinkBar]       = useState(false)
  const [linkUrl, setLinkUrl]       = useState('')
  const [tableMenu, setTableMenu]   = useState(false)
  const [hlMenu, setHlMenu]         = useState(false)
  const [findBar, setFindBar]       = useState(false)
  const [findQuery, setFindQuery]   = useState('')

  const saveTimer    = useRef(null)
  const savedTimer   = useRef(null)
  const activeIdRef  = useRef(null)
  const titleRef     = useRef('Untitled')
  const editorRef    = useRef(null)   // always-current editor ref for cleanup
  const tableMenuRef = useRef()
  const hlMenuRef    = useRef()
  const colorInputRef = useRef()
  const findInputRef = useRef()

  const markSaved = useCallback(() => {
    setSaveStatus('saved')
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
  }, [])

  // Flush any pending debounced save immediately — call before switching docs or on unmount
  const flushSave = useCallback(() => {
    if (saveTimer.current == null || activeIdRef.current == null) return
    clearTimeout(saveTimer.current)
    saveTimer.current = null
    const ed = editorRef.current
    if (!ed || ed.isDestroyed) return
    window.nexus.rte.save(activeIdRef.current, titleRef.current, ed.getHTML())
    markSaved()
  }, [markSaved])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Subscript,
      Superscript,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
      CharacterCount,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setSaveStatus('saving')
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        if (activeIdRef.current == null) return
        window.nexus.rte.save(activeIdRef.current, titleRef.current, editor.getHTML())
        refreshList()
        markSaved()
      }, DEBOUNCE_MS)
    },
  })

  // Keep editorRef in sync so cleanup closures always have the latest editor
  useEffect(() => { editorRef.current = editor }, [editor])

  // Flush pending save when user navigates away from the tool
  useEffect(() => () => flushSave(), [flushSave])

  // Close menus on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!tableMenuRef.current?.contains(e.target)) setTableMenu(false)
      if (!hlMenuRef.current?.contains(e.target)) setHlMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Ctrl+F to open find bar
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setFindBar(b => { if (!b) setTimeout(() => findInputRef.current?.focus(), 50); return !b })
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const refreshList = useCallback(async () => {
    const list = await window.nexus.rte.list()
    setDocs(list)
  }, [])

  useEffect(() => { refreshList() }, [refreshList])

  const openDoc = useCallback(async (id) => {
    if (!editor) return
    flushSave()  // persist current doc before switching
    const doc = await window.nexus.rte.get(id)
    if (!doc) return
    activeIdRef.current = id
    titleRef.current = doc.title
    setActiveId(id)
    setTitle(doc.title)
    setSaveStatus('idle')
    setLinkBar(false)
    setFindBar(false)
    editor.commands.setContent(doc.content || '', false)
  }, [editor, flushSave])

  useEffect(() => {
    if (!editor || docs.length === 0 || activeId !== null) return
    openDoc(docs[0].id)
  }, [editor, docs, activeId, openDoc])

  const newDoc = async () => {
    flushSave()  // persist current doc before creating new one
    const id = await window.nexus.rte.create()
    await refreshList()
    openDoc(id)
  }

  const duplicateDoc = async (e, id) => {
    e.stopPropagation()
    const doc = await window.nexus.rte.get(id)
    if (!doc) return
    const newId = await window.nexus.rte.create()
    await window.nexus.rte.save(newId, `${doc.title} (copy)`, doc.content)
    await refreshList()
    openDoc(newId)
  }

  const deleteDoc = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Delete this document?')) return
    await window.nexus.rte.delete(id)
    const remaining = docs.filter(d => d.id !== id)
    if (activeId === id) {
      setActiveId(null)
      activeIdRef.current = null
      setSaveStatus('idle')
      setLinkBar(false)
      editor?.commands.setContent('', false)
      setTitle('Untitled')
      if (remaining.length > 0) openDoc(remaining[0].id)
    }
    setDocs(remaining)
  }

  const handleTitleChange = (e) => {
    const val = e.target.value
    titleRef.current = val
    setTitle(val)
    setSaveStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (activeIdRef.current == null) return
      window.nexus.rte.save(activeIdRef.current, val, editor.getHTML())
      refreshList()
      markSaved()
    }, DEBOUNCE_MS)
  }

  // ── Link ──────────────────────────────────────────────────────────────────
  const openLinkBar = useCallback(() => {
    setLinkUrl(editor?.getAttributes('link').href || '')
    setLinkBar(true)
  }, [editor])

  const confirmLink = useCallback(() => {
    const url = linkUrl.trim()
    url ? editor?.chain().focus().setLink({ href: url }).run()
        : editor?.chain().focus().unsetLink().run()
    setLinkBar(false)
  }, [editor, linkUrl])

  const removeLink = useCallback(() => {
    editor?.chain().focus().unsetLink().run()
    setLinkBar(false)
  }, [editor])

  // ── Image ─────────────────────────────────────────────────────────────────
  const handleInsertImage = async () => {
    const filePath = await window.nexus.openFile({
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] }],
    })
    if (!filePath) return
    const ext = filePath.split('.').pop().toLowerCase()
    const mimes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }
    const mime = mimes[ext] || 'image/png'
    const buf = await window.nexus.readFile(filePath, null)
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const src = `data:${mime};base64,${btoa(binary)}`
    editor.chain().focus().setImage({ src }).run()
    // Save immediately — image is large data; don't risk losing it to debounce
    clearTimeout(saveTimer.current)
    saveTimer.current = null
    if (activeIdRef.current != null) {
      window.nexus.rte.save(activeIdRef.current, titleRef.current, editor.getHTML())
      refreshList()
      markSaved()
    }
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  const tbl = (cmd) => () => { editor?.chain().focus()[cmd]().run(); setTableMenu(false) }

  // ── Find ──────────────────────────────────────────────────────────────────
  const findNext = useCallback(() => {
    if (findQuery.trim()) window.find(findQuery, false, false, true)
  }, [findQuery])

  const findPrev = useCallback(() => {
    if (findQuery.trim()) window.find(findQuery, false, true, true)
  }, [findQuery])

  const findMatchCount = useMemo(() => {
    if (!findQuery.trim() || !editor) return 0
    const text = editor.getText().toLowerCase()
    const q = findQuery.trim().toLowerCase()
    let count = 0, idx = 0
    while ((idx = text.indexOf(q, idx)) !== -1) { count++; idx += q.length }
    return count
  }, [findQuery, editor])

  // ── Import / Export ───────────────────────────────────────────────────────
  const handleImport = async () => {
    const filePath = await window.nexus.openFile({ filters: [{ name: 'Word Documents', extensions: ['docx'] }] })
    if (!filePath) return
    const html = await importDocx(filePath)
    if (html) editor.commands.setContent(html)
  }

  const handleExportDocx = async () => {
    const fp = await window.nexus.saveFile({ defaultPath: `${title}.docx`, filters: [{ name: 'Word Document', extensions: ['docx'] }] })
    if (fp) await exportDocx(editor.getHTML(), fp)
  }

  const handleExportPdf = async () => {
    const fp = await window.nexus.saveFile({ defaultPath: `${title}.pdf`, filters: [{ name: 'PDF Document', extensions: ['pdf'] }] })
    if (fp) await exportPdf(editor.getHTML(), title, fp)
  }

  const handleExportTxt = async () => {
    const fp = await window.nexus.saveFile({ defaultPath: `${title}.txt`, filters: [{ name: 'Plain Text', extensions: ['txt'] }] })
    if (fp) await window.nexus.writeFile(fp, editor.getText())
  }

  const handlePrint = () => window.print()

  const curColor  = editor?.getAttributes('textStyle')?.color || '#e2e8f0'
  const curFamily = editor?.getAttributes('textStyle')?.fontFamily || ''
  const curSize   = editor?.getAttributes('textStyle')?.fontSize || ''
  const words = editor?.storage.characterCount?.words() ?? 0
  const chars = editor?.storage.characterCount?.characters() ?? 0

  return (
    <div className={styles.root}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <button className={styles.newBtn} onClick={newDoc}>+ New Document</button>
        <div className={styles.docList}>
          {docs.length === 0 && <p className={styles.empty}>No documents yet</p>}
          {docs.map(doc => (
            <div key={doc.id}
              className={`${styles.docItem} ${doc.id === activeId ? styles.docActive : ''}`}
              onClick={() => openDoc(doc.id)}
            >
              <span className={styles.docTitle}>{doc.title || 'Untitled'}</span>
              <span className={styles.docDate}>{fmtDate(doc.updated_at)}</span>
              <div className={styles.docActions}>
                <button className={styles.docDup} onClick={(e) => duplicateDoc(e, doc.id)} title="Duplicate">⧉</button>
                <button className={styles.docDel} onClick={(e) => deleteDoc(e, doc.id)} title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Editor pane */}
      <div className={styles.pane}>
        {activeId == null ? (
          <div className={styles.empty2}>
            <p>Create a new document to get started</p>
            <button className={styles.newBtn2} onClick={newDoc}>+ New Document</button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className={styles.toolbar}>
              {/* History */}
              <TbBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor?.can().undo()} title="Undo (Ctrl+Z)">↩</TbBtn>
              <TbBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor?.can().redo()} title="Redo (Ctrl+Y)">↪</TbBtn>
              <Divider />

              {/* Font family + size */}
              <select className={styles.tbSelect} title="Font Family" value={curFamily}
                onChange={e => e.target.value ? editor.chain().focus().setFontFamily(e.target.value).run() : editor.chain().focus().unsetFontFamily().run()}>
                {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <select className={styles.tbSelect} title="Font Size" value={curSize}
                onChange={e => e.target.value ? editor.chain().focus().setFontSize(e.target.value).run() : editor.chain().focus().unsetFontSize().run()}>
                {FONT_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <Divider />

              {/* Block style */}
              <TbBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor?.isActive('paragraph')} title="Paragraph">¶</TbBtn>
              <TbBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="Heading 1">H1</TbBtn>
              <TbBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="Heading 2">H2</TbBtn>
              <TbBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title="Heading 3">H3</TbBtn>
              <Divider />

              {/* Inline formatting */}
              <TbBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold (Ctrl+B)"><b>B</b></TbBtn>
              <TbBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic (Ctrl+I)"><i>I</i></TbBtn>
              <TbBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Underline (Ctrl+U)"><u>U</u></TbBtn>
              <TbBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="Strikethrough"><s>S</s></TbBtn>
              <TbBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor?.isActive('code')} title="Inline Code">`</TbBtn>
              <TbBtn onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor?.isActive('subscript')} title="Subscript">X₂</TbBtn>
              <TbBtn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor?.isActive('superscript')} title="Superscript">X²</TbBtn>

              {/* Multi-color highlight */}
              <div className={styles.menuWrap} ref={hlMenuRef}>
                <TbBtn onClick={() => setHlMenu(h => !h)} active={editor?.isActive('highlight') || hlMenu} title="Highlight">▓</TbBtn>
                {hlMenu && (
                  <div className={styles.hlMenu}>
                    {HIGHLIGHT_COLORS.map(({ color, label }) => (
                      <button key={color} className={styles.hlSwatch} title={label}
                        style={{ background: color }}
                        onClick={() => { editor.chain().focus().toggleHighlight({ color }).run(); setHlMenu(false) }}
                      />
                    ))}
                    <button className={styles.hlClear} onClick={() => { editor.chain().focus().unsetHighlight().run(); setHlMenu(false) }}>✕</button>
                  </div>
                )}
              </div>

              {/* Font color */}
              <label className={styles.colorPickerBtn} title="Font Color">
                <span style={{ borderBottom: `3px solid ${curColor}` }}>A</span>
                <input ref={colorInputRef} type="color"
                  value={curColor.startsWith('#') ? curColor : '#e2e8f0'}
                  onChange={e => editor?.chain().focus().setColor(e.target.value).run()} />
              </label>

              <TbBtn onClick={openLinkBar} active={editor?.isActive('link') || linkBar} title="Link (Ctrl+K)">🔗</TbBtn>
              <Divider />

              {/* Alignment */}
              <TbBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor?.isActive({ textAlign: 'left' })} title="Align Left">⬅</TbBtn>
              <TbBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor?.isActive({ textAlign: 'center' })} title="Center">↔</TbBtn>
              <TbBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor?.isActive({ textAlign: 'right' })} title="Align Right">➡</TbBtn>
              <TbBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor?.isActive({ textAlign: 'justify' })} title="Justify">≡</TbBtn>
              <Divider />

              {/* Lists */}
              <TbBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet List">•≡</TbBtn>
              <TbBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Numbered List">1≡</TbBtn>
              <TbBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor?.isActive('taskList')} title="Task List (Checklist)">☑</TbBtn>
              <TbBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Blockquote">"</TbBtn>
              <TbBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor?.isActive('codeBlock')} title="Code Block">{'{}'}</TbBtn>
              <TbBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">—</TbBtn>
              <Divider />

              {/* Insert */}
              <TbBtn onClick={handleInsertImage} title="Insert Image">🖼</TbBtn>

              {/* Table */}
              <div className={styles.menuWrap} ref={tableMenuRef}>
                <TbBtn onClick={() => setTableMenu(t => !t)} active={editor?.isActive('table') || tableMenu} title="Table">⊞</TbBtn>
                {tableMenu && (
                  <div className={styles.tableMenu}>
                    <button onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setTableMenu(false) }}>Insert Table (3×3)</button>
                    <div className={styles.menuSep} />
                    <button onClick={tbl('addColumnBefore')} disabled={!editor?.can().addColumnBefore()}>Add Column Before</button>
                    <button onClick={tbl('addColumnAfter')} disabled={!editor?.can().addColumnAfter()}>Add Column After</button>
                    <button onClick={tbl('deleteColumn')} disabled={!editor?.can().deleteColumn()}>Delete Column</button>
                    <div className={styles.menuSep} />
                    <button onClick={tbl('addRowBefore')} disabled={!editor?.can().addRowBefore()}>Add Row Before</button>
                    <button onClick={tbl('addRowAfter')} disabled={!editor?.can().addRowAfter()}>Add Row After</button>
                    <button onClick={tbl('deleteRow')} disabled={!editor?.can().deleteRow()}>Delete Row</button>
                    <div className={styles.menuSep} />
                    <button onClick={tbl('deleteTable')} disabled={!editor?.can().deleteTable()} className={styles.menuDanger}>Delete Table</button>
                  </div>
                )}
              </div>
              <Divider />

              {/* Import / Export */}
              <TbBtn onClick={handleImport} title="Import DOCX">↓ DOCX</TbBtn>
              <TbBtn onClick={handleExportDocx} title="Export as DOCX">↑ DOCX</TbBtn>
              <TbBtn onClick={handleExportPdf} title="Export as PDF">↑ PDF</TbBtn>
              <TbBtn onClick={handleExportTxt} title="Export as TXT">↑ TXT</TbBtn>
              <Divider />

              {/* Utilities */}
              <TbBtn onClick={() => { setFindBar(b => !b); setTimeout(() => findInputRef.current?.focus(), 50) }}
                active={findBar} title="Find in Document (Ctrl+F)">🔍</TbBtn>
              <TbBtn onClick={handlePrint} title="Print">🖨</TbBtn>
            </div>

            {/* Link bar */}
            {linkBar && (
              <div className={styles.linkBar}>
                <span className={styles.linkLabel}>URL</span>
                <input className={styles.linkInput} value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)} placeholder="https://" autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') confirmLink(); if (e.key === 'Escape') setLinkBar(false) }} />
                <button className={styles.linkSet} onClick={confirmLink}>Set</button>
                <button className={styles.linkRemove} onClick={removeLink}>Remove</button>
                <button className={styles.linkClose} onClick={() => setLinkBar(false)}>✕</button>
              </div>
            )}

            {/* Find bar */}
            {findBar && (
              <div className={styles.linkBar}>
                <span className={styles.linkLabel}>Find</span>
                <input ref={findInputRef} className={styles.linkInput} value={findQuery}
                  onChange={e => { setFindQuery(e.target.value); if (e.target.value.trim()) window.find(e.target.value, false, false, true) }}
                  placeholder="Search…"
                  onKeyDown={e => { if (e.key === 'Enter') findNext(); if (e.key === 'Escape') { setFindBar(false); setFindQuery('') } }} />
                {findQuery.trim() && <span className={styles.linkLabel}>{findMatchCount} match{findMatchCount !== 1 ? 'es' : ''}</span>}
                <button className={styles.linkSet} onClick={findPrev} title="Previous">↑</button>
                <button className={styles.linkSet} onClick={findNext} title="Next">↓</button>
                <button className={styles.linkClose} onClick={() => { setFindBar(false); setFindQuery('') }}>✕</button>
              </div>
            )}

            <div className={styles.editorWrap}>
              <div className={styles.editorInner}>
                <input className={styles.titleInput} value={title} onChange={handleTitleChange} placeholder="Untitled" />
                <EditorContent editor={editor} className={styles.editor} />
              </div>
            </div>

            <div className={styles.statusBar}>
              <span>{words} words</span>
              <span>{chars} characters</span>
              <span className={saveStatus === 'saving' ? styles.statusSaving : saveStatus === 'saved' ? styles.statusSaved : styles.autoSave}>
                {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : ''}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
