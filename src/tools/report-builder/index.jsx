/**
 * Nexus - Offline productivity suite
 * Copyright (C) 2026 Danang Estutomoaji
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import ReportPreview from './ReportPreview'
import { THEMES, DEFAULT_THEME } from './themes'
import styles from './index.module.css'

function uid() { return crypto.randomUUID() }

function buildDefaultSections(dataset) {
  if (!dataset) return [{ id: uid(), type: 'text', text: '' }]
  return [
    { id: uid(), type: 'stats' },
    { id: uid(), type: 'text', text: '' },
    { id: uid(), type: 'chart', chartType: 'bar', xCol: '', yCol: '', chartTitle: '', sortOrder: 'desc', maxItems: 20, colorMode: 'multi' },
    { id: uid(), type: 'heading', text: 'Data' },
    { id: uid(), type: 'table' },
  ]
}

const SECTION_LABELS = {
  stats:   'Key Stats',
  text:    'Text',
  heading: 'Heading',
  chart:   'Chart',
  table:   'Table',
}

const CHART_TYPES = [
  { value: 'bar',     label: 'Bar' },
  { value: 'hbar',   label: 'Horizontal Bar' },
  { value: 'line',   label: 'Line' },
  { value: 'area',   label: 'Area' },
  { value: 'donut',  label: 'Donut' },
  { value: 'scatter', label: 'Scatter' },
]

export default function ReportBuilder() {
  const location = useLocation()
  const dataset  = location.state?.dataset ?? null
  const columns  = dataset?.columns ?? []
  const { activeWorkspace } = useWorkspace()

  const [reportTitle, setReportTitle] = useState(dataset?.name ?? 'Untitled Report')
  const [sections,    setSections]    = useState(() => buildDefaultSections(dataset))
  const [exporting,   setExporting]   = useState(false)
  const [activeTheme, setActiveTheme] = useState(DEFAULT_THEME)
  const [wsSaved,     setWsSaved]     = useState(false)
  const wsReportIdRef = useRef(null)

  const addSection = type => setSections(p => [
    ...p,
    {
      id: uid(), type, text: '',
      ...(type === 'chart' ? { chartType: 'bar', xCol: '', yCol: '', chartTitle: '', sortOrder: 'desc', maxItems: 20, colorMode: 'multi' } : {}),
    },
  ])
  const removeSection = id => setSections(p => p.filter(s => s.id !== id))
  const moveSection   = (id, dir) => setSections(p => {
    const i = p.findIndex(s => s.id === id)
    const j = i + dir
    if (j < 0 || j >= p.length) return p
    const a = [...p];[a[i], a[j]] = [a[j], a[i]]; return a
  })
  const updateSection = (id, patch) => setSections(p => p.map(s => s.id === id ? { ...s, ...patch } : s))

  const saveToWorkspace = async () => {
    if (!activeWorkspace || wsSaved) return
    if (!wsReportIdRef.current) wsReportIdRef.current = crypto.randomUUID()
    const name = reportTitle.trim() || 'Untitled Report'
    await window.nexus.workspace.saveReport({
      workspaceId: activeWorkspace.id,
      id:          wsReportIdRef.current,
      name,
      sections,
      theme:       activeTheme,
    })
    await window.nexus.workspace.addActivity({
      workspaceId: activeWorkspace.id,
      tool:        'report-builder',
      action:      'save_report',
      detail:      name,
    })
    window.dispatchEvent(new Event('nexus:workspace:refresh'))
    setWsSaved(true)
    setTimeout(() => setWsSaved(false), 2000)
  }

  const handleExport = async () => {
    if (exporting) return
    const savePath = await window.nexus.saveFile({
      defaultPath: (reportTitle || 'Report') + '.pdf',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    })
    if (!savePath) return

    const previewEl = document.querySelector('[data-report-preview]')
    if (!previewEl) return

    setExporting(true)
    try {
      const cssText = Array.from(document.styleSheets).flatMap(ss => {
        try { return Array.from(ss.cssRules).map(r => r.cssText) }
        catch { return [] }
      }).join('\n')

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; padding: 32px; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: white; }
[data-report-preview] { max-width: 100% !important; box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
${cssText}
</style>
</head>
<body>
${previewEl.outerHTML}
</body>
</html>`

      await window.nexus.markdown.exportPDF(html, savePath)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className={styles.root}>
      {/* ── Left: Composer ── */}
      <div className={styles.composer}>
        <div className={styles.composerTop}>
          <input
            className={styles.titleInput}
            value={reportTitle}
            onChange={e => setReportTitle(e.target.value)}
            placeholder="Report title"
          />
          {activeWorkspace && (
            <button
              className={`${styles.wsSaveBtn} ${wsSaved ? styles.wsSaveBtnSaved : ''}`}
              onClick={saveToWorkspace}
              disabled={wsSaved}
              title={`Save report to "${activeWorkspace.name}"`}
            >
              {wsSaved ? '✓ Saved' : 'Save'}
            </button>
          )}
          <button className={styles.exportBtn} onClick={handleExport} disabled={exporting}>
            {exporting ? 'Saving…' : 'Export PDF'}
          </button>
        </div>

        <div className={styles.themeRow}>
          <span className={styles.themeLabel}>Theme</span>
          {Object.entries(THEMES).map(([key, t]) => (
            <button
              key={key}
              className={`${styles.themeSwatch}${activeTheme === key ? ` ${styles.themeSwatchActive}` : ''}`}
              style={{ background: t.swatchColor }}
              title={t.label}
              onClick={() => setActiveTheme(key)}
            />
          ))}
          <span className={styles.themeActiveName}>{THEMES[activeTheme].label}</span>
        </div>

        <div className={styles.sectionList}>
          {sections.map((s, i) => (
            <div key={s.id} className={styles.sectionCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardType}>{SECTION_LABELS[s.type] ?? s.type}</span>
                <div className={styles.cardActions}>
                  <button onClick={() => moveSection(s.id, -1)} disabled={i === 0} title="Move up">↑</button>
                  <button onClick={() => moveSection(s.id, 1)}  disabled={i === sections.length - 1} title="Move down">↓</button>
                  <button className={styles.removeBtn} onClick={() => removeSection(s.id)} title="Remove">✕</button>
                </div>
              </div>

              {(s.type === 'heading' || s.type === 'text') && (
                <textarea
                  className={styles.cardTextarea}
                  value={s.text}
                  onChange={e => updateSection(s.id, { text: e.target.value })}
                  placeholder={s.type === 'heading' ? 'Section heading…' : 'Write here…'}
                  rows={s.type === 'heading' ? 1 : 4}
                />
              )}

              {(s.type === 'stats' || s.type === 'table') && (
                <p className={styles.cardInfo}>
                  {dataset
                    ? `From "${dataset.name}" · ${dataset.rows?.length ?? 0} rows`
                    : 'No dataset — navigate here from CSV Editor or OCR Reader'}
                </p>
              )}

              {s.type === 'chart' && (
                <div className={styles.chartConfig}>
                  {dataset ? (
                    <>
                      <div className={styles.cfRow}>
                        <label className={styles.cfLabel}>Type</label>
                        <select
                          className={styles.cfSelect}
                          value={s.chartType || 'bar'}
                          onChange={e => updateSection(s.id, { chartType: e.target.value })}
                        >
                          {CHART_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.cfRow}>
                        <label className={styles.cfLabel}>X axis</label>
                        <select
                          className={styles.cfSelect}
                          value={s.xCol || ''}
                          onChange={e => updateSection(s.id, { xCol: e.target.value })}
                        >
                          <option value="">— column —</option>
                          {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className={styles.cfRow}>
                        <label className={styles.cfLabel}>Y axis</label>
                        <select
                          className={styles.cfSelect}
                          value={s.yCol || ''}
                          onChange={e => updateSection(s.id, { yCol: e.target.value })}
                        >
                          <option value="">— column —</option>
                          {s.chartType !== 'scatter' && (
                            <option value="__count__">Count rows</option>
                          )}
                          {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      {s.chartType !== 'scatter' && s.chartType !== 'line' && s.chartType !== 'area' && (
                        <>
                          <div className={styles.cfRow}>
                            <label className={styles.cfLabel}>Sort</label>
                            <select
                              className={styles.cfSelect}
                              value={s.sortOrder || 'desc'}
                              onChange={e => updateSection(s.id, { sortOrder: e.target.value })}
                            >
                              <option value="desc">Highest first</option>
                              <option value="asc">Lowest first</option>
                            </select>
                          </div>
                          <div className={styles.cfRow}>
                            <label className={styles.cfLabel}>Show</label>
                            <input
                              type="number"
                              className={styles.cfInput}
                              value={s.maxItems ?? 20}
                              min={1} max={50}
                              onChange={e => updateSection(s.id, { maxItems: Number(e.target.value) })}
                            />
                            <span className={styles.cfUnit}>items</span>
                          </div>
                        </>
                      )}
                      <div className={styles.cfRow}>
                        <label className={styles.cfLabel}>Colors</label>
                        <select
                          className={styles.cfSelect}
                          value={s.colorMode || 'multi'}
                          onChange={e => updateSection(s.id, { colorMode: e.target.value })}
                        >
                          <option value="multi">Multi-color</option>
                          <option value="single">Single color</option>
                        </select>
                      </div>
                      <div className={styles.cfRow}>
                        <label className={styles.cfLabel}>Title</label>
                        <input
                          type="text"
                          className={styles.cfInput}
                          value={s.chartTitle || ''}
                          placeholder="optional chart title"
                          onChange={e => updateSection(s.id, { chartTitle: e.target.value })}
                        />
                      </div>
                      {s.chartType === 'scatter' && (
                        <p className={styles.cfHint}>Both X and Y should be numeric columns.</p>
                      )}
                    </>
                  ) : (
                    <p className={styles.cardInfo}>No dataset — navigate here from CSV Editor or OCR Reader</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={styles.addRow}>
          <span className={styles.addLabel}>Add:</span>
          <button className={styles.addBtn} onClick={() => addSection('heading')}>Heading</button>
          <button className={styles.addBtn} onClick={() => addSection('text')}>Text</button>
          <button className={styles.addBtn} onClick={() => addSection('stats')}>Stats</button>
          <button className={styles.addBtn} onClick={() => addSection('chart')}>Chart</button>
          <button className={styles.addBtn} onClick={() => addSection('table')}>Table</button>
        </div>
      </div>

      {/* ── Right: Preview ── */}
      <div className={styles.previewPanel}>
        <div className={styles.previewLabel}>Preview</div>
        <div className={styles.previewScroll}>
          <ReportPreview sections={sections} dataset={dataset} reportTitle={reportTitle} theme={THEMES[activeTheme]} />
        </div>
      </div>
    </div>
  )
}
