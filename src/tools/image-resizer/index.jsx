import { useState, useCallback, useRef } from 'react'
import DropZone from '../../components/DropZone'
import { resizeImages } from './handler'
import styles from './index.module.css'

const ACCEPTS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'tiff']

const FIT_MODES = [
  { value: 'inside',   label: 'Inside',   desc: 'Fit within box, keep ratio' },
  { value: 'cover',    label: 'Cover',    desc: 'Fill box, crop excess' },
  { value: 'fill',     label: 'Fill',     desc: 'Stretch to exact size' },
  { value: 'contain',  label: 'Contain',  desc: 'Letterbox with background' },
  { value: 'outside',  label: 'Outside',  desc: 'Fit outside box, keep ratio' },
]

function fmtSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function ImageResizer() {
  const [files, setFiles]               = useState([])
  const [mode, setMode]                 = useState('pixels')   // 'pixels' | 'percent'
  const [width, setWidth]               = useState('')
  const [height, setHeight]             = useState('')
  const [percent, setPercent]           = useState(50)
  const [aspectLock, setAspectLock]     = useState(true)
  const [fit, setFit]                   = useState('inside')
  const [noEnlarge, setNoEnlarge]       = useState(true)
  const [outputDir, setOutputDir]       = useState('')
  const [running, setRunning]           = useState(false)
  const aspectRatio                     = useRef(null)  // w/h ratio when lock engaged

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

  const updateFile = useCallback((path, update) =>
    setFiles((prev) => prev.map((f) => f.path === path ? { ...f, ...update } : f)), [])

  // When aspect lock is on and user changes width, auto-update height
  const handleWidthChange = (val) => {
    setWidth(val)
    if (aspectLock && aspectRatio.current && val !== '') {
      setHeight(String(Math.round(Number(val) / aspectRatio.current)))
    }
  }

  const handleHeightChange = (val) => {
    setHeight(val)
    if (aspectLock && aspectRatio.current && val !== '') {
      setWidth(String(Math.round(Number(val) * aspectRatio.current)))
    }
  }

  // When a single file is added, pre-read its dimensions for aspect lock
  const onFilesWithMeta = useCallback(async (incoming) => {
    handleFiles(incoming)
    if (incoming.length === 1 && aspectLock) {
      try {
        const p = incoming[0].path ?? incoming[0]
        const meta = await window.nexus.sharp.metadata(p)
        if (meta.width && meta.height) {
          aspectRatio.current = meta.width / meta.height
          if (!width && !height) {
            setWidth(String(meta.width))
            setHeight(String(meta.height))
          }
        }
      } catch {}
    }
  }, [handleFiles, aspectLock, width, height])

  const pickOutputDir = async () => {
    const dir = await window.nexus.openDirectory({ title: 'Choose output folder' })
    if (dir) setOutputDir(dir)
  }

  const resize = async () => {
    if (!files.length) return
    let dir = outputDir
    if (!dir) {
      dir = await window.nexus.openDirectory({ title: 'Choose output folder' })
      if (!dir) return
      setOutputDir(dir)
    }

    setRunning(true)
    setFiles((prev) => prev.map((f) => ({
      ...f, status: 'pending', outputPath: undefined,
      outputSize: undefined, inputSize: undefined, outWidth: undefined, outHeight: undefined, error: undefined,
    })))

    await resizeImages(files, {
      mode,
      width:  width  ? Number(width)  : undefined,
      height: height ? Number(height) : undefined,
      percent: Number(percent),
      fit,
      aspectLock,
      withoutEnlargement: noEnlarge,
      outputDir: dir,
    }, updateFile)

    setRunning(false)
  }

  const doneCount  = files.filter((f) => f.status === 'done').length
  const errorCount = files.filter((f) => f.status === 'error').length

  return (
    <div className={styles.page}>

      {/* Mode toggle */}
      <div className={styles.modeRow}>
        <button
          className={`${styles.modeBtn} ${mode === 'pixels' ? styles.modeActive : ''}`}
          onClick={() => setMode('pixels')}
        >Pixels</button>
        <button
          className={`${styles.modeBtn} ${mode === 'percent' ? styles.modeActive : ''}`}
          onClick={() => setMode('percent')}
        >Percent</button>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {mode === 'pixels' ? (
          <div className={styles.pixelInputs}>
            <div className={styles.dimGroup}>
              <label className={styles.label}>Width (px)</label>
              <input
                type="number"
                min={1}
                value={width}
                onChange={(e) => handleWidthChange(e.target.value)}
                placeholder="auto"
                className={styles.dimInput}
              />
            </div>

            <button
              className={`${styles.lockBtn} ${aspectLock ? styles.lockActive : ''}`}
              onClick={() => setAspectLock((v) => !v)}
              title={aspectLock ? 'Aspect ratio locked' : 'Aspect ratio free'}
            >
              {aspectLock ? '🔒' : '🔓'}
            </button>

            <div className={styles.dimGroup}>
              <label className={styles.label}>Height (px)</label>
              <input
                type="number"
                min={1}
                value={height}
                onChange={(e) => handleHeightChange(e.target.value)}
                placeholder="auto"
                className={styles.dimInput}
              />
            </div>
          </div>
        ) : (
          <div className={styles.controlGroup}>
            <label className={styles.label}>
              Scale <span className={styles.accentVal}>{percent}%</span>
            </label>
            <div className={styles.percentRow}>
              <input
                type="range" min={1} max={200} value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                className={styles.slider}
              />
              <input
                type="number" min={1} max={200} value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                className={styles.percentNum}
              />
            </div>
          </div>
        )}

        <div className={styles.controlGroup}>
          <label className={styles.label}>Fit mode</label>
          <div className={styles.fitGrid}>
            {FIT_MODES.map((fm) => (
              <button
                key={fm.value}
                className={`${styles.fitBtn} ${fit === fm.value ? styles.fitActive : ''}`}
                onClick={() => setFit(fm.value)}
                title={fm.desc}
              >
                {fm.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.controlGroup}>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={noEnlarge} onChange={(e) => setNoEnlarge(e.target.checked)} />
            <span>Don't enlarge smaller images</span>
          </label>
        </div>

        <div className={styles.controlGroup}>
          <label className={styles.label}>Output folder</label>
          <div className={styles.dirRow}>
            <span className={styles.dirPath}>{outputDir || 'Choose before resizing'}</span>
            <button className="btn btn-ghost" onClick={pickOutputDir}>Browse</button>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      {files.length === 0 && (
        <DropZone
          onFiles={onFilesWithMeta}
          accept={ACCEPTS}
          multiple
          label="Drop images here or click to browse"
          sublabel="JPG · PNG · WEBP · AVIF · BMP · TIFF"
        />
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className={styles.fileSection}>
          <div className={styles.fileHeader}>
            <span className={styles.fileCount}>{files.length} file{files.length !== 1 ? 's' : ''}</span>
            <div className={styles.fileActions}>
              <button className="btn btn-ghost" onClick={() => setFiles([])} disabled={running}>Clear all</button>
              <button className="btn btn-ghost" disabled={running} onClick={async () => {
                const paths = await window.nexus.openFiles({ filters: [{ name: 'Images', extensions: ACCEPTS }] })
                if (paths?.length) onFilesWithMeta(paths.map((p) => ({ path: p, name: p.split(/[\\/]/).pop() })))
              }}>Add more</button>
            </div>
          </div>

          <div className={styles.fileList}>
            {files.map((f) => (
              <div key={f.path} className={styles.fileRow}>
                <div className={styles.fileInfo}>
                  <span className={styles.fileName}>{f.name}</span>
                  {f.status === 'done' && (
                    <span className={styles.sizeInfo}>
                      {fmtSize(f.inputSize)} → {fmtSize(f.outputSize)}
                      {f.outWidth && f.outHeight && (
                        <span className={styles.dims}> · {f.outWidth}×{f.outHeight}px</span>
                      )}
                    </span>
                  )}
                  {f.status === 'error' && (
                    <span className={styles.errorMsg}>{f.error}</span>
                  )}
                </div>
                <div className={styles.fileRight}>
                  <StatusBadge status={f.status} />
                  {f.status === 'done' && (
                    <button className={styles.openBtn} onClick={() => window.nexus.showItemInFolder(f.outputPath)} title="Show in folder">↗</button>
                  )}
                  {!running && (
                    <button className={styles.removeBtn} onClick={() => setFiles((p) => p.filter((x) => x.path !== f.path))}>×</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!running && doneCount > 0 && (
            <div className={styles.summary}>
              <span className={styles.summaryDone}>✓ {doneCount} resized</span>
              {errorCount > 0 && <span className={styles.summaryErr}>✗ {errorCount} failed</span>}
              {outputDir && (
                <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => window.nexus.showItemInFolder(outputDir)}>
                  Open folder
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className={styles.footer}>
        <button
          className="btn btn-primary"
          onClick={resize}
          disabled={running || files.length === 0}
        >
          {running
            ? `Resizing… (${doneCount + errorCount}/${files.length})`
            : `Resize ${files.length > 0 ? files.length : ''} image${files.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    pending:    { label: 'Pending',    cls: styles.badgePending },
    converting: { label: 'Resizing',   cls: styles.badgeConverting },
    done:       { label: 'Done',       cls: styles.badgeDone },
    error:      { label: 'Error',      cls: styles.badgeError },
  }
  const { label, cls } = map[status] || map.pending
  return <span className={`${styles.badge} ${cls}`}>{label}</span>
}
