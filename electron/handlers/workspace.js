const { ipcMain } = require('electron')
const { randomUUID } = require('crypto')
const { getDb } = require('../db')

const now = () => Math.floor(Date.now() / 1000)

ipcMain.handle('workspace:list', () =>
  getDb().prepare(
    'SELECT id, name, description, created_at, last_opened_at FROM workspaces ORDER BY last_opened_at DESC'
  ).all()
)

ipcMain.handle('workspace:create', (_e, name, description = '') => {
  const id = randomUUID()
  const ts = now()
  getDb().prepare(
    'INSERT INTO workspaces (id, name, description, created_at, last_opened_at) VALUES (?,?,?,?,?)'
  ).run(id, name.trim(), description, ts, ts)
  return { id, name: name.trim(), description, created_at: ts, last_opened_at: ts }
})

ipcMain.handle('workspace:rename', (_e, id, name) => {
  getDb().prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(name.trim(), id)
  return true
})

ipcMain.handle('workspace:delete', (_e, id) => {
  getDb().prepare('DELETE FROM workspaces WHERE id = ?').run(id)
  return true
})

ipcMain.handle('workspace:touch', (_e, id) => {
  getDb().prepare('UPDATE workspaces SET last_opened_at = ? WHERE id = ?').run(now(), id)
  return true
})

ipcMain.handle('workspace:datasets', (_e, workspaceId) =>
  getDb().prepare(
    'SELECT id, workspace_id, name, source_tool, row_count, created_at, updated_at FROM workspace_datasets WHERE workspace_id = ? ORDER BY updated_at DESC'
  ).all(workspaceId)
)

ipcMain.handle('workspace:saveDataset', (_e, { workspaceId, id, name, sourceTool, columns, rows }) => {
  const db  = getDb()
  const ts  = now()
  const dsId = id || randomUUID()
  const colJson = JSON.stringify(columns)
  const rowJson = JSON.stringify(rows)
  const rowCount = rows.length

  const exists = db.prepare('SELECT id FROM workspace_datasets WHERE id = ?').get(dsId)
  if (exists) {
    db.prepare(
      'UPDATE workspace_datasets SET name=?, source_tool=?, columns=?, rows=?, row_count=?, updated_at=? WHERE id=?'
    ).run(name, sourceTool, colJson, rowJson, rowCount, ts, dsId)
  } else {
    db.prepare(
      'INSERT INTO workspace_datasets (id, workspace_id, name, source_tool, columns, rows, row_count, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(dsId, workspaceId, name, sourceTool, colJson, rowJson, rowCount, ts, ts)
  }
  return { id: dsId, name, sourceTool, rowCount, updated_at: ts }
})

ipcMain.handle('workspace:getDataset', (_e, id) => {
  const row = getDb().prepare('SELECT * FROM workspace_datasets WHERE id = ?').get(id)
  if (!row) return null
  return { ...row, columns: JSON.parse(row.columns), rows: JSON.parse(row.rows) }
})

ipcMain.handle('workspace:deleteDataset', (_e, id) => {
  getDb().prepare('DELETE FROM workspace_datasets WHERE id = ?').run(id)
  return true
})

ipcMain.handle('workspace:addActivity', (_e, { workspaceId, tool, action, detail = '' }) => {
  getDb().prepare(
    'INSERT INTO workspace_activity (workspace_id, tool, action, detail) VALUES (?,?,?,?)'
  ).run(workspaceId, tool, action, detail)
  return true
})

ipcMain.handle('workspace:getActivity', (_e, workspaceId, limit = 10) =>
  getDb().prepare(
    'SELECT tool, action, detail, created_at FROM workspace_activity WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(workspaceId, limit)
)

ipcMain.handle('workspace:saveReport', (_e, { workspaceId, id, name, sections, theme }) => {
  const db = getDb()
  const ts = now()
  const reportId = id || randomUUID()
  const sectionsJson = JSON.stringify(sections)
  const exists = db.prepare('SELECT id FROM workspace_reports WHERE id = ?').get(reportId)
  if (exists) {
    db.prepare('UPDATE workspace_reports SET name=?, sections=?, theme=?, updated_at=? WHERE id=?')
      .run(name, sectionsJson, theme, ts, reportId)
  } else {
    db.prepare('INSERT INTO workspace_reports (id, workspace_id, name, sections, theme, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(reportId, workspaceId, name, sectionsJson, theme, ts, ts)
  }
  return { id: reportId, name, theme, updated_at: ts }
})

ipcMain.handle('workspace:reports', (_e, workspaceId) =>
  getDb().prepare(
    'SELECT id, workspace_id, name, theme, created_at, updated_at FROM workspace_reports WHERE workspace_id = ? ORDER BY updated_at DESC'
  ).all(workspaceId)
)

ipcMain.handle('workspace:deleteReport', (_e, id) => {
  getDb().prepare('DELETE FROM workspace_reports WHERE id = ?').run(id)
  return true
})
