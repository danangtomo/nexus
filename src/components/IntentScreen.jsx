/**
 * Nexus - Offline productivity suite
 * Copyright (C) 2026 Danang Estutomoaji
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useNavigate } from 'react-router-dom'
import styles from './IntentScreen.module.css'

const HERO_FLOW = ['Drop PDF', 'OCR & Extract', 'Data Table', 'Export Report']

const PRIMARY = [
  {
    icon: '📊',
    title: 'Find insights from data',
    desc: 'Upload any CSV or JSON — instantly see patterns, outliers, and summaries',
    path: '/csv-editor',
  },
  {
    icon: '📈',
    title: 'Create a report from data',
    desc: 'Turn your data into shareable charts and visuals — one click to export',
    path: '/chart-builder',
  },
  {
    icon: '🔄',
    title: 'Change file format',
    desc: 'Convert images, documents, PDFs, audio, and video — batch supported',
    path: '/image-converter',
  },
]

const SECONDARY = [
  { icon: '🖼',  title: 'Extract text from image',  desc: 'Pull text and numbers from photos or screenshots', path: '/ocr-reader' },
  { icon: '🧹',  title: 'Clean up messy data',       desc: 'Remove duplicates, fix formats, filter rows',       path: '/csv-editor' },
  { icon: '🔗',  title: 'Combine two data tables',   desc: 'Merge or JOIN datasets using SQL',                  path: '/sql-runner' },
  { icon: '✏️', title: 'Write or edit a document',  desc: 'Rich text, Markdown, or structured notes',          path: '/rich-text-editor' },
]

export default function IntentScreen() {
  const navigate = useNavigate()

  return (
    <div className={styles.screen}>
      <div className={styles.container}>
        <div className={styles.badge}>100% Offline &amp; Private · No Cloud Required</div>
        <h1 className={styles.heading}>What do you want to do?</h1>
        <p className={styles.sub}>Choose an outcome or pick a tool from the sidebar</p>

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
            Start blank workspace
          </button>
          <button className={styles.blankBtn} onClick={() => navigate('/sql-runner')}>
            Open SQL Runner
          </button>
        </div>
      </div>
    </div>
  )
}
