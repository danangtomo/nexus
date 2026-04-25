import styles from './ToolLayout.module.css'

export default function ToolLayout({ title, children, fill = false }) {
  return (
    <div className={styles.layout}>
      {title && (
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
        </header>
      )}
      <div className={`${styles.content}${fill ? ' ' + styles.contentFill : ''}`}>{children}</div>
    </div>
  )
}
