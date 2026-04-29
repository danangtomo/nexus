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

import { PDFDocument } from 'pdf-lib'

export async function getPageCount(filePath) {
  try {
    const bytes = await window.nexus.readFile(filePath, null)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
    return doc.getPageCount()
  } catch {
    return null
  }
}

export async function encryptPdf(filePath, userPassword, ownerPassword, outputPath) {
  return window.nexus.gs.encrypt({ inputPath: filePath, userPassword, ownerPassword, outputPath })
}

export async function decryptPdf(filePath, password, outputPath) {
  return window.nexus.gs.decrypt({ inputPath: filePath, password, outputPath })
}
