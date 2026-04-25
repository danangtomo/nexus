import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

// ── Reader types ──────────────────────────────────────────────────────────────
export const READER_TYPES = [
  { key: 'child',      label: 'Child (6–10)' },
  { key: 'middle',     label: 'Middle school (11–13)' },
  { key: 'highschool', label: 'High school (14–18)' },
  { key: 'adult',      label: 'Adult (general)' },
  { key: 'college',    label: 'College student' },
  { key: 'expert',     label: 'Expert / Professional' },
]

// Base WPM per reader index, per script
// CJK: Intl.Segmenter counts each character as 1 word, so WPM ≈ CPM here
// Arabic/Hebrew: space-separated words, slightly slower than Latin
// Russian/Cyrillic: alphabetic, close to Latin but slightly slower
// Indic (Devanagari, Tamil, Bengali…): abugida scripts, moderately slower than Latin
const SCRIPT_WPM = {
  latin:   [100, 150, 220, 250, 300, 350],
  cjk:     [ 80, 130, 200, 300, 400, 500],
  arabic:  [ 60, 100, 150, 180, 220, 270],
  russian: [ 80, 120, 180, 220, 260, 310],
  indic:   [ 60,  90, 140, 170, 210, 250],
}

// Content-type speed multipliers (universal across scripts)
const CONTENT_MULT = {
  general:   1.00,
  fiction:   1.10,
  academic:  0.70,
  technical: 0.48,
  business:  0.84,
}

export const CONTENT_LABELS = {
  general:   'General / Blog / News',
  fiction:   'Fiction / Narrative',
  academic:  'Academic / Research',
  technical: 'Technical / STEM',
  business:  'Business / Professional',
}

export const SCRIPT_LABELS = {
  latin:   'Latin / Roman',
  cjk:     'CJK (Chinese / Japanese / Korean)',
  arabic:  'Arabic / RTL',
  russian: 'Cyrillic (Russian / Slavic)',
  indic:   'Indic (Hindi / Tamil / Bengali…)',
  mixed:   'Mixed scripts',
}

export const ACCEPT_EXTS = ['txt', 'md', 'pdf']

// ── Script detection ──────────────────────────────────────────────────────────
function isCJK(cp) {
  return (cp >= 0x4E00 && cp <= 0x9FFF)   // CJK Unified
      || (cp >= 0x3400 && cp <= 0x4DBF)   // CJK Ext A
      || (cp >= 0x3040 && cp <= 0x30FF)   // Hiragana + Katakana
      || (cp >= 0xAC00 && cp <= 0xD7AF)   // Korean Hangul syllables
      || (cp >= 0x3000 && cp <= 0x303F)   // CJK Symbols & Punctuation
      || (cp >= 0x20000 && cp <= 0x2A6DF) // CJK Ext B
}
function isArabic(cp) {
  return (cp >= 0x0600 && cp <= 0x06FF)   // Arabic
      || (cp >= 0x0750 && cp <= 0x077F)   // Arabic Supplement
      || (cp >= 0xFB50 && cp <= 0xFDFF)   // Arabic Presentation Forms-A
      || (cp >= 0xFE70 && cp <= 0xFEFF)   // Arabic Presentation Forms-B
      || (cp >= 0x0590 && cp <= 0x05FF)   // Hebrew
}
function isRussian(cp) {
  return (cp >= 0x0400 && cp <= 0x04FF)   // Cyrillic (Russian, Ukrainian, Bulgarian…)
      || (cp >= 0x0500 && cp <= 0x052F)   // Cyrillic Supplement
}
function isIndic(cp) {
  return (cp >= 0x0900 && cp <= 0x097F)   // Devanagari (Hindi, Marathi, Sanskrit, Nepali)
      || (cp >= 0x0980 && cp <= 0x09FF)   // Bengali (Bangla, Assamese)
      || (cp >= 0x0A00 && cp <= 0x0A7F)   // Gurmukhi (Punjabi)
      || (cp >= 0x0A80 && cp <= 0x0AFF)   // Gujarati
      || (cp >= 0x0B00 && cp <= 0x0B7F)   // Odia (Oriya)
      || (cp >= 0x0B80 && cp <= 0x0BFF)   // Tamil
      || (cp >= 0x0C00 && cp <= 0x0C7F)   // Telugu
      || (cp >= 0x0C80 && cp <= 0x0CFF)   // Kannada
      || (cp >= 0x0D00 && cp <= 0x0D7F)   // Malayalam
      || (cp >= 0x0D80 && cp <= 0x0DFF)   // Sinhala
}
function isLatin(cp) {
  return (cp >= 0x0041 && cp <= 0x007A)   // Basic Latin letters
      || (cp >= 0x00C0 && cp <= 0x024F)   // Latin Extended A/B
}

// Returns { weights: { latin, cjk, arabic, russian, indic }, dominant, label }
function detectScript(text) {
  const chars = [...text].filter(ch => !/\s/.test(ch))
  if (!chars.length) return { weights: { latin: 1, cjk: 0, arabic: 0, russian: 0, indic: 0 }, dominant: 'latin', label: SCRIPT_LABELS.latin }

  let latinN = 0, cjkN = 0, arabicN = 0, russianN = 0, indicN = 0
  for (const ch of chars) {
    const cp = ch.codePointAt(0)
    if      (isCJK(cp))     cjkN++
    else if (isArabic(cp))  arabicN++
    else if (isRussian(cp)) russianN++
    else if (isIndic(cp))   indicN++
    else if (isLatin(cp))   latinN++
  }

  const total   = chars.length
  const weights = {
    latin:   latinN   / total,
    cjk:     cjkN     / total,
    arabic:  arabicN  / total,
    russian: russianN / total,
    indic:   indicN   / total,
  }

  // Dominant = any single script above 50%; mixed if multiple are significant (>15%)
  const significant = Object.entries(weights).filter(([, v]) => v > 0.15)
  let dominant = 'latin', label = SCRIPT_LABELS.latin

  if (significant.length > 1) {
    dominant = 'mixed'; label = SCRIPT_LABELS.mixed
  } else {
    const top = Object.entries(weights).reduce((a, b) => b[1] > a[1] ? b : a)
    dominant = top[0]; label = SCRIPT_LABELS[dominant] ?? SCRIPT_LABELS.latin
  }

  return { weights, dominant, label }
}

// Weighted WPM blending for a given reader index + content multiplier
function blendedWPM(readerIdx, contentMult, weights) {
  const known = weights.latin + weights.cjk + weights.arabic + weights.russian + weights.indic
  const other = Math.max(0, 1 - known)   // unrecognised script — fall back to Latin speed
  const wpm   = SCRIPT_WPM.latin[readerIdx]   * (weights.latin + other)
              + SCRIPT_WPM.cjk[readerIdx]     * weights.cjk
              + SCRIPT_WPM.arabic[readerIdx]   * weights.arabic
              + SCRIPT_WPM.russian[readerIdx]  * weights.russian
              + SCRIPT_WPM.indic[readerIdx]    * weights.indic
  return Math.max(1, Math.round(wpm * contentMult))
}

// ── File loading ──────────────────────────────────────────────────────────────
export async function loadFile(filePath, onProgress) {
  const ext   = filePath.split('.').pop().toLowerCase()
  const b64   = await window.nexus.readFile(filePath, 'base64')
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))

  if (ext === 'pdf') {
    const pdf   = await pdfjs.getDocument({ data: bytes }).promise
    const total = pdf.numPages
    const textParts = [], pages = []

    for (let i = 1; i <= total; i++) {
      onProgress?.({ msg: `Rendering page ${i} of ${total}…`, pct: Math.round((i / total) * 100) })
      const page = await pdf.getPage(i)

      const content = await page.getTextContent()
      let line = ''
      for (const item of content.items) {
        if (item.hasEOL) { textParts.push((line + item.str).trim()); line = '' }
        else { if (line && !line.endsWith(' ') && !item.str.startsWith(' ')) line += ' '; line += item.str }
      }
      if (line.trim()) textParts.push(line.trim())
      textParts.push('')

      const viewport = page.getViewport({ scale: 1.5 })
      const canvas   = document.createElement('canvas')
      canvas.width   = viewport.width
      canvas.height  = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      const blobUrl  = await new Promise(res => canvas.toBlob(b => res(URL.createObjectURL(b)), 'image/png'))
      pages.push(blobUrl)
    }

    return { text: textParts.join('\n'), pages, type: 'pdf' }
  }

  return { text: decodeText(bytes), pages: null, type: 'text' }
}

function decodeText(bytes) {
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.slice(2))
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.slice(2))
  const start = (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) ? 3 : 0
  return new TextDecoder('utf-8').decode(bytes.slice(start))
}

// ── Content type detection ────────────────────────────────────────────────────
// Uses word-boundary-free matching (indexOf / split) so it works inside mixed-script text
function detectContentType(text, words) {
  if (words < 15) return 'general'
  const lower = text.toLowerCase()

  // Technical: math symbols, code keywords, formula-like patterns
  const techSymbols  = (text.match(/[=×÷∑∫∂Δπ√∞≤≥≠±]/g) ?? []).length
  const codeKw       = (text.match(/\b(function|const|let|var|import|export|class|def|return|elif|switch|struct|void|int|float|double)\b/gi) ?? []).length
  const formulaLike  = (text.match(/\d+\s*[=+\-*/^]\s*\d/g) ?? []).length
  const mathTerms    = ['equation','formula','theorem','proof','derivative','integral','matrix','vector','polynomial','velocity','acceleration','entropy','wavelength','algorithm']
  const mathHits     = mathTerms.reduce((n, w) => n + (lower.split(w).length - 1), 0)
  const techScore    = techSymbols/words*4 + codeKw/words*8 + formulaLike/words*5 + mathHits/words*6

  // Fiction: dialogue, narrative verbs
  const dialogue     = (text.match(/"/g) ?? []).length
  const narVerbs     = ['whispered','shouted','smiled','frowned','nodded','walked','said','told','asked','replied','laughed','sighed','glanced','stared']
  const narHits      = narVerbs.reduce((n, w) => n + (lower.split(w).length - 1), 0)
  const narWords     = ['suddenly','meanwhile','afterwards','chapter','protagonist','narrator']
  const narHits2     = narWords.reduce((n, w) => n + (lower.split(w).length - 1), 0)
  const fictionScore = dialogue/words*4 + narHits/words*8 + narHits2/words*6

  // Academic: citations, long words, scholarly terms
  const citations    = (text.match(/\[\d+\]|\(\w[\w\s,]*\d{4}\)/g) ?? []).length
  const acTerms      = ['therefore','furthermore','moreover','hypothesis','methodology','findings','conclusion','abstract','literature','significant','empirical','theoretical','quantitative','qualitative','paradigm','respondents']
  const acHits       = acTerms.reduce((n, w) => n + (lower.split(w).length - 1), 0)
  // Only Latin/Cyrillic letter runs ≥14 chars — excludes CJK/Indic where space-free tokens are huge
  const longWords    = (text.match(/[a-zA-ZÀ-ɏЀ-ӿ]{14,}/gu) ?? []).length
  const academicScore = citations/words*12 + acHits/words*6 + longWords/words*3

  // Business
  const bizTerms     = ['revenue','profit','stakeholder','deliverable','milestone','roi','kpi','strategy','objective','budget','workflow','synergy','scalable','onboarding']
  const bizHits      = bizTerms.reduce((n, w) => n + (lower.split(w).length - 1), 0)
  const businessScore = bizHits/words*7

  const scores = { technical: techScore, fiction: fictionScore, academic: academicScore, business: businessScore, general: 0.08 }
  return Object.entries(scores).reduce((best, cur) => cur[1] > best[1] ? cur : best)[0]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function countWords(text) {
  if (!text.trim()) return 0
  const seg = new Intl.Segmenter(undefined, { granularity: 'word' })
  let n = 0
  for (const { isWordLike } of seg.segment(text)) { if (isWordLike) n++ }
  return n
}

function fmtTime(minutes) {
  if (minutes === 0) return '—'
  if (minutes < 1)   return '< 1 min'
  if (minutes < 60)  return `${minutes} min`
  const h = Math.floor(minutes / 60), m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

// ── Main export ───────────────────────────────────────────────────────────────
export function analyse(text) {
  const empty = { words: 0, chars: 0, charsNoSpaces: 0, sentences: 0, paragraphs: 0, contentType: 'general', scriptLabel: SCRIPT_LABELS.latin, readingTimes: [] }
  if (!text || text.trim() === '') return empty

  const words         = countWords(text)
  const chars         = [...text].length
  const charsNoSpaces = [...text].filter(ch => !/\s/.test(ch)).length
  // Covers Latin . ! ?, CJK 。！？, Arabic ؟, Devanagari danda ।॥, Arabic full stop ۔
  const sentences     = (text.match(/[^.!?。！？؟…।॥۔\n]+[.!?。！？؟…।॥۔]+/gu) ?? []).length
  const paragraphs    = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length

  const contentType   = detectContentType(text, words)
  const contentMult   = CONTENT_MULT[contentType]
  const { weights, label: scriptLabel } = detectScript(text)

  const readingTimes = READER_TYPES.map(({ key, label }, i) => {
    const wpm = blendedWPM(i, contentMult, weights)
    return { key, label, wpm, value: fmtTime(Math.ceil(words / wpm)) }
  })

  return { words, chars, charsNoSpaces, sentences, paragraphs, contentType, scriptLabel, readingTimes }
} 
