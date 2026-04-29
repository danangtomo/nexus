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

import { useMemo } from 'react'
import { extractHeadings } from './handler'
import styles from './OutlinePanel.module.css'

export default function OutlinePanel({ markdown, onHeadingClick }) {
  const headings = useMemo(() => extractHeadings(markdown), [markdown])

  if (headings.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.title}>Outline</div>
        <div className={styles.empty}>No headings yet.<br/>Add # H1, ## H2…</div>
      </div>
    )
  }

  const minLevel = Math.min(...headings.map(h => h.level))

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Outline</div>
      <div className={styles.list}>
        {headings.map((h, i) => (
          <button
            key={i}
            className={`${styles.item} ${styles[`level${h.level}`]}`}
            style={{ paddingLeft: (h.level - minLevel) * 12 + 10 }}
            onClick={() => onHeadingClick(h)}
            title={h.text}
          >
            <span className={styles.bullet}>{'#'.repeat(h.level)}</span>
            <span className={styles.text}>{h.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
