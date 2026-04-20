import { useState, useCallback, useRef } from 'react'
import DropZone from '../../components/DropZone'
import { getPageCount, mergePdfs } from './handler'
import styles from './index.module.css'

export default function PdfMerger() {
  const [files, setFiles]     = useState([])  // [{path, name, pages}]
  const [merging, setMerging] = useState(false)
  const [done, setDone]       = useState(false)
  const [outputPath, setOutputPath] = useState('')
  const dragIdx = useRef(null)

  const handleFiles = useCallback(async (incoming) => {
    setDone(false)
    const newFiles = []
    for (const f of incoming) {
      const path = f.path ?? f
      const name = f.name ?? path.split(/[\\/]/).pop()
      // skip duplicates
      setFiles((prev) => {
        if (prev.find((x) => x.path === path)) return prev
        return prev // add after page count loads
      })
      try {
        const pages = await getPageCount(path)
        newFiles.push({ path, name, pages })
      } catch {
        newFiles.push({ path, name, pages: '?' })
      }
    }
    setFiles((prev) => {
      const existing = new Set(prev.map((x) => x.path))
      return [...prev, ...newFiles.filter((f) => !existing.has(f.path))]
    })
  }, [])

  const removeFile = (path) => {
    setDone(false)
    setFiles((prev) => prev.filter((f) => f.path !== path))
  }

  const clearAll = () => { setFiles([]); setDone(false) }

  // ── Drag-to-reorder ────────────────────────────────────────────────────────
  const onDragStart = (idx) => { dragIdx.current = idx }

  const onDragOver = (e, idx) => {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === idx) return
    setFiles((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx.current, 1)
      next.splice(idx, 0, moved)
      dragIdx.current = idx
      return next
    })
  }

  const onDragEnd = () => { dragIdx.current = null }

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

  const totalPages = files.reduce((acc, f) => acc + (typeof f.pages === 'number' ? f.pages : 0), 0)

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
                onDragOver={(e) => onDragOver(e, idx)}
                onDragEnd={onDragEnd}
              >
                <span className={styles.dragHandle}>⠿</span>
                <span className={styles.order}>{idx + 1}</span>
                <div className={styles.fileInfo}>
                  <span className={styles.fileName}>{f.name}</span>
                </div>
                <span className={styles.pages}>
                  {typeof f.pages === 'number' ? `${f.pages} page${f.pages !== 1 ? 's' : ''}` : '…'}
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
