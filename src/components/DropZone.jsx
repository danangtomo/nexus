import { useState, useCallback } from 'react'
import styles from './DropZone.module.css'

export default function DropZone({ onFiles, accept, multiple = false, label, sublabel }) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragging(false)
      const files = Array.from(e.dataTransfer.files)
      if (!files.length) return
      if (!multiple) onFiles([files[0]])
      else onFiles(files)
    },
    [onFiles, multiple]
  )

  const handleBrowse = async () => {
    const paths = await window.nexus[multiple ? 'openFiles' : 'openFile']({
      filters: accept ? [{ name: 'Files', extensions: accept }] : undefined,
    })
    if (!paths) return
    const result = Array.isArray(paths) ? paths : [paths]
    onFiles(result.map((p) => ({ path: p, name: p.split(/[\\/]/).pop() })))
  }

  return (
    <div
      className={`${styles.zone} ${dragging ? styles.dragging : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={handleBrowse}
    >
      <div className={styles.icon}>📂</div>
      <p className={styles.label}>{label || 'Drop files here or click to browse'}</p>
      {sublabel && <p className={styles.sublabel}>{sublabel}</p>}
    </div>
  )
}
