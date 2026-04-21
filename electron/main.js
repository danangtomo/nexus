const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { getDb } = require('./db')

// Engine IPC handlers (registered when required)
require('./handlers/sharp')
require('./handlers/ffmpeg')
require('./handlers/ghostscript')

const isDev = process.env.NODE_ENV === 'development'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#0f0f0f',
    show: false,
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

app.whenReady().then(() => {
  getDb() // initialize database
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Dialog handlers ──────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFile', async (_e, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    ...options,
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:openFiles', async (_e, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    ...options,
  })
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('dialog:saveFile', async (_e, options = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, options)
  return result.canceled ? null : result.filePath
})

ipcMain.handle('dialog:openDirectory', async (_e, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    ...options,
  })
  return result.canceled ? null : result.filePaths[0]
})

// ── File system handlers ──────────────────────────────────────────────────────

ipcMain.handle('fs:readFile', async (_e, filePath, encoding = 'utf8') => {
  return fs.readFileSync(filePath, encoding)
})

ipcMain.handle('fs:writeFile', async (_e, filePath, data) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, data)
  return true
})

ipcMain.handle('fs:copyFile', async (_e, src, dest) => {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  return true
})

ipcMain.handle('fs:deleteFile', async (_e, filePath) => {
  fs.unlinkSync(filePath)
  return true
})

ipcMain.handle('fs:fileExists', async (_e, filePath) => {
  return fs.existsSync(filePath)
})

ipcMain.handle('fs:getFileInfo', async (_e, filePath) => {
  const stats = fs.statSync(filePath)
  return {
    size: stats.size,
    name: path.basename(filePath),
    ext: path.extname(filePath).toLowerCase(),
    dir: path.dirname(filePath),
    created: stats.birthtime,
    modified: stats.mtime,
  }
})

// ── Database handlers ─────────────────────────────────────────────────────────

ipcMain.handle('db:getPref', (_e, key) => {
  const row = getDb().prepare('SELECT value FROM preferences WHERE key = ?').get(key)
  return row ? row.value : null
})

ipcMain.handle('db:setPref', (_e, key, value) => {
  getDb()
    .prepare(
      'INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = strftime(\'%s\', \'now\')'
    )
    .run(key, String(value))
  return true
})

ipcMain.handle('db:getAllPrefs', () => {
  const rows = getDb().prepare('SELECT key, value FROM preferences').all()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
})

ipcMain.handle('db:addHistory', (_e, tool, action, details) => {
  getDb()
    .prepare(
      'INSERT INTO tool_history (tool, action, details) VALUES (?, ?, ?)'
    )
    .run(tool, action, details ? JSON.stringify(details) : null)
  return true
})

ipcMain.handle('db:getHistory', (_e, tool, limit = 50) => {
  const rows = getDb()
    .prepare(
      'SELECT * FROM tool_history WHERE tool = ? ORDER BY created_at DESC LIMIT ?'
    )
    .all(tool, limit)
  return rows.map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null }))
})

// ── Kanban handlers ───────────────────────────────────────────────────────────

ipcMain.handle('kanban:getBoards', () =>
  getDb().prepare('SELECT * FROM kanban_boards ORDER BY created_at').all()
)

ipcMain.handle('kanban:createBoard', (_e, name) => {
  const info = getDb()
    .prepare('INSERT INTO kanban_boards (name) VALUES (?)')
    .run(name)
  return info.lastInsertRowid
})

ipcMain.handle('kanban:deleteBoard', (_e, id) => {
  getDb().prepare('DELETE FROM kanban_boards WHERE id = ?').run(id)
  return true
})

ipcMain.handle('kanban:getColumns', (_e, boardId) =>
  getDb()
    .prepare('SELECT * FROM kanban_columns WHERE board_id = ? ORDER BY position')
    .all(boardId)
)

ipcMain.handle('kanban:createColumn', (_e, boardId, name, position) => {
  const info = getDb()
    .prepare('INSERT INTO kanban_columns (board_id, name, position) VALUES (?, ?, ?)')
    .run(boardId, name, position)
  return info.lastInsertRowid
})

ipcMain.handle('kanban:updateColumn', (_e, id, name) => {
  getDb().prepare('UPDATE kanban_columns SET name = ? WHERE id = ?').run(name, id)
  return true
})

ipcMain.handle('kanban:deleteColumn', (_e, id) => {
  getDb().prepare('DELETE FROM kanban_columns WHERE id = ?').run(id)
  return true
})

ipcMain.handle('kanban:getCards', (_e, columnId) =>
  getDb()
    .prepare('SELECT * FROM kanban_cards WHERE column_id = ? ORDER BY position')
    .all(columnId)
)

ipcMain.handle('kanban:createCard', (_e, columnId, title, description, position) => {
  const info = getDb()
    .prepare(
      'INSERT INTO kanban_cards (column_id, title, description, position) VALUES (?, ?, ?, ?)'
    )
    .run(columnId, title, description || '', position)
  return info.lastInsertRowid
})

ipcMain.handle('kanban:updateCard', (_e, id, data) => {
  const fields = Object.keys(data)
    .map((k) => `${k} = ?`)
    .join(', ')
  getDb()
    .prepare(`UPDATE kanban_cards SET ${fields} WHERE id = ?`)
    .run(...Object.values(data), id)
  return true
})

ipcMain.handle('kanban:deleteCard', (_e, id) => {
  getDb().prepare('DELETE FROM kanban_cards WHERE id = ?').run(id)
  return true
})

ipcMain.handle('kanban:moveCard', (_e, cardId, columnId, position) => {
  getDb()
    .prepare('UPDATE kanban_cards SET column_id = ?, position = ? WHERE id = ?')
    .run(columnId, position, cardId)
  return true
})

// ── Pomodoro handlers ─────────────────────────────────────────────────────────

ipcMain.handle('pomodoro:addSession', (_e, duration, type, completed) => {
  const info = getDb()
    .prepare(
      'INSERT INTO pomodoro_sessions (duration, type, completed) VALUES (?, ?, ?)'
    )
    .run(duration, type, completed ? 1 : 0)
  return info.lastInsertRowid
})

ipcMain.handle('pomodoro:getSessions', (_e, limit = 100) =>
  getDb()
    .prepare('SELECT * FROM pomodoro_sessions ORDER BY created_at DESC LIMIT ?')
    .all(limit)
)

// ── Shell handlers ────────────────────────────────────────────────────────────

ipcMain.handle('shell:openExternal', (_e, url) => shell.openExternal(url))
ipcMain.handle('shell:showItemInFolder', (_e, filePath) =>
  shell.showItemInFolder(filePath)
)
ipcMain.handle('app:getVersion', () => app.getVersion())
