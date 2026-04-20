import styles from './SegmentedControl.module.css'

/**
 * Apple HIG Segmented Control
 * props: options=[{value, label, icon?}], value, onChange, size='md'|'sm'
 */
export default function SegmentedControl({ options, value, onChange, size = 'md' }) {
  return (
    <div className={`${styles.control} ${styles[size]}`} role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`${styles.segment} ${value === opt.value ? styles.selected : ''}`}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
        >
          {opt.icon && <span className={styles.icon}>{opt.icon}</span>}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
