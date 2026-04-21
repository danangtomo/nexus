import { useState, useCallback } from 'react'
import DropZone from '../../components/DropZone'
import { getPageCount, encryptPdf, decryptPdf } from './handler'
import styles from './index.module.css'

const MODES = [
  { id: 'encrypt', label: 'Encrypt' },
  { id: 'decrypt', label: 'Decrypt' },
]

export default function PdfEncryptor() {
  const [file,          setFile]          = useState(null)
  const [mode,          setMode]          = useState('encrypt')
  const [password,      setPassword]      = useState('')
  const [confirm,       setConfirm]       = useState('')
  const [ownerPass,     setOwnerPass]     = useState('')
  const [showPass,      setShowPass]      = useState(false)
  const [busy,          setBusy]          = useState(false)
  const [outputPath,    setOutputPath]    = useState('')
  const [error,         setError]         = useState('')

  const handleFiles = useCallback(async (incoming) => {
    setOutputPath('')
    setError('')
    const raw  = incoming[0]
    const path = typeof raw === 'string' ? raw : (raw?.path ?? '')
    const name = path.split(/[\\/]/).pop()
    if (!path) return
    try {
      const pageCount = await getPageCount(path)
      setFile({ path, name, pageCount })
    } catch {
      setError('Could not load PDF. If it is encrypted, switch to Decrypt mode and enter the password.')
    }
  }, [])

  const switchMode = (m) => {
    setMode(m)
    setOutputPath('')
    setError('')
    setPassword('')
    setConfirm('')
    setOwnerPass('')
  }

  const validate = () => {
    if (!password) return 'Enter a password.'
    if (mode === 'encrypt' && password !== confirm) return 'Passwords do not match.'
    if (mode === 'encrypt' && password.length < 4) return 'Password must be at least 4 characters.'
    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }

    const baseName = file.name.replace(/\.pdf$/i, '')
    const suffix   = mode === 'encrypt' ? '_encrypted' : '_decrypted'
    const savePath = await window.nexus.saveFile({
      title: mode === 'encrypt' ? 'Save encrypted PDF' : 'Save decrypted PDF',
      defaultPath: `${baseName}${suffix}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (!savePath) return

    setBusy(true)
    setOutputPath('')
    setError('')
    try {
      if (mode === 'encrypt') {
        await encryptPdf(file.path, password, ownerPass, savePath)
      } else {
        await decryptPdf(file.path, password, savePath)
      }
      setOutputPath(savePath)
    } catch (e) {
      setError(mode === 'decrypt'
        ? 'Decryption failed — wrong password?'
        : `Failed: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setOutputPath('')
    setError('')
    setPassword('')
    setConfirm('')
    setOwnerPass('')
  }

  return (
    <div className={styles.page}>
      {!file ? (
        <DropZone
          onFiles={handleFiles}
          accept={['pdf']}
          multiple={false}
          label="Drop a PDF here or click to browse"
          sublabel="Encrypt or remove password protection"
        />
      ) : (
        <>
          {/* File bar */}
          <div className={styles.fileBar}>
            <div className={styles.fileBarLeft}>
              <span className={styles.fileName}>{file.name}</span>
              {file.pageCount != null && (
                <span className={styles.pageCount}>{file.pageCount} pages</span>
              )}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Change file</button>
          </div>

          {/* Mode selector */}
          <div className={styles.segmented}>
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`${styles.seg} ${mode === m.id ? styles.segActive : ''}`}
                onClick={() => switchMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div className={styles.fields}>
            <div className={styles.fieldRow}>
              <label className={styles.label}>
                {mode === 'encrypt' ? 'User password' : 'Current password'}
              </label>
              <div className={styles.passWrap}>
                <input
                  className={styles.input}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); setOutputPath('') }}
                />
                <button
                  className={styles.eyeBtn}
                  onClick={() => setShowPass((v) => !v)}
                  title={showPass ? 'Hide' : 'Show'}
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {mode === 'encrypt' && (
              <>
                <div className={styles.fieldRow}>
                  <label className={styles.label}>Confirm password</label>
                  <input
                    className={styles.input}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Repeat password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(''); setOutputPath('') }}
                  />
                </div>

                <div className={styles.fieldRow}>
                  <label className={styles.label}>
                    Owner password
                    <span className={styles.optional}>(optional — defaults to user password)</span>
                  </label>
                  <input
                    className={styles.input}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Leave blank to use same password"
                    value={ownerPass}
                    onChange={(e) => setOwnerPass(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          {outputPath && (
            <div className={styles.successBanner}>
              <span>✓ {mode === 'encrypt' ? 'Encrypted' : 'Decrypted'} successfully</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => window.nexus.showItemInFolder(outputPath)}
              >
                Show in folder
              </button>
            </div>
          )}
        </>
      )}

      {file && (
        <div className={styles.footer}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={busy || !password}
          >
            {busy
              ? (mode === 'encrypt' ? 'Encrypting…' : 'Decrypting…')
              : (mode === 'encrypt' ? 'Encrypt & Save' : 'Decrypt & Save')}
          </button>
        </div>
      )}
    </div>
  )
}
