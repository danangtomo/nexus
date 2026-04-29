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

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('nexus', {
  // Generic IPC invoke
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  // File dialogs
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  openFiles: (options) => ipcRenderer.invoke('dialog:openFiles', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  openDirectory: (options) => ipcRenderer.invoke('dialog:openDirectory', options),

  // File system
  readFile: (filePath, encoding) => ipcRenderer.invoke('fs:readFile', filePath, encoding),
  writeFile: (filePath, data) => ipcRenderer.invoke('fs:writeFile', filePath, data),
  copyFile: (src, dest) => ipcRenderer.invoke('fs:copyFile', src, dest),
  deleteFile: (filePath) => ipcRenderer.invoke('fs:deleteFile', filePath),
  fileExists: (filePath) => ipcRenderer.invoke('fs:fileExists', filePath),
  getFileInfo: (filePath) => ipcRenderer.invoke('fs:getFileInfo', filePath),

  // Database (preferences)
  getPref: (key) => ipcRenderer.invoke('db:getPref', key),
  setPref: (key, value) => ipcRenderer.invoke('db:setPref', key, value),
  getAllPrefs: () => ipcRenderer.invoke('db:getAllPrefs'),

  // Tool history
  addHistory: (tool, action, details) =>
    ipcRenderer.invoke('db:addHistory', tool, action, details),
  getHistory: (tool, limit) => ipcRenderer.invoke('db:getHistory', tool, limit),

  // Kanban
  kanban: {
    getBoards: () => ipcRenderer.invoke('kanban:getBoards'),
    createBoard: (name) => ipcRenderer.invoke('kanban:createBoard', name),
    deleteBoard: (id) => ipcRenderer.invoke('kanban:deleteBoard', id),
    getColumns: (boardId) => ipcRenderer.invoke('kanban:getColumns', boardId),
    createColumn: (boardId, name, position) =>
      ipcRenderer.invoke('kanban:createColumn', boardId, name, position),
    updateColumn: (id, name) => ipcRenderer.invoke('kanban:updateColumn', id, name),
    deleteColumn: (id) => ipcRenderer.invoke('kanban:deleteColumn', id),
    getCards: (columnId) => ipcRenderer.invoke('kanban:getCards', columnId),
    createCard: (columnId, title, description, position) =>
      ipcRenderer.invoke('kanban:createCard', columnId, title, description, position),
    updateCard: (id, data) => ipcRenderer.invoke('kanban:updateCard', id, data),
    deleteCard: (id) => ipcRenderer.invoke('kanban:deleteCard', id),
    moveCard: (cardId, columnId, position) =>
      ipcRenderer.invoke('kanban:moveCard', cardId, columnId, position),
  },

  // Pomodoro
  pomodoro: {
    addSession: (duration, type, completed) =>
      ipcRenderer.invoke('pomodoro:addSession', duration, type, completed),
    getSessions: (limit) => ipcRenderer.invoke('pomodoro:getSessions', limit),
  },

  // Sharp — image processing
  sharp: {
    process: (opts) => ipcRenderer.invoke('sharp:process', opts),
    metadata: (filePath) => ipcRenderer.invoke('sharp:metadata', filePath),
    thumbnail: (filePath, size) => ipcRenderer.invoke('sharp:thumbnail', filePath, size),
  },

  // Ghostscript — PDF encryption & compression
  gs: {
    encrypt:  (opts) => ipcRenderer.invoke('gs:encrypt',  opts),
    decrypt:  (opts) => ipcRenderer.invoke('gs:decrypt',  opts),
    compress: (opts) => ipcRenderer.invoke('gs:compress', opts),
  },

  // FFmpeg — video/audio
  ffmpeg: {
    run: (opts) => ipcRenderer.invoke('ffmpeg:run', opts),
    probe: (filePath) => ipcRenderer.invoke('ffmpeg:probe', filePath),
    thumbnail: (filePath, timestamp) => ipcRenderer.invoke('ffmpeg:thumbnail', filePath, timestamp),
    onProgress: (callback) => {
      const handler = (_e, data) => callback(data)
      ipcRenderer.on('ffmpeg:progress', handler)
      return () => ipcRenderer.removeListener('ffmpeg:progress', handler)
    },
  },

  // Progress events from main process (FFmpeg, conversions, etc.)
  onProgress: (callback) => {
    ipcRenderer.on('progress', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('progress')
  },

  // Archive — ZIP/TAR.GZ compress & extract
  archive: {
    list: (archivePath) => ipcRenderer.invoke('archive:list', archivePath),
    extract: (opts) => ipcRenderer.invoke('archive:extract', opts),
    compress: (opts) => ipcRenderer.invoke('archive:compress', opts),
  },

  // Binary file write (for DOCX, etc.)
  writeFileBinary: (filePath, base64Data) =>
    ipcRenderer.invoke('fs:writeFileBinary', filePath, base64Data),

  // Markdown PDF export
  markdown: {
    exportPDF: (htmlContent, outputPath) =>
      ipcRenderer.invoke('markdown:export-pdf', htmlContent, outputPath),
  },

  // DB connections (PostgreSQL, MySQL, MariaDB, MSSQL)
  dbconn: {
    test:       (config)         => ipcRenderer.invoke('dbconn:test', config),
    connect:    (config)         => ipcRenderer.invoke('dbconn:connect', config),
    disconnect: (connId)         => ipcRenderer.invoke('dbconn:disconnect', connId),
    query:      (connId, sql)    => ipcRenderer.invoke('dbconn:query', connId, sql),
    schema:      (connId)              => ipcRenderer.invoke('dbconn:schema', connId),
    databases:   (connId)              => ipcRenderer.invoke('dbconn:databases', connId),
    indexes:     (connId, tableName)   => ipcRenderer.invoke('dbconn:indexes', connId, tableName),
    foreignkeys: (connId)              => ipcRenderer.invoke('dbconn:foreignkeys', connId),
  },

  // Shell / system
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  showItemInFolder: (filePath) =>
    ipcRenderer.invoke('shell:showItemInFolder', filePath),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => process.platform,

  // Rich Text Editor documents
  rte: {
    list:   ()                    => ipcRenderer.invoke('rte:list'),
    get:    (id)                  => ipcRenderer.invoke('rte:get', id),
    create: ()                    => ipcRenderer.invoke('rte:create'),
    save:   (id, title, content)  => ipcRenderer.invoke('rte:save', id, title, content),
    delete: (id)                  => ipcRenderer.invoke('rte:delete', id),
  },

  // Auto-updater
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    onAvailable: (cb) => {
      ipcRenderer.on('updater:available', (_e, info) => cb(info))
      return () => ipcRenderer.removeAllListeners('updater:available')
    },
    onProgress: (cb) => {
      ipcRenderer.on('updater:download-progress', (_e, p) => cb(p))
      return () => ipcRenderer.removeAllListeners('updater:download-progress')
    },
    onDownloaded: (cb) => {
      ipcRenderer.on('updater:downloaded', (_e, info) => cb(info))
      return () => ipcRenderer.removeAllListeners('updater:downloaded')
    },
    onError: (cb) => {
      ipcRenderer.on('updater:error', (_e, msg) => cb(msg))
      return () => ipcRenderer.removeAllListeners('updater:error')
    },
  },
})
