const { ipcMain, app } = require('electron')
const { spawn }        = require('child_process')
const path             = require('path')
const fs               = require('fs')

// ── Binary resolution ─────────────────────────────────────────────────────────

function getGsPath() {
  const isWin   = process.platform === 'win32'
  const binName = isWin ? 'gswin64c.exe' : 'gs'

  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, 'ghostscript', binName)
    if (fs.existsSync(bundled)) return bundled
    return 'gs' // Mac/Linux fallback: system PATH
  }

  if (isWin) {
    const gsRoot = 'C:\\Program Files\\gs'
    if (fs.existsSync(gsRoot)) {
      const versions = fs.readdirSync(gsRoot).sort().reverse()
      for (const v of versions) {
        const candidate = path.join(gsRoot, v, 'bin', 'gswin64c.exe')
        if (fs.existsSync(candidate)) return candidate
      }
    }
    return 'gswin64c'
  }

  return 'gs'
}

// ── Core runner ───────────────────────────────────────────────────────────────

function runGs(args) {
  return new Promise((resolve, reject) => {
    const gs   = getGsPath()
    const proc = spawn(gs, args)
    let stderr = ''

    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.stdout.on('data', () => {})

    proc.on('close', (code) => {
      if (code === 0) return resolve({ success: true })
      reject(new Error(`Ghostscript exited ${code}: ${stderr.slice(-400)}`))
    })

    proc.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error(
          'Ghostscript not found. Install it with: winget install ArtifexSoftware.GhostScript'
        ))
      } else {
        reject(err)
      }
    })
  })
}

// ── gs:encrypt ────────────────────────────────────────────────────────────────
// Encrypts inputPath with AES-256 (PDF 2.0, Revision 6) → outputPath

ipcMain.handle('gs:encrypt', async (_e, { inputPath, userPassword, ownerPassword, outputPath }) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  const args = [
    '-dBATCH', '-dNOPAUSE', '-dQUIET',
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    '-dEncryptionR=3',
    '-dKeyLength=128',
    `-sUserPassword=${userPassword}`,
    `-sOwnerPassword=${ownerPassword || userPassword}`,
    `-sOutputFile=${outputPath}`,
    inputPath,
  ]

  return runGs(args)
})

// ── gs:decrypt ────────────────────────────────────────────────────────────────
// Removes password protection from inputPath → outputPath

ipcMain.handle('gs:decrypt', async (_e, { inputPath, password, outputPath }) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  const args = [
    '-dBATCH', '-dNOPAUSE', '-dQUIET',
    '-sDEVICE=pdfwrite',
    `-sPDFPassword=${password}`,
    `-sOutputFile=${outputPath}`,
    inputPath,
  ]

  return runGs(args)
})

// ── gs:compress ───────────────────────────────────────────────────────────────
// Resamples images and reduces PDF size → outputPath
// quality: 'screen' | 'ebook' | 'printer'

ipcMain.handle('gs:compress', async (_e, { inputPath, quality, outputPath }) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  const preset = { screen: '/screen', ebook: '/ebook', printer: '/printer' }[quality] ?? '/ebook'

  const args = [
    '-dBATCH', '-dNOPAUSE', '-dQUIET',
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.5',
    `-dPDFSETTINGS=${preset}`,
    '-dEmbedAllFonts=true',
    '-dSubsetFonts=true',
    `-sOutputFile=${outputPath}`,
    inputPath,
  ]

  return runGs(args)
})
