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

import { createWorker } from 'tesseract.js'

export const LANGUAGES = [
  { code: 'eng',     label: 'English' },
  { code: 'ind',     label: 'Indonesian' },
  { code: 'ara',     label: 'Arabic' },
  { code: 'hin',     label: 'Hindi' },
  { code: 'ben',     label: 'Bengali' },
  { code: 'tam',     label: 'Tamil' },
  { code: 'tel',     label: 'Telugu' },
  { code: 'mal',     label: 'Malayalam' },
  { code: 'guj',     label: 'Gujarati' },
  { code: 'urd',     label: 'Urdu' },
  { code: 'fra',     label: 'French' },
  { code: 'deu',     label: 'German' },
  { code: 'spa',     label: 'Spanish' },
  { code: 'ita',     label: 'Italian' },
  { code: 'por',     label: 'Portuguese' },
  { code: 'rus',     label: 'Russian' },
  { code: 'jpn',     label: 'Japanese' },
  { code: 'kor',     label: 'Korean' },
  { code: 'chi_sim', label: 'Chinese (Simplified)' },
  { code: 'chi_tra', label: 'Chinese (Traditional)' },
]

export async function recognizeImage(filePath, lang, onProgress) {
  const worker = await createWorker(lang, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        // recognizing phase = 30–100%
        onProgress(30 + Math.round(m.progress * 70))
      } else if (typeof m.progress === 'number') {
        // loading/init phases = 0–30%
        onProgress(Math.round(m.progress * 30))
      }
    },
  })

  let url = null
  try {
    const bytes = await window.nexus.readFile(filePath, null)
    url = URL.createObjectURL(new Blob([bytes]))
    const { data } = await worker.recognize(url)
    return data.text.trim()
  } finally {
    if (url) URL.revokeObjectURL(url)
    await worker.terminate()
  }
}

export async function saveText(text, outputPath) {
  await window.nexus.writeFile(outputPath, text)
}
