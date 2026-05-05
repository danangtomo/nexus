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

import { NavLink } from 'react-router-dom'
import styles from './Sidebar.module.css'

const categories = [
  {
    label: 'Data',
    icon: '📊',
    tools: [
      { path: '/csv-editor', label: 'CSV Editor' },
      { path: '/json-formatter', label: 'JSON Formatter' },
      { path: '/chart-builder', label: 'Chart Builder' },
      { path: '/sql-runner', label: 'SQL Runner' },
    ],
  },
  {
    label: 'Documents',
    icon: '📝',
    tools: [
      { path: '/rich-text-editor', label: 'Rich Text Editor' },
      { path: '/markdown-editor', label: 'Markdown Editor' },
      { path: '/doc-converter', label: 'Doc Converter' },
      { path: '/spreadsheet-converter', label: 'Spreadsheet Converter' },
      { path: '/diff-checker', label: 'Diff Checker' },
    ],
  },
  {
    label: 'Images',
    icon: '🖼',
    tools: [
      { path: '/image-converter', label: 'Image Converter' },
      { path: '/image-resizer', label: 'Image Resizer' },
      { path: '/image-compressor', label: 'Image Compressor' },
      { path: '/background-remover', label: 'Background Remover' },
      { path: '/watermark-tool', label: 'Watermark Tool' },
      { path: '/metadata-remover', label: 'Metadata Remover' },
    ],
  },
  {
    label: 'PDF',
    icon: '📄',
    tools: [
      { path: '/pdf-merger', label: 'PDF Merger' },
      { path: '/pdf-splitter', label: 'PDF Splitter' },
      { path: '/pdf-compressor', label: 'PDF Compressor' },
      { path: '/pdf-encryptor', label: 'PDF Encryptor' },
      { path: '/ocr-reader', label: 'OCR Reader' },
    ],
  },
  {
    label: 'Media',
    icon: '🎬',
    tools: [
      { path: '/video-converter', label: 'Video Converter' },
      { path: '/audio-converter', label: 'Audio Converter' },
    ],
  },
  {
    label: 'Files',
    icon: '🗂',
    tools: [
      { path: '/archive-manager', label: 'Archive Manager' },
    ],
  },
  {
    label: 'Productivity',
    icon: '⏱',
    tools: [
      { path: '/kanban-board', label: 'Kanban Board' },
      { path: '/pomodoro-timer', label: 'Pomodoro Timer' },
      { path: '/gantt-chart', label: 'Gantt Chart' },
    ],
  },
]

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect width="160" height="160" rx="36" fill="#0d0d1a"/>
      <ellipse cx="80" cy="80" rx="44" ry="44" fill="url(#sg)" opacity="0.18"/>
      <line x1="44" y1="108" x2="44"  y2="52"  stroke="#fff" strokeWidth="10" strokeLinecap="round"/>
      <line x1="44" y1="52"  x2="116" y2="108" stroke="#fff" strokeWidth="10" strokeLinecap="round"/>
      <line x1="116" y1="108" x2="116" y2="52" stroke="#fff" strokeWidth="10" strokeLinecap="round"/>
      <circle cx="44"  cy="52"  r="7" fill="#007AFF"/>
      <circle cx="116" cy="52"  r="7" fill="#007AFF"/>
      <circle cx="44"  cy="108" r="7" fill="#007AFF"/>
      <circle cx="116" cy="108" r="7" fill="#007AFF"/>
      <circle cx="80"  cy="80"  r="5" fill="#007AFF" opacity="0.6"/>
      <defs>
        <radialGradient id="sg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#007AFF"/>
          <stop offset="100%" stopColor="#007AFF" stopOpacity="0"/>
        </radialGradient>
      </defs>
    </svg>
  )
}

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <NavLink to="/" className={styles.logoLink}>
          <LogoMark />
          <span className={styles.logoText}>NEXUS</span>
        </NavLink>
      </div>

      <nav className={styles.nav}>
        {categories.map((cat) => (
          <div key={cat.label} className={styles.category}>
            <div className={styles.catHeader}>
              <span className={styles.catIcon}>{cat.icon}</span>
              <span className={styles.catLabel}>{cat.label}</span>
            </div>
            <ul className={styles.toolList}>
              {cat.tools.map((tool) => (
                <li key={tool.path}>
                  <NavLink
                    to={tool.path}
                    className={({ isActive }) =>
                      `${styles.toolLink} ${isActive ? styles.active : ''}`
                    }
                  >
                    {tool.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `${styles.settingsLink} ${isActive ? styles.active : ''}`
          }
        >
          <span className={styles.settingsIcon}>⚙️</span>
          Settings
        </NavLink>
      </div>
    </aside>
  )
}
