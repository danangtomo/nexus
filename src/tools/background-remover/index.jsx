import { useState, useCallback, useRef } from 'react'
import DropZone from '../../components/DropZone'
import { INPUT_EXTS, extOf, stripBackground } from './handler'
import styles from './index.module.css'

const STAGE_LABELS = {
  'fetch:/onnxruntime-web': 'Loading inference engine',
  'fetch:/models':          'Downloading AI model',
  'compute:inference':      'Running inference',
}

function stageLabel(key) {
  for (const [prefix, label] of Object.entries(STAGE_LABELS)) {
    if (key.startsWith(prefix)) return label
  }
  return 'Processing'
}

export default function BackgroundRemover() {
  const [file,       setFile]       = useState(null)   // { path, name, ext }
  const [origUrl,    setOrigUrl]    = useState('')     // blob URL for original preview
  const [resultUrl,  setResultUrl]  = useState('')     // blob URL for result
  const [busy,       setBusy]       = useState(false)
  const [stage,      setStage]      = useState('')
  const [pct,        setPct]        = useState(0)
  const [error,      setError]      = useState('')
  const prevResult   = useRef('')
  const prevOrig     = useRef('')

  const handleFiles = useCallback(async (incoming) => {
    const raw  = incoming[0]
    const path = typeof raw === 'string' ? raw : (raw?.path ?? '')
    if (!path) return

    const name = path.split(/[\\/]/).pop()
    const ext  = extOf(path)
    if (!INPUT_EXTS.includes(ext)) {
      setError(`Unsupported format: .${ext}. Supported: ${INPUT_EXTS.join(', ')}`)
      return
    }

    if (prevResult.current) { URL.revokeObjectURL(prevResult.current); prevResult.current = '' }
    if (prevOrig.current)   { URL.revokeObjectURL(prevOrig.current);   prevOrig.current   = '' }

    setFile({ path, name, ext })
    setResultUrl('')
    setError('')
    setStage('')
    setPct(0)

    // Build blob URL for original preview (avoids file:// COEP issues)
    try {
      const b64  = await window.nexus.readFile(path, 'base64')
      const raw2 = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      const blob = new Blob([raw2], { type: mime })
      const url  = URL.createObjectURL(blob)
      prevOrig.current = url
      setOrigUrl(url)
    } catch {
      setOrigUrl('')
    }
  }, [])

  const handleRemove = async () => {
    setBusy(true)
    setResultUrl('')
    setError('')
    setStage('Starting…')
    setPct(0)
    try {
      const blobUrl = await stripBackground(file.path, ({ key, pct: p }) => {
        setStage(stageLabel(key))
        setPct(p)
      })
      prevResult.current = blobUrl
      setResultUrl(blobUrl)
    } catch (err) {
      setError(`Processing failed: ${err.message}`)
    } finally {
      setBusy(false)
      setStage('')
      setPct(0)
    }
  }

  const handleDownload = () => {
    const base = file.name.replace(/\.[^.]+$/, '')
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = `${base}_nobg.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const reset = () => {
    if (prevResult.current) { URL.revokeObjectURL(prevResult.current); prevResult.current = '' }
    if (prevOrig.current)   { URL.revokeObjectURL(prevOrig.current);   prevOrig.current   = '' }
    setFile(null)
    setOrigUrl('')
    setResultUrl('')
    setError('')
    setStage('')
    setPct(0)
  }

  return (
    <div className={styles.page}>
      {!file ? (
        <>
          <DropZone
            onFiles={handleFiles}
            accept={INPUT_EXTS}
            multiple={false}
            label="Drop an image here or click to browse"
            sublabel="JPEG, PNG, WEBP supported — background removed locally"
          />
          <p className={styles.note}>
            AI model (~25 MB) is downloaded once on first use and cached permanently.
          </p>
        </>
      ) : (
        <div className={styles.fileBar}>
          <span className={styles.fileName}>{file.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Change</button>
        </div>
      )}

      {file && (
        <div className={styles.preview}>
          <div className={styles.previewPanel}>
            <p className={styles.panelLabel}>Original</p>
            <div className={styles.imgWrap}>
              <img src={origUrl} alt="Original" className={styles.img} />
            </div>
          </div>

          <div className={styles.previewPanel}>
            <p className={styles.panelLabel}>Result</p>
            <div className={`${styles.imgWrap} ${styles.checker}`}>
              {resultUrl ? (
                <img src={resultUrl} alt="Result" className={styles.img} />
              ) : busy ? (
                <div className={styles.busyState}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                  </div>
                  <p className={styles.stageText}>{stage} {pct > 0 ? `${pct}%` : ''}</p>
                </div>
              ) : (
                <p className={styles.placeholder}>Run removal to see result</p>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {file && (
        <div className={styles.footer}>
          {resultUrl && (
            <button className="btn btn-secondary" onClick={handleDownload}>
              Download PNG
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={handleRemove}
            disabled={busy}
          >
            {busy ? 'Processing…' : resultUrl ? 'Run Again' : 'Remove Background'}
          </button>
        </div>
      )}
    </div>
  )
}
