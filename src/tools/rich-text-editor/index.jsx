import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { useEffect, useRef, useCallback } from 'react'
import { exportDocx, importDocx } from './handler'
import styles from './index.module.css'

const SAVE_KEY = 'rich-text-editor-content'
const DEBOUNCE_MS = 1000

const ToolbarButton = ({ onClick, active, disabled, title, children }) => (
  <button
    className={`${styles.tbBtn} ${active ? styles.active : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={title}
    type="button"
  >
    {children}
  </button>
)

const Divider = () => <div className={styles.divider} />

export default function RichTextEditor() {
  const saveTimer = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
      CharacterCount,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        const html = editor.getHTML()
        window.nexus?.setPref(SAVE_KEY, html)
      }, DEBOUNCE_MS)
    },
  })

  // Load saved content on mount
  useEffect(() => {
    if (!editor) return
    window.nexus?.getPref(SAVE_KEY).then((saved) => {
      if (saved) editor.commands.setContent(saved, false)
    })
    return () => clearTimeout(saveTimer.current)
  }, [editor])

  const setLink = useCallback(() => {
    const prev = editor.getAttributes('link').href || ''
    const url = window.prompt('URL', prev)
    if (url === null) return
    if (url === '') { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().setLink({ href: url }).run()
  }, [editor])

  const handleImport = async () => {
    const filePath = await window.nexus.openFile({ filters: [{ name: 'Word Documents', extensions: ['docx'] }] })
    if (!filePath) return
    const html = await importDocx(filePath)
    if (html) editor.commands.setContent(html)
  }

  const handleExportDocx = async () => {
    const filePath = await window.nexus.saveFile({ defaultPath: 'document.docx', filters: [{ name: 'Word Document', extensions: ['docx'] }] })
    if (!filePath) return
    await exportDocx(editor.getHTML(), filePath)
  }

  const handleExportTxt = async () => {
    const filePath = await window.nexus.saveFile({ defaultPath: 'document.txt', filters: [{ name: 'Plain Text', extensions: ['txt'] }] })
    if (!filePath) return
    await window.nexus.writeFile(filePath, editor.getText())
  }

  if (!editor) return null

  const words = editor.storage.characterCount?.words() ?? 0
  const chars = editor.storage.characterCount?.characters() ?? 0

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        {/* History */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">↩</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">↪</ToolbarButton>
        <Divider />

        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Paragraph">¶</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">H1</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">H3</ToolbarButton>
        <Divider />

        {/* Inline formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><b>B</b></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><i>I</i></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><u>U</u></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><s>S</s></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight">▓</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline Code">`</ToolbarButton>
        <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Insert Link">🔗</ToolbarButton>
        <Divider />

        {/* Alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">⬅</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Center">↔</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">➡</ToolbarButton>
        <Divider />

        {/* Lists & blocks */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">•≡</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">1≡</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">"</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code Block">{'{}'}</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">—</ToolbarButton>
        <Divider />

        {/* Import / Export */}
        <ToolbarButton onClick={handleImport} title="Import DOCX">↓ DOCX</ToolbarButton>
        <ToolbarButton onClick={handleExportDocx} title="Export DOCX">↑ DOCX</ToolbarButton>
        <ToolbarButton onClick={handleExportTxt} title="Export plain text">↑ TXT</ToolbarButton>
      </div>

      <div className={styles.editorWrap}>
        <EditorContent editor={editor} className={styles.editor} />
      </div>

      <div className={styles.statusBar}>
        <span>{words} words</span>
        <span>{chars} characters</span>
        <span className={styles.autoSave}>Auto-saved</span>
      </div>
    </div>
  )
}
