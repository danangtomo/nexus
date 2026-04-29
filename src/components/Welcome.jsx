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

import { useNavigate } from 'react-router-dom'
import styles from './Welcome.module.css'

const highlights = [
  { icon: '🖼', label: 'Image Tools', desc: 'Convert, resize, compress, remove backgrounds' },
  { icon: '📄', label: 'PDF Tools', desc: 'Merge, split, compress, encrypt, OCR' },
  { icon: '🎬', label: 'Media', desc: 'Video & audio conversion via FFmpeg' },
  { icon: '✏️', label: 'Editors', desc: 'Rich text, Markdown, CSV, JSON, Diff' },
  { icon: '🗂', label: 'Productivity', desc: 'Kanban, Pomodoro, Gantt, SQL, formulas' },
  { icon: '🔐', label: 'Security', desc: 'Passwords, encryption, hashing' },
]

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.badge}>100% Offline · No Cloud · No AI</div>
        <h1 className={styles.heading}>
          Everything you need,<br />right on your machine.
        </h1>
        <p className={styles.sub}>
          NEXUS bundles 37 productivity tools in a single desktop app.
          All processing happens locally — no internet required.
        </p>
        <button className={`btn btn-primary ${styles.startBtn}`} onClick={() => navigate('/image-converter')}>
          Get Started
        </button>
      </div>

      <div className={styles.grid}>
        {highlights.map((h) => (
          <div key={h.label} className={styles.card}>
            <span className={styles.cardIcon}>{h.icon}</span>
            <strong className={styles.cardLabel}>{h.label}</strong>
            <p className={styles.cardDesc}>{h.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
