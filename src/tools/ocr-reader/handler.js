/**
 * Nexus - Offline productivity suite
 * Copyright (C) 2026 Danang Estutomoaji
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const LANGUAGES = [
  { code: 'ch',          label: 'ch (Chinese, English, Chinese Traditional)' },
  { code: 'ch_lite',     label: 'ch_lite (Chinese, English, Chinese Traditional, Japanese)' },
  { code: 'ch_server',   label: 'ch_server (Chinese, English, Chinese Traditional, Japanese)' },
  { code: 'en',          label: 'en (English)' },
  { code: 'korean',      label: 'korean (Korean, English)' },
  { code: 'japan',       label: 'japan (Chinese, English, Chinese Traditional, Japanese)' },
  { code: 'chinese_cht', label: 'chinese_cht (Chinese, English, Chinese Traditional, Japanese)' },
  { code: 'ta',          label: 'ta (Tamil, English)' },
  { code: 'te',          label: 'te (Telugu, English)' },
  { code: 'ka',          label: 'ka (Kannada)' },
  { code: 'el',          label: 'el (Greek, English)' },
  { code: 'th',          label: 'th (Thai, English)' },
  { code: 'latin',       label: 'latin (French, German, Spanish, Italian, Portuguese, Indonesian, Malay + more)' },
  { code: 'arabic',      label: 'arabic (Arabic, Persian, Uyghur, Urdu, Pashto, English)' },
  { code: 'east_slavic', label: 'east_slavic (Russian, Belarusian, Ukrainian, English)' },
  { code: 'cyrillic',    label: 'cyrillic (Russian, Belarusian, Ukrainian, Serbian, Bulgarian + more)' },
  { code: 'devanagari',  label: 'devanagari (Hindi, Marathi, Nepali, Sanskrit + more)' },
]

/**
 * Parse a document (PDF, image, DOCX, PPTX, XLSX) with MinerU (CPU/ONNX pipeline).
 * Returns { blocks, full_text, table_count, page_count }
 * blocks: Array<{ type:'text'|'title'|'table', content?, rows?, html?, caption?, page_idx }>
 * First call downloads MinerU models (~500 MB) — subsequent calls are fast.
 */
export async function parse(filePath, lang, startPage = 0, endPage = -1, forceOcr = false, tableEnable = true, formulaEnable = true) {
  return window.nexus.ocr.parse(filePath, lang, startPage, endPage, forceOcr, tableEnable, formulaEnable)
}

export async function saveText(text, outputPath) {
  await window.nexus.writeFile(outputPath, text)
}
