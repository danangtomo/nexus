import styles from './ProgressBar.module.css'

export default function ProgressBar({ value = 0, label }) {
  return (
    <div className={styles.wrapper}>
      {label && <div className={styles.label}>{label}</div>}
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <div className={styles.pct}>{Math.round(value)}%</div>
    </div>
  )
}
