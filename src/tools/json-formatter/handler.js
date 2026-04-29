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

export function getStats(parsed) {
  let strings = 0, numbers = 0, booleans = 0, nulls = 0, arrays = 0, objects = 0, keys = 0
  let maxDepth = 0

  function walk(node, depth) {
    if (depth > maxDepth) maxDepth = depth
    if (Array.isArray(node)) {
      arrays++
      node.forEach(v => walk(v, depth + 1))
    } else if (node !== null && typeof node === 'object') {
      objects++
      const entries = Object.entries(node)
      keys += entries.length
      entries.forEach(([, v]) => walk(v, depth + 1))
    } else if (typeof node === 'string') strings++
    else if (typeof node === 'number') numbers++
    else if (typeof node === 'boolean') booleans++
    else if (node === null) nulls++
  }

  walk(parsed, 0)
  return { strings, numbers, booleans, nulls, arrays, objects, keys, maxDepth }
}
