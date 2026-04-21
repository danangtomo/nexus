import { useState, useCallback } from 'react'
import DropZone from '../../components/DropZone'
import { FORMATS, INPUT_EXTS, readSpreadsheet, convertSpreadsheet } from './handler'
import styles from './index.module.css'

const PREVIEW_ROWS = 6

export default function SpreadsheetConverter() {
  const [file,          setFile]          = useState(null)
  const [meta,          setMeta]          = useState(null)  // { sheetNames, rows }
  const [selectedSheet, setSelectedSheet] = useState(0)
  const [format,        setFormat]        = useState('csv')
  const [busy,          setBusy]          = useState(false)
  const [outputPath,    setOutputPath]    = useState('')
  const [error,         setError]         = useState('')

  const loadSheet = useCallback(async (filePath, sheetIdx) => {
    try {
      const { sheetNames, rows } = await readSpreadsheet(filePath, sheetIdx)
      setMeta({ sheetNames, rows })
      setError('')
    } catch (err) {
      setError(`Failed to read file: ${err.message}`)
    }
  }, [])

  const handleFiles = useCallback(async (incoming) => {
    setOutputPath(''); setError(''); setMeta(null); setSelectedSheet(0)
    const raw  = incoming[0]
    const path = typeof raw === 'string' ? raw : (raw?.path ?? '')
    const name = path.split(/[\\/]/).pop()
    if (!path) return
    setFile({ path, name })
    await loadSheet(path, 0)
  }, [loadSheet])

  const handleSheetChange = async (idx) => {
    if (idx === selectedSheet) return
    setSelectedSheet(idx)
    setOutputPath('')
    await loadSheet(file.path, idx)
  }

  const handleConvert = async () => {
    const fmt      = FORMATS.find((f) => f.ext === format)
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const savePath = await window.nexus.saveFile({
      title: 'Save converted file',
      defaultPath: `${baseName}.${fmt.ext}`,
      filters: [{ name: fmt.label, extensions: [fmt.ext] }],
    })
    if (!savePath) return

    setBusy(true); setOutputPath(''); setError('')
    try {
      await convertSpreadsheet(file.path, format, savePath, selectedSheet)
      setOutputPath(savePath)
    } catch (err) {
      setError(`Conversion failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null); setMeta(null); setSelectedSheet(0); setOutputPath(''); setError('')
  }

  const previewRows = meta?.rows?.slice(0, PREVIEW_ROWS) ?? []
  const colCount    = previewRows[0]?.length ?? 0
  const totalRows   = meta ? Math.max(0, (meta.rows?.length ?? 1) - 1) : 0

  return (
    <div className={styles.page}>
      {!file ? (
        <DropZone
          onFiles={handleFiles}
          accept={INPUT_EXTS}
          multiple={false}
          label="Drop a spreadsheet here or click to browse"
          sublabel="XLSX, XLS, CSV, TSV, ODS, JSON supported"
        />
      ) : (
        <div className={styles.fileBar}>
          <div className={styles.fileBarLeft}>
            <span className={styles.fileName}>{file.name}</span>
            {meta && (
              <div className={styles.metaRow}>
                <span className={styles.metaTag}>{meta.sheetNames.length} sheet{meta.sheetNames.length !== 1 ? 's' : ''}</span>
                <span className={styles.metaTag}>{totalRows.toLocaleString()} rows</span>
                <span className={styles.metaTag}>{colCount} col{colCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Change</button>
        </div>
      )}

      {/* Sheet selector — only shown for multi-sheet files */}
      {meta && meta.sheetNames.length > 1 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Select sheet</p>
          <div className={styles.sheetTabs}>
            {meta.sheetNames.map((name, i) => (
              <button
                key={i}
                className={`${styles.sheetTab} ${selectedSheet === i ? styles.sheetTabActive : ''}`}
                onClick={() => handleSheetChange(i)}
                disabled={busy}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview table */}
      {meta && previewRows.length > 0 && (
        <div className={styles.previewWrap}>
          <p className={styles.previewLabel}>
            Preview — {meta.sheetNames[selectedSheet]}
            {meta.rows.length > PREVIEW_ROWS ? ` (first ${PREVIEW_ROWS} rows)` : ''}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {previewRows[0].map((cell, i) => (
                    <th key={i} className={styles.th}>{String(cell ?? '')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(1).map((row, ri) => (
                  <tr key={ri} className={styles.tr}>
                    {Array.from({ length: colCount }, (_, ci) => (
                      <td key={ci} className={styles.td}>{String(row[ci] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {file && (
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

      {file && (
        <div className={styles.footer}>
          <button className="btn btn-primary" onClick={handleConvert} disabled={busy || !meta}>
            {busy ? 'Converting…' : `Convert to ${format.toUpperCase()}`}
          </button>
        </div>
      )}
    </div>
  )
}
