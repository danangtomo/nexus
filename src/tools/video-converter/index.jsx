import { useState, useCallback } from 'react'
import DropZone from '../../components/DropZone'
import ProgressBar from '../../components/ProgressBar'
import { FORMATS, QUALITIES, getVideoInfo, formatDuration, convertVideo } from './handler'
import styles from './index.module.css'

export default function VideoConverter() {
  const [file,       setFile]       = useState(null)
  const [info,       setInfo]       = useState(null)
  const [format,     setFormat]     = useState('mp4')
  const [quality,    setQuality]    = useState('medium')
  const [busy,       setBusy]       = useState(false)
  const [progress,   setProgress]   = useState(0)
  const [outputPath, setOutputPath] = useState('')
  const [error,      setError]      = useState('')

  const handleFiles = useCallback(async (incoming) => {
    setOutputPath('')
    setError('')
    setProgress(0)
    const raw  = incoming[0]
    const path = typeof raw === 'string' ? raw : (raw?.path ?? '')
    const name = path.split(/[\\/]/).pop()
    if (!path) return
    setFile({ path, name })
    try {
      const probe = await getVideoInfo(path)
      const stream = probe.streams?.find((s) => s.codec_type === 'video')
      const dur    = parseFloat(probe.format?.duration ?? 0)
      setInfo({
        duration: dur > 0 ? formatDuration(dur) : null,
        resolution: stream ? `${stream.width}×${stream.height}` : null,
        codec: stream?.codec_name?.toUpperCase() ?? null,
        size: probe.format?.size ? `${(probe.format.size / 1024 / 1024).toFixed(1)} MB` : null,
      })
    } catch {
      setInfo(null)
    }
  }, [])

  const handleConvert = async () => {
    const fmt      = FORMATS.find((f) => f.ext === format)
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const savePath = await window.nexus.saveFile({
      title: 'Save converted video',
      defaultPath: `${baseName}.${fmt.ext}`,
      filters: [{ name: fmt.label, extensions: [fmt.ext] }],
    })
    if (!savePath) return

    setBusy(true)
    setProgress(0)
    setOutputPath('')
    setError('')
    try {
      await convertVideo(file.path, savePath, format, quality, (pct) => setProgress(pct))
      setOutputPath(savePath)
    } catch (err) {
      setError(`Conversion failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setFile(null); setInfo(null); setOutputPath(''); setError('') }

  const isGif = format === 'gif'

  return (
    <div className={styles.page}>
      {!file ? (
        <DropZone
          onFiles={handleFiles}
          accept={['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'm4v', 'wmv']}
          multiple={false}
          label="Drop a video here or click to browse"
          sublabel="MP4, MOV, AVI, MKV, WebM and more"
        />
      ) : (
        <div className={styles.fileBar}>
          <div className={styles.fileBarLeft}>
            <span className={styles.fileName}>{file.name}</span>
            {info && (
              <div className={styles.metaRow}>
                {info.resolution && <span className={styles.meta}>{info.resolution}</span>}
                {info.duration   && <span className={styles.meta}>{info.duration}</span>}
                {info.codec      && <span className={styles.meta}>{info.codec}</span>}
                {info.size       && <span className={styles.meta}>{info.size}</span>}
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Change</button>
        </div>
      )}

      {file && (
        <>
          {/* Format selector */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Output format</p>
            <div className={styles.formatGrid}>
              {FORMATS.map((f) => (
                <button
                  key={f.ext}
                  className={`${styles.fmtBtn} ${format === f.ext ? styles.fmtActive : ''}`}
                  onClick={() => { setFormat(f.ext); setOutputPath('') }}
                  disabled={busy}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality selector — hidden for GIF */}
          {!isGif && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Quality</p>
              <div className={styles.qualityRow}>
                {QUALITIES.map((q) => (
                  <button
                    key={q.id}
                    className={`${styles.qualBtn} ${quality === q.id ? styles.qualActive : ''}`}
                    onClick={() => { setQuality(q.id); setOutputPath('') }}
                    disabled={busy}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isGif && (
            <p className={styles.gifNote}>GIF output: 15 fps, 480px wide, optimised palette</p>
          )}

          {busy && (
            <div className={styles.progressWrap}>
              <ProgressBar percent={progress} />
              <span className={styles.progressLabel}>{Math.round(progress)}%</span>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          {outputPath && (
            <div className={styles.successBanner}>
              <span>✓ Converted successfully</span>
              <button className="btn btn-ghost btn-sm" onClick={() => window.nexus.showItemInFolder(outputPath)}>
                Show in folder
              </button>
            </div>
          )}
        </>
      )}

      {file && (
        <div className={styles.footer}>
          <button className="btn btn-primary" onClick={handleConvert} disabled={busy}>
            {busy ? 'Converting…' : `Convert to ${format.toUpperCase()}`}
          </button>
        </div>
      )}
    </div>
  )
}
