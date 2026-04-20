import styles from './ToolLayout.module.css'

export default function ToolLayout({ title, children }) {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
      </header>
      <div className={styles.content}>{children}</div>
    </div>
  )
}
