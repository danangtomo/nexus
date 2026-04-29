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

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  QR_SIZES, QR_LEVELS, BARCODE_FORMATS,
  renderQR, renderBarcode, canvasToPng, svgToPng,
} from './handler'
import styles from './index.module.css'

// ── QR Code pane ──────────────────────────────────────────────────────────────

function QrPane() {
  const canvasRef  = useRef(null)
  const [text,     setText]     = useState('')
  const [size,     setSize]     = useState(256)
  const [level,    setLevel]    = useState('M')
  const [dark,     setDark]     = useState('#000000')
  const [light,    setLight]    = useState('#ffffff')
  const [hasQr,    setHasQr]    = useState(false)
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)

  // Re-render QR whenever any option changes
  useEffect(() => {
    if (!text.trim()) { setHasQr(false); setError(''); return }
    let cancelled = false
    renderQR(canvasRef.current, text, { size, level, dark, light }).then((err) => {
      if (cancelled) return
      if (err) { setError(err); setHasQr(false) }
      else     { setError(''); setHasQr(true) }
    })
    return () => { cancelled = true }
  }, [text, size, level, dark, light])

  const handleSave = useCallback(async () => {
    if (!hasQr) return
    const savePath = await window.nexus.saveFile({
      title: 'Save QR Code',
      defaultPath: 'qrcode.png',
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    })
    if (!savePath) return
    setSaving(true)
    try {
      const bytes = await canvasToPng(canvasRef.current)
      await window.nexus.writeFile(savePath, bytes)
    } catch (err) {
      setError(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }, [hasQr])

  return (
    <div className={styles.pane}>
      {/* Input */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>Text or URL</p>
        <textarea
          className={styles.textarea}
          placeholder="Enter text, URL, phone number…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
      </div>

      {/* Options */}
      <div className={styles.optRow}>
        <div className={styles.optGroup}>
          <p className={styles.optLabel}>Size</p>
          <div className={styles.btnRow}>
            {QR_SIZES.map((s) => (
              <button
                key={s.value}
                className={`${styles.optBtn} ${size === s.value ? styles.optActive : ''}`}
                onClick={() => setSize(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.optGroup}>
          <p className={styles.optLabel}>Error correction</p>
          <div className={styles.btnRow}>
            {QR_LEVELS.map((l) => (
              <button
                key={l.value}
                className={`${styles.optBtn} ${level === l.value ? styles.optActive : ''}`}
                onClick={() => setLevel(l.value)}
              >
                {l.value}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.optGroup}>
          <p className={styles.optLabel}>Colors</p>
          <div className={styles.colorRow}>
            <label className={styles.colorLabel}>
              <input type="color" value={dark}  onChange={(e) => setDark(e.target.value)}  className={styles.colorInput} />
              <span>Foreground</span>
            </label>
            <label className={styles.colorLabel}>
              <input type="color" value={light} onChange={(e) => setLight(e.target.value)} className={styles.colorInput} />
              <span>Background</span>
            </label>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className={styles.previewArea}>
        <canvas
          ref={canvasRef}
          className={styles.qrCanvas}
          style={{ display: hasQr ? 'block' : 'none' }}
        />
        {!hasQr && !error && <p className={styles.previewHint}>QR code preview will appear here</p>}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/* Actions */}
      <div className={styles.footer}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!hasQr || saving}
        >
          {saving ? 'Saving…' : 'Download PNG'}
        </button>
      </div>
    </div>
  )
}

// ── Barcode pane ──────────────────────────────────────────────────────────────

function BarcodePane() {
  const svgRef        = useRef(null)
  const [value,       setValue]       = useState('')
  const [format,      setFormat]      = useState('CODE128')
  const [displayText, setDisplayText] = useState(true)
  const [lineColor,   setLineColor]   = useState('#000000')
  const [background,  setBackground]  = useState('#ffffff')
  const [hasBarcode,  setHasBarcode]  = useState(false)
  const [error,       setError]       = useState('')
  const [saving,      setSaving]      = useState(false)

  const selectedFmt = BARCODE_FORMATS.find((f) => f.id === format)

  // Re-render barcode whenever any option changes
  useEffect(() => {
    if (!value.trim()) { setHasBarcode(false); setError(''); return }
    const err = renderBarcode(svgRef.current, value, { format, displayValue: displayText, lineColor, background })
    if (err) { setError(err); setHasBarcode(false) }
    else     { setError(''); setHasBarcode(true) }
  }, [value, format, displayText, lineColor, background])

  const handleSave = useCallback(async () => {
    if (!hasBarcode) return
    const savePath = await window.nexus.saveFile({
      title: 'Save Barcode',
      defaultPath: `barcode-${format.toLowerCase()}.png`,
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    })
    if (!savePath) return
    setSaving(true)
    try {
      const bytes = await svgToPng(svgRef.current)
      await window.nexus.writeFile(savePath, bytes)
    } catch (err) {
      setError(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }, [hasBarcode, format])

  return (
    <div className={styles.pane}>
      {/* Format selector */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>Barcode format</p>
        <div className={styles.fmtGrid}>
          {BARCODE_FORMATS.map((f) => (
            <button
              key={f.id}
              className={`${styles.fmtBtn} ${format === f.id ? styles.fmtActive : ''}`}
              onClick={() => { setFormat(f.id); setValue(''); setHasBarcode(false); setError('') }}
            >
              {f.label}
            </button>
          ))}
        </div>
        {selectedFmt && (
          <p className={styles.hint}>Expected input: {selectedFmt.hint}</p>
        )}
      </div>

      {/* Input */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>Value</p>
        <input
          className={styles.input}
          placeholder={`Enter value for ${selectedFmt?.label ?? 'barcode'}…`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>

      {/* Options */}
      <div className={styles.optRow}>
        <div className={styles.optGroup}>
          <p className={styles.optLabel}>Show text</p>
          <button
            className={`${styles.optBtn} ${displayText ? styles.optActive : ''}`}
            onClick={() => setDisplayText((v) => !v)}
          >
            {displayText ? 'On' : 'Off'}
          </button>
        </div>

        <div className={styles.optGroup}>
          <p className={styles.optLabel}>Colors</p>
          <div className={styles.colorRow}>
            <label className={styles.colorLabel}>
              <input type="color" value={lineColor}   onChange={(e) => setLineColor(e.target.value)}   className={styles.colorInput} />
              <span>Lines</span>
            </label>
            <label className={styles.colorLabel}>
              <input type="color" value={background}  onChange={(e) => setBackground(e.target.value)}  className={styles.colorInput} />
              <span>Background</span>
            </label>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className={styles.previewArea}>
        <svg
          ref={svgRef}
          className={styles.barcodeSvg}
          style={{ display: hasBarcode ? 'block' : 'none' }}
        />
        {!hasBarcode && !error && <p className={styles.previewHint}>Barcode preview will appear here</p>}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/* Actions */}
      <div className={styles.footer}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!hasBarcode || saving}
        >
          {saving ? 'Saving…' : 'Download PNG'}
        </button>
      </div>
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────

export default function QrBarcode() {
  const [mode, setMode] = useState('qr')

  return (
    <div className={styles.page}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${mode === 'qr' ? styles.tabActive : ''}`}
          onClick={() => setMode('qr')}
        >
          QR Code
        </button>
        <button
          className={`${styles.tab} ${mode === 'barcode' ? styles.tabActive : ''}`}
          onClick={() => setMode('barcode')}
        >
          Barcode
        </button>
      </div>

      {mode === 'qr' ? <QrPane /> : <BarcodePane />}
    </div>
  )
}
