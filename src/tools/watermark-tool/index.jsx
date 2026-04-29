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
import { INPUT_EXTS, POSITIONS, extOf, drawPreview, saveWatermark } from './handler'
import styles from './index.module.css'

const DEFAULT_OPTS = {
  text:     'CONFIDENTIAL',
  fontSize: 48,
  color:    '#ffffff',
  opacity:  0.7,
  position: 'bottom-right',
}

export default function WatermarkTool() {
  const [file,    setFile]    = useState(null)
  const [opts,    setOpts]    = useState(DEFAULT_OPTS)
  const [busy,    setBusy]    = useState(false)
  const [saved,   setSaved]   = useState('')
  const [error,   setError]   = useState('')

  const canvasRef = useRef(null)
  const imgRef    = useRef(null)   // hidden <img> holding the loaded image
  const imgLoaded = useRef(false)

  // Redraw canvas whenever image or opts change
  useEffect(() => {
    if (!imgLoaded.current || !canvasRef.current) return
    drawPreview(canvasRef.current, imgRef.current, opts)
  }, [opts, file])

  const loadImage = useCallback((b64, mime) => {
    const src = `data:${mime};base64,${b64}`
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      imgLoaded.current = true
      const canvas = canvasRef.current
      if (!canvas) return
      // Scale canvas to image — cap at 800px wide for preview
      const maxW = 800
      const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1
      canvas.width  = Math.round(img.naturalWidth  * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      drawPreview(canvas, img, opts)
    }
    img.src = src
  }, [opts])

  const handleFiles = useCallback(async (incoming) => {
    const raw  = incoming[0]
    const path = typeof raw === 'string' ? raw : (raw?.path ?? '')
    if (!path) return

    const name = path.split(/[\\/]/).pop()
    const ext  = extOf(name)
    if (!INPUT_EXTS.includes(ext)) {
      setError(`Unsupported format: .${ext}. Supported: ${INPUT_EXTS.join(', ')}`)
      return
    }

    imgLoaded.current = false
    setFile({ path, name, ext })
    setSaved('')
    setError('')

    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    try {
      const b64 = await window.nexus.readFile(path, 'base64')
      loadImage(b64, mime)
    } catch (err) {
      setError(`Failed to load image: ${err.message}`)
    }
  }, [loadImage])

  const set = (key) => (e) => {
    const val = e.target.type === 'range' ? Number(e.target.value) : e.target.value
    setSaved('')
    setOpts(prev => ({ ...prev, [key]: val }))
  }

  const setPos = (id) => {
    setSaved('')
    setOpts(prev => ({ ...prev, position: id }))
  }

  const handleSave = async () => {
    const ext = extOf(file.name)
    const base = file.name.replace(/\.[^.]+$/, '')
    const savePath = await window.nexus.saveFile({
      title: 'Save watermarked image',
      defaultPath: `${base}_watermarked.${ext}`,
      filters: [{ name: 'Image', extensions: [ext] }],
    })
    if (!savePath) return

    setBusy(true); setSaved(''); setError('')
    try {
      await saveWatermark(file.path, savePath, opts)
      setSaved(savePath)
    } catch (err) {
      setError(`Save failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    imgLoaded.current = false
    imgRef.current = null
    setFile(null)
    setSaved('')
    setError('')
  }

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
          <span className={styles.fileName}>{file.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Change</button>
        </div>
      )}

      {file && (
        <div className={styles.layout}>
          {/* ── Controls ── */}
          <div className={styles.controls}>
            <div className={styles.field}>
              <label className={styles.label}>Watermark text</label>
              <input
                className={styles.textInput}
                type="text"
                value={opts.text}
                onChange={set('text')}
                placeholder="Enter watermark text…"
                maxLength={120}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                Font size <span className={styles.val}>{opts.fontSize}px</span>
              </label>
              <input type="range" min={12} max={200} value={opts.fontSize} onChange={set('fontSize')} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                Opacity <span className={styles.val}>{Math.round(opts.opacity * 100)}%</span>
              </label>
              <input
                type="range" min={0.05} max={1} step={0.05}
                value={opts.opacity} onChange={set('opacity')}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Color</label>
              <div className={styles.colorRow}>
                <input type="color" value={opts.color} onChange={set('color')} className={styles.colorPicker} />
                <span className={styles.colorHex}>{opts.color}</span>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Position</label>
              <div className={styles.posGrid}>
                {POSITIONS.map(p => (
                  <button
                    key={p.id}
                    className={`${styles.posBtn} ${opts.position === p.id ? styles.posBtnActive : ''}`}
                    onClick={() => setPos(p.id)}
                    title={p.id}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Canvas preview ── */}
          <div className={styles.previewWrap}>
            <canvas ref={canvasRef} className={styles.canvas} />
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {saved && (
        <div className={styles.successBanner}>
          <span>Saved successfully</span>
          <button className="btn btn-ghost btn-sm" onClick={() => window.nexus.showItemInFolder(saved)}>
            Show in folder
          </button>
        </div>
      )}

      {file && (
        <div className={styles.footer}>
          <button className="btn btn-primary" onClick={handleSave} disabled={busy || !opts.text}>
            {busy ? 'Saving…' : 'Save Watermarked Image'}
          </button>
        </div>
      )}
    </div>
  )
}
