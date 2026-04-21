import { useState, useCallback } from 'react'
import DropZone from '../../components/DropZone'
import { INPUT_EXTS, getOutputFormats, convert } from './handler'
import styles from './index.module.css'

export default function DocConverter() {
  const [file,       setFile]       = useState(null)   // { path, name, ext }
  const [outFmt,     setOutFmt]     = useState(null)   // 'html' | 'txt' | 'md'
  const [result,     setResult]     = useState(null)   // { output, warnings }
  const [viewSource, setViewSource] = useState(false)
  const [busy,       setBusy]       = useState(false)
  const [savedPath,  setSavedPath]  = useState('')
  const [error,      setError]      = useState('')

  const handleFiles = useCallback((incoming) => {
    const raw  = incoming[0]
    const path = typeof raw === 'string' ? raw : (raw?.path ?? '')
    if (!path) return
    const name = path.split(/[\\/]/).pop()
    const ext  = name.split('.').pop().toLowerCase()
    if (!INPUT_EXTS.includes(ext)) {
      setError(`Unsupported format: .${ext}`)
      return
    }
    const formats = getOutputFormats(ext)
    setFile({ path, name, ext })
    setOutFmt(formats[0]?.ext ?? null)
    setResult(null); setSavedPath(''); setError(''); setViewSource(false)
  }, [])

  const handleConvert = async () => {
    setBusy(true); setResult(null); setSavedPath(''); setError(''); setViewSource(false)
    try {
      const res = await convert(file.path, file.ext, outFmt)
      setResult(res)
    } catch (err) {
      setError(`Conversion failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    const extLabel = outFmt === 'txt' ? 'txt' : outFmt === 'md' ? 'md' : 'html'
    const base     = file.name.replace(/\.[^.]+$/, '')
    const savePath = await window.nexus.saveFile({
      title: 'Save converted file',
      defaultPath: `${base}.${extLabel}`,
      filters: [{ name: extLabel.toUpperCase(), extensions: [extLabel] }],
    })
    if (!savePath) return
    await window.nexus.writeFile(savePath, result.output)
    setSavedPath(savePath)
  }

  const reset = () => {
    setFile(null); setOutFmt(null); setResult(null)
    setSavedPath(''); setError(''); setViewSource(false)
  }

  const formats     = file ? getOutputFormats(file.ext) : []
  const isHtmlOut   = outFmt === 'html'
  const previewText = result?.output ?? ''

  return (
    <div className={styles.page}>
      {!file ? (
        <DropZone
          onFiles={handleFiles}
          accept={INPUT_EXTS}
          multiple={false}
          label="Drop a document here or click to browse"
          sublabel="DOCX, MD, TXT, HTML supported"
        />
      ) : (
        <div className={styles.fileBar}>
          <div className={styles.fileBarLeft}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.extTag}>.{file.ext.toUpperCase()}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Change</button>
        </div>
      )}

      {/* Output format selector */}
      {file && formats.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Convert to</p>
          <div className={styles.fmtRow}>
            {formats.map((f) => (
              <button
                key={f.ext}
                className={`${styles.fmtBtn} ${outFmt === f.ext ? styles.fmtActive : ''}`}
                onClick={() => { setOutFmt(f.ext); setResult(null); setSavedPath(''); setViewSource(false) }}
                disabled={busy}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversion warnings */}
      {result?.warnings?.length > 0 && (
        <div className={styles.warnings}>
          <p className={styles.warningTitle}>Conversion warnings:</p>
          <ul className={styles.warningList}>
            {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Output preview */}
      {result && (
        <div className={styles.previewSection}>
          <div className={styles.previewHeader}>
            <p className={styles.sectionLabel}>Preview</p>
            {isHtmlOut && (
              <button
                className={styles.toggleBtn}
                onClick={() => setViewSource((v) => !v)}
              >
                {viewSource ? 'Rendered' : 'HTML source'}
              </button>
            )}
          </div>
          <div className={styles.previewBox}>
            {isHtmlOut && !viewSource ? (
              <div
                className={styles.htmlPreview}
                dangerouslySetInnerHTML={{ __html: previewText }}
              />
            ) : (
              <pre className={styles.textPreview}>{previewText}</pre>
            )}
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {savedPath && (
        <div className={styles.successBanner}>
          <span>Saved successfully</span>
          <button className="btn btn-ghost btn-sm" onClick={() => window.nexus.showItemInFolder(savedPath)}>
            Show in folder
          </button>
        </div>
      )}

      {/* Action buttons */}
      {file && (
        <div className={styles.footer}>
          {!result ? (
            <button className="btn btn-primary" onClick={handleConvert} disabled={busy || !outFmt}>
              {busy ? 'Converting…' : `Convert to ${(outFmt ?? '').toUpperCase()}`}
            </button>
          ) : (
            <div className={styles.footerActions}>
              <button className="btn btn-ghost" onClick={() => { setResult(null); setSavedPath(''); setViewSource(false) }}>
                Re-convert
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                Save file
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
