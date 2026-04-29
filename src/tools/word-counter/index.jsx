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
import { analyse, loadFile, CONTENT_LABELS, ACCEPT_EXTS } from './handler'
import styles from './index.module.css'

export default function WordCounter() {
  const [text,       setText]       = useState('')
  const [loading,    setLoading]    = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [loadingPct, setLoadingPct] = useState(0)
  const [dragging,   setDragging]   = useState(false)
  const [error,      setError]      = useState('')

  // Preview mode state
  const [previewType,  setPreviewType]  = useState(null)   // 'pdf' | 'text' | null
  const [pdfPages,     setPdfPages]     = useState([])
  const [rawText,      setRawText]      = useState('')
  const prevPagesRef = useRef([])

  const stats = analyse(text)

  // Revoke old page blob URLs before replacing
  function revokePdfPages() {
    prevPagesRef.current.forEach(url => URL.revokeObjectURL(url))
    prevPagesRef.current = []
  }

  useEffect(() => () => revokePdfPages(), [])

  const openFile = useCallback(async (filePath) => {
    setLoading(true)
    setError('')
    setLoadingPct(0)
    setLoadingMsg('Reading file…')
    revokePdfPages()
    setPreviewType(null)
    setPdfPages([])

    try {
      const result = await loadFile(filePath, ({ msg, pct }) => {
        setLoadingMsg(msg)
        setLoadingPct(pct)
      })

      setText(result.text)
      setPreviewType(result.type)

      if (result.type === 'pdf') {
        prevPagesRef.current = result.pages
        setPdfPages(result.pages)
      } else {
        setRawText(result.text)
      }
    } catch (err) {
      setError(`Could not read file: ${err.message}`)
    } finally {
      setLoading(false)
      setLoadingMsg('')
      setLoadingPct(0)
    }
  }, [])

  const handleBrowse = useCallback(async () => {
    const filePath = await window.nexus.openFile({
      filters: [{ name: 'Text & PDF files', extensions: ACCEPT_EXTS }],
    })
    if (filePath) openFile(filePath)
  }, [openFile])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!ACCEPT_EXTS.includes(ext)) {
      setError(`Unsupported file type .${ext}. Accepted: ${ACCEPT_EXTS.join(', ')}`)
      return
    }
    const path = file.path ?? ''
    if (path) openFile(path)
  }, [openFile])

  const handleDragOver  = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }

  const handleClear = () => {
    revokePdfPages()
    setPdfPages([])
    setRawText('')
    setPreviewType(null)
    setText('')
    setError('')
  }

  return (
    <div className={styles.page}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button className="btn btn-tinted btn-sm" onClick={handleBrowse} disabled={loading}>
          Open file
        </button>
        {previewType && !loading && (
          <button className="btn btn-ghost btn-sm" onClick={handleClear}>
            Close file
          </button>
        )}
        {loading && (
          <div className={styles.loadingToolbar}>
            <div className={styles.spinnerSm} />
            <span className={styles.loadingText}>{loadingMsg}</span>
            {loadingPct > 0 && <span className={styles.loadingPct}>{loadingPct}%</span>}
          </div>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/* Content area */}
      {loading ? (
        <div className={styles.loadingArea}>
          <div className={styles.spinner} />
          <p className={styles.loadingHint}>{loadingMsg}</p>
          {loadingPct > 0 && (
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${loadingPct}%` }} />
            </div>
          )}
        </div>
      ) : previewType === 'pdf' ? (
        <div
          className={`${styles.pdfViewer} ${dragging ? styles.dragOver : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {pdfPages.map((src, i) => (
            <img key={i} src={src} alt={`Page ${i + 1}`} className={styles.pdfPage} draggable={false} />
          ))}
        </div>
      ) : previewType === 'text' ? (
        <div
          className={`${styles.textareaWrap} ${dragging ? styles.dragOver : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <pre className={styles.preView}>{rawText}</pre>
        </div>
      ) : (
        <div
          className={`${styles.textareaWrap} ${dragging ? styles.dragOver : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <textarea
            className={styles.textarea}
            value={text}
            onChange={e => { setText(e.target.value); setError('') }}
            placeholder="Paste or type text here — or open / drop a .txt, .md, or .pdf file"
            spellCheck={false}
          />
        </div>
      )}

      {/* Stats */}
      <div className={styles.stats}>
        <StatCard label="Words"      value={stats.words} />
        <StatCard label="Characters" value={stats.chars} />
        <StatCard label="No spaces"  value={stats.charsNoSpaces} />
        <StatCard label="Sentences"  value={stats.sentences} />
        <StatCard label="Paragraphs" value={stats.paragraphs} />
      </div>

      {/* Reading time */}
      <div className={styles.readSection}>
        <div className={styles.readHeader}>
          <p className={styles.readTitle}>Estimated reading time</p>
          {stats.words > 0 && (
            <div className={styles.badges}>
              <span className={styles.contentBadge}>{CONTENT_LABELS[stats.contentType]}</span>
              <span className={styles.scriptBadge}>{stats.scriptLabel}</span>
            </div>
          )}
        </div>
        <div className={styles.readGrid}>
          {stats.readingTimes.map(({ key, label, wpm, value }) => (
            <div key={key} className={styles.readRow}>
              <span className={styles.readLabel}>{label}</span>
              <span className={styles.readWpm}>~{wpm} wpm</span>
              <span className={styles.readValue}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className={styles.card}>
      <span className={styles.cardValue}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
      <span className={styles.cardLabel}>{label}</span>
    </div>
  )
}
