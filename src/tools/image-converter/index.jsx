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
import { convertImages, FORMATS } from './handler'
import styles from './index.module.css'

const ACCEPTS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'tiff', 'gif']

const QUALITY_FORMATS = new Set(['jpeg', 'webp', 'avif', 'tiff'])

function fmtSize(bytes) {
  if (bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function sizeDelta(inSize, outSize) {
  if (!inSize || !outSize) return null
  const pct = ((outSize - inSize) / inSize) * 100
  return pct.toFixed(1)
}

export default function ImageConverter() {
  const [files, setFiles] = useState([])       // [{path, name, status?, ...}]
  const [format, setFormat] = useState('webp')
  const [quality, setQuality] = useState(85)
  const [outputDir, setOutputDir] = useState('')
  const [running, setRunning] = useState(false)

  const handleFiles = useCallback((incoming) => {
    const mapped = incoming.map((f) => ({
      path: f.path ?? f,
      name: f.name ?? (f.path ?? f).split(/[\\/]/).pop(),
      status: 'pending',
    }))
    setFiles((prev) => {
      const existing = new Set(prev.map((x) => x.path))
      return [...prev, ...mapped.filter((f) => !existing.has(f.path))]
    })
  }, [])

  const pickOutputDir = async () => {
    const dir = await window.nexus.openDirectory({ title: 'Choose output folder' })
    if (dir) setOutputDir(dir)
  }

  const removeFile = (path) =>
    setFiles((prev) => prev.filter((f) => f.path !== path))

  const clearAll = () => setFiles([])

  const updateFile = useCallback((path, update) => {
    setFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, ...update } : f))
    )
  }, [])

  const convert = async () => {
    if (!files.length) return
    let dir = outputDir
    if (!dir) {
      dir = await window.nexus.openDirectory({ title: 'Choose output folder' })
      if (!dir) return
      setOutputDir(dir)
    }
    setRunning(true)
    // Reset all to pending
    setFiles((prev) => prev.map((f) => ({ ...f, status: 'pending', outputPath: undefined, outputSize: undefined, inputSize: undefined, error: undefined })))
    await convertImages(files, { format, quality, outputDir: dir }, updateFile)
    setRunning(false)
  }

  const doneCount = files.filter((f) => f.status === 'done').length
  const errorCount = files.filter((f) => f.status === 'error').length

  return (
    <div className={styles.page}>
      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <label className={styles.label}>Output format</label>
          <div className={styles.formatGrid}>
            {FORMATS.map((f) => (
              <button
                key={f}
                className={`${styles.fmtBtn} ${format === f ? styles.fmtActive : ''}`}
                onClick={() => setFormat(f)}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {QUALITY_FORMATS.has(format) && (
          <div className={styles.controlGroup}>
            <label className={styles.label}>
              Quality <span className={styles.qualVal}>{quality}</span>
            </label>
            <input
              type="range"
              min={1}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className={styles.slider}
            />
          </div>
        )}

        <div className={styles.controlGroup}>
          <label className={styles.label}>Output folder</label>
          <div className={styles.dirRow}>
            <span className={styles.dirPath}>{outputDir || 'Same as source (auto)'}</span>
            <button className="btn btn-ghost" onClick={pickOutputDir}>Browse</button>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      {files.length === 0 && (
        <DropZone
          onFiles={handleFiles}
          accept={ACCEPTS}
          multiple
          label="Drop images here or click to browse"
          sublabel="JPG · PNG · WEBP · AVIF · BMP · TIFF · GIF"
        />
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className={styles.fileSection}>
          <div className={styles.fileHeader}>
            <span className={styles.fileCount}>{files.length} file{files.length !== 1 ? 's' : ''}</span>
            <div className={styles.fileActions}>
              <button className="btn btn-ghost" onClick={clearAll} disabled={running}>Clear all</button>
              <button className="btn btn-ghost" onClick={() => document.getElementById('img-add-input').click()} disabled={running}>Add more</button>
              <input
                id="img-add-input"
                type="file"
                multiple
                accept={ACCEPTS.map((e) => `.${e}`).join(',')}
                style={{ display: 'none' }}
                onChange={(e) =>
                  handleFiles(
                    Array.from(e.target.files).map((f) => ({ path: f.path, name: f.name }))
                  )
                }
              />
            </div>
          </div>

          <div className={styles.fileList}>
            {files.map((f) => {
              const delta = sizeDelta(f.inputSize, f.outputSize)
              return (
                <div key={f.path} className={`${styles.fileRow} ${styles[`status_${f.status}`]}`}>
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{f.name}</span>
                    {f.status === 'done' && (
                      <span className={styles.sizeInfo}>
                        {fmtSize(f.inputSize)} → {fmtSize(f.outputSize)}
                        {delta !== null && (
                          <span className={parseFloat(delta) < 0 ? styles.smaller : styles.larger}>
                            {' '}({parseFloat(delta) > 0 ? '+' : ''}{delta}%)
                          </span>
                        )}
                      </span>
                    )}
                    {f.status === 'error' && (
                      <span className={styles.errorMsg}>{f.error}</span>
                    )}
                  </div>
                  <div className={styles.fileRight}>
                    <StatusBadge status={f.status} />
                    {f.status === 'done' && (
                      <button
                        className={styles.openBtn}
                        title="Show in folder"
                        onClick={() => window.nexus.showItemInFolder(f.outputPath)}
                      >
                        ↗
                      </button>
                    )}
                    {!running && (
                      <button className={styles.removeBtn} onClick={() => removeFile(f.path)}>×</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary bar when done */}
          {!running && doneCount > 0 && (
            <div className={styles.summary}>
              <span className={styles.summaryDone}>✓ {doneCount} converted</span>
              {errorCount > 0 && <span className={styles.summaryErr}>✗ {errorCount} failed</span>}
              {outputDir && (
                <button
                  className="btn btn-ghost"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => window.nexus.showItemInFolder(outputDir)}
                >
                  Open folder
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Convert button */}
      <div className={styles.footer}>
        <button
          className="btn btn-primary"
          onClick={convert}
          disabled={running || files.length === 0}
        >
          {running ? `Converting… (${doneCount + errorCount}/${files.length})` : `Convert ${files.length > 0 ? files.length : ''} file${files.length !== 1 ? 's' : ''} → ${format.toUpperCase()}`}
        </button>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    pending:    { label: 'Pending',    cls: styles.badgePending },
    converting: { label: 'Converting', cls: styles.badgeConverting },
    done:       { label: 'Done',       cls: styles.badgeDone },
    error:      { label: 'Error',      cls: styles.badgeError },
  }
  const { label, cls } = map[status] || map.pending
  return <span className={`${styles.badge} ${cls}`}>{label}</span>
}
