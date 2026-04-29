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

// DOCX export — browser-compatible via JSZip
// DOCX import — mammoth.js
// PDF  export — via Electron printToPDF

function xmlEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function pxToHalfPt(px) {
  return Math.round(parseFloat(px) * 0.75 * 2)
}

function hexColor(cssColor) {
  if (!cssColor) return null
  if (cssColor.startsWith('#')) return cssColor.slice(1).toUpperCase()
  const m = cssColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (m) return [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('').toUpperCase()
  return null
}

const HL_MAP = {
  'FDE68A': 'yellow', 'A7F3D0': 'green',  'BFDBFE': 'cyan',
  'FBCFE8': 'magenta','FED7AA': 'darkYellow','DDD6FE': 'lightGray','FECACA': 'red',
}

// Load image element to get natural dimensions
function getImgDims(src) {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve({ w: 400, h: 300 })
    img.src = src
  })
}

// Generate OOXML drawing XML for an embedded image
function imgDrawingXml(info) {
  const WP  = 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
  const A   = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
  const PIC = 'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'
  const R   = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
  const { rId, id, name, cxEmu, cyEmu } = info
  return `<w:p><w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0" ${WP}>` +
      `<wp:extent cx="${cxEmu}" cy="${cyEmu}"/>` +
      `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
      `<wp:docPr id="${id}" name="${xmlEsc(name)}"/>` +
      `<wp:cNvGraphicFramePr><a:graphicFrameLocks ${A} noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
      `<a:graphic ${A}>` +
        `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
          `<pic:pic ${PIC}>` +
            `<pic:nvPicPr>` +
              `<pic:cNvPr id="${id}" name="${xmlEsc(name)}"/>` +
              `<pic:cNvPicPr/>` +
            `</pic:nvPicPr>` +
            `<pic:blipFill>` +
              `<a:blip r:embed="${rId}" ${R}/>` +
              `<a:stretch><a:fillRect/></a:stretch>` +
            `</pic:blipFill>` +
            `<pic:spPr>` +
              `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${cxEmu}" cy="${cyEmu}"/></a:xfrm>` +
              `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
            `</pic:spPr>` +
          `</pic:pic>` +
        `</a:graphicData>` +
      `</a:graphic>` +
    `</wp:inline>` +
  `</w:drawing></w:r></w:p>`
}

function nodeToRuns(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = xmlEsc(node.textContent)
    return t ? `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>` : ''
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const tag = node.tagName.toLowerCase()
  const inner = Array.from(node.childNodes).map(nodeToRuns).join('')

  const wrap = (rpr, content) =>
    content.replace(/<w:r>/g, `<w:r><w:rPr>${rpr}</w:rPr>`)
           .replace(/<w:r><w:rPr><\/w:rPr>/g, '<w:r>')

  if (tag === 'strong' || tag === 'b') return wrap('<w:b/>', inner)
  if (tag === 'em'     || tag === 'i') return wrap('<w:i/>', inner)
  if (tag === 'u')   return wrap('<w:u w:val="single"/>', inner)
  if (tag === 's')   return wrap('<w:strike/>', inner)
  if (tag === 'sub') return wrap('<w:vertAlign w:val="subscript"/>', inner)
  if (tag === 'sup') return wrap('<w:vertAlign w:val="superscript"/>', inner)
  if (tag === 'code') return wrap('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/>', inner)

  if (tag === 'mark') {
    const bg = node.style?.backgroundColor
    const hex = hexColor(bg)
    if (hex) {
      const named = HL_MAP[hex]
      return named
        ? wrap(`<w:highlight w:val="${named}"/>`, inner)
        : wrap(`<w:shd w:val="clear" w:color="auto" w:fill="${hex}"/>`, inner)
    }
    return wrap('<w:highlight w:val="yellow"/>', inner)
  }

  if (tag === 'a') {
    const href = node.getAttribute('href') || ''
    return `<w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t xml:space="preserve">${xmlEsc(node.textContent)} (${xmlEsc(href)})</w:t></w:r>`
  }

  if (tag === 'img') return '' // block images handled in elementToXml

  if (tag === 'span') {
    let rpr = ''
    const s = node.style || {}
    const hex = hexColor(s.color)
    if (hex) rpr += `<w:color w:val="${hex}"/>`
    if (s.fontFamily) {
      const font = s.fontFamily.split(',')[0].trim().replace(/['"]/g, '')
      rpr += `<w:rFonts w:ascii="${xmlEsc(font)}" w:hAnsi="${xmlEsc(font)}"/>`
    }
    if (s.fontSize) {
      const hp = pxToHalfPt(s.fontSize)
      if (hp > 0) rpr += `<w:sz w:val="${hp}"/><w:szCs w:val="${hp}"/>`
    }
    return rpr ? wrap(rpr, inner) : inner
  }

  return inner
}

function taskItemRuns(li) {
  const div = li.querySelector(':scope > div')
  if (!div) return ''
  return Array.from(div.childNodes).map(child => {
    if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'p')
      return Array.from(child.childNodes).map(nodeToRuns).join('')
    return nodeToRuns(child)
  }).join('')
}

function tableToXml(el) {
  const BORDERS = `<w:tblBorders>
    <w:top    w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
    <w:left   w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
    <w:bottom w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
    <w:right  w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
    <w:insideH w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
    <w:insideV w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
  </w:tblBorders>`
  const rows = Array.from(el.querySelectorAll('tr'))
  const rowXml = rows.map(tr => {
    const cells = Array.from(tr.querySelectorAll('td, th'))
    const cellXml = cells.map(cell => {
      const isHeader = cell.tagName.toLowerCase() === 'th'
      const runs = Array.from(cell.childNodes).map(nodeToRuns).join('')
      const shade = isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/>' : ''
      const cellPr = `<w:tcPr>${shade}<w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>`
      return `<w:tc>${cellPr}<w:p>${isHeader ? '<w:r><w:rPr><w:b/></w:rPr><w:t/></w:r>' : ''}${runs}</w:p></w:tc>`
    }).join('')
    return `<w:tr>${cellXml}</w:tr>`
  }).join('')
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${BORDERS}</w:tblPr>${rowXml}</w:tbl>`
}

const JC_MAP = { left: 'left', center: 'center', right: 'right', justify: 'both' }

// imgMap: Map from img DOM element → imgInfo (for embedding)
function makeElementToXml(imgMap) {
  return function elementToXml(el) {
    const tag = el.tagName?.toLowerCase()
    if (!tag) return ''

    if (['h1','h2','h3'].includes(tag)) {
      const runs = Array.from(el.childNodes).map(nodeToRuns).join('')
      return `<w:p><w:pPr><w:pStyle w:val="Heading${tag[1]}"/></w:pPr>${runs}</w:p>`
    }

    if (tag === 'p') {
      const runs = Array.from(el.childNodes).map(nodeToRuns).join('')
      const jc = JC_MAP[el.style?.textAlign]
      const ppr = jc ? `<w:pPr><w:jc w:val="${jc}"/></w:pPr>` : ''
      return `<w:p>${ppr}${runs}</w:p>`
    }

    if (tag === 'blockquote') {
      return Array.from(el.children).map(child => {
        const runs = Array.from(child.childNodes).map(nodeToRuns).join('')
        return `<w:p><w:pPr><w:ind w:left="720"/><w:pBdr><w:left w:val="single" w:sz="12" w:space="4"/></w:pBdr></w:pPr>${runs}</w:p>`
      }).join('')
    }

    if (tag === 'ul') {
      if (el.getAttribute('data-type') === 'taskList') {
        return Array.from(el.querySelectorAll(':scope > li[data-type="taskItem"]')).map(li => {
          const checked = li.getAttribute('data-checked') === 'true'
          const runs = taskItemRuns(li)
          const strikeRpr = checked ? '<w:r><w:rPr><w:strike/><w:color w:val="888888"/></w:rPr><w:t/></w:r>' : ''
          return `<w:p><w:pPr><w:ind w:left="360"/></w:pPr><w:r><w:t xml:space="preserve">${checked ? '☑' : '☐'} </w:t></w:r>${strikeRpr}${runs}</w:p>`
        }).join('')
      }
      return Array.from(el.querySelectorAll(':scope > li')).map(li => {
        const runs = Array.from(li.childNodes).map(nodeToRuns).join('')
        return `<w:p><w:pPr><w:ind w:left="720"/></w:pPr><w:r><w:t xml:space="preserve">• </w:t></w:r>${runs}</w:p>`
      }).join('')
    }

    if (tag === 'ol') {
      let n = 1
      return Array.from(el.querySelectorAll(':scope > li')).map(li => {
        const runs = Array.from(li.childNodes).map(nodeToRuns).join('')
        return `<w:p><w:pPr><w:ind w:left="720"/></w:pPr><w:r><w:t xml:space="preserve">${n++}. </w:t></w:r>${runs}</w:p>`
      }).join('')
    }

    if (tag === 'pre') {
      const code = el.querySelector('code') || el
      return code.textContent.split('\n').map(line =>
        `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${xmlEsc(line)}</w:t></w:r></w:p>`
      ).join('')
    }

    if (tag === 'hr') {
      return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1"/></w:pBdr></w:pPr></w:p>`
    }

    if (tag === 'table') return tableToXml(el)

    if (tag === 'img') {
      const info = imgMap.get(el)
      return info ? imgDrawingXml(info) : ''
    }

    return ''
  }
}

export async function exportDocx(html, filePath) {
  const JSZip = (await import('jszip')).default
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // ── Pre-process images ──────────────────────────────────────────────────
  const imgEls = [...doc.querySelectorAll('img[src^="data:"]')]
  const MAX_EMU = 5943600 // 6.5 inches wide max

  const imgInfoList = await Promise.all(imgEls.map(async (el, i) => {
    const src = el.getAttribute('src') || ''
    const m = src.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) return null
    const mime = m[1]
    const b64  = m[2]
    const ext  = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1] || 'png'
    const { w, h } = await getImgDims(src)
    const scale = w * 9525 > MAX_EMU ? MAX_EMU / (w * 9525) : 1
    return {
      el, rId: `rId${i + 2}`, id: i + 1,
      name: `image${i + 1}.${ext}`,
      mime, b64, ext,
      cxEmu: Math.round(w * 9525 * scale),
      cyEmu: Math.round(h * 9525 * scale),
    }
  }))

  const imgs = imgInfoList.filter(Boolean)
  const imgMap = new Map(imgs.map(info => [info.el, info]))
  const elementToXml = makeElementToXml(imgMap)

  // ── Build OOXML body ────────────────────────────────────────────────────
  const body = Array.from(doc.body.children).map(elementToXml).join('\n')

  // ── Assemble ZIP ────────────────────────────────────────────────────────
  const W  = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
  const zip = new JSZip()

  // Content types — include image types
  const imgExts = [...new Set(imgs.map(i => i.ext))]
  const imgCtypes = imgExts.map(ext => {
    const ct = ext === 'jpg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`
    return `<Default Extension="${ext}" ContentType="${ct}"/>`
  }).join('')
  zip.file('[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    imgCtypes +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `</Types>`)

  zip.folder('_rels').file('.rels',
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`)

  zip.folder('word').file('document.xml',
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<w:document ${W}><w:body>${body}` +
    `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1800"/></w:sectPr>` +
    `</w:body></w:document>`)

  zip.folder('word').file('styles.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:styles ${W}>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>` +
    `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="6366F1"/><w:u w:val="single"/></w:rPr></w:style>` +
    `</w:styles>`)

  // Relationships: styles + images
  const imgRels = imgs.map(i =>
    `<Relationship Id="${i.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${i.name}"/>`
  ).join('')
  zip.folder('word').folder('_rels').file('document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    imgRels +
    `</Relationships>`)

  // Add image binaries to media folder
  const mediaFolder = zip.folder('word').folder('media')
  for (const img of imgs) {
    mediaFolder.file(img.name, img.b64, { base64: true })
  }

  // Generate and write
  const buf = await zip.generateAsync({ type: 'uint8array' })
  let binary = ''
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i])
  await window.nexus.writeFileBinary(filePath, btoa(binary))
}

export async function importDocx(filePath) {
  const mammoth = (await import('mammoth')).default
  const buf = await window.nexus.readFile(filePath, null)
  const result = await mammoth.convertToHtml({ arrayBuffer: buf })
  return result.value
}

export async function exportPdf(html, title, filePath) {
  const safeTitle = String(title)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Note: printToPDF already applies 1.5in physical margins.
  // Body has NO extra horizontal padding/max-width so content fills the printable area exactly.
  const styledHtml = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 15px;
    line-height: 1.7;
    color: #1c1c1e;
    background: #fff;
  }
  h1.doc-title {
    font-size: 2.2em; font-weight: 700;
    margin-bottom: 12px; padding-bottom: 10px;
    border-bottom: 2px solid #e5e7eb; line-height: 1.2;
  }
  h1 { font-size: 1.9em; font-weight: 700; margin: 1em 0 0.3em; line-height: 1.2; }
  h2 { font-size: 1.45em; font-weight: 600; margin: 0.9em 0 0.3em; }
  h3 { font-size: 1.15em; font-weight: 600; margin: 0.7em 0 0.25em; }
  p  { margin: 0 0 0.75em; }
  ul, ol { padding-left: 1.5em; margin: 0 0 0.75em; }
  li { margin-bottom: 0.2em; }
  ul[data-type="taskList"] { list-style: none; padding-left: 0.25em; }
  li[data-type="taskItem"] { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 0.3em; }
  li[data-type="taskItem"] > label { display: flex; align-items: center; flex-shrink: 0; margin-top: 3px; }
  li[data-type="taskItem"] > label input[type="checkbox"] { width: 14px; height: 14px; margin: 0; accent-color: #6366f1; }
  li[data-type="taskItem"][data-checked="true"] > div { text-decoration: line-through; color: #9ca3af; }
  li[data-type="taskItem"] > div { flex: 1; }
  blockquote { border-left: 3px solid #6366f1; margin: 0.75em 0; padding: 0.2em 0 0.2em 1em; color: #555; font-style: italic; }
  code { background: #f3f4f6; border-radius: 3px; padding: 0.1em 0.3em; font-family: 'Courier New', monospace; font-size: 0.875em; color: #6366f1; }
  pre  { background: #f3f4f6; border-radius: 8px; padding: 1em; overflow-x: auto; margin: 0.75em 0; }
  pre code { background: none; padding: 0; color: #1c1c1e; }
  hr   { border: none; border-top: 1px solid #e5e7eb; margin: 1.5em 0; }
  a    { color: #6366f1; text-decoration: underline; }
  mark { border-radius: 2px; padding: 0 2px; color: #1c1c1e; }
  sub  { vertical-align: sub; font-size: 0.75em; }
  sup  { vertical-align: super; font-size: 0.75em; }
  img  { max-width: 100%; height: auto; border-radius: 6px; margin: 0.5em 0; display: block; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.9em; }
  th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; vertical-align: top; }
  th { background: #f9fafb; font-weight: 600; }
</style>
</head>
<body>
  <h1 class="doc-title">${safeTitle}</h1>
  ${html}
</body></html>`

  await window.nexus.markdown.exportPDF(styledHtml, filePath)
}
