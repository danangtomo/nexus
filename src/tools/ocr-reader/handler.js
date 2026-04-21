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
        onProgress(Math.round(m.progress * 100))
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
