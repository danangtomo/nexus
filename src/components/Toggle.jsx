import styles from './Toggle.module.css'

/** Apple HIG Toggle (pill switch) */
export default function Toggle({ checked, onChange, disabled, label, id }) {
  const uid = id || `toggle-${Math.random().toString(36).slice(2)}`
  return (
    <label className={`${styles.wrapper} ${disabled ? styles.disabled : ''}`} htmlFor={uid}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={`${styles.track} ${checked ? styles.on : ''}`}>
        <div className={styles.thumb} />
        <input
          id={uid}
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          className={styles.input}
        />
      </div>
    </label>
  )
}
