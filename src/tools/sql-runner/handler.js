import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// ── SQL syntax highlighter ─────────────────────────────────────────────────
const KW = new Set([
  // Standard SQL
  'SELECT','FROM','WHERE','AND','OR','NOT','IN','IS','NULL','LIKE','BETWEEN',
  'EXISTS','JOIN','LEFT','RIGHT','INNER','OUTER','FULL','CROSS','ON','AS',
  'DISTINCT','GROUP','BY','ORDER','HAVING','LIMIT','OFFSET','UNION','ALL',
  'EXCEPT','INTERSECT','WITH','CASE','WHEN','THEN','ELSE','END','INSERT',
  'INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','DROP','ALTER',
  'ADD','COLUMN','INDEX','PRIMARY','KEY','FOREIGN','REFERENCES','UNIQUE',
  'DEFAULT','INTEGER','TEXT','REAL','BLOB','NUMERIC','BOOLEAN',
  'EXPLAIN','PLAN','QUERY','TRUE','FALSE','ASC','DESC','USING','NATURAL',
  // MySQL / MariaDB
  'USE','SHOW','DESCRIBE','DATABASES','TABLES','TRUNCATE','RENAME','ANALYZE',
  'AUTO_INCREMENT','ENGINE','CHARSET','COLLATE','PROCEDURE','FUNCTION',
  'DUPLICATE','LOCK','UNLOCK','TRIGGER','EVENT','SCHEMA',
  // PostgreSQL
  'RETURNING','ILIKE','SIMILAR','VACUUM','FREEZE','REINDEX','CLUSTER',
  'CONCURRENTLY','GENERATED','ALWAYS','STORED','VIRTUAL','EXCLUDE',
  'PARTITION','INHERIT','TABLESPACE','SEQUENCE','MATERIALIZED','VIEW',
  // SQL Server
  'TOP','IDENTITY','NOLOCK','NOCOUNT','SHOWPLAN','MERGE','OUTPUT',
  'INSERTED','DELETED','APPLY','EXEC','EXECUTE','THROW','RAISERROR',
  'TRANSACTION','COMMIT','ROLLBACK','SAVEPOINT','BEGIN','GO',
  // Types (all dialects)
  'VARCHAR','NVARCHAR','CHAR','NCHAR','INT','BIGINT','SMALLINT','TINYINT',
  'DECIMAL','FLOAT','DOUBLE','MONEY','BIT','DATETIME','TIMESTAMP','DATE',
  'TIME','INTERVAL','UUID','JSONB','JSON','ARRAY','ENUM','SERIAL','BYTEA',
])
const FN = new Set([
  // Aggregates
  'COUNT','SUM','AVG','MIN','MAX','ROUND','ABS',
  // String
  'LENGTH','LEN','LOWER','UPPER','TRIM','LTRIM','RTRIM','SUBSTR','SUBSTRING',
  'REPLACE','CONCAT','CHARINDEX','PATINDEX','STUFF','INSTR','POSITION',
  'LEFT','RIGHT','LPAD','RPAD','REPEAT','REVERSE','SPACE','ASCII','CHAR',
  'STRING_AGG','GROUP_CONCAT','LISTAGG',
  // Null / conditional
  'COALESCE','NULLIF','ISNULL','IFNULL','NVL','IIF','IF','DECODE',
  'GREATEST','LEAST','CASE',
  // Cast / convert
  'CAST','CONVERT','TYPEOF','TRY_CAST','PARSE',
  // Date / time
  'DATE','TIME','DATETIME','NOW','GETDATE','GETUTCDATE','SYSDATE','CURDATE',
  'CURTIME','CURRENT_TIMESTAMP','CURRENT_DATE','CURRENT_TIME',
  'DATEADD','DATEDIFF','DATEPART','DATENAME','DATE_ADD','DATE_SUB',
  'DATE_FORMAT','DATE_TRUNC','DATE_PART','EXTRACT','TO_DATE','TO_CHAR',
  'TO_TIMESTAMP','STR_TO_DATE','STRFTIME','JULIANDAY','TIMESTAMPDIFF',
  'YEAR','MONTH','DAY','HOUR','MINUTE','SECOND','FORMAT',
  // Window
  'ROW_NUMBER','RANK','DENSE_RANK','LAG','LEAD','FIRST_VALUE','LAST_VALUE',
  'NTILE','OVER','PARTITION','CUME_DIST','PERCENT_RANK',
  // JSON
  'JSON_BUILD_OBJECT','JSONB_BUILD_OBJECT','JSON_AGG','JSONB_AGG',
  'JSON_EXTRACT','JSON_VALUE','JSON_QUERY','JSON_OBJECT','JSON_ARRAY',
  // Math
  'CEIL','CEILING','FLOOR','POWER','SQRT','MOD','SIGN','PI','EXP','LOG',
  'RANDOM','RAND','NEWID','UUID',
  // Other
  'PRINTF','HEX','RANDOMBLOB','ZEROBLOB','CHANGES','LAST_INSERT_ROWID',
  'GENERATE_SERIES','UNNEST','ARRAY_AGG','TOTAL','SCOPE_IDENTITY',
])

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function highlightSQL(code) {
  let html = ''
  let i = 0
  while (i < code.length) {
    // Single-line comment
    if (code[i] === '-' && code[i+1] === '-') {
      let j = i; while (j < code.length && code[j] !== '\n') j++
      html += `<span class="hl-c">${esc(code.slice(i, j))}</span>`; i = j
    }
    // String literal 'abc'
    else if (code[i] === "'") {
      let j = i + 1
      while (j < code.length) {
        if (code[j] === "'" && code[j+1] === "'") { j += 2; continue }
        if (code[j] === "'") { j++; break }
        j++
      }
      html += `<span class="hl-s">${esc(code.slice(i, j))}</span>`; i = j
    }
    // Quoted identifier "name"
    else if (code[i] === '"') {
      let j = i + 1; while (j < code.length && code[j] !== '"') j++
      html += `<span class="hl-q">${esc(code.slice(i, j + 1))}</span>`; i = j + 1
    }
    // Word: keyword, function, or identifier
    else if (/[a-zA-Z_]/.test(code[i])) {
      let j = i; while (j < code.length && /\w/.test(code[j])) j++
      const word = code.slice(i, j); const up = word.toUpperCase()
      let k = j; while (k < code.length && code[k] === ' ') k++
      if (code[k] === '(') {
        html += `<span class="${FN.has(up) ? 'hl-fn' : 'hl-id'}">${esc(word)}</span>`
      } else if (KW.has(up)) {
        html += `<span class="hl-kw">${up}</span>`
      } else {
        html += esc(word)
      }
      i = j
    }
    // Number
    else if (/[0-9]/.test(code[i]) || (code[i] === '.' && /[0-9]/.test(code[i+1] ?? ''))) {
      let j = i; while (j < code.length && /[0-9.eE+-]/.test(code[j])) j++
      html += `<span class="hl-n">${esc(code.slice(i, j))}</span>`; i = j
    }
    // Operator: *, =, !=, <=, >=, etc.
    else if (/[=!<>*]/.test(code[i])) {
      html += `<span class="hl-op">${esc(code[i])}</span>`; i++
    }
    else {
      html += esc(code[i]); i++
    }
  }
  return html
}

// ── Chart option builder ───────────────────────────────────────────────────
export function buildChartOption(results, chartType) {
  const { columns, rows } = results
  const isNum = c => {
    const vals = rows.slice(0, 30).map(r => r[c]).filter(v => v != null && v !== '')
    return vals.length > 0 && vals.every(v => !isNaN(parseFloat(v)))
  }
  const numCols  = columns.filter(isNum)
  const textCols = columns.filter(c => !isNum(c))

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const textClr  = isDark ? '#b0b0b0' : '#555'
  const gridClr  = isDark ? '#333' : '#e5e5e5'
  const PALETTE  = ['#4a90d9','#e87c2e','#22c55e','#a855f7','#f59e0b','#ef4444']

  const base = {
    animation: false,
    backgroundColor: 'transparent',
    textStyle: { color: textClr },
    grid: { left: 60, right: 20, top: 32, bottom: 56, containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: isDark ? '#222' : '#fff', borderColor: gridClr, textStyle: { color: textClr } },
    color: PALETTE,
  }

  if ((chartType === 'bar' || chartType === 'line') && textCols.length >= 1 && numCols.length >= 1) {
    const cats = rows.map(r => String(r[textCols[0]] ?? '')).slice(0, 500)
    const rotate = cats.length > 12 ? 35 : 0
    return {
      ...base,
      legend: cats.length > 1 && numCols.length > 1 ? { textStyle: { color: textClr } } : undefined,
      xAxis: { type: 'category', data: cats, axisLabel: { color: textClr, rotate }, axisLine: { lineStyle: { color: gridClr } } },
      yAxis: { type: 'value', axisLabel: { color: textClr }, splitLine: { lineStyle: { color: gridClr } } },
      series: numCols.slice(0, 4).map((c, i) => ({
        name: c, type: chartType, data: rows.slice(0, 500).map(r => parseFloat(r[c]) || 0),
        smooth: chartType === 'line', color: PALETTE[i],
        barMaxWidth: 60,
      })),
    }
  }

  if (chartType === 'pie' && textCols.length >= 1 && numCols.length >= 1) {
    return {
      ...base,
      grid: undefined,
      tooltip: { trigger: 'item' },
      series: [{ type: 'pie', radius: ['38%', '65%'],
        data: rows.slice(0, 30).map(r => ({ name: String(r[textCols[0]] ?? ''), value: parseFloat(r[numCols[0]]) || 0 })),
        label: { color: textClr }, emphasis: { itemStyle: { shadowBlur: 10 } },
      }],
    }
  }

  if (chartType === 'scatter' && numCols.length >= 2) {
    return {
      ...base,
      tooltip: { trigger: 'item' },
      xAxis: { type: 'value', name: numCols[0], nameTextStyle: { color: textClr }, axisLabel: { color: textClr }, splitLine: { lineStyle: { color: gridClr } } },
      yAxis: { type: 'value', name: numCols[1], nameTextStyle: { color: textClr }, axisLabel: { color: textClr }, splitLine: { lineStyle: { color: gridClr } } },
      series: [{ type: 'scatter', data: rows.slice(0, 2000).map(r => [parseFloat(r[numCols[0]]) || 0, parseFloat(r[numCols[1]]) || 0]), symbolSize: 5 }],
    }
  }

  return null // can't chart this
}

export function sanitizeName(filePath) {
  const base = filePath.split(/[\\/]/).pop().replace(/\.\w+$/, '')
  return base.replace(/[^\w]+/g, '_').replace(/^(\d)/, '_$1') || 'data'
}

export function csvToRows(text) {
  const r = Papa.parse(text.trim(), { header: true, skipEmptyLines: true, dynamicTyping: false })
  if (!r.meta.fields?.length) throw new Error('Could not parse CSV — check the file format')
  return { columns: r.meta.fields, rows: r.data }
}

export function jsonToRows(text) {
  const parsed = JSON.parse(text)
  let arr = Array.isArray(parsed) ? parsed : null
  if (!arr) {
    const key = Object.keys(parsed).find(k => Array.isArray(parsed[k]))
    if (key) arr = parsed[key]
  }
  if (!Array.isArray(arr) || !arr.length) {
    throw new Error('JSON must be an array of objects (or an object with an array property)')
  }
  const columns = [...new Set(arr.flatMap(r => Object.keys(r)))]
  return { columns, rows: arr }
}

export function xlsxToRows(base64) {
  const wb = XLSX.read(base64, { type: 'base64' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false })
  if (!data.length) throw new Error('XLSX sheet is empty')
  const columns = Object.keys(data[0])
  return { columns, rows: data }
}

export function inferColType(col, rows) {
  const sample = rows.slice(0, 200).map(r => r[col]).filter(v => v != null && v !== '')
  if (!sample.length) return 'TEXT'
  if (sample.every(v => /^-?\d+$/.test(String(v)))) return 'INTEGER'
  if (sample.every(v => /^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(String(v)))) return 'REAL'
  return 'TEXT'
}

export function buildTableSql(tableName, columns, rows) {
  const cols = columns
    .map(c => `  "${c.replace(/"/g, '""')}" ${inferColType(c, rows)}`)
    .join(',\n')
  return `CREATE TABLE "${tableName}" (\n${cols}\n);`
}

export function buildInsertPlaceholders(columns) {
  const cols = columns.map(c => `"${c.replace(/"/g, '""')}"`).join(', ')
  const placeholders = columns.map(() => '?').join(', ')
  return { cols, placeholders }
}

// ── Exports ────────────────────────────────────────────────────────────────
export function resultsToCSV(columns, rows) {
  const esc = v => {
    const s = String(v ?? '')
    return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.join(','), ...rows.map(r => columns.map(c => esc(r[c])).join(','))].join('\n')
}

export function resultsToJSON(rows) {
  return JSON.stringify(rows, null, 2)
}

export function resultsToSQLInsert(tableName, columns, rows) {
  if (!rows.length) return ''
  const cols = columns.map(c => `"${c.replace(/"/g, '""')}"`).join(', ')
  const out = [`-- ${rows.length} rows from "${tableName}"\n`]
  for (let i = 0; i < rows.length; i += 100) {
    const vals = rows.slice(i, i + 100).map(row => {
      const cells = columns.map(c => {
        const v = row[c]
        if (v == null) return 'NULL'
        if (typeof v === 'number' || (typeof v === 'string' && /^-?\d*\.?\d+$/.test(v.trim()))) return v
        return `'${String(v).replace(/'/g, "''")}'`
      })
      return `  (${cells.join(', ')})`
    })
    out.push(`INSERT INTO "${tableName}" (${cols}) VALUES\n${vals.join(',\n')};\n`)
  }
  return out.join('\n')
}

// ── SQL formatter ──────────────────────────────────────────────────────────
const CLAUSE_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'HAVING',
  'LIMIT', 'OFFSET', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
  'FULL OUTER JOIN', 'CROSS JOIN', 'JOIN', 'UNION ALL', 'UNION',
  'INTERSECT', 'EXCEPT', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE FROM', 'CREATE TABLE', 'DROP TABLE', 'WITH',
]
const ALL_KEYWORDS = [
  ...CLAUSE_KEYWORDS,
  'DISTINCT', 'AS', 'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
  'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL', 'NULL', 'TRUE', 'FALSE',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'COALESCE', 'NULLIF',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'ABS',
]

export function formatSQL(sql) {
  let s = sql.trim()

  // Uppercase all keywords (longest first to avoid partial matches)
  const sorted = [...ALL_KEYWORDS].sort((a, b) => b.length - a.length)
  for (const kw of sorted) {
    const esc = kw.replace(/\s+/g, '\\s+')
    s = s.replace(new RegExp(`\\b${esc}\\b`, 'gi'), kw)
  }

  // Put main clause keywords on their own line
  for (const kw of CLAUSE_KEYWORDS) {
    const esc = kw.replace(/\s+/g, '\\s+')
    s = s.replace(new RegExp(`(?<![(\n])\\b${esc}\\b`, 'g'), `\n${kw}`)
  }

  // AND / OR inside clauses get indented
  s = s.replace(/\b(AND|OR)\b/g, '\n  $1')

  // Clean up
  s = s.split('\n').map(l => l.trimEnd()).filter(l => l.trim()).join('\n').trim()
  if (s && !s.endsWith(';')) s += ';'
  return s
}

// ── Column stats ───────────────────────────────────────────────────────────
export function computeColStats(col, rows) {
  const vals  = rows.map(r => r[col])
  const nonNull = vals.filter(v => v != null && v !== '')
  const nums  = nonNull.map(v => parseFloat(v)).filter(n => !isNaN(n))
  const isNum = nums.length === nonNull.length && nonNull.length > 0
  return {
    total:  rows.length,
    count:  nonNull.length,
    nulls:  rows.length - nonNull.length,
    unique: new Set(nonNull).size,
    ...(isNum && nums.length ? {
      min: Math.min(...nums),
      max: Math.max(...nums),
      avg: nums.reduce((a, b) => a + b, 0) / nums.length,
    } : {}),
  }
}

// ── Examples ───────────────────────────────────────────────────────────────
export function sqlExamples(tables) {
  if (!tables.length) return []
  const t  = tables[0]
  const c  = t.columns[0] ? `"${t.columns[0].name}"` : '*'
  const ex = [
    { label: 'All rows',      sql: `SELECT * FROM "${t.name}" LIMIT 100;` },
    { label: 'Count rows',    sql: `SELECT COUNT(*) AS total_rows FROM "${t.name}";` },
    { label: 'Group by',      sql: `SELECT ${c}, COUNT(*) AS n\nFROM "${t.name}"\nGROUP BY ${c}\nORDER BY n DESC\nLIMIT 20;` },
    { label: 'Distinct vals', sql: `SELECT DISTINCT ${c} FROM "${t.name}" LIMIT 50;` },
  ]
  if (t.numericCols.length) {
    const nc = `"${t.numericCols[0]}"`
    ex.push({
      label: 'Min / Max / Avg',
      sql: `SELECT\n  MIN(${nc}) AS min_val,\n  MAX(${nc}) AS max_val,\n  ROUND(AVG(${nc}), 2) AS avg_val\nFROM "${t.name}";`,
    })
  }
  if (t.columns.length >= 2) {
    const [c1, c2] = t.columns
    ex.push({
      label: 'Filter & sort',
      sql: `SELECT "${c1.name}", "${c2.name}"\nFROM "${t.name}"\nWHERE "${c1.name}" IS NOT NULL\nORDER BY "${c2.name}" DESC\nLIMIT 50;`,
    })
  }
  if (tables.length > 1) {
    const t2 = tables[1]
    ex.push({
      label: 'Join 2 tables',
      sql: `SELECT a.*, b.*\nFROM "${t.name}" a\nJOIN "${t2.name}" b\n  ON a."${t.columns[0].name}" = b."${t2.columns[0].name}"\nLIMIT 50;`,
    })
  }
  return ex
}

// ── Dialect-aware autocomplete keywords ────────────────────────────────────
const COMMON_KW = [
  'SELECT','FROM','WHERE','AND','OR','NOT','IN','IS','NULL','LIKE','BETWEEN','EXISTS',
  'JOIN','LEFT JOIN','RIGHT JOIN','INNER JOIN','CROSS JOIN','ON','AS','DISTINCT',
  'GROUP BY','ORDER BY','HAVING','UNION ALL','UNION','INTERSECT','EXCEPT',
  'INSERT INTO','VALUES','UPDATE','SET','DELETE FROM',
  'CREATE TABLE','DROP TABLE','ALTER TABLE','ADD COLUMN','DROP COLUMN',
  'CREATE INDEX','DROP INDEX','CREATE VIEW','DROP VIEW',
  'WITH','CASE','WHEN','THEN','ELSE','END','ASC','DESC',
  'IF EXISTS','IF NOT EXISTS',
  'BEGIN','COMMIT','ROLLBACK','SAVEPOINT',
  'COUNT(*)','COUNT','SUM','AVG','MIN','MAX','ROUND','ABS',
  'COALESCE','NULLIF','CAST','CONCAT','LOWER','UPPER','TRIM','REPLACE','SUBSTRING',
  'TRUE','FALSE',
]

const DIALECT_KW = {
  sqlite: [
    'LIMIT','OFFSET','AUTOINCREMENT','EXPLAIN QUERY PLAN',
    'LENGTH','SUBSTR','TYPEOF','IFNULL','PRINTF','RANDOM',
    'INTEGER','TEXT','REAL','BLOB','NUMERIC',
  ],
  postgresql: [
    'LIMIT','OFFSET','RETURNING','ON CONFLICT DO NOTHING','ON CONFLICT DO UPDATE',
    'EXCLUDED','EXPLAIN','EXPLAIN ANALYZE','VACUUM','ANALYZE','ILIKE','SIMILAR TO',
    'ANY','ALL','SOME','OVER','PARTITION BY','ROWS BETWEEN','RANGE BETWEEN',
    'UNBOUNDED PRECEDING','CURRENT ROW',
    'NOW()','CURRENT_TIMESTAMP','CURRENT_DATE','CURRENT_DATE','EXTRACT','DATE_TRUNC',
    'TO_CHAR','TO_DATE','TO_TIMESTAMP','GENERATE_SERIES','UNNEST',
    'STRING_AGG','ARRAY_AGG','JSON_BUILD_OBJECT','JSONB_BUILD_OBJECT','JSON_AGG',
    'ROW_NUMBER()','RANK()','DENSE_RANK()','LAG()','LEAD()','NTILE()','FIRST_VALUE()','LAST_VALUE()',
    'LENGTH','POSITION','GREATEST','LEAST',
    'SERIAL','BIGSERIAL','VARCHAR','BOOLEAN','TIMESTAMP','TIMESTAMPTZ','DATE','TIME',
    'INTERVAL','JSONB','JSON','UUID','ARRAY','BIGINT','SMALLINT','DECIMAL','NUMERIC',
    'CREATE UNIQUE INDEX','CREATE MATERIALIZED VIEW','REFRESH MATERIALIZED VIEW',
    'CREATE SEQUENCE','CREATE FUNCTION','LANGUAGE','PLPGSQL',
  ],
  mysql: [
    'LIMIT','OFFSET','USE','SHOW DATABASES','SHOW TABLES','SHOW COLUMNS FROM',
    'SHOW CREATE TABLE','SHOW INDEX FROM','SHOW STATUS','SHOW VARIABLES',
    'DESCRIBE','DESC','EXPLAIN','TRUNCATE TABLE','RENAME TABLE',
    'ON DUPLICATE KEY UPDATE','AUTO_INCREMENT','ENGINE','DEFAULT CHARSET','COLLATE',
    'GROUP_CONCAT','IFNULL','DATE_FORMAT','STR_TO_DATE',
    'NOW()','CURDATE()','CURTIME()','SYSDATE()','DATEDIFF','TIMESTAMPDIFF',
    'DATE_ADD','DATE_SUB','YEAR','MONTH','DAY',
    'IF','IFNULL','NULLIF',
    'VARCHAR','INT','BIGINT','TINYINT','SMALLINT','MEDIUMINT','DECIMAL','FLOAT',
    'DOUBLE','DATETIME','TIMESTAMP','DATE','TIME','YEAR','TEXT','MEDIUMTEXT',
    'LONGTEXT','BLOB','ENUM','JSON','BOOLEAN','BIT',
    'ROW_NUMBER()','RANK()','DENSE_RANK()','LAG()','LEAD()','OVER','PARTITION BY',
    'LOCK TABLES','UNLOCK TABLES',
  ],
  mariadb: [
    'LIMIT','OFFSET','USE','SHOW DATABASES','SHOW TABLES','SHOW COLUMNS FROM',
    'DESCRIBE','DESC','EXPLAIN','TRUNCATE TABLE','RENAME TABLE',
    'ON DUPLICATE KEY UPDATE','AUTO_INCREMENT','ENGINE','DEFAULT CHARSET','COLLATE',
    'GROUP_CONCAT','IFNULL','DATE_FORMAT','STR_TO_DATE',
    'NOW()','CURDATE()','CURTIME()','DATEDIFF','TIMESTAMPDIFF','DATE_ADD','DATE_SUB',
    'IF','IFNULL','NULLIF',
    'VARCHAR','INT','BIGINT','TINYINT','DECIMAL','FLOAT','DOUBLE',
    'DATETIME','TIMESTAMP','DATE','TIME','TEXT','BLOB','ENUM','JSON','BOOLEAN',
    'ROW_NUMBER()','RANK()','DENSE_RANK()','LAG()','LEAD()','OVER','PARTITION BY',
    'RETURNING','SEQUENCE','CREATE SEQUENCE',
  ],
  mssql: [
    'TOP','WITH (NOLOCK)','NOLOCK','SET NOCOUNT ON','SET SHOWPLAN_TEXT ON','GO',
    'ISNULL','LEN','CHARINDEX','PATINDEX','STUFF',
    'GETDATE()','GETUTCDATE()','DATEADD','DATEDIFF','DATEPART','DATENAME',
    'CONVERT','FORMAT','YEAR','MONTH','DAY','SCOPE_IDENTITY()','NEWID()',
    'IDENTITY','EXEC','EXECUTE','MERGE','OUTPUT','INSERTED','DELETED',
    'OUTER APPLY','CROSS APPLY','OVER','PARTITION BY',
    'ROW_NUMBER()','RANK()','DENSE_RANK()','NTILE()','LAG()','LEAD()',
    'TRY','CATCH','THROW','RAISERROR','PRINT',
    'BEGIN TRANSACTION','COMMIT TRANSACTION','ROLLBACK TRANSACTION',
    'NVARCHAR','VARCHAR','NCHAR','CHAR','INT','BIGINT','SMALLINT','TINYINT','BIT',
    'DECIMAL','NUMERIC','FLOAT','REAL','MONEY','SMALLMONEY',
    'DATETIME','DATETIME2','DATE','TIME','DATETIMEOFFSET','UNIQUEIDENTIFIER',
    'VARBINARY','BINARY','CREATE PROCEDURE','DROP PROCEDURE','CREATE FUNCTION',
    'SELECT INTO','INSERT INTO ... SELECT',
  ],
}

export function getDialectKeywords(type) {
  return [...COMMON_KW, ...(DIALECT_KW[type] ?? DIALECT_KW.sqlite)]
}

// ── EXPLAIN result detection & tree builder ────────────────────────────────────

export function detectExplainResult(columns) {
  const c = columns.map(s => s.toLowerCase())
  if (c.length === 4 && c.includes('id') && c.includes('parent') && c.includes('detail')) return 'sqlite'
  if (c.length === 1 && (c[0] === 'query plan' || c[0] === 'queryplan')) return 'postgresql'
  if (c.includes('id') && c.includes('select_type') && c.includes('table') &&
      (c.includes('type') || c.includes('access_type'))) return 'mysql'
  return null
}

export function buildExplainTree(columns, rows, dialect) {
  if (dialect === 'sqlite') {
    const nodes = rows.map(r => ({ id: r.id ?? 0, parentId: r.parent ?? 0, detail: r.detail ?? '', children: [] }))
    const byId = {}
    nodes.forEach(n => { byId[n.id] = n })
    const roots = []
    nodes.forEach(n => {
      const par = byId[n.parentId]
      if (!par || par === n || n.parentId === 0) roots.push(n)
      else par.children.push(n)
    })
    return roots
  }
  if (dialect === 'postgresql') {
    const planCol = columns[0]
    const lines = rows.map(r => String(r[planCol] ?? '')).filter(l => l.trim())
    const stack = [] // [{node, indent}]
    const roots = []
    for (const line of lines) {
      const indent = (line.match(/^(\s*)/) || ['',''])[1].length
      const text = line.trim().replace(/^->\s*/, '')
      const node = { detail: text, children: [] }
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
      if (!stack.length) roots.push(node)
      else stack[stack.length - 1].node.children.push(node)
      stack.push({ node, indent })
    }
    return roots
  }
  if (dialect === 'mysql') {
    return rows.map(r => ({
      detail: [r.select_type, r.table ? `table: ${r.table}` : null, r.type ? `type: ${r.type}` : null].filter(Boolean).join(' · '),
      extra: [r.key ? `KEY: ${r.key}` : null, r.rows ? `~${r.rows} rows` : null, r.Extra || null].filter(Boolean).join(' · '),
      children: [],
    }))
  }
  return []
}

// ── Pivot table builder ────────────────────────────────────────────────────────

export function buildPivotData(rows, rowFields, colFields, valueField, agg) {
  if (!rows.length || !rowFields.length || !valueField) return null
  const colVals = colFields.length
    ? [...new Set(rows.map(r => colFields.map(f => String(r[f] ?? '')).join(' / ')))].sort()
    : ['Total']
  const groups = {}
  for (const row of rows) {
    const rk = rowFields.map(f => String(row[f] ?? '')).join(' / ')
    const ck = colFields.length ? colFields.map(f => String(row[f] ?? '')).join(' / ') : 'Total'
    if (!groups[rk]) groups[rk] = {}
    if (!groups[rk][ck]) groups[rk][ck] = []
    groups[rk][ck].push(row[valueField])
  }
  const AGG = {
    count: v => v.length,
    sum:   v => v.reduce((a, x) => a + (parseFloat(x) || 0), 0),
    avg:   v => v.length ? v.reduce((a, x) => a + (parseFloat(x) || 0), 0) / v.length : null,
    min:   v => v.length ? Math.min(...v.map(x => parseFloat(x) || 0)) : null,
    max:   v => v.length ? Math.max(...v.map(x => parseFloat(x) || 0)) : null,
  }
  const fn = AGG[agg] || AGG.count
  const pivotRows = Object.entries(groups)
    .map(([rk, cm]) => { const r = { _rk: rk }; colVals.forEach(cv => { r[cv] = fn(cm[cv] || []) }); return r })
    .sort((a, b) => String(a._rk).localeCompare(String(b._rk)))
  return { colVals, pivotRows, rowLabel: rowFields.join(' / ') }
}
