import { useState, useEffect } from 'react'
import styles from './UpdateNotification.module.css'

export default function UpdateNotification() {
  const [state, setState] = useState('idle') // idle | available | downloading | downloaded | error
  const [info, setInfo] = useState(null)
  const [progress, setProgress] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!window.nexus?.updater) return

    const offAvailable = window.nexus.updater.onAvailable((i) => {
      setInfo(i)
      setState('available')
    })
    const offProgress = window.nexus.updater.onProgress((p) => {
      setProgress(Math.round(p.percent))
      setState('downloading')
    })
    const offDownloaded = window.nexus.updater.onDownloaded((i) => {
      setInfo(i)
      setState('downloaded')
    })
    const offError = window.nexus.updater.onError(() => {
      setState('error')
    })

    return () => {
      offAvailable?.()
      offProgress?.()
      offDownloaded?.()
      offError?.()
    }
  }, [])

  if (dismissed || state === 'idle') return null

  const handleDownload = () => {
    window.nexus.updater.download()
    setState('downloading')
  }

  const handleInstall = () => {
    window.nexus.updater.install()
  }

  return (
    <div className={styles.banner}>
      <span className={styles.dot} />
      {state === 'available' && (
        <>
          <span className={styles.msg}>
            Version <strong>{info?.version}</strong> is available
          </span>
          <button className={styles.btn} onClick={handleDownload}>Download</button>
          <button className={styles.dismiss} onClick={() => setDismissed(true)}>✕</button>
        </>
      )}
      {state === 'downloading' && (
        <>
          <span className={styles.msg}>Downloading update… {progress}%</span>
          <div className={styles.bar}>
            <div className={styles.fill} style={{ width: `${progress}%` }} />
          </div>
        </>
      )}
      {state === 'downloaded' && (
        <>
          <span className={styles.msg}>
            <strong>{info?.version}</strong> ready to install
          </span>
          <button className={styles.btn} onClick={handleInstall}>Restart &amp; Install</button>
          <button className={styles.dismiss} onClick={() => setDismissed(true)}>✕</button>
        </>
      )}
      {state === 'error' && (
        <>
          <span className={styles.msg}>Update check failed</span>
          <button className={styles.dismiss} onClick={() => setDismissed(true)}>✕</button>
        </>
      )}
    </div>
  )
}
