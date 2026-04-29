/**
 * Nexus - Offline productivity suite
 * Copyright (C) 2026 Danang Estutomoaji
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { useState, useCallback } from 'react'
import DropZone from '../../components/DropZone'
import ProgressBar from '../../components/ProgressBar'
import { FORMATS, QUALITIES, getAudioInfo, convertAudio } from './handler'
import styles from './index.module.css'

const LOSSLESS = ['flac', 'wav']

export default function AudioConverter() {
  const [file,       setFile]       = useState(null)
  const [info,       setInfo]       = useState(null)
  const [format,     setFormat]     = useState('mp3')
  const [quality,    setQuality]    = useState('medium')
  const [busy,       setBusy]       = useState(false)
  const [progress,   setProgress]   = useState(0)
  const [outputPath, setOutputPath] = useState('')
  const [error,      setError]      = useState('')

  const handleFiles = useCallback(async (incoming) => {
    setOutputPath('')
    setError('')
    setProgress(0)
    const raw  = incoming[0]
    const path = typeof raw === 'string' ? raw : (raw?.path ?? '')
    const name = path.split(/[\\/]/).pop()
    if (!path) return
    setFile({ path, name })
    try {
      const meta = await getAudioInfo(path)
      setInfo(meta)
    } catch {
      setInfo(null)
    }
  }, [])

  const handleConvert = async () => {
    const fmt      = FORMATS.find((f) => f.ext === format)
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const savePath = await window.nexus.saveFile({
      title: 'Save converted audio',
      defaultPath: `${baseName}.${fmt.ext}`,
      filters: [{ name: fmt.label, extensions: [fmt.ext] }],
    })
    if (!savePath) return

    setBusy(true)
    setProgress(0)
    setOutputPath('')
    setError('')
    try {
      await convertAudio(file.path, savePath, format, quality, (pct) => setProgress(pct))
      setOutputPath(savePath)
    } catch (err) {
      setError(`Conversion failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setFile(null); setInfo(null); setOutputPath(''); setError('') }
  const isLossless = LOSSLESS.includes(format)

  return (
    <div className={styles.page}>
      {!file ? (
        <DropZone
          onFiles={handleFiles}
          accept={['mp3', 'aac', 'm4a', 'ogg', 'flac', 'wav', 'wma', 'opus', 'aiff']}
          multiple={false}
          label="Drop an audio file here or click to browse"
          sublabel="MP3, AAC, OGG, FLAC, WAV, M4A and more"
        />
      ) : (
        <div className={styles.fileBar}>
          <div className={styles.fileBarLeft}>
            <span className={styles.fileName}>{file.name}</span>
            {info && (
              <div className={styles.metaRow}>
                {info.codec      && <span className={styles.meta}>{info.codec}</span>}
                {info.sampleRate && <span className={styles.meta}>{info.sampleRate}</span>}
                {info.channels   && <span className={styles.meta}>{info.channels}</span>}
                {info.duration   && <span className={styles.meta}>{info.duration}</span>}
                {info.size       && <span className={styles.meta}>{info.size}</span>}
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Change</button>
        </div>
      )}

      {file && (
        <>
          {/* Format selector */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Output format</p>
            <div className={styles.formatGrid}>
              {FORMATS.map((f) => (
                <button
                  key={f.ext}
                  className={`${styles.fmtBtn} ${format === f.ext ? styles.fmtActive : ''}`}
                  onClick={() => { setFormat(f.ext); setOutputPath('') }}
                  disabled={busy}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality — hidden for lossless */}
          {!isLossless && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Quality</p>
              <div className={styles.qualityRow}>
                {QUALITIES.map((q) => (
                  <button
                    key={q.id}
                    className={`${styles.qualBtn} ${quality === q.id ? styles.qualActive : ''}`}
                    onClick={() => { setQuality(q.id); setOutputPath('') }}
                    disabled={busy}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLossless && (
            <p className={styles.note}>Lossless format — no quality setting needed</p>
          )}

          {busy && (
            <div className={styles.progressWrap}>
              <ProgressBar percent={progress} />
              <span className={styles.progressLabel}>{Math.round(progress)}%</span>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          {outputPath && (
            <div className={styles.successBanner}>
              <span>✓ Converted successfully</span>
              <button className="btn btn-ghost btn-sm" onClick={() => window.nexus.showItemInFolder(outputPath)}>
                Show in folder
              </button>
            </div>
          )}
        </>
      )}

      {file && (
        <div className={styles.footer}>
          <button className="btn btn-primary" onClick={handleConvert} disabled={busy}>
            {busy ? 'Converting…' : `Convert to ${format.toUpperCase()}`}
          </button>
        </div>
      )}
    </div>
  )
}
