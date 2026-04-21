#!/usr/bin/env node
/**
 * Copies the platform Ghostscript binary into resources/ghostscript/
 * so electron-builder can package it as an extraResource.
 *
 * Run: npm run bundle-gs
 * CI:  each platform runner installs GS first, then calls this script.
 */

const fs   = require('fs')
const path = require('path')

const outDir = path.join(__dirname, '..', 'resources', 'ghostscript')
fs.mkdirSync(outDir, { recursive: true })

// ── Windows ───────────────────────────────────────────────────────────────────
if (process.platform === 'win32') {
  const gsRoot = 'C:\\Program Files\\gs'

  if (!fs.existsSync(gsRoot)) {
    console.error('✗ Ghostscript not found at C:\\Program Files\\gs')
    console.error('  Install it: winget install ArtifexSoftware.GhostScript')
    process.exit(1)
  }

  const versions = fs.readdirSync(gsRoot).sort().reverse()
  let binDir = null
  for (const v of versions) {
    const candidate = path.join(gsRoot, v, 'bin')
    if (fs.existsSync(path.join(candidate, 'gswin64c.exe'))) {
      binDir = candidate
      break
    }
  }

  if (!binDir) {
    console.error('✗ gswin64c.exe not found in any GS version under Program Files\\gs')
    process.exit(1)
  }

  for (const f of ['gswin64c.exe', 'gsdll64.dll']) {
    const src = path.join(binDir, f)
    if (!fs.existsSync(src)) {
      console.error(`✗ Required file not found: ${src}`)
      process.exit(1)
    }
    fs.copyFileSync(src, path.join(outDir, f))
    console.log(`  ✓ Copied ${f}`)
  }

// ── macOS ─────────────────────────────────────────────────────────────────────
} else if (process.platform === 'darwin') {
  const candidates = [
    '/opt/homebrew/bin/gs',  // Apple Silicon Homebrew
    '/usr/local/bin/gs',     // Intel Homebrew
    '/usr/bin/gs',
  ]

  const gsPath = candidates.find(p => fs.existsSync(p))
  if (!gsPath) {
    console.error('✗ Ghostscript not found.')
    console.error('  Install it: brew install ghostscript')
    process.exit(1)
  }

  fs.copyFileSync(gsPath, path.join(outDir, 'gs'))
  fs.chmodSync(path.join(outDir, 'gs'), 0o755)
  console.log(`  ✓ Copied gs (from ${gsPath})`)

// ── Linux ─────────────────────────────────────────────────────────────────────
} else {
  const candidates = ['/usr/bin/gs', '/usr/local/bin/gs']
  const gsPath = candidates.find(p => fs.existsSync(p))

  if (!gsPath) {
    console.error('✗ Ghostscript not found.')
    console.error('  Install it: sudo apt install ghostscript')
    process.exit(1)
  }

  fs.copyFileSync(gsPath, path.join(outDir, 'gs'))
  fs.chmodSync(path.join(outDir, 'gs'), 0o755)
  console.log(`  ✓ Copied gs (from ${gsPath})`)
}

console.log(`\nGhostscript bundled → resources/ghostscript/`)
