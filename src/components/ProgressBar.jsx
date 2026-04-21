import styles from './ProgressBar.module.css'

export default function ProgressBar({ percent = 0, value, label }) {
  const pct = Math.min(100, Math.max(0, percent ?? value ?? 0))
  return (
    <div className={styles.wrapper}>
      {label && <div className={styles.label}>{label}</div>}
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.pct}>{Math.round(pct)}%</div>
    </div>
  )
}
