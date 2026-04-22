import { marked } from 'marked'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import katexCSSString from 'katex/dist/katex.min.css?inline'

// ── marked extensions: block math $$...$$ ─────────────────────────────────
const blockMathExt = {
  name: 'blockMath',
  level: 'block',
  start(src) { return src.indexOf('$$') },
  tokenizer(src) {
    const m = src.match(/^\$\$([\s\S]+?)\$\$/)
    if (m) return { type: 'blockMath', raw: m[0], math: m[1].trim() }
  },
  renderer({ math }) {
    try {
      return `<div class="katex-block">${katex.renderToString(math, { displayMode: true, throwOnError: false })}</div>\n`
    } catch {
      return `<div class="katex-error">${math}</div>\n`
    }
  },
}

// ── marked extensions: inline math $...$ ──────────────────────────────────
const inlineMathExt = {
  name: 'inlineMath',
  level: 'inline',
  start(src) { return src.indexOf('$') },
  tokenizer(src) {
    const m = src.match(/^\$([^ $\n][^$\n]*[^ $\n]|[^ $\n])\$/)
    if (m) return { type: 'inlineMath', raw: m[0], math: m[1] }
  },
  renderer({ math }) {
    try {
      return katex.renderToString(math, { throwOnError: false })
    } catch {
      return `<span class="katex-error">${math}</span>`
    }
  },
}

marked.use({ gfm: true, breaks: true })
marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang === 'mermaid') return `<div class="mermaid-pending">${text}</div>\n`
      return false
    },
  },
})
marked.use({ extensions: [blockMathExt, inlineMathExt] })

// ── Public: parse markdown to HTML ────────────────────────────────────────
export function parseMarkdown(text) {
  if (!text) return ''
  return marked.parse(text)
}

// ── Public: extract headings for outline panel ─────────────────────────────
export function extractHeadings(markdown) {
  return markdown.split('\n').reduce((acc, line, index) => {
    const m = line.match(/^(#{1,6})\s+(.+)/)
    if (m) acc.push({ level: m[1].length, text: m[2].replace(/[*_`[\]]/g, ''), line: index })
    return acc
  }, [])
}

// ── Public: build self-contained HTML export ───────────────────────────────
export function buildHTMLExport(title, bodyHTML) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
${katexCSSString}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:40px auto;padding:0 24px;line-height:1.7;color:#1d1d1f;background:#fff}
h1{font-size:2em;border-bottom:1px solid #d1d1d6;padding-bottom:.3em;margin:1.2em 0 .5em}
h2{font-size:1.5em;border-bottom:1px solid #d1d1d6;padding-bottom:.2em;margin:1.2em 0 .5em}
h3,h4,h5,h6{margin:1em 0 .4em}p{margin:.7em 0}
a{color:#0a84ff;text-decoration:none}a:hover{text-decoration:underline}
code{background:#f2f2f7;padding:2px 6px;border-radius:4px;font-family:'SF Mono',Consolas,monospace;font-size:.875em}
pre{background:#f2f2f7;border:1px solid #d1d1d6;border-radius:8px;padding:16px;overflow-x:auto;margin:1em 0}
pre code{background:none;padding:0}
blockquote{border-left:3px solid #0a84ff;margin:1em 0;padding:.5em 1em;background:#f2f9ff;border-radius:0 6px 6px 0;color:#555}
ul,ol{padding-left:1.6em;margin:.5em 0}li{margin:.3em 0}
hr{border:none;border-top:1px solid #d1d1d6;margin:1.5em 0}
table{border-collapse:collapse;width:100%;margin:1em 0}
th,td{border:1px solid #d1d1d6;padding:8px 12px;text-align:left}
th{background:#f2f2f7;font-weight:600}img{max-width:100%;border-radius:6px}
.katex-block{text-align:center;margin:1em 0}
</style>
</head>
<body>${bodyHTML}</body>
</html>`
}

// ── Public: export as LaTeX ────────────────────────────────────────────────
export function toLatex(markdown) {
  let tex = markdown
  tex = tex.replace(/^#{6} (.+)$/gm, '\\subparagraph{$1}')
  tex = tex.replace(/^#{5} (.+)$/gm, '\\paragraph{$1}')
  tex = tex.replace(/^#{4} (.+)$/gm, '\\subsubsection*{$1}')
  tex = tex.replace(/^#{3} (.+)$/gm, '\\subsubsection{$1}')
  tex = tex.replace(/^#{2} (.+)$/gm, '\\subsection{$1}')
  tex = tex.replace(/^# (.+)$/gm, '\\section{$1}')
  tex = tex.replace(/\*\*\*(.+?)\*\*\*/g, '\\textbf{\\textit{$1}}')
  tex = tex.replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}')
  tex = tex.replace(/\*(.+?)\*/g, '\\textit{$1}')
  tex = tex.replace(/~~(.+?)~~/g, '\\sout{$1}')
  tex = tex.replace(/```[\w]*\n([\s\S]+?)```/gm, '\\begin{verbatim}\n$1\\end{verbatim}')
  tex = tex.replace(/`(.+?)`/g, '\\texttt{$1}')
  tex = tex.replace(/!\[([^\]]*)\]\([^)]+\)/g, '[Image: $1]')
  tex = tex.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1\\footnote{\\url{$2}}')
  tex = tex.replace(/^[-*+] (.+)$/gm, '\\item $1')
  tex = tex.replace(/^\d+\. (.+)$/gm, '\\item $1')
  tex = tex.replace(/^> (.+)$/gm, '\\begin{quote}\n$1\n\\end{quote}')
  tex = tex.replace(/^[-*_]{3,}$/gm, '\\hrulefill')
  return `\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{hyperref}
\\usepackage{ulem}
\\usepackage{verbatim}
\\usepackage{geometry}
\\geometry{margin=2.5cm}

\\begin{document}
${tex}
\\end{document}`
}

// ── Public: export as MediaWiki ────────────────────────────────────────────
export function toMediaWiki(markdown) {
  let w = markdown
  w = w.replace(/^#{6} (.+)$/gm, '====== $1 ======')
  w = w.replace(/^#{5} (.+)$/gm, '===== $1 =====')
  w = w.replace(/^#{4} (.+)$/gm, '==== $1 ====')
  w = w.replace(/^#{3} (.+)$/gm, '=== $1 ===')
  w = w.replace(/^#{2} (.+)$/gm, '== $1 ==')
  w = w.replace(/^# (.+)$/gm, '= $1 =')
  w = w.replace(/\*\*\*(.+?)\*\*\*/g, "'''''$1'''''")
  w = w.replace(/\*\*(.+?)\*\*/g, "'''$1'''")
  w = w.replace(/\*(.+?)\*/g, "''$1''")
  w = w.replace(/~~(.+?)~~/g, '<s>$1</s>')
  w = w.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '[[File:$2|$1]]')
  w = w.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[$2 $1]')
  w = w.replace(/`(.+?)`/g, '<code>$1</code>')
  w = w.replace(/```[\w]*\n([\s\S]+?)```/gm, '<syntaxhighlight>\n$1</syntaxhighlight>')
  w = w.replace(/^[-*+] (.+)$/gm, '* $1')
  w = w.replace(/^\d+\. (.+)$/gm, '# $1')
  w = w.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
  w = w.replace(/^[-*_]{3,}$/gm, '----')
  return w
}

// ── Public: export as DOCX (via JSZip) ────────────────────────────────────
function xmlEsc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function inlineRuns(text) {
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`)/)
  return parts.map(p => {
    if (!p) return ''
    if (/^\*\*\*.*\*\*\*$/.test(p)) return `<w:r><w:rPr><w:b/><w:i/></w:rPr><w:t xml:space="preserve">${xmlEsc(p.slice(3,-3))}</w:t></w:r>`
    if (/^\*\*.*\*\*$/.test(p))    return `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${xmlEsc(p.slice(2,-2))}</w:t></w:r>`
    if (/^\*.*\*$/.test(p))         return `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${xmlEsc(p.slice(1,-1))}</w:t></w:r>`
    if (/^~~.*~~$/.test(p))         return `<w:r><w:rPr><w:strike/></w:rPr><w:t xml:space="preserve">${xmlEsc(p.slice(2,-2))}</w:t></w:r>`
    if (/^`.*`$/.test(p))           return `<w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr><w:t xml:space="preserve">${xmlEsc(p.slice(1,-1))}</w:t></w:r>`
    return `<w:r><w:t xml:space="preserve">${xmlEsc(p)}</w:t></w:r>`
  }).join('')
}

function tokenToXml(tok) {
  if (tok.type === 'heading') {
    const s = `Heading${Math.min(tok.depth, 3)}`
    return `<w:p><w:pPr><w:pStyle w:val="${s}"/></w:pPr><w:r><w:t>${xmlEsc(tok.text)}</w:t></w:r></w:p>`
  }
  if (tok.type === 'paragraph') return `<w:p>${inlineRuns(tok.text)}</w:p>`
  if (tok.type === 'code') return tok.text.split('\n').map(l =>
    `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${xmlEsc(l)}</w:t></w:r></w:p>`).join('')
  if (tok.type === 'list') return (tok.items||[]).map(item => {
    const t = (item.tokens||[]).map(t => t.text||'').join('') || item.text || ''
    return `<w:p><w:pPr><w:ind w:left="720"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEsc((tok.ordered ? '1. ' : '• ') + t)}</w:t></w:r></w:p>`
  }).join('')
  if (tok.type === 'blockquote') return (tok.tokens||[]).map(tokenToXml).join('')
  if (tok.type === 'hr') return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1"/></w:pBdr></w:pPr></w:p>`
  if (tok.type === 'space') return '<w:p/>'
  return ''
}

export async function toDocx(markdown) {
  const JSZip = (await import('jszip')).default
  const tokens = marked.lexer(markdown)
  const body = tokens.map(tokenToXml).join('\n    ')
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
  const zip = new JSZip()
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`)
  zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`)
  zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}<w:sectPr/></w:body></w:document>`)
  zip.folder('word').file('styles.xml', `<?xml version="1.0" encoding="UTF-8"?><w:styles ${W}><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr></w:style></w:styles>`)
  zip.folder('word').folder('_rels').file('document.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`)
  const buf = await zip.generateAsync({ type: 'uint8array' })
  return buf
}

// ── Public: import DOCX → markdown (via mammoth + turndown) ───────────────
export async function importDocx(base64Data) {
  const mammoth = (await import('mammoth')).default
  const { default: TurndownService } = await import('turndown')
  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer })
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })
  return td.turndown(result.value)
}

// ── Public: import HTML → markdown ────────────────────────────────────────
export async function importHTML(htmlContent) {
  const { default: TurndownService } = await import('turndown')
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })
  return td.turndown(htmlContent)
}
