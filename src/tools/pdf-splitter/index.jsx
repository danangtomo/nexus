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
import { loadPdf, splitPdf } from './handler'
import styles from './index.module.css'

const MODES = [
  { id: 'range',   label: 'By range' },
  { id: 'everyN',  label: 'Every N pages' },
]

export default function PdfSplitter() {
  const [file,       setFile]       = useState(null)   // { path, name, pageCount }
  const [mode,       setMode]       = useState('range')
  const [rangeStr,   setRangeStr]   = useState('')
  const [chunkSize,  setChunkSize]  = useState(1)
  const [splitting,  setSplitting]  = useState(false)
  const [outputs,    setOutputs]    = useState([])     // [{ path, name, pages }]
  const [error,      setError]      = useState('')

  const handleFiles = useCallback(async (incoming) => {
    setOutputs([])
    setError('')
    const raw = incoming[0]
    const path = typeof raw === 'string' ? raw : (raw?.path ?? '')
    const name = path.split(/[\\/]/).pop()
    if (!path) return
    try {
      const { pageCount } = await loadPdf(path)
      setFile({ path, name, pageCount })
    } catch (err) {
      setError(`Could not load PDF: ${err.message}`)
    }
  }, [])

  const handleSplit = async () => {
    if (!file) return
    setError('')
    const outputDir = await window.nexus.openDirectory({ title: 'Choose output folder' })
    if (!outputDir) return

    setSplitting(true)
    setOutputs([])
    try {
      const results = await splitPdf(file.path, mode, rangeStr, chunkSize, outputDir)
      setOutputs(results)
    } catch (err) {
      setError(err.message)
    } finally {
      setSplitting(false)
    }
  }

  const reset = () => { setFile(null); setOutputs([]); setError('') }

  const canSplit = file && !splitting &&
    (mode === 'everyN' || rangeStr.trim().length > 0)

  return (
    <div className={styles.page}>
      {!file ? (
        <DropZone
          onFiles={handleFiles}
          accept={['pdf']}
          multiple={false}
          label="Drop a PDF here or click to browse"
          sublabel="One PDF file to split"
        />
      ) : (
        <>
          {/* File info bar */}
          <div className={styles.fileBar}>
            <div className={styles.fileBarLeft}>
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.pageCount}>{file.pageCount} pages</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Change file</button>
          </div>

          {/* Mode selector */}
          <div className={styles.modeRow}>
            <div className={styles.segmented}>
              {MODES.map((m) => (
                <button
                  key={m.id}
                  className={`${styles.seg} ${mode === m.id ? styles.segActive : ''}`}
                  onClick={() => { setMode(m.id); setOutputs([]); setError('') }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode-specific inputs */}
          {mode === 'range' ? (
            <div className={styles.inputGroup}>
              <label className={styles.label}>
                Page ranges
                <span className={styles.labelHint}>(e.g. 1-3, 5, 7-9)</span>
              </label>
              <input
                className={styles.input}
                type="text"
                placeholder={`1-${Math.min(3, file.pageCount)}, ${Math.min(5, file.pageCount)}`}
                value={rangeStr}
                onChange={(e) => { setRangeStr(e.target.value); setOutputs([]); setError('') }}
              />
              <p className={styles.hint}>Each entry produces a separate PDF file.</p>
            </div>
          ) : (
            <div className={styles.inputGroup}>
              <label className={styles.label}>Pages per chunk</label>
              <div className={styles.numberRow}>
                <input
                  className={styles.inputSmall}
                  type="number"
                  min={1}
                  max={file.pageCount}
                  value={chunkSize}
                  onChange={(e) => { setChunkSize(Number(e.target.value)); setOutputs([]); setError('') }}
                />
                <span className={styles.hint}>
                  → {Math.ceil(file.pageCount / Math.max(1, chunkSize))} file{Math.ceil(file.pageCount / Math.max(1, chunkSize)) !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && <p className={styles.error}>{error}</p>}

          {/* Output list */}
          {outputs.length > 0 && (
            <div className={styles.outputSection}>
              <div className={styles.outputHeader}>
                <span className={styles.outputTitle}>
                  {outputs.length} file{outputs.length !== 1 ? 's' : ''} created
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => window.nexus.showItemInFolder(outputs[0].path)}
                >
                  Show in folder
                </button>
              </div>
              <div className={styles.outputList}>
                {outputs.map((o) => (
                  <div key={o.path} className={styles.outputRow}>
                    <span className={styles.outputName}>{o.name}</span>
                    <span className={styles.outputPages}>{o.pages} page{o.pages !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      {file && (
        <div className={styles.footer}>
          <button
            className="btn btn-primary"
            onClick={handleSplit}
            disabled={!canSplit}
          >
            {splitting ? 'Splitting…' : 'Split PDF'}
          </button>
        </div>
      )}
    </div>
  )
}
