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

const { ipcMain } = require('electron')

// connId -> { type, client }
const connections = new Map()

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function extractError(err) {
  if (err instanceof AggregateError && err.errors?.length) {
    return err.errors.map(e => e.message || String(e)).join('; ')
  }
  return err.message || String(err) || 'Unknown error'
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ])
}

// ── Driver factory ────────────────────────────────────────────────────────────

async function makeDriver(config) {
  const { type, port, database, user, password, ssl } = config
  // Node 18+ resolves 'localhost' as both IPv6+IPv4 causing AggregateError — force IPv4
  const host = config.host === 'localhost' ? '127.0.0.1' : config.host
  const p = parseInt(port, 10)

  if (type === 'postgresql') {
    const { Pool } = require('pg')
    const pool = new Pool({
      host, port: p, database, user, password,
      ssl: ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
      max: 5,
    })
    const c = await pool.connect()
    c.release()
    return pool
  }

  if (type === 'mysql' || type === 'mariadb') {
    const mysql = require('mysql2/promise')
    const conn = await mysql.createConnection({
      host, port: p, database, user, password,
      connectTimeout: 10000,
      multipleStatements: true,
    })
    return conn
  }

  if (type === 'mssql') {
    const { ConnectionPool } = require('mssql')
    const pool = new ConnectionPool({
      server: host, port: p, database, user, password,
      connectionTimeout: 10000,
      requestTimeout: 30000,
      options: { trustServerCertificate: true, enableArithAbort: true },
    })
    await pool.connect()
    return pool
  }

  throw new Error(`Unknown database type: ${type}`)
}

async function closeDriver(type, client) {
  try {
    if (type === 'postgresql') await client.end()
    else if (type === 'mysql' || type === 'mariadb') await client.end()
    else if (type === 'mssql') await client.close()
  } catch (_) {}
}

// ── Query normalizer ──────────────────────────────────────────────────────────

async function execQuery(type, client, sql) {
  if (type === 'postgresql') {
    const result = await client.query(sql)
    if (!result.fields || result.fields.length === 0) {
      return [{ columns: ['Result'], rows: [{ Result: `${result.rowCount ?? 0} row(s) affected` }] }]
    }
    return [{ columns: result.fields.map(f => f.name), rows: result.rows }]
  }

  if (type === 'mysql' || type === 'mariadb') {
    const [results, fields] = await client.query(sql)
    if (!fields) {
      return [{ columns: ['Result'], rows: [{ Result: `${results.affectedRows ?? 0} row(s) affected` }] }]
    }
    if (Array.isArray(fields[0])) {
      return results.map((rows, i) => ({ columns: fields[i].map(f => f.name), rows }))
    }
    return [{ columns: fields.map(f => f.name), rows: results }]
  }

  if (type === 'mssql') {
    const result = await client.request().query(sql)
    if (result.recordsets && result.recordsets.length > 0) {
      const sets = result.recordsets
        .map(rs => ({ columns: rs.length > 0 ? Object.keys(rs[0]) : [], rows: rs }))
        .filter(r => r.columns.length > 0)
      if (sets.length > 0) return sets
    }
    const affected = Array.isArray(result.rowsAffected)
      ? result.rowsAffected.reduce((a, b) => a + b, 0) : 0
    return [{ columns: ['Result'], rows: [{ Result: `${affected} row(s) affected` }] }]
  }

  throw new Error(`Unsupported database type: ${type}`)
}

// ── Schema introspector ───────────────────────────────────────────────────────

async function introspect(type, client) {
  let colRows = []
  let countMap = {}
  let views = []
  let functions = []
  let procedures = []

  if (type === 'postgresql') {
    const colRes = await client.query(`
      SELECT table_name AS tbl, column_name AS col, data_type AS dt
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `)
    const cntRes = await client.query(`
      SELECT relname AS tbl, n_live_tup AS cnt FROM pg_stat_user_tables
    `)
    colRows = colRes.rows
    for (const r of cntRes.rows) countMap[r.tbl] = parseInt(r.cnt) || 0

    const vRes = await client.query(`
      SELECT table_name AS name FROM information_schema.views
      WHERE table_schema = 'public' ORDER BY table_name
    `).catch(() => ({ rows: [] }))
    views = vRes.rows.map(r => ({ name: r.name }))

    const rRes = await client.query(`
      SELECT routine_name AS name, routine_type AS rtype
      FROM information_schema.routines
      WHERE routine_schema = 'public' ORDER BY routine_name
    `).catch(() => ({ rows: [] }))
    functions  = rRes.rows.filter(r => r.rtype === 'FUNCTION').map(r => ({ name: r.name }))
    procedures = rRes.rows.filter(r => r.rtype === 'PROCEDURE').map(r => ({ name: r.name }))
  }

  if (type === 'mysql' || type === 'mariadb') {
    const [cols] = await client.query(`
      SELECT TABLE_NAME AS tbl, COLUMN_NAME AS col, DATA_TYPE AS dt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `)
    const [tbls] = await client.query(`
      SELECT TABLE_NAME AS tbl, TABLE_TYPE AS ttype, TABLE_ROWS AS cnt
      FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
    `)
    colRows = cols
    for (const r of tbls) {
      if (r.ttype === 'BASE TABLE') countMap[r.tbl] = parseInt(r.cnt) || 0
      else if (r.ttype === 'VIEW') views.push({ name: r.tbl })
    }

    const [routines] = await client.query(`
      SELECT ROUTINE_NAME AS name, ROUTINE_TYPE AS rtype
      FROM information_schema.ROUTINES
      WHERE ROUTINE_SCHEMA = DATABASE() ORDER BY ROUTINE_NAME
    `).catch(() => [[]])
    functions  = (routines || []).filter(r => r.rtype === 'FUNCTION').map(r => ({ name: r.name }))
    procedures = (routines || []).filter(r => r.rtype === 'PROCEDURE').map(r => ({ name: r.name }))
  }

  if (type === 'mssql') {
    const colRes = await client.request().query(`
      SELECT t.name AS tbl, c.name AS col, tp.name AS dt
      FROM sys.tables t
      JOIN sys.columns c ON t.object_id = c.object_id
      JOIN sys.types tp ON c.user_type_id = tp.user_type_id
      ORDER BY t.name, c.column_id
    `)
    const cntRes = await client.request().query(`
      SELECT t.name AS tbl, SUM(p.rows) AS cnt
      FROM sys.tables t JOIN sys.partitions p ON t.object_id = p.object_id
      WHERE p.index_id IN (0, 1) GROUP BY t.name
    `)
    const vRes = await client.request().query(`SELECT name FROM sys.views ORDER BY name`).catch(() => ({ recordset: [] }))
    const fRes = await client.request().query(`SELECT name FROM sys.objects WHERE type IN ('FN','IF','TF') ORDER BY name`).catch(() => ({ recordset: [] }))
    const pRes = await client.request().query(`SELECT name FROM sys.procedures ORDER BY name`).catch(() => ({ recordset: [] }))

    colRows = colRes.recordset
    for (const r of cntRes.recordset) countMap[r.tbl] = parseInt(r.cnt) || 0
    views      = vRes.recordset.map(r => ({ name: r.name }))
    functions  = fRes.recordset.map(r => ({ name: r.name }))
    procedures = pRes.recordset.map(r => ({ name: r.name }))
  }

  const byTable = {}
  for (const { tbl, col, dt } of colRows) {
    if (!byTable[tbl]) byTable[tbl] = []
    byTable[tbl].push({ name: col, type: String(dt).toUpperCase() })
  }
  const isNum = dt => /int|float|double|decimal|numeric|real|money|bit|number/.test(dt.toLowerCase())
  const tables = Object.entries(byTable).map(([name, columns]) => ({
    name, columns,
    rowCount: countMap[name] ?? 0,
    numericCols: columns.filter(c => isNum(c.type)).map(c => c.name),
  }))

  return { tables, views, functions, procedures }
}

async function getDatabases(type, client) {
  try {
    if (type === 'postgresql') {
      const res = await client.query(`
        SELECT datname AS name FROM pg_database
        WHERE datistemplate = false AND datallowconn = true ORDER BY datname
      `)
      return res.rows.map(r => r.name)
    }
    if (type === 'mysql' || type === 'mariadb') {
      const [rows] = await client.query('SHOW DATABASES')
      return rows.map(r => r.Database || r.database || Object.values(r)[0])
    }
    if (type === 'mssql') {
      const res = await client.request().query(`
        SELECT name FROM sys.databases WHERE state_desc = 'ONLINE' ORDER BY name
      `)
      return res.recordset.map(r => r.name)
    }
  } catch (_) {}
  return []
}

// ── Index introspection ───────────────────────────────────────────────────────

async function getTableIndexes(type, client, tableName) {
  try {
    if (type === 'postgresql') {
      const res = await client.query(`
        SELECT i.relname AS idx_name, ix.indisunique AS is_unique, ix.indisprimary AS is_primary,
               string_agg(a.attname, ',' ORDER BY array_position(ix.indkey, a.attnum)) AS cols
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE t.relname = $1 AND t.relkind = 'r'
        GROUP BY i.relname, ix.indisunique, ix.indisprimary
        ORDER BY ix.indisprimary DESC, i.relname
      `, [tableName])
      return res.rows.map(r => ({
        name: r.idx_name, unique: !!r.is_unique, primary: !!r.is_primary,
        columns: (r.cols || '').split(','),
      }))
    }
    if (type === 'mysql' || type === 'mariadb') {
      const safe = tableName.replace(/`/g, '``')
      const [rows] = await client.query(`SHOW INDEX FROM \`${safe}\``)
      const byName = {}
      for (const r of rows) {
        const k = r.Key_name
        if (!byName[k]) byName[k] = { name: k, unique: r.Non_unique === 0, primary: k === 'PRIMARY', columns: [] }
        byName[k].columns.push(r.Column_name)
      }
      return Object.values(byName)
    }
    if (type === 'mssql') {
      const safe = tableName.replace(/'/g, "''")
      const res = await client.request().query(`
        SELECT i.name AS idx_name, i.is_unique AS is_unique, i.is_primary_key AS is_primary,
               STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS cols
        FROM sys.indexes i
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        JOIN sys.tables t ON i.object_id = t.object_id
        WHERE t.name = '${safe}' AND i.name IS NOT NULL
        GROUP BY i.name, i.is_unique, i.is_primary_key
        ORDER BY i.is_primary_key DESC, i.name
      `)
      return res.recordset.map(r => ({
        name: r.idx_name, unique: !!r.is_unique, primary: !!r.is_primary,
        columns: (r.cols || '').split(','),
      }))
    }
  } catch (_) {}
  return []
}

// ── Foreign key introspection ─────────────────────────────────────────────────

async function getForeignKeys(type, client) {
  try {
    if (type === 'postgresql') {
      const res = await client.query(`
        SELECT tc.table_name AS from_table, kcu.column_name AS from_col,
               ccu.table_name AS to_table, ccu.column_name AS to_col
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_name
      `)
      return res.rows.map(r => ({ fromTable: r.from_table, fromCol: r.from_col, toTable: r.to_table, toCol: r.to_col }))
    }
    if (type === 'mysql' || type === 'mariadb') {
      const [rows] = await client.query(`
        SELECT kcu.TABLE_NAME AS from_table, kcu.COLUMN_NAME AS from_col,
               kcu.REFERENCED_TABLE_NAME AS to_table, kcu.REFERENCED_COLUMN_NAME AS to_col
        FROM information_schema.KEY_COLUMN_USAGE kcu
        JOIN information_schema.TABLE_CONSTRAINTS tc
          ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
        WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY' AND kcu.TABLE_SCHEMA = DATABASE()
          AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY kcu.TABLE_NAME
      `)
      return rows.map(r => ({ fromTable: r.from_table, fromCol: r.from_col, toTable: r.to_table, toCol: r.to_col }))
    }
    if (type === 'mssql') {
      const res = await client.request().query(`
        SELECT tp.name AS from_table, cp.name AS from_col,
               tr.name AS to_table, cr.name AS to_col
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
        JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
        JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
        JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
        ORDER BY tp.name
      `)
      return res.recordset.map(r => ({ fromTable: r.from_table, fromCol: r.from_col, toTable: r.to_table, toCol: r.to_col }))
    }
  } catch (_) {}
  return []
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('dbconn:test', async (_e, config) => {
  let client = null
  try {
    client = await withTimeout(makeDriver(config), 10000, 'Connection test')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: extractError(err) }
  } finally {
    if (client) withTimeout(closeDriver(config.type, client), 3000, 'Close').catch(() => {})
  }
})

ipcMain.handle('dbconn:connect', async (_e, config) => {
  try {
    const client = await withTimeout(makeDriver(config), 12000, 'Connect')
    const connId = genId()
    connections.set(connId, { type: config.type, client })
    return { ok: true, connId }
  } catch (err) {
    return { ok: false, error: extractError(err) }
  }
})

ipcMain.handle('dbconn:disconnect', async (_e, connId) => {
  const conn = connections.get(connId)
  connections.delete(connId)
  if (conn) await closeDriver(conn.type, conn.client)
  return { ok: true }
})

ipcMain.handle('dbconn:query', async (_e, connId, sql) => {
  const conn = connections.get(connId)
  if (!conn) return { ok: false, error: 'Not connected. Please reconnect.' }
  try {
    const sets = await execQuery(conn.type, conn.client, sql)
    return { ok: true, sets }
  } catch (err) {
    return { ok: false, error: extractError(err) }
  }
})

ipcMain.handle('dbconn:schema', async (_e, connId) => {
  const conn = connections.get(connId)
  if (!conn) return { ok: false, error: 'Not connected.' }
  try {
    const schema = await introspect(conn.type, conn.client)
    return { ok: true, ...schema }
  } catch (err) {
    return { ok: false, error: extractError(err) }
  }
})

ipcMain.handle('dbconn:databases', async (_e, connId) => {
  const conn = connections.get(connId)
  if (!conn) return { ok: false, error: 'Not connected.' }
  try {
    const list = await getDatabases(conn.type, conn.client)
    return { ok: true, list }
  } catch (err) {
    return { ok: false, error: extractError(err) }
  }
})

ipcMain.handle('dbconn:indexes', async (_e, connId, tableName) => {
  const conn = connections.get(connId)
  if (!conn) return { ok: false, error: 'Not connected.' }
  try {
    const indexes = await getTableIndexes(conn.type, conn.client, tableName)
    return { ok: true, indexes }
  } catch (err) {
    return { ok: false, error: extractError(err) }
  }
})

ipcMain.handle('dbconn:foreignkeys', async (_e, connId) => {
  const conn = connections.get(connId)
  if (!conn) return { ok: false, error: 'Not connected.' }
  try {
    const fks = await getForeignKeys(conn.type, conn.client)
    return { ok: true, fks }
  } catch (err) {
    return { ok: false, error: extractError(err) }
  }
})

// Cleanup all connections on exit
process.on('exit', () => {
  for (const { type, client } of connections.values()) {
    try {
      if (type === 'postgresql') client.end()
      else if (type === 'mysql' || type === 'mariadb') client.end()
      else if (type === 'mssql') client.close()
    } catch (_) {}
  }
})
