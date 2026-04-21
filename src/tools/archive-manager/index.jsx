import { useState, useCallback } from 'react'
import { COMPRESS_FORMATS, listArchive, extractArchive, compressFiles, formatBytes } from './handler'
import styles from './index.module.css'

// ── Compress mode ─────────────────────────────────────────────────────────────

function CompressPane() {
  const [files,      setFiles]      = useState([])   // [{ path, name, isDir }]
  const [format,     setFormat]     = useState('zip')
  const [busy,       setBusy]       = useState(false)
  const [result,     setResult]     = useState(null) // { outputPath, size }
  const [error,      setError]      = useState('')

  const addPaths = useCallback((paths) => {
    setResult(null); setError('')
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.path))
      const next = [...prev]
      for (const p of paths) {
        if (!existing.has(p)) {
          next.push({ path: p, name: p.split(/[\\/]/).pop() })
          existing.add(p)
        }
      }
      return next
    })
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const paths = Array.from(e.dataTransfer.files).map((f) => f.path)
    if (paths.length) addPaths(paths)
  }, [addPaths])

  const handleAddFiles = async () => {
    const paths = await window.nexus.openFiles({
      title: 'Select files to compress',
    })
    if (paths?.length) addPaths(paths)
  }

  const handleAddFolder = async () => {
    const dir = await window.nexus.openDirectory({ title: 'Select folder to compress' })
    if (dir) addPaths([dir])
  }

  const handleRemove = (path) => setFiles((prev) => prev.filter((f) => f.path !== path))

  const handleCompress = async () => {
    if (!files.length) return
    const fmt = COMPRESS_FORMATS.find((f) => f.ext === format)
    const outputPath = await window.nexus.saveFile({
      title: 'Save archive',
      defaultPath: `archive.${fmt.ext}`,
      filters: [{ name: fmt.label, extensions: [fmt.ext === 'tar.gz' ? 'gz' : fmt.ext] }],
    })
    if (!outputPath) return

    setBusy(true); setResult(null); setError('')
    try {
      const res = await compressFiles(files.map((f) => f.path), outputPath, format)
      setResult({ outputPath, size: res.size })
    } catch (err) {
      setError(`Compression failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.pane}>
      {/* Drop zone / file list */}
      <div
        className={`${styles.dropArea} ${files.length ? styles.dropAreaFilled : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {files.length === 0 ? (
          <p className={styles.dropHint}>Drop files or folders here</p>
        ) : (
          <ul className={styles.fileList}>
            {files.map((f) => (
              <li key={f.path} className={styles.fileItem}>
                <span className={styles.fileItemName} title={f.path}>{f.name}</span>
                <button
                  className={styles.removeBtn}
                  onClick={() => handleRemove(f.path)}
                  disabled={busy}
                  title="Remove"
                >✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.addBtns}>
        <button className="btn btn-ghost btn-sm" onClick={handleAddFiles} disabled={busy}>
          + Add Files
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handleAddFolder} disabled={busy}>
          + Add Folder
        </button>
      </div>

      {/* Format selector */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>Output format</p>
        <div className={styles.formatRow}>
          {COMPRESS_FORMATS.map((f) => (
            <button
              key={f.ext}
              className={`${styles.fmtBtn} ${format === f.ext ? styles.fmtActive : ''}`}
              onClick={() => { setFormat(f.ext); setResult(null) }}
              disabled={busy}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {result && (
        <div className={styles.successBanner}>
          <span>Archive created — {formatBytes(result.size)}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => window.nexus.showItemInFolder(result.outputPath)}
          >
            Show in folder
          </button>
        </div>
      )}

      <div className={styles.footer}>
        <button
          className="btn btn-primary"
          onClick={handleCompress}
          disabled={busy || files.length === 0}
        >
          {busy ? 'Compressing…' : `Compress to ${format.toUpperCase()}`}
        </button>
      </div>
    </div>
  )
}

// ── Extract mode ──────────────────────────────────────────────────────────────

function ExtractPane() {
  const [file,    setFile]    = useState(null)   // { path, name }
  const [entries, setEntries] = useState(null)   // [{ name, isDir, date }]
  const [busy,    setBusy]    = useState(false)
  const [result,  setResult]  = useState(null)   // { outputDir, count }
  const [error,   setError]   = useState('')

  const loadArchive = useCallback(async (filePath) => {
    const name = filePath.split(/[\\/]/).pop()
    setFile({ path: filePath, name })
    setEntries(null); setResult(null); setError('')
    try {
      const list = await listArchive(filePath)
      setEntries(list)
    } catch (err) {
      setError(`Could not read archive: ${err.message}`)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
    if (!dropped[0]) return
    const p = dropped[0].path
    if (!p.toLowerCase().endsWith('.zip')) {
      setError('Only ZIP archives are supported for extraction')
      return
    }
    loadArchive(p)
  }, [loadArchive])

  const handleBrowse = async () => {
    const p = await window.nexus.openFile({
      title: 'Select ZIP archive',
      filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
    })
    if (p) loadArchive(p)
  }

  const handleExtract = async () => {
    const outputDir = await window.nexus.openDirectory({ title: 'Extract to folder' })
    if (!outputDir) return

    setBusy(true); setResult(null); setError('')
    try {
      const res = await extractArchive(file.path, outputDir)
      setResult({ outputDir, count: res.count })
    } catch (err) {
      setError(`Extraction failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setFile(null); setEntries(null); setResult(null); setError('') }

  const dirs  = entries?.filter((e) => e.isDir)  ?? []
  const files = entries?.filter((e) => !e.isDir) ?? []

  return (
    <div className={styles.pane}>
      {!file ? (
        <div
          className={styles.dropArea}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <p className={styles.dropHint}>Drop a ZIP file here</p>
          <button className="btn btn-ghost btn-sm" onClick={handleBrowse}>Browse…</button>
        </div>
      ) : (
        <div className={styles.fileBar}>
          <div className={styles.fileBarLeft}>
            <span className={styles.fileName}>{file.name}</span>
            {entries && (
              <span className={styles.metaTag}>
                {files.length} file{files.length !== 1 ? 's' : ''}, {dirs.length} folder{dirs.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Change</button>
        </div>
      )}

      {/* Entry list preview */}
      {entries && entries.length > 0 && (
        <div className={styles.entryList}>
          {entries.slice(0, 200).map((entry) => (
            <div key={entry.name} className={`${styles.entryRow} ${entry.isDir ? styles.entryDir : ''}`}>
              <span className={styles.entryIcon}>{entry.isDir ? '📁' : '📄'}</span>
              <span className={styles.entryName} title={entry.name}>{entry.name}</span>
            </div>
          ))}
          {entries.length > 200 && (
            <p className={styles.moreNote}>…and {entries.length - 200} more entries</p>
          )}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {result && (
        <div className={styles.successBanner}>
          <span>Extracted {result.count} file{result.count !== 1 ? 's' : ''}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => window.nexus.showItemInFolder(result.outputDir)}
          >
            Open folder
          </button>
        </div>
      )}

      {file && (
        <div className={styles.footer}>
          <button
            className="btn btn-primary"
            onClick={handleExtract}
            disabled={busy || !entries}
          >
            {busy ? 'Extracting…' : 'Extract to folder…'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────

export default function ArchiveManager() {
  const [mode, setMode] = useState('compress')

  return (
    <div className={styles.page}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${mode === 'compress' ? styles.tabActive : ''}`}
          onClick={() => setMode('compress')}
        >
          Compress
        </button>
        <button
          className={`${styles.tab} ${mode === 'extract' ? styles.tabActive : ''}`}
          onClick={() => setMode('extract')}
        >
          Extract
        </button>
      </div>

      {mode === 'compress' ? <CompressPane /> : <ExtractPane />}
    </div>
  )
}
