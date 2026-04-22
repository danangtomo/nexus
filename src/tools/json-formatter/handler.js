export function formatJSON(text, indent = 2) {
  const parsed = JSON.parse(text) // throws on invalid
  const indentArg = indent === 'tab' ? '\t' : indent
  return JSON.stringify(parsed, null, indentArg)
}

export function minifyJSON(text) {
  return JSON.stringify(JSON.parse(text))
}

export function validateJSON(text) {
  if (!text.trim()) return { valid: false, error: 'Empty input' }
  try {
    JSON.parse(text)
    return { valid: true, error: null }
  } catch (e) {
    return { valid: false, error: e.message }
  }
}

export function parseJSON(text) {
  return JSON.parse(text)
}

export function getValueType(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}
