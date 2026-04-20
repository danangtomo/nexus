import { useState, useCallback, useRef } from 'react'
import DropZone from '../../components/DropZone'
import { getPageCount, mergePdfs } from './handler'
import styles from './index.module.css'

export default function PdfMerger() {
  const [files, setFiles]           = useState([])
  const [merging, setMerging]       = useState(false)
  const [done, setDone]             = useState(false)
  const [outputPath, setOutputPath] = useState('')

  // Drag-to-reorder refs — only update state on drop (no re-renders mid-drag)
  const dragSrc  = useRef(null)
  const dragDest = useRef(null)

  // ── File loading ───────────────────────────────────────────────────────────
  const handleFiles = useCallback(async (incoming) => {
    setDone(false)

    // Normalise: accept File objects, {path,name} objects, or plain strings
    const toLoad = incoming
      .map((f) => {
        if (typeof f === 'string') return { path: f, name: f.split(/[\\/]/).pop() }
        const p = typeof f.path === 'string' ? f.path : ''
        const n = typeof f.name === 'string' ? f.name : p.split(/[\\/]/).pop()
        return { path: p, name: n }
      })
      .filter((f) => f.path.length > 0)

    // Add immediately with pages = null (shows "…")
    setFiles((prev) => {
      const existing = new Set(prev.map((x) => x.path))
      const fresh = toLoad.filter((f) => !existing.has(f.path))
      return [...prev, ...fresh.map((f) => ({ path: f.path, name: f.name, pages: null }))]
    })

    // Load page counts one by one, update each row as it resolves
    for (const f of toLoad) {
      try {
        const pages = await getPageCount(f.path)
        setFiles((prev) => prev.map((x) => x.path === f.path ? { ...x, pages } : x))
      } catch {
        setFiles((prev) => prev.map((x) => x.path === f.path ? { ...x, pages: '?' } : x))
      }
    }
  }, [])

  const removeFile = (path) => { setDone(false); setFiles((prev) => prev.filter((f) => f.path !== path)) }
  const clearAll   = () => { setFiles([]); setDone(false) }

  // ── Drag-to-reorder ────────────────────────────────────────────────────────
  const onDragStart = (idx) => { dragSrc.current = idx }
  const onDragEnter = (idx) => { dragDest.current = idx }
  const onDrop      = (e)   => {
    e.preventDefault()
    const src  = dragSrc.current
    const dest = dragDest.current
    if (src === null || dest === null || src === dest) return
    setFiles((prev) => {
      const next = [...prev]
      const [moved] = next.splice(src, 1)
      next.splice(dest, 0, moved)
      return next
    })
    dragSrc.current  = null
    dragDest.current = null
  }
  const onDragEnd = () => { dragSrc.current = null; dragDest.current = null }

  // ── Merge ──────────────────────────────────────────────────────────────────
  const merge = async () => {
    if (files.length < 2) return
    const savePath = await window.nexus.saveFile({
      title: 'Save merged PDF',
      defaultPath: 'merged.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (!savePath) return

    setMerging(true)
    setDone(false)
    try {
      await mergePdfs(files, savePath)
      setOutputPath(savePath)
      setDone(true)
    } catch (err) {
      alert(`Merge failed: ${err.message}`)
    } finally {
      setMerging(false)
    }
  }

  const totalPages = files.reduce(
    (acc, f) => acc + (typeof f.pages === 'number' ? f.pages : 0), 0
  )

  return (
    <div className={styles.page}>
      {files.length === 0 ? (
        <DropZone
          onFiles={handleFiles}
          accept={['pdf']}
          multiple
          label="Drop PDF files here or click to browse"
          sublabel="Add two or more PDFs to merge"
        />
      ) : (
        <div className={styles.fileSection}>
          <div className={styles.fileHeader}>
            <div className={styles.headerLeft}>
              <span className={styles.fileCount}>{files.length} PDF{files.length !== 1 ? 's' : ''}</span>
              {totalPages > 0 && (
                <span className={styles.pageCount}>{totalPages} pages total</span>
              )}
            </div>
            <div className={styles.fileActions}>
              <button className="btn btn-ghost btn-sm" onClick={clearAll} disabled={merging}>Clear all</button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={merging}
                onClick={() => document.getElementById('pdf-add-input').click()}
              >
                Add more
              </button>
              <input
                id="pdf-add-input"
                type="file"
                multiple
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={(e) =>
                  handleFiles(Array.from(e.target.files).map((f) => ({ path: f.path, name: f.name })))
                }
              />
            </div>
          </div>

          <div className={styles.fileList}>
            {files.map((f, idx) => (
              <div
                key={f.path}
                className={styles.fileRow}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragEnter={() => onDragEnter(idx)}
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={onDragEnd}
              >
                <span className={styles.dragHandle}>⠿</span>
                <span className={styles.order}>{idx + 1}</span>
                <div className={styles.fileInfo}>
                  <span className={styles.fileName}>{f.name}</span>
                </div>
                <span className={styles.pages}>
                  {typeof f.pages === 'number'
                    ? `${f.pages} page${f.pages !== 1 ? 's' : ''}`
                    : f.pages === '?' ? 'error' : '…'}
                </span>
                {!merging && (
                  <button className={styles.removeBtn} onClick={() => removeFile(f.path)}>×</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {done && (
        <div className={styles.successBanner}>
          <span>✓ Merged successfully</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => window.nexus.showItemInFolder(outputPath)}
          >
            Show in folder
          </button>
        </div>
      )}

      <div className={styles.footer}>
        {files.length > 0 && files.length < 2 && (
          <span className={styles.hint}>Add at least 2 PDFs to merge</span>
        )}
        <button
          className="btn btn-primary"
          onClick={merge}
          disabled={merging || files.length < 2}
        >
          {merging ? 'Merging…' : `Merge ${files.length} PDF${files.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
