import { useState, useCallback, useRef } from 'react'
import DropZone from '../../components/DropZone'
import { INPUT_EXTS, extOf, stripBackground } from './handler'
import styles from './index.module.css'

const STAGE_LABELS = {
  'download': 'Downloading RMBG-1.4 model',
  'inference': 'Removing background',
}

function stageLabel(key) {
  return STAGE_LABELS[key] ?? 'Processing'
}

const BG_PRESETS = [
  { id: 'checker', label: 'Transparent' },
  { id: '#ffffff', label: 'White' },
  { id: '#f0f0f0', label: 'Light gray' },
  { id: '#000000', label: 'Black' },
  { id: '#1a1a2e', label: 'Dark navy' },
  { id: '#e8f4f8', label: 'Light blue' },
]

export default function BackgroundRemover() {
  const [file,        setFile]        = useState(null)
  const [origUrl,     setOrigUrl]     = useState('')
  const [resultUrl,   setResultUrl]   = useState('')
  const [busy,        setBusy]        = useState(false)
  const [stage,       setStage]       = useState('')
  const [pct,         setPct]         = useState(0)
  const [error,       setError]       = useState('')
  const [bgColor,     setBgColor]     = useState('checker')
  const [customColor, setCustomColor] = useState('#ffffff')
  const prevResult  = useRef('')
  const prevOrig    = useRef('')

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
            sublabel="JPEG, PNG, WEBP supported — powered by RMBG-1.4"
          />
          <p className={styles.note}>
            RMBG-1.4 model (~176 MB) downloads once on first use and is cached permanently.
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
            <div
              className={`${styles.imgWrap} ${bgColor === 'checker' ? styles.checker : ''}`}
              style={bgColor !== 'checker' ? { background: bgColor } : undefined}
            >
              {resultUrl ? (
                <img src={resultUrl} alt="Result" className={styles.img} />
              ) : busy ? (
                <div className={styles.busyState}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                  </div>
                  <p className={styles.stageText}>{stage}{pct > 0 ? ` ${pct}%` : ''}</p>
                </div>
              ) : (
                <p className={styles.placeholder}>Run removal to see result</p>
              )}
            </div>

            {/* Background color switcher */}
            <div className={styles.bgSwitcher}>
              <span className={styles.bgSwitcherLabel}>Background</span>
              {BG_PRESETS.map(preset => (
                preset.id === 'checker' ? (
                  <button
                    key="checker"
                    title="Transparent (checkerboard)"
                    className={`${styles.bgSwatch} ${styles.bgSwatchChecker} ${bgColor === 'checker' ? styles.bgSwatchActive : ''}`}
                    onClick={() => setBgColor('checker')}
                  />
                ) : (
                  <button
                    key={preset.id}
                    title={preset.label}
                    className={`${styles.bgSwatch} ${bgColor === preset.id ? styles.bgSwatchActive : ''}`}
                    style={{ background: preset.id }}
                    onClick={() => setBgColor(preset.id)}
                  />
                )
              ))}
              {/* Custom color picker */}
              <input
                type="color"
                title="Custom color"
                className={`${styles.bgColorInput} ${bgColor === customColor && bgColor !== 'checker' && !BG_PRESETS.some(p => p.id === bgColor) ? styles.bgColorInputActive : ''}`}
                value={customColor}
                onChange={e => { setCustomColor(e.target.value); setBgColor(e.target.value) }}
              />
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
