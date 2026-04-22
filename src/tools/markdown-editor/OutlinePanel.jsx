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
