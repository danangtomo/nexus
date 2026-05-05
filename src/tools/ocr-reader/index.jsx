/**
 * Nexus - Offline productivity suite
 * Copyright (C) 2026 Danang Estutomoaji
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import DropZone from '../../components/DropZone'
import { parse, saveText, LANGUAGES } from './handler'
import styles from './index.module.css'

function LangSelect({ value, onChange, options, disabled }) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top: 0, left: 0, width: 0 })
  const btnRef  = useRef(null)
  const listRef = useRef(null)

  const toggle = () => {
    if (disabled) return
    if (!open) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 340) })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (!btnRef.current?.contains(e.target) && !listRef.current?.contains(e.target))
        setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const selected = options.find(o => o.code === value)

  return (
    <div className={styles.langSelect}>
      <button ref={btnRef} type="button" className={`${styles.langSelectBtn} ${disabled ? styles.langSelectBtnDisabled : ''}`} onClick={toggle}>
        <span className={styles.langSelectVal}>{selected?.label ?? value}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div ref={listRef} className={styles.langSelectList} style={{ top: pos.top, left: pos.left, minWidth: pos.width }}>
          {options.map(opt => (
            <button
              key={opt.code}
              type="button"
              className={`${styles.langSelectItem} ${opt.code === value ? styles.langSelectItemActive : ''}`}
              onClick={() => { onChange(opt.code); setOpen(false) }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const MAX_MB     = 50
const MAX_BATCH  = 20
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif'])
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', bmp: 'image/bmp', tiff: 'image/tiff', tif: 'image/tiff' }

async function readAsDataUrl(filePath) {
  const ext  = filePath.split('.').pop().toLowerCase()
  const mime = MIME[ext] ?? 'image/jpeg'
  const b64  = await window.nexus.readFile(filePath, 'base64')
  return `data:${mime};base64,${b64}`
}

async function renderPdfPages(filePath) {
  const bytes   = await window.nexus.readFile(filePath, null)
  const blob    = new Blob([bytes], { type: 'application/pdf' })
  const blobUrl = URL.createObjectURL(blob)
  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url,
    ).href
    const pdf   = await pdfjsLib.getDocument({ url: blobUrl }).promise
    const pages = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const vp1  = page.getViewport({ scale: 1.0 })
      const vp   = page.getViewport({ scale: 1.5 })
      const canvas = document.createElement('canvas')
      canvas.width  = vp.width
      canvas.height = vp.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
      pages.push({ url: canvas.toDataURL('image/jpeg', 0.85), w: vp1.width, h: vp1.height })
    }
    return pages
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

export default function OcrReader() {
  const navigate = useNavigate()

  const [queue,         setQueue]         = useState([])
  const [activeIdx,     setActiveIdx]     = useState(0)
  const [lang,          setLang]          = useState('ch')
  const [busy,          setBusy]          = useState(false)
  const [results,       setResults]       = useState([])
  const [editedBlocks,  setEditedBlocks]  = useState({})
  const [pdfPages,      setPdfPages]      = useState([])
  const [pdfPageIdx,    setPdfPageIdx]    = useState(0)
  const [previewUrl,    setPreviewUrl]    = useState('')
  const [imageDims,     setImageDims]     = useState(null)
  const [tableEnable,   setTableEnable]   = useState(true)
  const [formulaEnable, setFormulaEnable] = useState(true)
  const [forceOcr,      setForceOcr]      = useState(false)
  const [copiedKey,     setCopiedKey]     = useState('')
  const [engineReady,   setEngineReady]   = useState(false)
  const [error,         setError]         = useState('')

  const activeResult = results[activeIdx]
  const currentFile  = queue[activeIdx]
  const tables       = (activeResult?.blocks || []).filter(b => b.type === 'table')
  const isPdf        = currentFile?.name?.toLowerCase().endsWith('.pdf')
  const isImage      = IMAGE_EXTS.has(currentFile?.name?.split('.').pop().toLowerCase() ?? '')
  const pdfPage      = pdfPages[pdfPageIdx]

  // Blocks visible on the current view (for overlay)
  const visibleBlocks = activeResult
    ? (activeResult.blocks || []).map((b, i) => ({ ...b, blockIdx: i })).filter(b => {
        if (!b.bbox) return false
        return isImage ? true : b.page_idx === pdfPageIdx
      })
    : []

  useEffect(() => {
    window.nexus.ocr.pageEnter()
    const unsub = window.nexus.ocr.onEngineReady(() => setEngineReady(true))
    return () => { unsub(); window.nexus.ocr.pageLeave() }
  }, [])

  useEffect(() => {
    setPreviewUrl('')
    setImageDims(null)
    setPdfPages([])
    setPdfPageIdx(0)
    if (!currentFile) return

    const ext       = currentFile.name.split('.').pop().toLowerCase()
    const isImg     = IMAGE_EXTS.has(ext)
    const isPdfFile = ext === 'pdf'

    let cancelled = false
    if (isImg) {
      readAsDataUrl(currentFile.path)
        .then(url => { if (!cancelled) setPreviewUrl(url) })
        .catch(() => {})
    } else if (isPdfFile) {
      renderPdfPages(currentFile.path)
        .then(pages => { if (!cancelled) setPdfPages(pages) })
        .catch(() => {})
    }
    return () => { cancelled = true }
  }, [currentFile])

  const handleFiles = useCallback((incoming) => {
    const parsed = (Array.isArray(incoming) ? incoming : [incoming])
      .map(raw => {
        const p = typeof raw === 'string' ? raw : (raw?.path ?? '')
        return { path: p, name: p.split(/[\\/]/).pop() }
      })
      .filter(f => f.path)
    if (parsed.length > MAX_BATCH) { setError(`Maximum ${MAX_BATCH} files at once.`); return }
    setQueue(parsed); setResults([]); setActiveIdx(0); setEditedBlocks({}); setError('')
  }, [])

  const handleExtract = async () => {
    if (!queue.length) return
    setBusy(true); setError(''); setResults([]); setEditedBlocks({})
    try {
      const allResults = []
      for (const file of queue) {
        const res = await parse(file.path, lang, 0, -1, forceOcr, tableEnable, formulaEnable)
        allResults.push({ file, ...res })
      }
      setResults(allResults); setActiveIdx(0)
    } catch (err) {
      setError(`Extraction failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const getBlockText = (fi, bi, def) => editedBlocks[`${fi}-${bi}`] ?? def ?? ''
  const updateBlock  = (fi, bi, v)   => setEditedBlocks(p => ({ ...p, [`${fi}-${bi}`]: v }))
  const getCell      = (fi, bi, r, c, def) => editedBlocks[`${fi}-t${bi}-r${r}-c${c}`] ?? def ?? ''
  const updateCell   = (fi, bi, r, c, v)   => setEditedBlocks(p => ({ ...p, [`${fi}-t${bi}-r${r}-c${c}`]: v }))
  const getTableRows = (block, bi) =>
    (block.rows || []).map((row, r) => row.map((cell, c) => getCell(activeIdx, bi, r, c, cell)))

  const getFullText = () => {
    if (!activeResult?.blocks?.length) return activeResult?.full_text ?? ''
    return activeResult.blocks
      .filter(b => b.type !== 'table')
      .map((b, i) => getBlockText(activeIdx, i, b.content))
      .filter(Boolean).join('\n\n')
  }

  const markCopied = (key) => { setCopiedKey(key); setTimeout(() => setCopiedKey(''), 2000) }

  const handleCopyText = async () => {
    const text = getFullText()
    if (!text) return
    await navigator.clipboard.writeText(text)
    markCopied('text')
  }

  const handleSave = async () => {
    const text = getFullText()
    if (!text) return
    const base = activeResult.file.name.replace(/\.[^.]+$/, '')
    const dest = await window.nexus.saveFile({
      title: 'Save extracted text',
      defaultPath: `${base}_ocr.txt`,
      filters: [{ name: 'Text', extensions: ['txt'] }],
    })
    if (dest) await saveText(text, dest)
  }

  const handleCopyTableCsv = async (tbl, bi) => {
    if (!tbl?.rows?.length) return
    const rows = getTableRows(tbl, bi)
    const csv  = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    await navigator.clipboard.writeText(csv)
    markCopied(`csv-${bi}`)
  }

  const handleCopyImage = async (dataUrl, bi) => {
    await window.nexus.clipboard.writeImage(dataUrl)
    markCopied(`img-${bi}`)
  }

  const handleCopyLatex = async (text, bi) => {
    await navigator.clipboard.writeText(text)
    markCopied(`latex-${bi}`)
  }

  const handleSendToDataTable = (tbl, tblIdx, bi) => {
    if (!tbl?.rows?.length) return
    const rows     = getTableRows(tbl, bi)
    const headers  = rows[0] || []
    const dataRows = rows.slice(1)
    const baseName = activeResult?.file.name.replace(/\.[^.]+$/, '') ?? 'Table'
    navigate('/csv-editor', {
      state: {
        dataset: {
          id:         crypto.randomUUID(),
          name:       `${baseName} — Table ${tblIdx + 1}`,
          source:     'ocr-table',
          sourceTool: 'OCR Reader',
          columns:    headers.map(h => ({ name: h || 'Column', type: 'string' })),
          rows:       dataRows.map(row => {
            const obj = {}
            headers.forEach((h, i) => { obj[h || `col${i}`] = row[i] ?? '' })
            return obj
          }),
          rowCount:  dataRows.length,
          createdAt: new Date().toISOString(),
        },
      },
    })
  }

  const reset      = () => { setQueue([]); setResults([]); setActiveIdx(0); setEditedBlocks({}); setError('') }
  const switchFile = (i) => { setActiveIdx(i) }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!queue.length) {
    return (
      <div className={styles.page}>
        {!engineReady && (
          <div className={styles.engineBanner}>
            <span className={styles.engineDot} />
            Loading OCR engine…
          </div>
        )}
        <DropZone
          onFiles={handleFiles}
          accept={['png','jpg','jpeg','webp','bmp','tiff','tif','pdf','docx','pptx','xlsx']}
          multiple
          label="Drop files here, or click to browse"
          sublabel={`PDF, images, DOCX, PPTX, XLSX · Batch ≤${MAX_BATCH} files · ≤${MAX_MB} MB`}
        />
        {error && <p className={styles.error}>{error}</p>}
      </div>
    )
  }

  const showPreview = (isImage && previewUrl) || (isPdf && pdfPage)

  // ── Working / results state ───────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {!engineReady && (
        <div className={styles.engineBanner}>
          <span className={styles.engineDot} />
          Loading OCR engine…
        </div>
      )}

      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.fileTabs}>
          {queue.map((f, i) => (
            <button
              key={i}
              className={`${styles.fileTab} ${i === activeIdx ? styles.fileTabActive : ''}`}
              onClick={() => switchFile(i)}
              title={f.name}
            >
              {f.name.length > 22 ? f.name.slice(0, 20) + '…' : f.name}
              {results[i] && <span className={styles.doneDot} />}
            </button>
          ))}
        </div>
        <div className={styles.topBarRight}>
          <label className={styles.label}>Language</label>
          <LangSelect value={lang} onChange={setLang} options={LANGUAGES} disabled={busy} />
          <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Clear</button>
          <button className="btn btn-primary btn-sm" onClick={handleExtract} disabled={busy || !engineReady}>
            {busy ? 'Extracting…' : !engineReady ? 'Engine loading…' : 'Extract'}
          </button>
        </div>
      </div>

      {/* Options row */}
      <div className={styles.optionsRow}>
        <label className={styles.optionLabel} title="If disabled, tables will be shown as images.">
          <input type="checkbox" checked={tableEnable} onChange={e => setTableEnable(e.target.checked)} disabled={busy} />
          Enable table recognition
        </label>
        <label className={styles.optionLabel} title="If disabled, display formulas will be shown as images, and inline formulas will not be detected or parsed.">
          <input type="checkbox" checked={formulaEnable} onChange={e => setFormulaEnable(e.target.checked)} disabled={busy} />
          Enable formula recognition
        </label>
        <label className={styles.optionLabel} title="Enable only if the result is extremely poor. Requires correct OCR language.">
          <input type="checkbox" checked={forceOcr} onChange={e => setForceOcr(e.target.checked)} disabled={busy} />
          Force enable OCR
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/* Split panel */}
      <div className={styles.splitPanel}>

        {/* ── Left: source preview with numbered block overlays ── */}
        <div className={styles.leftPane}>
          <div className={styles.imageWrap}>
            {showPreview ? (
              <div className={styles.imageContainer}>
                <img
                  src={isImage ? previewUrl : pdfPage.url}
                  className={styles.sourceImage}
                  alt=""
                  draggable={false}
                  onLoad={isImage ? (e => setImageDims({ w: e.target.naturalWidth, h: e.target.naturalHeight })) : undefined}
                />
                {busy && <div className={styles.scanLine} />}
                {visibleBlocks.map(({ bbox: b, type, blockIdx }) => {
                  if (!b || b.length < 4) return null
                  const bw = b[2] - b[0]
                  const bh = b[3] - b[1]
                  if (bw <= 0 || bh <= 0) return null
                  const isTable   = type === 'table'
                  const isImgBlk  = type === 'image' || type === 'equation'
                  const boxCls    = isTable ? styles.bboxBoxTable : isImgBlk ? styles.bboxBoxImage : styles.bboxBoxText
                  const badgeCls  = isTable ? styles.bboxBadgeTable : isImgBlk ? styles.bboxBadgeImage : styles.bboxBadgeText
                  return (
                    <div
                      key={blockIdx}
                      className={`${styles.bboxBox} ${boxCls}`}
                      style={{
                        left:   `${b[0] / 10}%`,
                        top:    `${b[1] / 10}%`,
                        width:  `${bw   / 10}%`,
                        height: `${bh   / 10}%`,
                      }}
                    >
                      <span className={`${styles.bboxBadge} ${badgeCls}`}>
                        {blockIdx + 1}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={styles.imagePlaceholder}>
                <span className={styles.placeholderIcon}>📄</span>
                <span>{currentFile?.name}</span>
                {activeResult && (
                  <span className={styles.mineruTag}>
                    {activeResult.table_count} table{activeResult.table_count !== 1 ? 's' : ''} · {activeResult.page_count} page{activeResult.page_count !== 1 ? 's' : ''}
                  </span>
                )}
                <span className={styles.scanningLabel}>
                  {busy ? 'Analyzing…' : isPdf ? 'Rendering preview…' : ''}
                </span>
              </div>
            )}
          </div>

          {isPdf && pdfPages.length > 1 && (
            <div className={styles.pageNav}>
              <button className={styles.pageNavBtn} onClick={() => setPdfPageIdx(p => p - 1)} disabled={pdfPageIdx === 0}>‹</button>
              <span className={styles.pageNavLabel}>Page {pdfPageIdx + 1} / {pdfPages.length}</span>
              <button className={styles.pageNavBtn} onClick={() => setPdfPageIdx(p => p + 1)} disabled={pdfPageIdx === pdfPages.length - 1}>›</button>
            </div>
          )}
        </div>

        {/* ── Right: unified block view with number badges ── */}
        <div className={styles.rightPane}>
          {activeResult ? (
            <>
              <div className={styles.resultHeader}>
                <span className={styles.lineCount}>
                  {activeResult.page_count > 0 && `${activeResult.page_count}p · `}
                  {tables.length > 0 && `${tables.length} table${tables.length !== 1 ? 's' : ''} · `}
                  {getFullText().length.toLocaleString()} chars
                </span>
                <div className={styles.resultActions}>
                  <button className="btn btn-ghost btn-sm" onClick={handleCopyText}>{copiedKey === 'text' ? 'Copied!' : 'Copy Text'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={handleSave}>Save .txt</button>
                </div>
              </div>

              <div className={styles.blockList}>
                {(activeResult.blocks || []).length === 0 ? (
                  <div className={styles.rightPlaceholder}>
                    <span>No content extracted from this file.</span>
                  </div>
                ) : (activeResult.blocks || []).map((block, i) => {
                  const num       = i + 1
                  const isTable   = block.type === 'table'
                  const isImgBlk  = block.type === 'image' || block.type === 'equation'
                  const badgeCls  = isTable ? styles.blockBadgeTable : isImgBlk ? styles.blockBadgeImage : styles.blockBadgeText

                  if (isImgBlk) {
                    return (
                      <div key={i} className={styles.imageBlock}>
                        <div className={styles.imageBlockHeader}>
                          <span className={badgeCls}>{num}</span>
                          <span className={styles.imageLabel}>
                            {block.type === 'equation' ? 'Equation' : 'Image'}
                            {block.page_idx >= 0 ? ` · p.${block.page_idx + 1}` : ''}
                          </span>
                          {block.caption && <span className={styles.tableCaption}>{block.caption}</span>}
                          {block.img_data_url && (
                            <button className="btn btn-ghost btn-sm" onClick={() => handleCopyImage(block.img_data_url, i)}>
                              {copiedKey === `img-${i}` ? 'Copied!' : 'Copy Image'}
                            </button>
                          )}
                          {block.type === 'equation' && block.text && (
                            <button className="btn btn-ghost btn-sm" onClick={() => handleCopyLatex(block.text, i)}>
                              {copiedKey === `latex-${i}` ? 'Copied!' : 'Copy LaTeX'}
                            </button>
                          )}
                        </div>
                        {block.img_data_url
                          ? <img src={block.img_data_url} className={styles.extractedImage} alt={block.caption || ''} />
                          : <span className={styles.imageBlockMissing}>Image not available</span>
                        }
                        {block.type === 'equation' && block.text && (
                          <div className={styles.equationText}>{block.text}</div>
                        )}
                      </div>
                    )
                  }

                  if (isTable) {
                    const tblIdx = tables.indexOf(block)
                    return (
                      <div key={i} className={styles.tableBlock}>
                        <div className={styles.tableActions}>
                          <span className={badgeCls}>{num}</span>
                          <span className={styles.tableLabel}>
                            Table {tblIdx + 1}{block.page_idx >= 0 ? ` · p.${block.page_idx + 1}` : ''}
                          </span>
                          {block.caption && <span className={styles.tableCaption}>{block.caption}</span>}
                          <button className="btn btn-ghost btn-sm" onClick={() => handleCopyTableCsv(block, i)}>{copiedKey === `csv-${i}` ? 'Copied!' : 'Copy CSV'}</button>
                          <button className="btn btn-primary btn-sm" onClick={() => handleSendToDataTable(block, tblIdx, i)}>Data Table →</button>
                        </div>
                        {block.rows?.length > 0 && (
                          <div className={styles.tableWrap}>
                            <table className={styles.dataTable}>
                              <thead>
                                <tr>{(block.rows[0] || []).map((cell, c) => (
                                  <th key={c}><input className={styles.cellInput} value={getCell(activeIdx, i, 0, c, cell)} onChange={e => updateCell(activeIdx, i, 0, c, e.target.value)} spellCheck={false} /></th>
                                ))}</tr>
                              </thead>
                              <tbody>
                                {block.rows.slice(1).map((row, r) => (
                                  <tr key={r}>{row.map((cell, c) => (
                                    <td key={c}><input className={styles.cellInput} value={getCell(activeIdx, i, r + 1, c, cell)} onChange={e => updateCell(activeIdx, i, r + 1, c, e.target.value)} spellCheck={false} /></td>
                                  ))}</tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <div key={i} className={styles.textBlockWrap}>
                      <span className={badgeCls}>{num}</span>
                      <textarea
                        className={block.type === 'title' ? styles.titleTextarea : styles.textTextarea}
                        value={getBlockText(activeIdx, i, block.content)}
                        onChange={e => updateBlock(activeIdx, i, e.target.value)}
                        spellCheck={false}
                      />
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className={styles.rightPlaceholder}>
              {busy
                ? <><div className={styles.pulseDot} /><span>Extracting the content...</span></>
                : <span>Results will appear here after extraction</span>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
