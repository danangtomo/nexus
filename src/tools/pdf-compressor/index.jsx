import { useState, useCallback } from 'react'
import DropZone from '../../components/DropZone'
import { getFileSize, compressPdf } from './handler'
import styles from './index.module.css'

const QUALITY_OPTIONS = [
  { id: 'screen',  label: 'Small',    desc: '~72 DPI — smallest file, screen viewing only' },
  { id: 'ebook',   label: 'Balanced', desc: '~150 DPI — good quality, much smaller file' },
  { id: 'printer', label: 'Quality',  desc: '~300 DPI — high quality, moderate reduction' },
]

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function PdfCompressor() {
  const [file,       setFile]       = useState(null)   // { path, name, size }
  const [quality,    setQuality]    = useState('ebook')
  const [busy,       setBusy]       = useState(false)
  const [result,     setResult]     = useState(null)   // { path, size }
  const [error,      setError]      = useState('')

  const handleFiles = useCallback(async (incoming) => {
    setResult(null)
    setError('')
    const raw  = incoming[0]
    const path = typeof raw === 'string' ? raw : (raw?.path ?? '')
    const name = path.split(/[\\/]/).pop()
    if (!path) return
    try {
      const size = await getFileSize(path)
      setFile({ path, name, size })
    } catch (err) {
      setError(`Could not read file: ${err.message}`)
    }
  }, [])

  const handleCompress = async () => {
    const baseName = file.name.replace(/\.pdf$/i, '')
    const savePath = await window.nexus.saveFile({
      title: 'Save compressed PDF',
      defaultPath: `${baseName}_compressed.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (!savePath) return

    setBusy(true)
    setResult(null)
    setError('')
    try {
      await compressPdf(file.path, quality, savePath)
      const size = await getFileSize(savePath)
      setResult({ path: savePath, size })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setFile(null); setResult(null); setError('') }

  const savings = result
    ? Math.round((1 - result.size / file.size) * 100)
    : null

  return (
    <div className={styles.page}>
      {!file ? (
        <DropZone
          onFiles={handleFiles}
          accept={['pdf']}
          multiple={false}
          label="Drop a PDF here or click to browse"
          sublabel="Reduce file size by resampling images"
        />
      ) : (
        <>
          {/* File bar */}
          <div className={styles.fileBar}>
            <div className={styles.fileBarLeft}>
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileSize}>{fmtSize(file.size)}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Change file</button>
          </div>

          {/* Quality selector */}
          <div className={styles.qualitySection}>
            <p className={styles.sectionLabel}>Compression level</p>
            <div className={styles.qualityList}>
              {QUALITY_OPTIONS.map((q) => (
                <button
                  key={q.id}
                  className={`${styles.qualityCard} ${quality === q.id ? styles.qualityActive : ''}`}
                  onClick={() => { setQuality(q.id); setResult(null) }}
                >
                  <span className={styles.qualityLabel}>{q.label}</span>
                  <span className={styles.qualityDesc}>{q.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && <p className={styles.error}>{error}</p>}

          {/* Result */}
          {result && (
            <div className={styles.resultBanner}>
              <div className={styles.resultLeft}>
                <span className={styles.resultCheck}>✓</span>
                <div className={styles.resultSizes}>
                  <span>{fmtSize(file.size)}</span>
                  <span className={styles.arrow}>→</span>
                  <span className={styles.newSize}>{fmtSize(result.size)}</span>
                  {savings > 0
                    ? <span className={styles.savings}>{savings}% smaller</span>
                    : <span className={styles.noSavings}>No reduction (file already optimised)</span>
                  }
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => window.nexus.showItemInFolder(result.path)}
              >
                Show in folder
              </button>
            </div>
          )}
        </>
      )}

      {file && (
        <div className={styles.footer}>
          <button
            className="btn btn-primary"
            onClick={handleCompress}
            disabled={busy}
          >
            {busy ? 'Compressing…' : 'Compress PDF'}
          </button>
        </div>
      )}
    </div>
  )
}
