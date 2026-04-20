import { useTheme } from '../contexts/ThemeContext'
import styles from './Settings.module.css'

const APPEARANCE_OPTIONS = [
  {
    value: 'light',
    label: 'Light',
    preview: <LightPreview />,
  },
  {
    value: 'dark',
    label: 'Dark',
    preview: <DarkPreview />,
  },
  {
    value: 'system',
    label: 'Auto',
    preview: <AutoPreview />,
  },
]

export default function Settings() {
  const { theme, changeTheme } = useTheme()

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Settings</h1>

      {/* ── Appearance ─────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Appearance</h2>
        <div className={styles.sectionBody}>
          <div className={styles.appearanceRow}>
            <div className={styles.appearanceCards}>
              {APPEARANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.appearanceCard} ${theme === opt.value ? styles.cardSelected : ''}`}
                  onClick={() => changeTheme(opt.value)}
                  aria-pressed={theme === opt.value}
                >
                  <div className={styles.previewWrap}>{opt.preview}</div>
                  <div className={styles.cardFooter}>
                    <span className={`${styles.checkCircle} ${theme === opt.value ? styles.checkActive : ''}`}>
                      {theme === opt.value && <CheckIcon />}
                    </span>
                    <span className={styles.cardLabel}>{opt.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── About ──────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>About</h2>
        <div className={styles.sectionBody}>
          <div className={styles.aboutRow}>
            <span className={styles.aboutLabel}>Version</span>
            <span className={styles.aboutValue}>1.0.0</span>
          </div>
          <div className={styles.rowSep} />
          <div className={styles.aboutRow}>
            <span className={styles.aboutLabel}>License</span>
            <span className={styles.aboutValue}>MIT</span>
          </div>
          <div className={styles.rowSep} />
          <div className={styles.aboutRow}>
            <span className={styles.aboutLabel}>All processing</span>
            <span className={styles.aboutValue}>100% local · No cloud</span>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ── Preview thumbnails ─────────────────────────────────────────────────── */
function LightPreview() {
  return (
    <svg width="88" height="56" viewBox="0 0 88 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="88" height="56" rx="6" fill="#f2f2f7"/>
      <rect width="88" height="11" fill="#e5e5ea"/>
      <rect x="4" y="3" width="5" height="5" rx="2.5" fill="#ff5f57"/>
      <rect x="12" y="3" width="5" height="5" rx="2.5" fill="#febc2e"/>
      <rect x="20" y="3" width="5" height="5" rx="2.5" fill="#28c840"/>
      <rect x="4" y="16" width="20" height="34" rx="4" fill="#ffffff"/>
      <rect x="6" y="18" width="12" height="3" rx="1.5" fill="#c7c7cc"/>
      <rect x="6" y="23" width="9" height="2" rx="1" fill="#d1d1d6"/>
      <rect x="6" y="27" width="11" height="2" rx="1" fill="#d1d1d6"/>
      <rect x="6" y="31" width="8" height="2" rx="1" fill="#d1d1d6"/>
      <rect x="28" y="16" width="56" height="34" rx="4" fill="#ffffff"/>
      <rect x="32" y="22" width="36" height="4" rx="2" fill="#e5e5ea"/>
      <rect x="32" y="29" width="24" height="3" rx="1.5" fill="#f2f2f7"/>
      <rect x="32" y="35" width="28" height="3" rx="1.5" fill="#f2f2f7"/>
      <rect x="32" y="41" width="20" height="3" rx="1.5" fill="#f2f2f7"/>
    </svg>
  )
}

function DarkPreview() {
  return (
    <svg width="88" height="56" viewBox="0 0 88 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="88" height="56" rx="6" fill="#000000"/>
      <rect width="88" height="11" fill="#1c1c1e"/>
      <rect x="4" y="3" width="5" height="5" rx="2.5" fill="#ff5f57"/>
      <rect x="12" y="3" width="5" height="5" rx="2.5" fill="#febc2e"/>
      <rect x="20" y="3" width="5" height="5" rx="2.5" fill="#28c840"/>
      <rect x="4" y="16" width="20" height="34" rx="4" fill="#1c1c1e"/>
      <rect x="6" y="18" width="12" height="3" rx="1.5" fill="#3a3a3c"/>
      <rect x="6" y="23" width="9" height="2" rx="1" fill="#2c2c2e"/>
      <rect x="6" y="27" width="11" height="2" rx="1" fill="#2c2c2e"/>
      <rect x="6" y="31" width="8" height="2" rx="1" fill="#2c2c2e"/>
      <rect x="28" y="16" width="56" height="34" rx="4" fill="#1c1c1e"/>
      <rect x="32" y="22" width="36" height="4" rx="2" fill="#3a3a3c"/>
      <rect x="32" y="29" width="24" height="3" rx="1.5" fill="#2c2c2e"/>
      <rect x="32" y="35" width="28" height="3" rx="1.5" fill="#2c2c2e"/>
      <rect x="32" y="41" width="20" height="3" rx="1.5" fill="#2c2c2e"/>
    </svg>
  )
}

function AutoPreview() {
  return (
    <svg width="88" height="56" viewBox="0 0 88 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="left-half"><rect width="44" height="56"/></clipPath>
        <clipPath id="right-half"><rect x="44" y="0" width="44" height="56"/></clipPath>
        <clipPath id="card-clip"><rect width="88" height="56" rx="6"/></clipPath>
      </defs>
      {/* Light half */}
      <g clipPath="url(#card-clip)">
        <g clipPath="url(#left-half)">
          <rect width="88" height="56" fill="#f2f2f7"/>
          <rect width="88" height="11" fill="#e5e5ea"/>
          <rect x="4" y="16" width="20" height="34" rx="4" fill="#ffffff"/>
          <rect x="28" y="16" width="56" height="34" rx="4" fill="#ffffff"/>
          <rect x="32" y="22" width="36" height="4" rx="2" fill="#e5e5ea"/>
          <rect x="32" y="29" width="24" height="3" rx="1.5" fill="#f2f2f7"/>
        </g>
        {/* Dark half */}
        <g clipPath="url(#right-half)">
          <rect width="88" height="56" fill="#000000"/>
          <rect width="88" height="11" fill="#1c1c1e"/>
          <rect x="4" y="16" width="20" height="34" rx="4" fill="#1c1c1e"/>
          <rect x="28" y="16" width="56" height="34" rx="4" fill="#1c1c1e"/>
          <rect x="32" y="22" width="36" height="4" rx="2" fill="#3a3a3c"/>
          <rect x="32" y="29" width="24" height="3" rx="1.5" fill="#2c2c2e"/>
        </g>
        {/* Diagonal divider */}
        <line x1="48" y1="0" x2="40" y2="56" stroke="rgba(128,128,128,0.3)" strokeWidth="1"/>
        {/* Traffic lights */}
        <rect x="4" y="3" width="5" height="5" rx="2.5" fill="#ff5f57"/>
        <rect x="12" y="3" width="5" height="5" rx="2.5" fill="#febc2e"/>
        <rect x="20" y="3" width="5" height="5" rx="2.5" fill="#28c840"/>
      </g>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
