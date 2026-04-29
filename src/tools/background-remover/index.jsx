/**
 * Nexus - Offline productivity suite
 * Copyright (C) 2026 Danang Estutomoaji
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import DropZone from '../../components/DropZone'
import { INPUT_EXTS, extOf, stripBackground } from './handler'
import styles from './index.module.css'

const STAGE_LABELS = {
  'download':  'Downloading model…',
  'inference': 'Removing background…',
}

function stageLabel(key) {
  return STAGE_LABELS[key] ?? 'Processing…'
}

const BG_PRESETS = [
  { id: 'checker', label: 'Transparent' },
  { id: '#ffffff', label: 'White' },
  { id: '#f0f0f0', label: 'Light gray' },
  { id: '#000000', label: 'Black' },
  { id: '#1a1a2e', label: 'Dark navy' },
  { id: '#e8f4f8', label: 'Light blue' },
]

const STAR_POSITIONS = [
  { top: '18%', left: '22%' },
  { top: '65%', left: '72%' },
  { top: '38%', left: '58%' },
  { top: '78%', left: '28%' },
  { top: '12%', left: '78%' },
  { top: '52%', left: '12%' },
  { top: '42%', left: '88%' },
  { top: '82%', left: '55%' },
]

// ── Before/After compare slider (lives inside the result panel) ───────────────

function CompareSlider({ origUrl, resultUrl, bgColor }) {
  const [pos, setPos] = useState(50)
  const containerRef  = useRef(null)
  const dragging      = useRef(false)

  const updatePos = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)))
  }, [])

  useEffect(() => {
    const onMove = (e) => { if (dragging.current) updatePos(e.clientX) }
    const onUp   = ()  => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [updatePos])

  return (
    <div
      ref={containerRef}
      className={styles.slider}
      onTouchMove={(e) => updatePos(e.touches[0].clientX)}
    >
      {/* Original fills container and sets its natural height */}
      <img src={origUrl} className={styles.sliderImg} draggable={false} alt="Before" />

      {/* Result clipped to the left portion */}
      <div
        className={`${styles.sliderResultWrap} ${bgColor === 'checker' ? styles.checker : ''}`}
        style={{
          clipPath: `inset(0 ${100 - pos}% 0 0)`,
          ...(bgColor !== 'checker' ? { background: bgColor } : {}),
        }}
      >
        <img src={resultUrl} className={styles.sliderImg} draggable={false} alt="After" />
      </div>

      {/* Drag handle */}
      <div
        className={styles.sliderDivider}
        style={{ left: `${pos}%` }}
        onMouseDown={(e) => { dragging.current = true; e.preventDefault() }}
        onTouchStart={(e) => { dragging.current = true; updatePos(e.touches[0].clientX) }}
      >
        <div className={styles.sliderHandle}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7 5L3 10L7 15"    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13 5L17 10L13 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      <span className={styles.sliderLabelBefore}>Before</span>
      <span className={styles.sliderLabelAfter}>After</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BackgroundRemover() {
  const [file,        setFile]        = useState(null)
  const [origUrl,     setOrigUrl]     = useState('')
  const [resultUrl,   setResultUrl]   = useState('')
  const [busy,        setBusy]        = useState(false)
  const [stage,       setStage]       = useState('')
  const [error,       setError]       = useState('')
  const [bgColor,     setBgColor]     = useState('checker')
  const [customColor, setCustomColor] = useState('#ffffff')
  const prevResult = useRef('')
  const prevOrig   = useRef('')

  // Page-based lifecycle: spawn sidecar on mount, kill on unmount or navigation away
  useEffect(() => {
    window.nexus.birefnet.pageEnter()
    return () => { window.nexus.birefnet.pageLeave() }
  }, [])

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
    try {
      const blobUrl = await stripBackground(file.path, ({ key }) => {
        setStage(stageLabel(key))
      })
      prevResult.current = blobUrl
      setResultUrl(blobUrl)
    } catch (err) {
      setError(`Processing failed: ${err.message}`)
    } finally {
      setBusy(false)
      setStage('')
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
            sublabel="JPEG, PNG, WEBP supported"
          />
          <p className={styles.note}>
             model (~224 MB) downloads once on first use and is cached permanently.
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
          {/* Left — original image, always static */}
          <div className={styles.previewPanel}>
            <p className={styles.panelLabel}>Original</p>
            <div className={styles.imgWrap}>
              {origUrl
                ? <img src={origUrl} className={styles.img} alt="Original" />
                : <p className={styles.placeholder}>Loading…</p>
              }
            </div>
          </div>

          {/* Right — sparkle while processing, slider once done, placeholder otherwise */}
          <div className={styles.previewPanel}>
            <p className={styles.panelLabel}>Result</p>

            {busy ? (
              <div className={styles.sparkleWrap}>
                {origUrl && <img src={origUrl} className={styles.sparkleImg} draggable={false} alt="" />}
                <div className={styles.sparkleOverlay}>
                  <div className={styles.sparkleShimmer} />
                  {STAR_POSITIONS.map((pos, i) => (
                    <span
                      key={i}
                      className={styles.sparkleStar}
                      style={{ '--i': i, '--top': pos.top, '--left': pos.left }}
                    />
                  ))}
                  <p className={styles.sparkleLabel}>{stage}</p>
                </div>
              </div>
            ) : resultUrl ? (
              <CompareSlider origUrl={origUrl} resultUrl={resultUrl} bgColor={bgColor} />
            ) : (
              <div className={styles.imgWrap}>
                <p className={styles.placeholder}>Run removal to see result</p>
              </div>
            )}

            {/* Background color switcher — available as soon as a file is loaded */}
            {!busy && (
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
                <input
                  type="color"
                  title="Custom color"
                  className={`${styles.bgColorInput} ${bgColor === customColor && bgColor !== 'checker' && !BG_PRESETS.some(p => p.id === bgColor) ? styles.bgColorInputActive : ''}`}
                  value={customColor}
                  onChange={e => { setCustomColor(e.target.value); setBgColor(e.target.value) }}
                />
              </div>
            )}
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
