import { useState, useCallback } from 'react'
import DropZone from '../../components/DropZone'
import { INPUT_EXTS, loadMetadata, stripAndSave, buildMetaRows, hasAnyMetadata } from './handler'
import styles from './index.module.css'

export default function MetadataRemover() {
  const [file,       setFile]       = useState(null)   // { path, name }
  const [thumb,      setThumb]      = useState('')      // base64 data URL
  const [meta,       setMeta]       = useState(null)    // Sharp metadata object
  const [busy,       setBusy]       = useState(false)
  const [outputPath, setOutputPath] = useState('')
  const [error,      setError]      = useState('')

  const handleFiles = useCallback(async (incoming) => {
    setOutputPath(''); setError(''); setMeta(null); setThumb('')
    const raw  = incoming[0]
    const path = typeof raw === 'string' ? raw : (raw?.path ?? '')
    if (!path) return
    const name = path.split(/[\\/]/).pop()
    const ext  = name.split('.').pop().toLowerCase()
    if (!INPUT_EXTS.includes(ext)) {
      setError(`Unsupported format: .${ext}. Supported: ${INPUT_EXTS.join(', ')}`)
      return
    }
    setFile({ path, name })
    setBusy(true)
    try {
      const [thumbData, metaData] = await Promise.all([
        window.nexus.sharp.thumbnail(path, 240),
        loadMetadata(path),
      ])
      setThumb(thumbData)
      setMeta(metaData)
    } catch (err) {
      setError(`Failed to read file: ${err.message}`)
      setFile(null)
    } finally {
      setBusy(false)
    }
  }, [])

  const handleStrip = async () => {
    const ext  = file.name.split('.').pop().toLowerCase()
    const base = file.name.replace(/\.[^.]+$/, '')
    const savePath = await window.nexus.saveFile({
      title: 'Save cleaned image',
      defaultPath: `${base}_clean.${ext}`,
      filters: [{ name: 'Image', extensions: [ext] }],
    })
    if (!savePath) return

    setBusy(true); setOutputPath(''); setError('')
    try {
      await stripAndSave(file.path, savePath)
      setOutputPath(savePath)
    } catch (err) {
      setError(`Strip failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null); setThumb(''); setMeta(null); setOutputPath(''); setError('')
  }

  const metaRows = meta ? buildMetaRows(meta) : []
  const hasMeta  = meta ? hasAnyMetadata(meta) : false

  return (
    <div className={styles.page}>
      {!file ? (
        <DropZone
          onFiles={handleFiles}
          accept={INPUT_EXTS}
          multiple={false}
          label="Drop an image here or click to browse"
          sublabel="JPEG, PNG, WEBP, TIFF, AVIF supported"
        />
      ) : (
        <div className={styles.fileBar}>
          <div className={styles.fileBarLeft}>
            <span className={styles.fileName}>{file.name}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Change</button>
        </div>
      )}

      {busy && !meta && <p className={styles.loadingText}>Reading metadata…</p>}

      {meta && (
        <div className={styles.content}>
          {/* Thumbnail */}
          {thumb && (
            <div className={styles.thumbWrap}>
              <img src={thumb} alt="Preview" className={styles.thumb} />
            </div>
          )}

          {/* Metadata table */}
          <div className={styles.metaPanel}>
            <p className={styles.sectionLabel}>File metadata</p>
            <div className={styles.metaTable}>
              {metaRows.map((row) => (
                <div key={row.label} className={styles.metaRow}>
                  <span className={styles.metaKey}>{row.label}</span>
                  <span className={styles.metaVal}>{row.value}</span>
                </div>
              ))}
            </div>

            {hasMeta ? (
              <div className={styles.warningBanner}>
                This file contains embedded metadata (EXIF / ICC / XMP). Click below to remove it.
              </div>
            ) : (
              <div className={styles.cleanBanner}>
                No embedded metadata found — this file is already clean.
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {outputPath && (
        <div className={styles.successBanner}>
          <span>Metadata stripped successfully</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => window.nexus.showItemInFolder(outputPath)}
          >
            Show in folder
          </button>
        </div>
      )}

      {file && meta && (
        <div className={styles.footer}>
          <button
            className="btn btn-primary"
            onClick={handleStrip}
            disabled={busy}
          >
            {busy ? 'Processing…' : 'Strip Metadata & Save'}
          </button>
        </div>
      )}
    </div>
  )
}
