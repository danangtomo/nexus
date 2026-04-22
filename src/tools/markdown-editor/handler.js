import { marked } from 'marked'

marked.use({ gfm: true, breaks: true })

export function parseMarkdown(text) {
  if (!text) return ''
  return marked.parse(text)
}

export function buildHTMLExport(title, bodyHTML) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; line-height: 1.7; color: #1d1d1f; background: #fff; }
  h1 { font-size: 2em; border-bottom: 1px solid #d1d1d6; padding-bottom: 0.3em; margin: 1.2em 0 0.5em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #d1d1d6; padding-bottom: 0.2em; margin: 1.2em 0 0.5em; }
  h3, h4, h5, h6 { margin: 1em 0 0.4em; }
  p { margin: 0.7em 0; }
  a { color: #0a84ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { background: #f2f2f7; padding: 2px 6px; border-radius: 4px; font-family: 'SF Mono', Consolas, monospace; font-size: 0.875em; }
  pre { background: #f2f2f7; border: 1px solid #d1d1d6; border-radius: 8px; padding: 16px; overflow-x: auto; margin: 1em 0; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #0a84ff; margin: 1em 0; padding: 0.5em 1em; background: #f2f9ff; border-radius: 0 6px 6px 0; color: #555; }
  ul, ol { padding-left: 1.6em; margin: 0.5em 0; }
  li { margin: 0.3em 0; }
  hr { border: none; border-top: 1px solid #d1d1d6; margin: 1.5em 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #d1d1d6; padding: 8px 12px; text-align: left; }
  th { background: #f2f2f7; font-weight: 600; }
  img { max-width: 100%; border-radius: 6px; }
</style>
</head>
<body>
${bodyHTML}
</body>
</html>`
}
