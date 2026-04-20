import { NavLink } from 'react-router-dom'
import styles from './Sidebar.module.css'

const categories = [
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
    label: 'Documents',
    icon: '📝',
    tools: [
      { path: '/doc-converter', label: 'Doc Converter' },
      { path: '/spreadsheet-converter', label: 'Spreadsheet Converter' },
      { path: '/archive-manager', label: 'Archive Manager' },
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
    label: 'Generators',
    icon: '✨',
    tools: [
      { path: '/qr-barcode', label: 'QR & Barcode' },
      { path: '/chart-builder', label: 'Chart Builder' },
    ],
  },
  {
    label: 'Editors',
    icon: '✏️',
    tools: [
      { path: '/rich-text-editor', label: 'Rich Text Editor' },
      { path: '/markdown-editor', label: 'Markdown Editor' },
      { path: '/csv-editor', label: 'CSV Editor' },
      { path: '/json-formatter', label: 'JSON Formatter' },
      { path: '/diff-checker', label: 'Diff Checker' },
    ],
  },
  {
    label: 'Productivity',
    icon: '🗂',
    tools: [
      { path: '/kanban-board', label: 'Kanban Board' },
      { path: '/pomodoro-timer', label: 'Pomodoro Timer' },
      { path: '/gantt-chart', label: 'Gantt Chart' },
      { path: '/sql-runner', label: 'SQL Runner' },
      { path: '/formula-calculator', label: 'Formula Calculator' },
      { path: '/timezone-converter', label: 'Timezone Converter' },
    ],
  },
  {
    label: 'Security',
    icon: '🔐',
    tools: [
      { path: '/password-generator', label: 'Password Generator' },
      { path: '/file-encryptor', label: 'File Encryptor' },
      { path: '/hash-generator', label: 'Hash Generator' },
    ],
  },
  {
    label: 'Utilities',
    icon: '🔧',
    tools: [
      { path: '/unit-converter', label: 'Unit Converter' },
      { path: '/color-converter', label: 'Color Converter' },
      { path: '/base64-encoder', label: 'Base64 Encoder' },
      { path: '/regex-tester', label: 'Regex Tester' },
      { path: '/word-counter', label: 'Word Counter' },
    ],
  },
]

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <NavLink to="/" className={styles.logoLink}>
          <span className={styles.logoMark}>N</span>
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
