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

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { getDb } = require('./db')
const { autoUpdater } = require('electron-updater')

// Engine IPC handlers (registered when required)
require('./handlers/sharp')
require('./handlers/ffmpeg')
require('./handlers/ghostscript')
require('./handlers/archive')
require('./handlers/dbconnect')

const isDev = process.env.NODE_ENV === 'development'

let mainWindow

function getIconPath() {
  const base = isDev
    ? path.join(__dirname, '../build')
    : path.join(process.resourcesPath, 'icons')
  if (process.platform === 'win32')  return path.join(base, 'icon.ico')
  if (process.platform === 'darwin') return path.join(base, 'icon.icns')
  return path.join(base, 'icon.png')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: getIconPath(),
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

function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:available', info)
  })
  autoUpdater.on('update-not-available', (info) => {
    mainWindow?.webContents.send('updater:not-available', info)
  })
  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('updater:error', err.message)
  })
  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater:download-progress', progress)
  })
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:downloaded', info)
  })
}

app.whenReady().then(() => {
  getDb() // initialize database
  createWindow()

  if (!isDev) {
    setupAutoUpdater()
    // Check for updates 3 seconds after launch so the window is ready
    setTimeout(() => autoUpdater.checkForUpdates(), 3000)
  }

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

// ── Binary file write ─────────────────────────────────────────────────────────

ipcMain.handle('fs:writeFileBinary', async (_e, filePath, base64Data) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'))
  return true
})

// ── Markdown PDF export ───────────────────────────────────────────────────────

ipcMain.handle('markdown:export-pdf', async (_e, htmlContent, outputPath) => {
  const os = require('os')
  const tempPath = path.join(os.tmpdir(), `nexus-md-${Date.now()}.html`)
  fs.writeFileSync(tempPath, htmlContent, 'utf8')

  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  await win.loadFile(tempPath)

  const pdfBuf = await win.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    margins: { marginType: 'custom', top: 1, bottom: 1, left: 1.5, right: 1.5 },
  })

  win.close()
  try { fs.unlinkSync(tempPath) } catch {}
  fs.writeFileSync(outputPath, pdfBuf)
  return true
})

// ── Shell handlers ────────────────────────────────────────────────────────────

ipcMain.handle('shell:openExternal', (_e, url) => shell.openExternal(url))
ipcMain.handle('shell:showItemInFolder', (_e, filePath) =>
  shell.showItemInFolder(filePath)
)
ipcMain.handle('app:getVersion', () => app.getVersion())

// ── Rich Text Editor document handlers ───────────────────────────────────────

ipcMain.handle('rte:list', () =>
  getDb().prepare('SELECT id, title, updated_at FROM rte_documents ORDER BY updated_at DESC').all()
)

ipcMain.handle('rte:get', (_e, id) =>
  getDb().prepare('SELECT * FROM rte_documents WHERE id = ?').get(id)
)

ipcMain.handle('rte:create', () => {
  const info = getDb().prepare(
    'INSERT INTO rte_documents (title, content) VALUES (?, ?)'
  ).run('Untitled', '')
  return info.lastInsertRowid
})

ipcMain.handle('rte:save', (_e, id, title, content) => {
  getDb().prepare(
    'UPDATE rte_documents SET title = ?, content = ?, updated_at = strftime(\'%s\', \'now\') WHERE id = ?'
  ).run(title, content, id)
  return true
})

ipcMain.handle('rte:delete', (_e, id) => {
  getDb().prepare('DELETE FROM rte_documents WHERE id = ?').run(id)
  return true
})

// ── Auto-updater handlers ─────────────────────────────────────────────────────

ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates())
ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate())
ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall())
