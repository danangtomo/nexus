import { useState } from 'react'
import styles from './index.module.css'

const DB_TYPES = [
  { value: 'postgresql', label: 'PostgreSQL', port: '5432', abbr: 'PG', color: '#336791' },
  { value: 'mysql',      label: 'MySQL',      port: '3306', abbr: 'MY', color: '#4479A1' },
  { value: 'mariadb',    label: 'MariaDB',    port: '3306', abbr: 'MA', color: '#C0765A' },
  { value: 'mssql',      label: 'SQL Server', port: '1433', abbr: 'MS', color: '#CC2927' },
]

const EMPTY = { name: '', type: 'postgresql', host: 'localhost', port: '5432', database: '', user: '', password: '', ssl: false }

export default function ConnectionPanel({ connections, onClose, onConnect, onSave, onDelete }) {
  const [view, setView]               = useState(connections.length === 0 ? 'form' : 'list')
  const [editId, setEditId]           = useState(null)
  const [form, setForm]               = useState(EMPTY)
  const [testing, setTesting]         = useState(false)
  const [testMsg, setTestMsg]         = useState(null)
  const [connectingId, setConnectingId] = useState(null)

  const dbInfo = v => DB_TYPES.find(t => t.value === v) ?? DB_TYPES[0]

  function setField(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v }
      if (k === 'type') next.port = dbInfo(v).port
      return next
    })
    setTestMsg(null)
  }

  function openNew() {
    setEditId(null); setForm(EMPTY); setTestMsg(null); setView('form')
  }

  function openEdit(conn) {
    setEditId(conn.id); setForm({ ...conn }); setTestMsg(null); setView('form')
  }

  async function testConn() {
    setTesting(true); setTestMsg(null)
    const res = await window.nexus.dbconn.test(form)
    setTesting(false)
    setTestMsg(res.ok ? { ok: true, text: 'Connection successful' } : { ok: false, text: res.error || 'Connection failed — check your credentials and host' })
  }

  function saveForm() {
    if (!formValid) return
    onSave({ ...form, id: editId ?? Date.now().toString() })
    setView('list')
  }

  async function handleConnect(config) {
    setConnectingId(config.id)
    await onConnect(config)
    setConnectingId(null)
  }

  const formValid = form.name.trim() && form.host.trim() && form.database.trim() && form.user.trim() && form.port

  return (
    <div className={styles.connOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.connModal}>

        {/* Header */}
        <div className={styles.connHeader}>
          <div className={styles.connHeaderLeft}>
            {view === 'form' && connections.length > 0 && (
              <button className={styles.connBack} onClick={() => setView('list')}>← Back</button>
            )}
            <span className={styles.connTitle}>
              {view === 'form' ? (editId ? 'Edit Connection' : 'New Connection') : 'Database Connections'}
            </span>
          </div>
          <button className={styles.connClose} onClick={onClose}>✕</button>
        </div>

        {/* Connection list */}
        {view === 'list' && (
          <div className={styles.connBody}>
            {connections.length === 0 && (
              <div className={styles.connEmpty}>No saved connections yet.</div>
            )}
            {connections.map(c => {
              const info = dbInfo(c.type)
              return (
                <div key={c.id} className={styles.connItem}>
                  <span className={styles.connBadge} style={{ background: info.color }}>{info.abbr}</span>
                  <div className={styles.connItemInfo}>
                    <div className={styles.connItemName}>{c.name}</div>
                    <div className={styles.connItemMeta}>{c.host}:{c.port} / {c.database} · {c.user}</div>
                  </div>
                  <div className={styles.connItemActions}>
                    <button className={styles.connConnectBtn}
                      onClick={() => handleConnect(c)}
                      disabled={connectingId !== null}>
                      {connectingId === c.id ? 'Connecting…' : 'Connect'}
                    </button>
                    <button className={styles.connEditBtn} onClick={() => openEdit(c)}>Edit</button>
                    <button className={styles.connDelBtn} onClick={() => onDelete(c.id)}>✕</button>
                  </div>
                </div>
              )
            })}
            <button className={styles.connAddBtn} onClick={openNew}>+ Add Connection</button>
          </div>
        )}

        {/* Add / Edit form */}
        {view === 'form' && (
          <div className={styles.connBody}>
            <div className={styles.fGroup}>
              <label className={styles.fLabel}>Display Name</label>
              <input className={styles.fInput} value={form.name}
                onChange={e => setField('name', e.target.value)} placeholder="My PostgreSQL DB" autoFocus />
            </div>

            <div className={styles.fGroup}>
              <label className={styles.fLabel}>Database Type</label>
              <select className={styles.fSelect} value={form.type} onChange={e => setField('type', e.target.value)}>
                {DB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className={styles.fRow}>
              <div className={styles.fGroup} style={{ flex: 1 }}>
                <label className={styles.fLabel}>Host</label>
                <input className={styles.fInput} value={form.host}
                  onChange={e => setField('host', e.target.value)} placeholder="localhost" />
              </div>
              <div className={styles.fGroup} style={{ width: 90 }}>
                <label className={styles.fLabel}>Port</label>
                <input className={styles.fInput} value={form.port}
                  onChange={e => setField('port', e.target.value)} />
              </div>
            </div>

            <div className={styles.fGroup}>
              <label className={styles.fLabel}>Database</label>
              <input className={styles.fInput} value={form.database}
                onChange={e => setField('database', e.target.value)} placeholder="mydb" />
            </div>

            <div className={styles.fRow}>
              <div className={styles.fGroup} style={{ flex: 1 }}>
                <label className={styles.fLabel}>Username</label>
                <input className={styles.fInput} value={form.user}
                  onChange={e => setField('user', e.target.value)} placeholder="postgres" />
              </div>
              <div className={styles.fGroup} style={{ flex: 1 }}>
                <label className={styles.fLabel}>Password</label>
                <input className={styles.fInput} type="password" value={form.password}
                  onChange={e => setField('password', e.target.value)} placeholder="••••••••" />
              </div>
            </div>

            {form.type === 'postgresql' && (
              <div className={styles.fGroup}>
                <label className={styles.fCheckRow}>
                  <input type="checkbox" checked={form.ssl} onChange={e => setField('ssl', e.target.checked)} />
                  <span>Use SSL (recommended for remote servers)</span>
                </label>
              </div>
            )}

            {testMsg && (
              <div className={testMsg.ok ? styles.testOk : styles.testErr}>
                {testMsg.ok ? '✓ ' : '✗ '}{testMsg.text}
              </div>
            )}

            <div className={styles.fActions}>
              <button className={styles.testBtn} onClick={testConn} disabled={testing || !formValid}>
                {testing ? 'Testing…' : 'Test Connection'}
              </button>
              <div style={{ flex: 1 }} />
              <button className={styles.fSaveBtn} onClick={saveForm} disabled={!formValid}>Save</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
