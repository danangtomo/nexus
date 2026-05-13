/**
 * Nexus - Offline productivity suite
 * Copyright (C) 2026 Danang Estutomoaji
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import styles from './Sidebar.module.css'

const categories = [
  {
    label: 'Data',
    icon: '📊',
    tools: [
      { path: '/csv-editor',    label: 'CSV Editor' },
      { path: '/json-formatter',label: 'JSON Formatter' },
      { path: '/chart-builder', label: 'Chart Builder' },
      { path: '/sql-runner',    label: 'SQL Runner' },
    ],
  },
  {
    label: 'Documents',
    icon: '📝',
    tools: [
      { path: '/rich-text-editor',      label: 'Rich Text Editor' },
      { path: '/markdown-editor',       label: 'Markdown Editor' },
      { path: '/doc-converter',         label: 'Doc Converter' },
      { path: '/spreadsheet-converter', label: 'Spreadsheet Converter' },
      { path: '/diff-checker',          label: 'Diff Checker' },
    ],
  },
  {
    label: 'Images',
    icon: '🖼',
    tools: [
      { path: '/image-converter',   label: 'Image Converter' },
      { path: '/image-resizer',     label: 'Image Resizer' },
      { path: '/image-compressor',  label: 'Image Compressor' },
      { path: '/background-remover',label: 'Background Remover' },
      { path: '/watermark-tool',    label: 'Watermark Tool' },
      { path: '/metadata-remover',  label: 'Metadata Remover' },
    ],
  },
  {
    label: 'PDF',
    icon: '📄',
    tools: [
      { path: '/pdf-merger',    label: 'PDF Merger' },
      { path: '/pdf-splitter',  label: 'PDF Splitter' },
      { path: '/pdf-compressor',label: 'PDF Compressor' },
      { path: '/pdf-encryptor', label: 'PDF Encryptor' },
      { path: '/ocr-reader',    label: 'OCR Reader' },
    ],
  },
  {
    label: 'Media',
    icon: '🎬',
    tools: [
      { path: '/video-converter', label: 'Video Converter' },
      { path: '/audio-converter', label: 'Audio Converter' },
    ],
  },
  {
    label: 'Files',
    icon: '🗂',
    tools: [
      { path: '/archive-manager', label: 'Archive Manager' },
    ],
  },
  {
    label: 'Productivity',
    icon: '⏱',
    tools: [
      { path: '/kanban-board',    label: 'Kanban Board' },
      { path: '/pomodoro-timer',  label: 'Pomodoro Timer' },
      { path: '/gantt-chart',     label: 'Gantt Chart' },
    ],
  },
]

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect width="160" height="160" rx="36" fill="#0d0d1a"/>
      <ellipse cx="80" cy="80" rx="44" ry="44" fill="url(#sg)" opacity="0.18"/>
      <line x1="44" y1="108" x2="44"  y2="52"  stroke="#fff" strokeWidth="10" strokeLinecap="round"/>
      <line x1="44" y1="52"  x2="116" y2="108" stroke="#fff" strokeWidth="10" strokeLinecap="round"/>
      <line x1="116" y1="108" x2="116" y2="52" stroke="#fff" strokeWidth="10" strokeLinecap="round"/>
      <circle cx="44"  cy="52"  r="7" fill="#007AFF"/>
      <circle cx="116" cy="52"  r="7" fill="#007AFF"/>
      <circle cx="44"  cy="108" r="7" fill="#007AFF"/>
      <circle cx="116" cy="108" r="7" fill="#007AFF"/>
      <circle cx="80"  cy="80"  r="5" fill="#007AFF" opacity="0.6"/>
      <defs>
        <radialGradient id="sg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#007AFF"/>
          <stop offset="100%" stopColor="#007AFF" stopOpacity="0"/>
        </radialGradient>
      </defs>
    </svg>
  )
}

function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, createWorkspace, switchWorkspace, renameWorkspace, deleteWorkspace } = useWorkspace()
  const [open,        setOpen]        = useState(false)
  const [creating,    setCreating]    = useState(false)
  const [newName,     setNewName]     = useState('')
  const [renamingId,  setRenamingId]  = useState(null)
  const [renameVal,   setRenameVal]   = useState('')
  const ref = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setRenamingId(null)
        setCreating(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleCreate(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    try {
      await createWorkspace(name)
      setNewName('')
      setCreating(false)
      // Keep dropdown open so user sees the new workspace in the list
    } catch (err) {
      console.error('Failed to create workspace:', err)
    }
  }

  async function handleRename(e, id) {
    e.preventDefault()
    const name = renameVal.trim()
    if (name) await renameWorkspace(id, name)
    setRenamingId(null)
  }

  async function handleDelete(id) {
    if (workspaces.length <= 1) return
    await deleteWorkspace(id)
    setOpen(false)
  }

  return (
    <div className={styles.wsSwitcher} ref={ref}>
      <button
        className={styles.wsBtn}
        onClick={() => setOpen(v => !v)}
        title="Switch workspace"
      >
        <span className={styles.wsIcon}>◆</span>
        <span className={styles.wsName}>{activeWorkspace?.name ?? '…'}</span>
        <span className={styles.wsChevron}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className={styles.wsDropdown}>
          <div className={styles.wsDropdownLabel}>Workspaces</div>

          {workspaces.map(ws => (
            <div key={ws.id} className={`${styles.wsItem} ${ws.id === activeWorkspace?.id ? styles.wsItemActive : ''}`}>
              {renamingId === ws.id ? (
                <form onSubmit={e => handleRename(e, ws.id)} className={styles.wsRenameForm}>
                  <input
                    className={styles.wsRenameInput}
                    value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onBlur={e => handleRename(e, ws.id)}
                    autoFocus
                  />
                </form>
              ) : (
                <>
                  <button
                    className={styles.wsItemBtn}
                    onClick={() => { switchWorkspace(ws.id); setOpen(false) }}
                  >
                    {ws.id === activeWorkspace?.id && <span className={styles.wsCheck}>✓</span>}
                    <span className={styles.wsItemName}>{ws.name}</span>
                  </button>
                  <div className={styles.wsItemActions}>
                    <button
                      className={styles.wsActionBtn}
                      title="Rename"
                      onClick={() => { setRenamingId(ws.id); setRenameVal(ws.name) }}
                    >✎</button>
                    {workspaces.length > 1 && (
                      <button
                        className={`${styles.wsActionBtn} ${styles.wsDeleteBtn}`}
                        title="Delete"
                        onClick={() => handleDelete(ws.id)}
                      >✕</button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          <div className={styles.wsDivider} />

          {creating ? (
            <form onSubmit={handleCreate} className={styles.wsCreateForm}>
              <input
                className={styles.wsCreateInput}
                placeholder="Workspace name…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
                onBlur={() => { if (!newName.trim()) setCreating(false) }}
              />
              <button type="submit" className={styles.wsCreateSubmit}>+</button>
            </form>
          ) : (
            <button className={styles.wsNewBtn} onClick={() => setCreating(true)}>
              + New Workspace
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function WorkspaceExplorer() {
  const { activeWorkspace } = useWorkspace()
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState([])
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!activeWorkspace) return
    const load = () => window.nexus.workspace.datasets(activeWorkspace.id).then(setDatasets)
    load()
    window.addEventListener('nexus:workspace:refresh', load)
    return () => window.removeEventListener('nexus:workspace:refresh', load)
  }, [activeWorkspace])

  async function openDs(ds) {
    const full = await window.nexus.workspace.getDataset(ds.id)
    navigate('/csv-editor', { state: { dataset: { ...full, source: 'workspace' } } })
  }

  async function delDs(e, id) {
    e.stopPropagation()
    await window.nexus.workspace.deleteDataset(id)
    setDatasets(p => p.filter(d => d.id !== id))
    window.dispatchEvent(new Event('nexus:workspace:refresh'))
  }

  if (datasets.length === 0) return null

  return (
    <div className={styles.explorer}>
      <button className={styles.explorerHeader} onClick={() => setCollapsed(v => !v)}>
        <span className={styles.explorerTitle}>DATA TABLES</span>
        <span className={styles.explorerChevron}>{collapsed ? '▾' : '▴'}</span>
      </button>
      {!collapsed && (
        <ul className={styles.explorerList}>
          {datasets.slice(0, 5).map(ds => (
            <li key={ds.id} className={styles.explorerItem}>
              <button className={styles.explorerItemBtn} onClick={() => openDs(ds)} title={ds.name}>
                <span className={styles.explorerItemName}>{ds.name}</span>
                <span className={styles.explorerItemRows}>{ds.row_count.toLocaleString()}r</span>
              </button>
              <button className={styles.explorerDelBtn} onClick={e => delDs(e, ds.id)} title="Remove">✕</button>
            </li>
          ))}
          {datasets.length > 5 && (
            <li className={styles.explorerMore}>+{datasets.length - 5} more on Home</li>
          )}
        </ul>
      )}
    </div>
  )
}

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <NavLink to="/" className={styles.logoLink}>
          <LogoMark />
          <span className={styles.logoText}>NEXUS</span>
        </NavLink>
      </div>

      <WorkspaceSwitcher />
      <WorkspaceExplorer />

      <nav className={styles.nav}>
        {categories.map((cat) => (
          <div key={cat.label} className={styles.category}>
            <div className={styles.catHeader}>
              <span className={styles.catIcon}>{cat.icon}</span>
              <span className={styles.catLabel}>{cat.label}</span>
            </div>
            <ul className={styles.toolList}>
              {cat.tools.map((tool) => (
                <li key={tool.path}>
                  <NavLink
                    to={tool.path}
                    className={({ isActive }) =>
                      `${styles.toolLink} ${isActive ? styles.active : ''}`
                    }
                  >
                    {tool.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <button className={styles.searchBtn} onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k', bubbles: true }))}>
          <span className={styles.searchBtnIcon}>🔍</span>
          <span className={styles.searchBtnLabel}>Search</span>
          <kbd className={styles.searchKbd}>Ctrl K</kbd>
        </button>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `${styles.settingsLink} ${isActive ? styles.active : ''}`
          }
        >
          <span className={styles.settingsIcon}>⚙️</span>
          Settings
        </NavLink>
      </div>
    </aside>
  )
}
