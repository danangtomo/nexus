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
import { recognizeImage, saveText, LANGUAGES } from './handler'
import styles from './index.module.css'

export default function OcrReader() {
  const [file,      setFile]      = useState(null)
  const [lang,      setLang]      = useState('eng')
  const [busy,      setBusy]      = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [text,      setText]      = useState('')
  const [copied,    setCopied]    = useState(false)
  const [error,     setError]     = useState('')
  const handleFiles = useCallback((incoming) => {
    const raw  = incoming[0]
    const path = typeof raw === 'string' ? raw : (raw?.path ?? '')
    const name = path.split(/[\\/]/).pop()
    if (!path) return
    setFile({ path, name })
    setText('')
    setError('')
    setProgress(0)
  }, [])

  const handleRecognize = async () => {
    if (!file) return
    setBusy(true)
    setProgress(0)
    setText('')
    setError('')

    try {
      const result = await recognizeImage(file.path, lang, (pct) => {
        setProgress(pct)
      })
      setText(result)
      setProgress(100)
    } catch (err) {
      setError(`OCR failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    if (!text) return
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const savePath = await window.nexus.saveFile({
      title: 'Save extracted text',
      defaultPath: `${baseName}_ocr.txt`,
      filters: [{ name: 'Text', extensions: ['txt'] }],
    })
    if (!savePath) return
    await saveText(text, savePath)
  }

  const reset = () => {
    setFile(null)
    setText('')
    setError('')
    setProgress(0)
  }

  return (
    <div className={styles.page}>
      {!file ? (
        <DropZone
          onFiles={handleFiles}
          accept={['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif']}
          multiple={false}
          label="Drop an image here or click to browse"
          sublabel="PNG, JPG, WEBP, BMP, TIFF supported"
        />
      ) : (
        <div className={styles.fileBar}>
          <span className={styles.fileName}>{file.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>
            Change file
          </button>
        </div>
      )}

      {file && (
        <div className={styles.controls}>
          <label className={styles.label}>Language</label>
          <select
            className={styles.select}
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={busy}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
      )}

      {busy && (
        <div className={styles.progressWrap}>
          <ProgressBar percent={progress} />
          <span className={styles.progressLabel}>
            {progress < 100 ? `Recognising… ${progress}%` : 'Done'}
          </span>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {text && (
        <div className={styles.outputSection}>
          <div className={styles.outputHeader}>
            <span className={styles.outputTitle}>Extracted text</span>
            <div className={styles.outputActions}>
              <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleSave}>
                Save .txt
              </button>
            </div>
          </div>
          <textarea
            className={styles.textArea}
            readOnly
            value={text}
            spellCheck={false}
          />
        </div>
      )}

      {file && (
        <div className={styles.footer}>
          <button
            className="btn btn-primary"
            onClick={handleRecognize}
            disabled={busy}
          >
            {busy ? 'Recognising…' : 'Extract Text'}
          </button>
        </div>
      )}
    </div>
  )
}
