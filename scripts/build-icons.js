/**
 * build-icons.js — generate app icons from assets/logo.svg
 * Run: node scripts/build-icons.js
 * Outputs: build/icon.png  (512px, Linux)
 *          build/icon.ico  (multi-size, Windows)
 *          build/icon.icns (multi-size, macOS)
 */

const sharp = require('sharp')
const fs    = require('fs')
const path  = require('path')

const SRC = path.join(__dirname, '../assets/logo.svg')
const OUT = path.join(__dirname, '../build')
fs.mkdirSync(OUT, { recursive: true })

const ICO_SIZES  = [16, 32, 48, 64, 128, 256]
const ICNS_TYPES = { 16:'icp4', 32:'icp5', 64:'icp6', 128:'ic07', 256:'ic08', 512:'ic09', 1024:'ic10' }
const ICNS_SIZES = Object.keys(ICNS_TYPES).map(Number)

async function run() {
  console.log('Building icons from', SRC)

  // PNG 512 — Linux & BrowserWindow dev icon
  await sharp(SRC).resize(512, 512).png().toFile(path.join(OUT, 'icon.png'))
  console.log('  ✓ build/icon.png')

  // ICO — Windows (PNG-embedded, Vista+)
  const icoBufs = await Promise.all(ICO_SIZES.map((s) => sharp(SRC).resize(s, s).png().toBuffer()))
  fs.writeFileSync(path.join(OUT, 'icon.ico'), buildIco(ICO_SIZES, icoBufs))
  console.log('  ✓ build/icon.ico')

  // ICNS — macOS
  const icnsBufs = await Promise.all(ICNS_SIZES.map((s) => sharp(SRC).resize(s, s).png().toBuffer()))
  fs.writeFileSync(path.join(OUT, 'icon.icns'), buildIcns(ICNS_SIZES, icnsBufs))
  console.log('  ✓ build/icon.icns')

  console.log('\nDone.')
}

// Modern ICO: PNG data embedded directly (Windows Vista+)
function buildIco(sizes, bufs) {
  const headerSize = 6 + sizes.length * 16
  const total = headerSize + bufs.reduce((s, b) => s + b.length, 0)
  const out = Buffer.alloc(total)
  let pos = 0

  out.writeUInt16LE(0,            pos); pos += 2  // reserved
  out.writeUInt16LE(1,            pos); pos += 2  // type = ICO
  out.writeUInt16LE(sizes.length, pos); pos += 2  // count

  let dataOffset = headerSize
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i]; const len = bufs[i].length
    out.writeUInt8(s === 256 ? 0 : s, pos); pos += 1  // width  (0 means 256)
    out.writeUInt8(s === 256 ? 0 : s, pos); pos += 1  // height
    out.writeUInt8(0,                  pos); pos += 1  // colorCount
    out.writeUInt8(0,                  pos); pos += 1  // reserved
    out.writeUInt16LE(1,               pos); pos += 2  // planes
    out.writeUInt16LE(32,              pos); pos += 2  // bitCount
    out.writeUInt32LE(len,             pos); pos += 4  // bytesInRes
    out.writeUInt32LE(dataOffset,      pos); pos += 4  // imageOffset
    dataOffset += len
  }

  for (const buf of bufs) { buf.copy(out, pos); pos += buf.length }
  return out
}

// ICNS: Apple Icon Image format
function buildIcns(sizes, bufs) {
  const chunks = sizes.map((s, i) => {
    const type = ICNS_TYPES[s]
    if (!type) return null
    const chunk = Buffer.alloc(8 + bufs[i].length)
    chunk.write(type, 0, 'ascii')
    chunk.writeUInt32BE(8 + bufs[i].length, 4)
    bufs[i].copy(chunk, 8)
    return chunk
  }).filter(Boolean)

  const body = Buffer.concat(chunks)
  const header = Buffer.alloc(8)
  header.write('icns', 0, 'ascii')
  header.writeUInt32BE(8 + body.length, 4)
  return Buffer.concat([header, body])
}

run().catch((err) => { console.error(err); process.exit(1) })
