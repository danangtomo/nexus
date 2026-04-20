import { useState, useCallback } from 'react'
import DropZone from '../../components/DropZone'
import { compressImages, qualityLabel } from './handler'
import styles from './index.module.css'

const ACCEPTS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff']

function fmtSize(bytes) {
  if (bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function sizeDelta(inSize, outSize) {
  if (!inSize || !outSize) return null
  return ((outSize - inSize) / inSize * 100).toFixed(1)
}

export default function ImageCompressor() {
  const [files, setFiles]   = useState([])
  const [quality, setQuality] = useState(80)
  const [running, setRunning] = useState(false)

  const handleFiles = useCallback((incoming) => {
    const mapped = incoming.map((f) => ({
      path: f.path ?? f,
      name: f.name ?? (f.path ?? f).split(/[\\/]/).pop(),
      status: 'pending',
    }))
    setFiles((prev) => {
      const existing = new Set(prev.map((x) => x.path))
      return [...prev, ...mapped.filter((f) => !existing.has(f.path))]
    })
  }, [])

  const removeFile = (path) => setFiles((prev) => prev.filter((f) => f.path !== path))
  const clearAll   = () => setFiles([])

  const updateFile = useCallback((path, update) =>
    setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, ...update } : f))),
  [])

  const compress = async () => {
    if (!files.length) return
    setRunning(true)
    setFiles((prev) => prev.map((f) => ({
      ...f, status: 'pending', outputPath: undefined, inputSize: undefined, outputSize: undefined, error: undefined,
    })))
    await compressImages(files, { quality }, updateFile)
    setRunning(false)
  }

  const doneCount  = files.filter((f) => f.status === 'done').length
  const errorCount = files.filter((f) => f.status === 'error').length

  // Total bytes saved across completed files
  const totalSaved = files.reduce((acc, f) => {
    if (f.status === 'done' && f.inputSize && f.outputSize) {
      return acc + (f.inputSize - f.outputSize)
    }
    return acc
  }, 0)

  return (
    <div className={styles.page}>
      {/* Quality control */}
      <div className={styles.controls}>
        <div className={styles.qualRow}>
          <div className={styles.qualLeft}>
            <span className={styles.label}>Quality</span>
            <span className={styles.qualNum}>{quality}</span>
            <span className={styles.qualTag}>{qualityLabel(quality)}</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className={styles.slider}
          />
        </div>
        <p className={styles.hint}>
          Applies to JPEG · WEBP · AVIF · TIFF. PNG uses lossless compression regardless of quality.
        </p>
      </div>

      {/* Drop zone */}
      {files.length === 0 && (
        <DropZone
          onFiles={handleFiles}
          accept={ACCEPTS}
          multiple
          label="Drop images here or click to browse"
          sublabel="JPG · PNG · WEBP · AVIF · TIFF"
        />
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className={styles.fileSection}>
          <div className={styles.fileHeader}>
            <span className={styles.fileCount}>{files.length} file{files.length !== 1 ? 's' : ''}</span>
            <div className={styles.fileActions}>
              <button className="btn btn-ghost btn-sm" onClick={clearAll} disabled={running}>Clear all</button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={running}
                onClick={() => document.getElementById('comp-add-input').click()}
              >
                Add more
              </button>
              <input
                id="comp-add-input"
                type="file"
                multiple
                accept={ACCEPTS.map((e) => `.${e}`).join(',')}
                style={{ display: 'none' }}
                onChange={(e) =>
                  handleFiles(Array.from(e.target.files).map((f) => ({ path: f.path, name: f.name })))
                }
              />
            </div>
          </div>

          <div className={styles.fileList}>
            {files.map((f) => {
              const delta = sizeDelta(f.inputSize, f.outputSize)
              return (
                <div key={f.path} className={styles.fileRow}>
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{f.name}</span>
                    {f.status === 'done' && (
                      <span className={styles.sizeInfo}>
                        {fmtSize(f.inputSize)} → {fmtSize(f.outputSize)}
                        {delta !== null && (
                          <span className={parseFloat(delta) < 0 ? styles.smaller : styles.larger}>
                            {' '}({parseFloat(delta) > 0 ? '+' : ''}{delta}%)
                          </span>
                        )}
                      </span>
                    )}
                    {f.status === 'error' && <span className={styles.errorMsg}>{f.error}</span>}
                  </div>
                  <div className={styles.fileRight}>
                    <StatusBadge status={f.status} />
                    {f.status === 'done' && (
                      <button
                        className={styles.openBtn}
                        title="Show in folder"
                        onClick={() => window.nexus.showItemInFolder(f.outputPath)}
                      >↗</button>
                    )}
                    {!running && (
                      <button className={styles.removeBtn} onClick={() => removeFile(f.path)}>×</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary */}
          {!running && doneCount > 0 && (
            <div className={styles.summary}>
              <span className={styles.summaryDone}>✓ {doneCount} compressed</span>
              {totalSaved > 0 && (
                <span className={styles.summarySaved}>saved {fmtSize(totalSaved)}</span>
              )}
              {errorCount > 0 && <span className={styles.summaryErr}>✗ {errorCount} failed</span>}
            </div>
          )}
        </div>
      )}

      {/* Action button */}
      <div className={styles.footer}>
        <button
          className="btn btn-primary"
          onClick={compress}
          disabled={running || files.length === 0}
        >
          {running
            ? `Compressing… (${doneCount + errorCount}/${files.length})`
            : `Compress ${files.length > 0 ? files.length + ' ' : ''}file${files.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    pending:     { label: 'Pending',     cls: styles.badgePending },
    compressing: { label: 'Compressing', cls: styles.badgeRunning },
    done:        { label: 'Done',        cls: styles.badgeDone },
    error:       { label: 'Error',       cls: styles.badgeError },
  }
  const { label, cls } = map[status] || map.pending
  return <span className={`${styles.badge} ${cls}`}>{label}</span>
}
