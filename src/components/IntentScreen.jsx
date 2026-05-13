/**
 * Nexus - Offline productivity suite
 * Copyright (C) 2026 Danang Estutomoaji
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import styles from './IntentScreen.module.css'

const HERO_FLOW = ['Drop PDF', 'OCR & Extract', 'Data Table', 'Export Report']

const PRIMARY = [
  {
    icon: '📊',
    title: 'Find insights from data',
    desc: 'Upload any CSV or JSON — view in a table, inspect column stats, filter and export',
    path: '/csv-editor',
  },
  {
    icon: '📄',
    title: 'Create a report from data',
    desc: 'Compose a structured report with tables, charts, and text — export as PDF',
    path: '/report-builder',
  },
  {
    icon: '🔄',
    title: 'Convert image format',
    desc: 'Convert between JPEG, PNG, WebP, AVIF, and more — batch supported',
    path: '/image-converter',
  },
]

const SECONDARY = [
  { icon: '🖼',  title: 'Extract text from image',   desc: 'Pull text and numbers from photos or screenshots',              path: '/ocr-reader' },
  { icon: '🧹',  title: 'Clean up messy data',        desc: 'Edit cells, fix values, filter and sort rows in your data table', path: '/csv-editor' },
  { icon: '🔗',  title: 'Combine two data tables',    desc: 'Merge or JOIN datasets using SQL',                               path: '/sql-runner' },
  { icon: '✏️', title: 'Write or edit a document',   desc: 'Format rich text with headings, tables, and lists — export ready', path: '/rich-text-editor' },
]

export default function IntentScreen() {
  const navigate = useNavigate()
  const { activeWorkspace } = useWorkspace()
  const [datasets,  setDatasets]  = useState([])
  const [activity,  setActivity]  = useState([])

  useEffect(() => {
    if (!activeWorkspace) return
    const load = () => {
      window.nexus.workspace.datasets(activeWorkspace.id).then(setDatasets)
      window.nexus.workspace.getActivity(activeWorkspace.id, 6).then(setActivity)
    }
    load()
    window.addEventListener('nexus:workspace:refresh', load)
    return () => window.removeEventListener('nexus:workspace:refresh', load)
  }, [activeWorkspace])

  async function openDataset(ds) {
    const full = await window.nexus.workspace.getDataset(ds.id)
    navigate('/csv-editor', { state: { dataset: { ...full, source: 'workspace' } } })
  }

  async function deleteDataset(e, id) {
    e.stopPropagation()
    await window.nexus.workspace.deleteDataset(id)
    setDatasets(p => p.filter(d => d.id !== id))
    window.dispatchEvent(new Event('nexus:workspace:refresh'))
  }

  function activityLabel(tool, action) {
    if (action === 'save_dataset') return 'Saved data table'
    if (action === 'save_report')  return 'Saved report'
    return action.replace(/_/g, ' ')
  }

  function activityIcon(tool) {
    if (tool === 'report-builder') return '📝'
    return '📊'
  }

  function fmtDate(ts) {
    if (!ts) return ''
    const d = new Date(ts * 1000)
    const now = Date.now()
    const diff = now - d.getTime()
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div className={styles.screen}>
      <div className={styles.container}>
        <div className={styles.badge}>100% Local &amp; Private · No Cloud Required</div>
        <h1 className={styles.heading}>What do you want to do?</h1>
        <p className={styles.sub}>Choose an outcome, pick a tool from the sidebar, or press <kbd>Ctrl K</kbd> to search</p>

        {/* ── Hero card ── */}
        <button className={styles.heroCard} onClick={() => navigate('/ocr-reader')}>
          <div className={styles.heroTop}>
            <span className={styles.heroIcon}>📄</span>
            <span className={styles.heroBadge}>⭐ Most popular</span>
          </div>
          <span className={styles.heroTitle}>Extract tables &amp; insights from PDF</span>
          <span className={styles.heroDesc}>
            Drop a PDF or invoice — get structured tables, key numbers, and a ready-to-export report in minutes.
          </span>
          <div className={styles.heroFlow}>
            {HERO_FLOW.map((step, i) => (
              <span key={step} className={styles.heroFlowItem}>
                <span className={styles.flowStep}>{step}</span>
                {i < HERO_FLOW.length - 1 && <span className={styles.flowArrow}>→</span>}
              </span>
            ))}
          </div>
        </button>

        {/* ── Primary cards ── */}
        <div className={styles.primaryGrid}>
          {PRIMARY.map(intent => (
            <button
              key={intent.title}
              className={styles.card}
              onClick={() => navigate(intent.path)}
            >
              <span className={styles.icon}>{intent.icon}</span>
              <span className={styles.cardTitle}>{intent.title}</span>
              <span className={styles.cardDesc}>{intent.desc}</span>
            </button>
          ))}
        </div>

        {/* ── Secondary ── */}
        <p className={styles.moreLabel}>More tools</p>
        <div className={styles.moreGrid}>
          {SECONDARY.map(intent => (
            <button
              key={intent.title}
              className={styles.moreCard}
              onClick={() => navigate(intent.path)}
            >
              <span className={styles.icon}>{intent.icon}</span>
              <span className={styles.cardTitle}>{intent.title}</span>
              <span className={styles.cardDesc}>{intent.desc}</span>
            </button>
          ))}
        </div>

        <div className={styles.divider}><span>or</span></div>

        <div className={styles.blanks}>
          <button className={styles.blankBtn} onClick={() => navigate('/csv-editor')}>
            Open blank data table
          </button>
          <button className={styles.blankBtn} onClick={() => navigate('/sql-runner')}>
            Open SQL Runner
          </button>
        </div>

        {/* ── Recent Data Tables ── */}
        {datasets.length > 0 && (
          <div className={styles.recentSection}>
            <p className={styles.recentLabel}>
              Recent Data Tables
              <span className={styles.recentLabelSep}>·</span>
              <span className={styles.recentWs}>{activeWorkspace?.name}</span>
            </p>
            <div className={styles.recentList}>
              {datasets.slice(0, 6).map(ds => (
                <div
                  key={ds.id}
                  className={styles.recentItem}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDataset(ds)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openDataset(ds) }}
                >
                  <span className={styles.recentIcon}>📊</span>
                  <span className={styles.recentInfo}>
                    <span className={styles.recentName}>{ds.name}</span>
                    <span className={styles.recentMeta}>{ds.row_count.toLocaleString()} rows · {fmtDate(ds.updated_at)}</span>
                  </span>
                  <button
                    className={styles.recentDel}
                    title="Remove from workspace"
                    onClick={e => deleteDataset(e, ds.id)}
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Activity timeline ── */}
        {activity.length > 0 && (
          <div className={styles.activitySection}>
            <p className={styles.recentLabel}>Recent Activity</p>
            <div className={styles.activityList}>
              {activity.map((a, i) => (
                <div key={i} className={styles.activityItem}>
                  <span className={styles.activityIcon}>{activityIcon(a.tool)}</span>
                  <span className={styles.activityInfo}>
                    <span className={styles.activityLabel}>{activityLabel(a.tool, a.action)}</span>
                    <span className={styles.activityDetail}>{a.detail}</span>
                  </span>
                  <span className={styles.activityTime}>{fmtDate(a.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
