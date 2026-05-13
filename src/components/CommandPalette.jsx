/**
 * Nexus - Offline productivity suite
 * Copyright (C) 2026 Danang Estutomoaji
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import styles from './CommandPalette.module.css'

const TOOLS = [
  { icon: '📊', label: 'CSV Editor',             desc: 'View, edit and analyze tabular data',            path: '/csv-editor' },
  { icon: '{}', label: 'JSON Formatter',          desc: 'Format, validate and explore JSON',              path: '/json-formatter' },
  { icon: '📈', label: 'Chart Builder',           desc: 'Build charts and visualizations from data',      path: '/chart-builder' },
  { icon: '🗄', label: 'SQL Runner',              desc: 'Run SQL queries on files or a database server',  path: '/sql-runner' },
  { icon: '✍️', label: 'Rich Text Editor',        desc: 'Write and format rich documents',                path: '/rich-text-editor' },
  { icon: '📝', label: 'Markdown Editor',         desc: 'Write Markdown with live preview',               path: '/markdown-editor' },
  { icon: '🔄', label: 'Doc Converter',           desc: 'Convert DOCX, PDF and other document formats',   path: '/doc-converter' },
  { icon: '📋', label: 'Spreadsheet Converter',   desc: 'Convert between spreadsheet formats',            path: '/spreadsheet-converter' },
  { icon: '🔍', label: 'Diff Checker',            desc: 'Compare two texts and highlight differences',    path: '/diff-checker' },
  { icon: '🖼',  label: 'Image Converter',         desc: 'Convert images between formats',                 path: '/image-converter' },
  { icon: '✂️', label: 'Image Resizer',           desc: 'Resize and crop images',                         path: '/image-resizer' },
  { icon: '🗜',  label: 'Image Compressor',        desc: 'Compress images without losing quality',         path: '/image-compressor' },
  { icon: '🎭', label: 'Background Remover',      desc: 'Remove image backgrounds automatically',         path: '/background-remover' },
  { icon: '💧', label: 'Watermark Tool',          desc: 'Add text or image watermarks to photos',         path: '/watermark-tool' },
  { icon: '🏷',  label: 'Metadata Remover',        desc: 'Strip EXIF and metadata from images',            path: '/metadata-remover' },
  { icon: '📑', label: 'PDF Merger',              desc: 'Combine multiple PDFs into one',                 path: '/pdf-merger' },
  { icon: '✂️', label: 'PDF Splitter',            desc: 'Split a PDF into individual pages',              path: '/pdf-splitter' },
  { icon: '🗜',  label: 'PDF Compressor',          desc: 'Reduce PDF file size',                           path: '/pdf-compressor' },
  { icon: '🔒', label: 'PDF Encryptor',           desc: 'Password-protect and encrypt PDFs',              path: '/pdf-encryptor' },
  { icon: '🖖', label: 'OCR Reader',              desc: 'Extract text and tables from images and PDFs',   path: '/ocr-reader' },
  { icon: '🎬', label: 'Video Converter',         desc: 'Convert video files between formats',            path: '/video-converter' },
  { icon: '🎵', label: 'Audio Converter',         desc: 'Convert audio files between formats',            path: '/audio-converter' },
  { icon: '🗂',  label: 'Archive Manager',         desc: 'Create and extract ZIP and TAR archives',        path: '/archive-manager' },
  { icon: '🃏', label: 'Kanban Board',            desc: 'Manage tasks with a drag-and-drop board',        path: '/kanban-board' },
  { icon: '⏱',  label: 'Pomodoro Timer',          desc: 'Focus timer with work and break intervals',      path: '/pomodoro-timer' },
  { icon: '📅', label: 'Gantt Chart',             desc: 'Plan and visualize project timelines',           path: '/gantt-chart' },
  { icon: '📄', label: 'Report Builder',          desc: 'Build and export structured reports',            path: '/report-builder' },
  { icon: '📷', label: 'QR & Barcode',            desc: 'Generate QR codes and barcodes',                 path: '/qr-barcode' },
  { icon: '🌍', label: 'Timezone Converter',      desc: 'Convert times across timezones',                 path: '/timezone-converter' },
  { icon: '📖', label: 'Word Counter',            desc: 'Count words, characters and reading time',       path: '/word-counter' },
]

export default function CommandPalette() {
  const [open,     setOpen]     = useState(false)
  const [query,    setQuery]    = useState('')
  const [datasets, setDatasets] = useState([])
  const [cursor,   setCursor]   = useState(0)
  const inputRef = useRef(null)
  const listRef  = useRef(null)
  const navigate = useNavigate()
  const { activeWorkspace } = useWorkspace()

  // ── Global Ctrl+K / ⌘K toggle ────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(p => !p)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Load workspace datasets when opened ───────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setQuery('')
    setCursor(0)
    setDatasets([])
    if (activeWorkspace) {
      window.nexus.workspace.datasets(activeWorkspace.id).then(setDatasets)
    }
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open, activeWorkspace])

  // ── Filtered results ──────────────────────────────────────────────────────────
  const q = query.trim().toLowerCase()

  const filteredDatasets = useMemo(() =>
    datasets.filter(d => !q || d.name.toLowerCase().includes(q)),
    [datasets, q]
  )

  const filteredTools = useMemo(() =>
    TOOLS.filter(t => !q || t.label.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)),
    [q]
  )

  // Total flat count for keyboard nav bounds
  const totalResults = filteredDatasets.length + filteredTools.length

  // ── Keep cursor in view ───────────────────────────────────────────────────────
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  // Reset cursor when query changes
  useEffect(() => setCursor(0), [query])

  // ── Navigate to selected item ─────────────────────────────────────────────────
  function select(item) {
    setOpen(false)
    if (item.kind === 'dataset') {
      window.nexus.workspace.getDataset(item.id).then(full => {
        navigate('/csv-editor', { state: { dataset: { ...full, source: 'workspace' } } })
      })
    } else {
      navigate(item.path)
    }
  }

  // ── Keyboard navigation in input ──────────────────────────────────────────────
  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (totalResults > 0) setCursor(p => Math.min(p + 1, totalResults - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (totalResults > 0) setCursor(p => Math.max(p - 1, 0))
    }
    if (e.key === 'Enter' && totalResults > 0) {
      const item = cursor < filteredDatasets.length
        ? { kind: 'dataset', ...filteredDatasets[cursor] }
        : { kind: 'tool',    ...filteredTools[cursor - filteredDatasets.length] }
      select(item)
    }
  }

  if (!open) return null

  // Datasets start at flat index 0, tools start at filteredDatasets.length
  const toolOffset = filteredDatasets.length

  return (
    <div className={styles.backdrop} onMouseDown={() => setOpen(false)}>
      <div className={styles.palette} onMouseDown={e => e.stopPropagation()}>

        {/* Search input */}
        <div className={styles.inputRow}>
          <span className={styles.searchIco}>🔍</span>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search tools and data tables…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => { setQuery(''); inputRef.current?.focus() }}>✕</button>
          )}
          <kbd className={styles.escKey}>ESC</kbd>
        </div>

        {/* Results */}
        <div className={styles.list} ref={listRef}>
          {totalResults === 0 && (
            <div className={styles.empty}>
              {q ? `No results for "${query}"` : 'No data tables in this workspace yet'}
            </div>
          )}

          {/* Data Tables group */}
          {filteredDatasets.length > 0 && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>Data Tables · {activeWorkspace?.name}</div>
              {filteredDatasets.map((d, i) => {
                const flatIdx = i
                return (
                  <button
                    key={d.id}
                    data-idx={flatIdx}
                    className={cursor === flatIdx ? styles.resultActive : styles.result}
                    onMouseEnter={() => setCursor(flatIdx)}
                    onClick={() => select({ kind: 'dataset', ...d })}
                  >
                    <span className={styles.resultIcon}>📊</span>
                    <span className={styles.resultBody}>
                      <span className={styles.resultLabel}>{d.name}</span>
                      <span className={styles.resultMeta}>{d.row_count?.toLocaleString()} rows · Data Table</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Tools group */}
          {filteredTools.length > 0 && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>Tools</div>
              {filteredTools.map((t, i) => {
                const flatIdx = toolOffset + i
                return (
                  <button
                    key={t.path}
                    data-idx={flatIdx}
                    className={cursor === flatIdx ? styles.resultActive : styles.result}
                    onMouseEnter={() => setCursor(flatIdx)}
                    onClick={() => select({ kind: 'tool', ...t })}
                  >
                    <span className={styles.resultIcon}>{t.icon}</span>
                    <span className={styles.resultBody}>
                      <span className={styles.resultLabel}>{t.label}</span>
                      <span className={styles.resultMeta}>{t.desc}</span>
                    </span>
                    <span className={styles.resultArrow}>→</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>ESC</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
