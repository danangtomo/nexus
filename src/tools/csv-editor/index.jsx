import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import { parseCSV, parseXLSX, unparseCSV, unparseXLSX, unparseJSON, unparseSQL, detectColTypes, indexToColLetter, computeFormulaResults, shiftFormula } from './handler'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import styles from './index.module.css'

ModuleRegistry.registerModules([AllCommunityModule])

// Smart default: if both values look numeric, compare as numbers; else compare as strings.
// Applied via defaultColDef so ALL columns (including manually typed data) sort correctly.
const smartComparator = (a, b) => {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  const sa = String(a), sb = String(b)
  const na = Number(sa), nb = Number(sb)
  if (isFinite(na) && isFinite(nb) && sa.trim() !== '' && sb.trim() !== '') return na - nb
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

// Explicit comparators for columns where type was detected from file data.
const numComparator = (a, b) => {
  const na = parseFloat(a), nb = parseFloat(b)
  if (isNaN(na) && isNaN(nb)) return 0
  if (isNaN(na)) return -1
  if (isNaN(nb)) return 1
  return na - nb
}

const dateComparator = (a, b) => {
  const da = a ? Date.parse(String(a)) : NaN
  const db = b ? Date.parse(String(b)) : NaN
  if (isNaN(da) && isNaN(db)) return 0
  if (isNaN(da)) return -1
  if (isNaN(db)) return 1
  return da - db
}

// ── Conditional formatting helpers ───────────────────────────────────────────
function parseCfThreshold(str) {
  const m = str.trim().match(/^(>=|<=|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) return null
  return { op: m[1], val: parseFloat(m[2]) }
}
function matchesThreshold(strVal, parsed) {
  const n = parseFloat(strVal)
  if (isNaN(n)) return false
  const { op, val } = parsed
  if (op === '>')  return n > val
  if (op === '<')  return n < val
  if (op === '>=') return n >= val
  if (op === '<=') return n <= val
  if (op === '=')  return n === val
  if (op === '!=') return n !== val
  return false
}

const FilterIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <path d="M1 2h10L7 6.5V11L5 10V6.5L1 2z"/>
  </svg>
)

// Toolbar icons
const IcoNewFile = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 13V2h7.5L13 5.5V13H2z"/><path d="M9.5 2v3.5H13"/>
    <line x1="7" y1="7.5" x2="7" y2="11.5"/><line x1="5" y1="9.5" x2="9" y2="9.5"/>
  </svg>
)
const IcoOpen = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12V5.5h4.5l1.5-2H14V12H1z"/><line x1="1" y1="6.5" x2="14" y2="6.5"/>
  </svg>
)
const IcoSave = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 13V2h9.5l1.5 1.5V13H2z"/>
    <path d="M5 13V9h5v4"/><rect x="4.5" y="2" width="5" height="3"/>
  </svg>
)
const IcoUndo = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 5.5L1.5 7.5L3.5 9.5"/><path d="M1.5 7.5H9a3 3 0 010 6H7"/>
  </svg>
)
const IcoRedo = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11.5 5.5L13.5 7.5L11.5 9.5"/><path d="M13.5 7.5H6a3 3 0 000 6h2"/>
  </svg>
)
const IcoAddRow = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1.5" width="13" height="8" rx="1"/>
    <line x1="1" y1="5.5" x2="14" y2="5.5"/><line x1="5.5" y1="1.5" x2="5.5" y2="9.5"/>
    <line x1="7.5" y1="12" x2="7.5" y2="14.5"/><line x1="6.25" y1="13.25" x2="8.75" y2="13.25"/>
  </svg>
)
const IcoDelRow = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1.5" width="13" height="8" rx="1"/>
    <line x1="1" y1="5.5" x2="14" y2="5.5"/><line x1="5.5" y1="1.5" x2="5.5" y2="9.5"/>
    <line x1="5.75" y1="13.25" x2="9.25" y2="13.25"/>
  </svg>
)
const IcoAddCol = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="9" height="13" rx="1"/>
    <line x1="5.5" y1="1" x2="5.5" y2="14"/><line x1="1" y1="5.5" x2="10" y2="5.5"/>
    <line x1="12" y1="7" x2="12" y2="9.5"/><line x1="10.75" y1="8.25" x2="13.25" y2="8.25"/>
  </svg>
)
const IcoDelCol = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="9" height="13" rx="1"/>
    <line x1="5.5" y1="1" x2="5.5" y2="14"/><line x1="1" y1="5.5" x2="10" y2="5.5"/>
    <line x1="10.75" y1="8.25" x2="13.25" y2="8.25"/>
  </svg>
)
const IcoSearch = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="6.5" cy="6.5" r="4.5"/><line x1="10" y1="10" x2="13.5" y2="13.5"/>
  </svg>
)
const IcoCF = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="2" width="13" height="11" rx="1"/>
    <line x1="1" y1="6" x2="14" y2="6" strokeWidth="1"/>
    <line x1="1" y1="9.5" x2="14" y2="9.5" strokeWidth="1"/>
    <line x1="7.5" y1="2" x2="7.5" y2="13" strokeWidth="1"/>
    <rect x="1" y="2" width="6.5" height="4" fill="currentColor" fillOpacity="0.3" stroke="none"/>
    <rect x="7.5" y="9.5" width="6.5" height="3.5" fill="currentColor" fillOpacity="0.3" stroke="none"/>
  </svg>
)

function EditableHeader({ displayName, column, api, progressSort, enableSorting, onRename, onFreezeAt, onUnfreezeAll, onHeaderClick, colType = 'string', colLetter = '' }) {
  const [editing, setEditing]         = useState(false)
  const [value, setValue]             = useState(displayName)
  const [sort, setSort]               = useState(() => column.getSort() || null)
  const [filterActive, setFilterActive] = useState(() => column.isFilterActive())
  const [pinned, setPinned]           = useState(() => !!column.isPinned())
  const [ctxMenu, setCtxMenu]         = useState(null) // {x, y}
  const inputRef = useRef(null)
  const menuRef  = useRef(null)

  useEffect(() => { setValue(displayName) }, [displayName])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  useEffect(() => {
    const onSort   = () => setSort(column.getSort() || null)
    const onFilter = () => setFilterActive(column.isFilterActive())
    const onPin    = () => setPinned(!!column.isPinned())
    api.addEventListener('sortChanged', onSort)
    api.addEventListener('filterChanged', onFilter)
    api.addEventListener('columnPinned', onPin)
    return () => {
      api.removeEventListener('sortChanged', onSort)
      api.removeEventListener('filterChanged', onFilter)
      api.removeEventListener('columnPinned', onPin)
    }
  }, [api, column])

  // Close context menu on click-outside or Escape
  useEffect(() => {
    if (!ctxMenu) return
    const close = e => { if (e.type !== 'keydown' || e.key === 'Escape') setCtxMenu(null) }
    window.addEventListener('click', close)
    window.addEventListener('keydown', close)
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', close) }
  }, [ctxMenu])

  function handleLabelClick(e) {
    if (!editing && enableSorting) progressSort(e.shiftKey)
    if (!editing) onHeaderClick?.(column.getId())
  }

  function handleContextMenu(e) {
    e.preventDefault(); e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 190)
    const y = Math.min(e.clientY, window.innerHeight - 72)
    setCtxMenu({ x, y })
  }

  function commit() {
    const trimmed = value.trim()
    if (trimmed && trimmed !== displayName) onRename(column.getId(), trimmed)
    else setValue(displayName)
    setEditing(false)
  }

  function onKeyDown(e) {
    e.stopPropagation()
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') { setValue(displayName); setEditing(false) }
  }

  function openFilter(e) {
    e.stopPropagation()
    if (api.showColumnFilter) api.showColumnFilter(column.getId())
    else if (api.showColumnMenuAfterButtonClick) api.showColumnMenuAfterButtonClick(column.getId(), menuRef.current)
  }

  return (
    <>
      <div className={`${styles.hdrRoot} ${pinned ? styles.hdrPinned : ''}`} onContextMenu={handleContextMenu}>
        <div
          className={`${styles.hdrLabel} ${sort ? styles.hdrLabelSorted : ''}`}
          onClick={handleLabelClick}
          style={{ cursor: enableSorting && !editing ? 'pointer' : 'default' }}
        >
          {editing ? (
            <input
              ref={inputRef}
              className={styles.hdrInput}
              value={value}
              onChange={e => setValue(e.target.value)}
              onBlur={commit}
              onKeyDown={onKeyDown}
              onClick={e => e.stopPropagation()}
              placeholder="Column name…"
            />
          ) : (
            <span
              className={`${styles.hdrText} ${sort ? styles.hdrTextSorted : ''}`}
              title={displayName}
              onDoubleClick={e => { e.stopPropagation(); setEditing(true) }}
            >
              {pinned && <span className={styles.hdrPin}>📌 </span>}
              {colLetter && <span className={styles.colLetter} title={`Column ${colLetter} — use in formulas`}>{colLetter}</span>}
              {colType === 'number' && <span className={styles.colType} title="Numeric column">123</span>}
              {colType === 'date'   && <span className={styles.colType} title="Date column">date</span>}
              {displayName}
            </span>
          )}
          {sort && !editing && (
            <span className={styles.hdrSort}>{sort === 'asc' ? '↑' : '↓'}</span>
          )}
        </div>
        <button
          ref={menuRef}
          className={`${styles.hdrMenu} ${filterActive ? styles.hdrMenuActive : ''}`}
          onClick={openFilter}
          title={filterActive ? 'Filter active' : 'Filter column'}
        >
          <FilterIcon />
        </button>
      </div>

      {ctxMenu && (
        <div className={styles.ctxMenu} style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x }}
          onClick={e => e.stopPropagation()}>
          <button className={styles.ctxItem} onClick={() => { onFreezeAt?.(column.getId()); setCtxMenu(null) }}>
            {pinned ? 'Move freeze to here' : 'Freeze up to here'}
          </button>
          <div className={styles.ctxSep} />
          <button className={styles.ctxItem} onClick={() => { onUnfreezeAll?.(); setCtxMenu(null) }}>
            Unfreeze all columns
          </button>
        </div>
      )}
    </>
  )
}

function computeColStats(api, colId) {
  const values = []
  api.forEachNodeAfterFilter(node => {
    if (node.data) values.push(String(node.data[colId] ?? ''))
  })
  const nullCount = values.filter(v => v === '').length
  const nonEmpty  = values.filter(v => v !== '')
  const unique    = new Set(values).size
  const nums      = nonEmpty.map(Number).filter(v => !isNaN(v))
  const isNumeric = nonEmpty.length > 0 && nums.length === nonEmpty.length
  let min = null, max = null, avg = null
  if (isNumeric && nums.length > 0) {
    let sum = nums[0]; min = nums[0]; max = nums[0]
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] < min) min = nums[i]
      if (nums[i] > max) max = nums[i]
      sum += nums[i]
    }
    avg = sum / nums.length
  }
  return { colId, count: nonEmpty.length, unique, nulls: nullCount, isNumeric, min, max, avg }
}

const RID = '__nexus_rid__'
let _uid = 0
const uid = () => ++_uid
const withId = row => ({ ...row, [RID]: uid() })

const ROW_NUM_FIELD = '__nexus_rownum__'
const ROW_NUM_COL = {
  field: ROW_NUM_FIELD,
  headerName: '#',
  pinned: 'left',
  width: 50, minWidth: 50, maxWidth: 50,
  editable: false, sortable: false, filter: false, resizable: false, suppressMovable: true,
  valueGetter: p => p.node ? p.node.rowIndex + 1 : '',
  cellStyle: {
    color: 'var(--color-label-3)', fontSize: '11px', textAlign: 'right',
    userSelect: 'none', cursor: 'default', background: 'var(--color-bg-secondary)',
    paddingRight: '8px',
  },
}

// Direct DOM helpers for fill-handle drag highlighting (avoids React re-renders on every mousemove)
function clearFillHighlights(container) {
  if (!container) return
  container.querySelectorAll('[data-fill-target]').forEach(el => {
    el.style.removeProperty('background-color')
    el.style.removeProperty('outline')
    el.removeAttribute('data-fill-target')
  })
}
function applyFillHighlights(container, startRowIdx, endRowIdx, colId) {
  clearFillHighlights(container)
  const step = endRowIdx > startRowIdx ? 1 : -1
  for (let ri = startRowIdx + step; step > 0 ? ri <= endRowIdx : ri >= endRowIdx; ri += step) {
    const el = container.querySelector(`.ag-row[row-index="${ri}"] [col-id="${colId}"]`)
    if (el) {
      el.style.backgroundColor = 'rgba(0,122,204,0.13)'
      el.style.outline = '1px solid rgba(0,122,204,0.55)'
      el.setAttribute('data-fill-target', '1')
    }
  }
}

// After adding/deleting a column, reassign colLetter in every column's headerComponentParams
// so the letters stay in sync with what the formula engine uses (colDefs order).
function rebuildColLetters(defs) {
  let i = 0
  return defs.map(c => {
    if (c.field === ROW_NUM_FIELD) return c
    const letter = indexToColLetter(i++)
    return { ...c, headerComponentParams: { ...c.headerComponentParams, colLetter: letter } }
  })
}

export default function CsvEditor() {
  const gridRef    = useRef(null)
  const [gridKey, setGridKey]           = useState(0)
  const [rowData, setRowData]           = useState([])
  const [colDefs, setColDefs]           = useState([])
  const [fileName, setFileName]         = useState('')
  const [filePath, setFilePath]         = useState(null)
  const [delimiter, setDelimiter]       = useState(',')
  const [dirty, setDirty]               = useState(false)
  const [status, setStatus]             = useState('')
  const [activeCol, setActiveCol]       = useState(null)
  const [colStats, setColStats]         = useState(null)
  const [filteredCount, setFilteredCount] = useState(null)
  const [showHelp, setShowHelp]         = useState(false)

  // Conditional formatting
  const [cfEnabled, setCfEnabled]       = useState(false)
  const [cfEmpty, setCfEmpty]           = useState(true)
  const [cfOutliers, setCfOutliers]     = useState(true)
  const [cfThreshold, setCfThreshold]   = useState('')

  // Formula bar
  const [formulaBarAddr,  setFormulaBarAddr]  = useState('')
  const [formulaBarValue, setFormulaBarValue] = useState('')
  const formulaResultsRef    = useRef({})   // { [rid]: { [field]: evaluatedValue } }
  const focusedCellRef       = useRef(null) // { rid, field } of grid-focused cell
  const formulaBarInputRef   = useRef(null)
  const evaluateAndRedrawRef = useRef(null)

  // Fill handle — appears at bottom-right of a focused formula cell; draggable to fill down/up
  const [fillHandle, setFillHandle]   = useState(null) // { x, y, rowIdx, colId } | null (fixed viewport coords)
  const fillDragRef       = useRef(null)   // drag state while filling
  const gridContainerRef  = useRef(null)
  const updateFillHandleRef = useRef(null)

  const activeColRef = useRef(null)
  activeColRef.current = activeCol

  // Find & Replace state
  const [showFind, setShowFind]       = useState(false)
  const [findMode, setFindMode]       = useState('find')   // 'find' | 'replace'
  const [findTerm, setFindTerm]       = useState('')
  const [replaceTerm, setReplaceTerm] = useState('')
  const [findRegex, setFindRegex]     = useState(false)
  const [findCase, setFindCase]       = useState(false)
  const [matches, setMatches]         = useState([])       // [{rid, field}]
  const [matchIndex, setMatchIndex]   = useState(-1)

  // Stable refs — used inside AG Grid cellStyle & keyboard handlers without stale closures
  const matchSetRef    = useRef(new Set())  // Set of "rid_field" for highlighted cells
  const activeMatchRef = useRef(null)       // {rid, field} for the focused/current match
  const showFindRef    = useRef(false)
  showFindRef.current  = showFind
  const findInputRef   = useRef(null)
  const saveRef        = useRef()
  saveRef.current      = save
  const hasDataRef     = useRef(false)
  hasDataRef.current   = colDefs.filter(c => c.field !== ROW_NUM_FIELD).length > 0
  const rowDataRef     = useRef(rowData)
  rowDataRef.current   = rowData
  const colDefsRef     = useRef(colDefs)
  colDefsRef.current   = colDefs
  // Allows renameColumn (defined before clearFind) to call clearFind without stale closure
  const clearFindRef   = useRef(null)
  // Allows renameColumn (defined before pushHistory) to call pushHistory without circular dep
  const pushHistoryRef = useRef(null)
  const pasteFromClipboardRef = useRef(null)

  // CF refs — read by cellStyle without stale closures
  const cfEnabledRef          = useRef(false)
  cfEnabledRef.current        = cfEnabled
  const cfEmptyRef            = useRef(true)
  cfEmptyRef.current          = cfEmpty
  const cfOutliersRef         = useRef(true)
  cfOutliersRef.current       = cfOutliers
  const cfThresholdParsedRef  = useRef(null)
  cfThresholdParsedRef.current = parseCfThreshold(cfThreshold)
  const cfStatsRef            = useRef({})  // { [colId]: { low, high } } — IQR outlier bounds

  // Undo / Redo
  const [historyRevision, setHistoryRevision] = useState(0) // bumped to trigger re-render on history change
  const historyRef      = useRef([])   // [{headers: string[], rows: object[]}]
  const historyIndexRef = useRef(-1)
  const undoRef         = useRef(null)
  const redoRef         = useRef(null)

  // ── Column definitions ───────────────────────────────────────────────────

  const defaultColDef = useMemo(() => ({
    editable: true, sortable: true, filter: true, resizable: true, minWidth: 80,
    comparator: smartComparator,
  }), [])

  const freezeAt = useCallback(colId => {
    const api = gridRef.current?.api
    if (!api) return
    // getColumnState() returns columns in current visual order (respects user drag-reordering)
    // applyColumnState() is the v33+ replacement for the removed setColumnPinned()
    const state = api.getColumnState()
    let shouldPin = true
    const newState = []
    state.forEach(({ colId: id }) => {
      if (id === ROW_NUM_FIELD) return
      newState.push({ colId: id, pinned: shouldPin ? 'left' : null })
      if (id === colId) shouldPin = false
    })
    api.applyColumnState({ state: newState })
  }, [])

  const unfreezeAll = useCallback(() => {
    const api = gridRef.current?.api
    if (!api) return
    const newState = api.getColumnState()
      .filter(({ colId }) => colId !== ROW_NUM_FIELD)
      .map(({ colId }) => ({ colId, pinned: null }))
    api.applyColumnState({ state: newState })
  }, [])

  // showColStats is called from inside makeCol's headerComponentParams (stable closure),
  // so we use a ref to always reach the latest grid API and state setters.
  const showColStatsRef = useRef(null)
  const showColStats = useCallback(colId => {
    showColStatsRef.current?.(colId)
  }, [])

  const renameColumn = useCallback((oldField, newField) => {
    if (!newField || newField === oldField) return
    const newColDefs = colDefsRef.current.map(c => c.field === oldField
      ? { ...c, field: newField, headerName: newField }
      : c
    )
    const newRowData = rowDataRef.current.map(r => {
      const { [oldField]: val, ...rest } = r
      return { ...rest, [newField]: val }
    })
    pushHistoryRef.current?.(newColDefs, newRowData)
    setColDefs(newColDefs)
    setRowData(newRowData)
    setActiveCol(null); setColStats(null)
    setDirty(true)
    clearFindRef.current?.()
    evaluateAndRedrawRef.current?.(newColDefs, newRowData)
  }, [])

  const makeCol = useCallback((field, type = 'string', colIndex = null) => ({
    field,
    headerName: field,
    // p.colDef.field is used instead of closing over `field` so that column rename (which
    // updates colDef.field in-place) keeps valueGetter/valueSetter/cellStyle working correctly.
    valueGetter: p => {
      if (!p.data) return type === 'number' ? null : ''
      const v = p.data[p.colDef.field]
      // Formula cells always return the raw formula so the cell editor shows it, not the result.
      // valueFormatter is responsible for the display value.
      if (typeof v === 'string' && v.startsWith('=')) return v
      if (type === 'number') {
        if (v === '' || v == null) return null
        const n = Number(v)
        return isNaN(n) ? null : n
      }
      return v ?? ''
    },
    valueSetter: p => {
      if (p.data) {
        const v = p.newValue
        // Don't try to cast formula strings to numbers
        if (type === 'number' && v !== '' && v != null && !(typeof v === 'string' && v.startsWith('='))) {
          const n = parseFloat(v)
          p.data[p.colDef.field] = isNaN(n) ? v : n
        } else {
          p.data[p.colDef.field] = v
        }
      }
      return true
    },
    // Formula cells: show evaluated result instead of raw formula string
    valueFormatter: p => {
      const v = p.value
      if (typeof v === 'string' && v.startsWith('=')) {
        const rid = p.data?.[RID]
        const f   = p.colDef?.field
        if (rid !== undefined && f) {
          const cached = formulaResultsRef.current[rid]?.[f]
          if (cached !== undefined && cached !== null) {
            if (typeof cached === 'number')
              return Number.isInteger(cached) ? String(cached)
                : cached.toLocaleString(undefined, { maximumFractionDigits: 10 })
            return String(cached)
          }
        }
        return v // show raw formula if not yet evaluated
      }
      return v == null ? '' : String(v)
    },
    ...(type === 'number' ? { comparator: numComparator } : {}),
    ...(type === 'date'   ? { comparator: dateComparator } : {}),
    cellStyle: p => {
      if (!p.data) return null
      const f   = p.colDef.field
      const rid = p.data[RID]
      // 1. Find & replace highlights (highest priority)
      if (activeMatchRef.current?.rid === rid && activeMatchRef.current?.field === f)
        return { backgroundColor: 'var(--accent)', color: '#fff' }
      if (matchSetRef.current.has(`${rid}_${f}`))
        return { backgroundColor: 'var(--accent-soft)' }
      // 2. Formula error cells — red tint + italic
      const rawV = p.data[f]
      if (typeof rawV === 'string' && rawV.startsWith('=')) {
        const cached = formulaResultsRef.current[rid]?.[f]
        if (typeof cached === 'string' && cached.startsWith('#'))
          return { color: '#e74c3c', backgroundColor: 'rgba(192,57,43,0.08)', fontStyle: 'italic' }
      }
      // 3. Conditional formatting — resolve formula cells to their evaluated value first
      if (cfEnabledRef.current) {
        const isFormula = typeof rawV === 'string' && rawV.startsWith('=')
        const displayVal = isFormula ? (formulaResultsRef.current[rid]?.[f] ?? rawV) : rawV
        const str = displayVal == null ? '' : String(displayVal)
        if (cfEmptyRef.current && str.trim() === '')
          return { backgroundColor: 'rgba(155,89,182,0.28)' }
        if (cfOutliersRef.current) {
          const bounds = cfStatsRef.current[f]
          if (bounds) {
            const n = Number(str)
            if (!isNaN(n)) {
              if (n > bounds.high) return { backgroundColor: 'rgba(192,57,43,0.16)', color: '#c0392b' }
              if (n < bounds.low)  return { backgroundColor: 'rgba(39,174,96,0.16)',  color: '#27ae60' }
            }
          }
        }
        const parsed = cfThresholdParsedRef.current
        if (parsed && str.trim() !== '' && matchesThreshold(str, parsed))
          return { backgroundColor: 'rgba(243,156,18,0.18)', color: '#d68910' }
      }
      return {}
    },
    headerComponent: EditableHeader,
    headerComponentParams: { onRename: renameColumn, onFreezeAt: freezeAt, onUnfreezeAll: unfreezeAll, onHeaderClick: showColStats, colType: type, colLetter: colIndex !== null ? indexToColLetter(colIndex) : '' },
    editable: true, sortable: true, filter: true, resizable: true, minWidth: 80,
  }), [renameColumn, freezeAt, unfreezeAll])

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  const pushHistory = useCallback((newColDefs, newRowData) => {
    const headers = newColDefs.filter(c => c.field !== ROW_NUM_FIELD).map(c => c.field)
    const rows = newRowData.map(r => ({ ...r }))
    const newStack = historyRef.current.slice(0, historyIndexRef.current + 1)
    newStack.push({ headers, rows })
    if (newStack.length > 50) newStack.shift()
    historyRef.current = newStack
    historyIndexRef.current = newStack.length - 1
    setHistoryRevision(r => r + 1)
  }, [])
  pushHistoryRef.current = pushHistory

  function computeCfStats() {
    const stats = {}
    colDefsRef.current.forEach(col => {
      if (col.field === ROW_NUM_FIELD) return
      const nums = rowDataRef.current
        .map(r => {
          let v = r[col.field]
          // For formula cells use the evaluated result, not the raw formula string
          if (typeof v === 'string' && v.startsWith('='))
            v = formulaResultsRef.current[r[RID]]?.[col.field]
          return (v == null || v === '') ? NaN : Number(v)
        })
        .filter(v => !isNaN(v))
      if (nums.length < 4) return
      const sorted = [...nums].sort((a, b) => a - b)
      const q1 = sorted[Math.floor(sorted.length * 0.25)]
      const q3 = sorted[Math.floor(sorted.length * 0.75)]
      const iqr = q3 - q1
      if (iqr === 0) return
      stats[col.field] = { low: q1 - 1.5 * iqr, high: q3 + 1.5 * iqr }
    })
    cfStatsRef.current = stats
  }

  // Evaluate all formula cells and redraw the grid.
  // Must be called after any data change (cell edit, add/delete row/col, undo/redo, paste, load).
  function evaluateAndRedraw(newColDefs, newRowData) {
    formulaResultsRef.current = computeFormulaResults(newColDefs, newRowData, RID, ROW_NUM_FIELD)
    const api = gridRef.current?.api
    if (api) api.redrawRows()
  }
  evaluateAndRedrawRef.current = evaluateAndRedraw

  // ── Fill handle ───────────────────────────────────────────────────────────

  // Compute the fill-handle square position (viewport coords) for a focused formula cell.
  function updateFillHandle(rowIdx, colId, rawValue) {
    if (typeof rawValue !== 'string' || !rawValue.startsWith('=')) {
      setFillHandle(null); return
    }
    const container = gridContainerRef.current
    if (!container) { setFillHandle(null); return }
    setTimeout(() => {
      const cellEl = container.querySelector(`.ag-row[row-index="${rowIdx}"] [col-id="${colId}"]`)
      if (!cellEl) { setFillHandle(null); return }
      const r = cellEl.getBoundingClientRect()
      setFillHandle({ x: r.right - 1, y: r.bottom - 1, rowIdx, colId })
    }, 30)
  }
  updateFillHandleRef.current = updateFillHandle

  function applyFill(startRowIdx, field, rawValue, endRowIdx) {
    const api = gridRef.current?.api
    const step = endRowIdx > startRowIdx ? 1 : -1
    const changes = {}
    // dRow = display row offset from the source; formula references shift by this amount
    for (let ri = startRowIdx + step; step > 0 ? ri <= endRowIdx : ri >= endRowIdx; ri += step) {
      const node = api?.getDisplayedRowAtIndex(ri)
      if (!node?.data) continue
      changes[node.data[RID]] = shiftFormula(rawValue, ri - startRowIdx)
    }
    if (!Object.keys(changes).length) return
    const newRowData = rowDataRef.current.map(r =>
      changes[r[RID]] !== undefined ? { ...r, [field]: changes[r[RID]] } : r
    )
    pushHistoryRef.current?.(colDefsRef.current, newRowData)
    setRowData(newRowData)
    setDirty(true)
    evaluateAndRedrawRef.current?.(colDefsRef.current, newRowData)
  }

  function startFillDrag(e) {
    if (!fillHandle) return
    e.preventDefault(); e.stopPropagation()
    const { rowIdx, colId } = fillHandle
    const node = gridRef.current?.api?.getDisplayedRowAtIndex(rowIdx)
    if (!node?.data) return
    // Read raw value directly from the AG Grid node (always current, even before React re-renders)
    const rawValue = node.data[colId]
    if (typeof rawValue !== 'string' || !rawValue.startsWith('=')) return
    fillDragRef.current = { startRowIdx: rowIdx, field: colId, rawValue }
    const container = gridContainerRef.current
    let endRowIdx = rowIdx
    function onMove(e2) {
      const el = document.elementFromPoint(e2.clientX, e2.clientY)
      const rowEl = el?.closest?.('[row-index]')
      if (rowEl) {
        const ri = parseInt(rowEl.getAttribute('row-index'))
        if (!isNaN(ri) && ri !== endRowIdx) {
          endRowIdx = ri
          if (ri !== rowIdx) applyFillHighlights(container, rowIdx, ri, colId)
          else clearFillHighlights(container)
        }
      }
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      clearFillHighlights(container)
      setFillHandle(null)
      const drag = fillDragRef.current; fillDragRef.current = null
      if (drag && endRowIdx !== drag.startRowIdx)
        applyFill(drag.startRowIdx, drag.field, drag.rawValue, endRowIdx)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onBodyScroll = useCallback(() => setFillHandle(null), [])

  // Synchronous CF handlers — update the ref BEFORE calling redrawRows so
  // cellStyle always reads the new value in the same tick (async setState alone
  // would leave refs stale until the next render, causing both bugs).
  // redrawRows() is used instead of refreshCells({ force: true }) because AG Grid
  // does not guarantee cellStyle re-evaluation via refreshCells; redrawRows fully
  // destroys and recreates row DOM nodes, which guarantees cellStyle is re-called.
  function cfRefresh() {
    const api = gridRef.current?.api
    if (api) api.redrawRows()
  }

  function cfToggle() {
    const next = !cfEnabledRef.current
    cfEnabledRef.current = next
    setCfEnabled(next)
    if (next && cfOutliersRef.current) computeCfStats()
    cfRefresh()
  }
  function cfClose() {
    cfEnabledRef.current = false
    setCfEnabled(false)
    cfRefresh()
  }
  function cfSetEmpty(val) {
    cfEmptyRef.current = val
    setCfEmpty(val)
    cfRefresh()
  }
  function cfSetOutliers(val) {
    cfOutliersRef.current = val
    setCfOutliers(val)
    if (cfEnabledRef.current && val) computeCfStats()
    cfRefresh()
  }
  function cfSetThreshold(val) {
    cfThresholdParsedRef.current = parseCfThreshold(val)
    setCfThreshold(val)
    cfRefresh()
  }

  const applySnapshot = useCallback(snapshot => {
    const types = detectColTypes(snapshot.headers, snapshot.rows)
    const cols = [ROW_NUM_COL, ...snapshot.headers.map((h, i) => makeCol(h, types[h], i))]
    const rows = snapshot.rows.map(r => ({ ...r }))
    setColDefs(cols)
    setRowData(rows)
    setDirty(true)
    setColStats(null)
    setActiveCol(null)
    setFilteredCount(null)
    clearFindRef.current?.()
    evaluateAndRedrawRef.current?.(cols, rows)
  }, [makeCol])

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current--
    setHistoryRevision(r => r + 1)
    applySnapshot(historyRef.current[historyIndexRef.current])
  }, [applySnapshot])

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current++
    setHistoryRevision(r => r + 1)
    applySnapshot(historyRef.current[historyIndexRef.current])
  }, [applySnapshot])

  undoRef.current = undo
  redoRef.current = redo

  // ── Formula bar handlers ──────────────────────────────────────────────────

  const onCellFocused = useCallback(e => {
    if (e.rowIndex == null || !e.column) {
      focusedCellRef.current = null
      setFormulaBarAddr('')
      setFormulaBarValue('')
      setFillHandle(null)
      return
    }
    const colId = typeof e.column.getId === 'function' ? e.column.getId() : String(e.column)
    if (colId === ROW_NUM_FIELD) return
    const api = gridRef.current?.api
    const node = api?.getDisplayedRowAtIndex(e.rowIndex)
    if (!node?.data) return
    const rid = node.data[RID]
    focusedCellRef.current = { rid, field: colId }
    // Compute A1-style address from original data order and column position
    const dataCols = colDefsRef.current.filter(c => c.field !== ROW_NUM_FIELD)
    const cIdx = dataCols.findIndex(c => c.field === colId)
    const rIdx = rowDataRef.current.findIndex(r => r[RID] === rid)
    setFormulaBarAddr(cIdx >= 0 ? `${indexToColLetter(cIdx)}${rIdx + 1}` : '')
    const raw = node.data[colId]
    setFormulaBarValue(raw == null ? '' : String(raw))
    // Show fill handle for formula cells
    updateFillHandleRef.current?.(e.rowIndex, colId, raw)
  }, [])

  function applyFormulaBarValue() {
    const focused = focusedCellRef.current
    if (!focused) return
    const { rid, field } = focused
    const newRowData = rowDataRef.current.map(r =>
      r[RID] === rid ? { ...r, [field]: formulaBarValue } : r
    )
    pushHistoryRef.current?.(colDefsRef.current, newRowData)
    setRowData(newRowData)
    setDirty(true)
    // Patch AG Grid node so the cell shows the new value before redraw
    const api = gridRef.current?.api
    const node = api?.getRowNode(String(rid))
    if (node) node.data[field] = formulaBarValue
    evaluateAndRedraw(colDefsRef.current, newRowData)
    // Return focus to grid — use display row index, not data-array index (differs when sorted/filtered)
    if (api && focusedCellRef.current) {
      const node = api.getRowNode(String(rid))
      if (node?.rowIndex != null) api.setFocusedCell(node.rowIndex, field)
    }
  }

  // ── Data loading ─────────────────────────────────────────────────────────

  function applyParsed(headers, rows, name, path, sep = ',') {
    const types = detectColTypes(headers, rows)
    // Cast values to their native types so AG Grid's built-in sort handles them correctly
    const typedRows = rows.map(r => {
      const o = { ...r }
      headers.forEach(h => {
        if (types[h] === 'number' && r[h] !== '' && r[h] != null) {
          const n = parseFloat(r[h])
          if (!isNaN(n)) o[h] = n
        }
      })
      return o
    })
    const cols = headers.map((h, i) => makeCol(h, types[h], i))
    const data = typedRows.map(withId)
    // Reset history to initial loaded state
    historyRef.current = [{ headers, rows: data.map(r => ({ ...r })) }]
    historyIndexRef.current = 0
    setHistoryRevision(r => r + 1)
    setGridKey(k => k + 1)
    setColDefs([ROW_NUM_COL, ...cols]); setRowData(data)
    setFileName(name); setFilePath(path)
    setDelimiter(sep); setDirty(false); setActiveCol(null); setColStats(null); setFilteredCount(null)
    setStatus('')
    clearFind()
    // Reset formula bar and evaluate any formulas in the loaded file
    setFormulaBarAddr(''); setFormulaBarValue('')
    focusedCellRef.current = null
    evaluateAndRedrawRef.current?.([ROW_NUM_COL, ...cols], data)
  }

  function applyData(text, sep, name, path) {
    const { headers, rows } = parseCSV(text, sep)
    applyParsed(headers, rows, name, path, sep)
  }

  async function openFile() {
    const path = await window.nexus.openFile({
      filters: [
        { name: 'Spreadsheet', extensions: ['csv', 'tsv', 'txt', 'xlsx'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (!path) return
    const lower = path.toLowerCase()
    if (lower.endsWith('.xlsx')) {
      const b64 = await window.nexus.readFile(path, 'base64')
      const binary = atob(b64)
      const buffer = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
      const { headers, rows } = parseXLSX(buffer)
      applyParsed(headers, rows, path.split(/[\\/]/).pop(), path, ',')
    } else {
      const text = await window.nexus.readFile(path, 'utf8')
      const sep = lower.endsWith('.tsv') ? '\t' : ','
      applyData(text, sep, path.split(/[\\/]/).pop(), path)
    }
  }

  function newFile() {
    _uid = 0
    const headers = ['A', 'B', 'C']
    const cols = headers.map((h, i) => makeCol(h, 'string', i))
    const data = Array.from({ length: 5 }, () => {
      const r = {}; headers.forEach(h => { r[h] = '' }); return withId(r)
    })
    // Reset history to blank spreadsheet state
    historyRef.current = [{ headers, rows: data.map(r => ({ ...r })) }]
    historyIndexRef.current = 0
    setHistoryRevision(r => r + 1)
    setColDefs([ROW_NUM_COL, ...cols]); setRowData(data)
    setFileName('Untitled.csv'); setFilePath(null)
    setDelimiter(','); setDirty(true); setActiveCol(null); setColStats(null)
    setStatus('')
    clearFind()
    setFormulaBarAddr(''); setFormulaBarValue('')
    focusedCellRef.current = null
    formulaResultsRef.current = {}
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) { setStatus('Clipboard is empty'); return }
      const firstLine = text.split('\n')[0]
      const sep = firstLine.includes('\t') ? '\t' : ','
      applyData(text, sep, 'Pasted.csv', null)
      setDirty(true)
      // applyData → applyParsed already calls evaluateAndRedraw
    } catch {
      setStatus('Clipboard read blocked — try Open File instead')
    }
  }
  pasteFromClipboardRef.current = pasteFromClipboard

  // ── Snapshot / save / export ──────────────────────────────────────────────

  function snapshot() {
    const headers = colDefs.filter(c => c.field !== ROW_NUM_FIELD).map(c => c.field)
    const api = gridRef.current?.api
    const rows = []
    if (api) {
      const byRid = new Map(rowData.map(r => [r[RID], r]))
      api.forEachNodeAfterFilterAndSort(node => {
        if (!node.data) return
        const r = byRid.get(node.data[RID]) ?? node.data
        const o = {}
        headers.forEach(h => { o[h] = r[h] ?? '' })
        rows.push(o)
      })
    } else {
      rowData.forEach(r => {
        const o = {}; headers.forEach(h => { o[h] = r[h] ?? '' }); rows.push(o)
      })
    }
    return { headers, rows }
  }

  async function save() {
    if (!filePath) { await exportAs('csv'); return }
    const { headers, rows } = snapshot()
    if (filePath.toLowerCase().endsWith('.xlsx')) {
      await writeXlsx(filePath, headers, rows)
    } else {
      await window.nexus.writeFile(filePath, unparseCSV(headers, rows, delimiter))
    }
    setDirty(false)
    setStatus('Saved'); setTimeout(() => setStatus(''), 2500)
  }

  async function writeXlsx(path, headers, rows) {
    const uint8 = unparseXLSX(headers, rows)
    let binary = ''
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
    await window.nexus.writeFileBinary(path, btoa(binary))
  }

  async function exportAs(fmt) {
    const { headers, rows } = snapshot()
    const base = (fileName || 'data').replace(/\.(csv|tsv|txt|xlsx)$/i, '')
    if (fmt === 'xlsx') {
      const savePath = await window.nexus.saveFile({
        defaultPath: `${base}.xlsx`,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
      })
      if (!savePath) return
      await writeXlsx(savePath, headers, rows)
      setStatus(`Exported ${savePath.split(/[\\/]/).pop()}`); setTimeout(() => setStatus(''), 2500)
      return
    }
    if (fmt === 'sql') {
      const tableName = base.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^\d/, s => 't_' + s) || 'data'
      const content = unparseSQL(headers, rows, tableName)
      const savePath = await window.nexus.saveFile({
        defaultPath: `${base}.sql`,
        filters: [{ name: 'SQL File', extensions: ['sql'] }],
      })
      if (!savePath) return
      await window.nexus.writeFile(savePath, content)
      setStatus(`Exported ${savePath.split(/[\\/]/).pop()}`); setTimeout(() => setStatus(''), 2500)
      return
    }
    const content = fmt === 'json'
      ? unparseJSON(rows)
      : unparseCSV(headers, rows, fmt === 'tsv' ? '\t' : ',')
    const savePath = await window.nexus.saveFile({
      defaultPath: `${base}.${fmt}`,
      filters: [{ name: fmt.toUpperCase(), extensions: [fmt] }],
    })
    if (!savePath) return
    await window.nexus.writeFile(savePath, content)
    setStatus(`Exported ${savePath.split(/[\\/]/).pop()}`); setTimeout(() => setStatus(''), 2500)
  }

  // ── Row / column operations ───────────────────────────────────────────────

  function addRow() {
    const r = {}
    colDefs.forEach(c => { if (c.field !== ROW_NUM_FIELD) r[c.field] = '' })
    const newRow = withId(r)
    const newRowData = [...rowData, newRow]
    pushHistory(colDefs, newRowData)
    setRowData(newRowData)
    setColStats(null); setDirty(true)
    evaluateAndRedrawRef.current?.(colDefs, newRowData)
  }

  function deleteRows() {
    const api = gridRef.current?.api
    if (!api) return
    const ids = new Set(api.getSelectedRows().map(r => r[RID]))
    if (!ids.size) { setStatus('Select rows first'); return }
    const newRowData = rowData.filter(r => !ids.has(r[RID]))
    pushHistory(colDefs, newRowData)
    setRowData(newRowData)
    setColStats(null); setDirty(true)
    evaluateAndRedrawRef.current?.(colDefs, newRowData)
  }

  function addColumn() {
    const dataCnt = colDefs.filter(c => c.field !== ROW_NUM_FIELD).length
    const name = `Col ${dataCnt + 1}`
    // If colDefs is empty (no file open yet) make sure ROW_NUM_COL is included
    const base = colDefs.some(c => c.field === ROW_NUM_FIELD) ? colDefs : [ROW_NUM_COL]
    const newColDefs = [...base, makeCol(name, 'string', dataCnt)]
    const newRowData = rowData.map(r => ({ ...r, [name]: '' }))
    pushHistory(newColDefs, newRowData)
    setColDefs(newColDefs)
    setRowData(newRowData)
    setDirty(true)
    evaluateAndRedrawRef.current?.(newColDefs, newRowData)
  }

  function deleteColumn() {
    const field = activeCol
    if (!field) return
    const newColDefs = rebuildColLetters(colDefs.filter(c => c.field !== field))
    const newRowData = rowData.map(({ [field]: _, ...rest }) => rest)
    pushHistory(newColDefs, newRowData)
    setColDefs(newColDefs)
    setRowData(newRowData)
    setActiveCol(null); setColStats(null); setDirty(true)
    evaluateAndRedrawRef.current?.(newColDefs, newRowData)
  }

  // ── Find & Replace ────────────────────────────────────────────────────────

  // Navigate the grid to a specific {rid, field} match
  function navigateTo({ rid, field }) {
    const api = gridRef.current?.api
    if (!api) return
    const node = api.getRowNode(String(rid))
    if (!node || node.rowIndex == null) return
    api.ensureIndexVisible(node.rowIndex, 'middle')
    api.setFocusedCell(node.rowIndex, field)
  }

  function applyReplace(val, term, replaceWith, isRegex, isCaseSensitive) {
    if (isRegex) {
      try { return val.replace(new RegExp(term, isCaseSensitive ? 'g' : 'gi'), replaceWith) }
      catch { return val }
    }
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return val.replace(new RegExp(escaped, isCaseSensitive ? 'g' : 'gi'), replaceWith)
  }

  const clearFind = useCallback(() => {
    matchSetRef.current = new Set()
    activeMatchRef.current = null
    setMatches([])
    setMatchIndex(-1)
    gridRef.current?.api?.refreshCells({ force: true })
  }, [])
  clearFindRef.current = clearFind
  showColStatsRef.current = colId => {
    const api = gridRef.current?.api
    if (!api) return
    setActiveCol(colId)
    setColStats(computeColStats(api, colId))
    setStatus('')
  }

  // Scans all cells for matches; uses refs so it's stable and always reads latest data
  const runFind = useCallback((term, isRegex, isCaseSensitive) => {
    const api = gridRef.current?.api
    const data = rowDataRef.current
    const cols = colDefsRef.current

    if (!term) {
      matchSetRef.current = new Set()
      activeMatchRef.current = null
      setMatches([])
      setMatchIndex(-1)
      api?.refreshCells({ force: true })
      return
    }

    let re
    if (isRegex) {
      try { re = new RegExp(term, isCaseSensitive ? '' : 'i') } catch { return }
    }

    const newSet = new Set()
    const results = []

    const matchStr = (s) => re
      ? re.test(s)
      : isCaseSensitive ? s.includes(term) : s.toLowerCase().includes(term.toLowerCase())

    data.forEach(row => {
      cols.forEach(col => {
        if (col.field === ROW_NUM_FIELD) return
        const raw = row[col.field]
        const rawStr = String(raw ?? '')
        const isFormula = typeof raw === 'string' && raw.startsWith('=')
        const evaluated = isFormula
          ? String(formulaResultsRef.current[row[RID]]?.[col.field] ?? '')
          : null
        const hit = matchStr(rawStr) || (evaluated !== null && matchStr(evaluated))
        if (hit) {
          newSet.add(`${row[RID]}_${col.field}`)
          results.push({ rid: row[RID], field: col.field })
        }
      })
    })

    matchSetRef.current = newSet
    setMatches(results)

    if (results.length > 0) {
      setMatchIndex(0)
      activeMatchRef.current = results[0]
      navigateTo(results[0])
    } else {
      setMatchIndex(-1)
      activeMatchRef.current = null
    }

    api?.refreshCells({ force: true })
  }, []) // stable — reads latest data via rowDataRef/colDefsRef

  function navigateMatch(dir, currentMatches, currentIndex) {
    if (!currentMatches.length) return
    const newIndex = ((currentIndex + dir) % currentMatches.length + currentMatches.length) % currentMatches.length
    setMatchIndex(newIndex)
    activeMatchRef.current = currentMatches[newIndex]
    navigateTo(currentMatches[newIndex])
    gridRef.current?.api?.refreshCells({ force: true })
  }

  function doReplace(term, replaceWith, isRegex, isCaseSensitive, currentMatches, currentIndex) {
    if (!currentMatches.length || currentIndex < 0) return
    const match = currentMatches[currentIndex]
    const row = rowDataRef.current.find(r => r[RID] === match.rid)
    if (!row) return

    const newVal = applyReplace(String(row[match.field] ?? ''), term, replaceWith, isRegex, isCaseSensitive)
    const newRowData = rowDataRef.current.map(r => r[RID] === match.rid ? { ...r, [match.field]: newVal } : r)
    pushHistory(colDefsRef.current, newRowData)
    setRowData(newRowData)
    setDirty(true)

    // Update AG Grid's internal node so the cell repaints immediately
    const api = gridRef.current?.api
    const node = api?.getRowNode(String(match.rid))
    if (node) node.data[match.field] = newVal

    // Remove this match and advance
    const newMatches = currentMatches.filter((_, i) => i !== currentIndex)
    matchSetRef.current = new Set(newMatches.map(m => `${m.rid}_${m.field}`))
    setMatches(newMatches)

    if (newMatches.length === 0) {
      activeMatchRef.current = null
      setMatchIndex(-1)
    } else {
      const next = currentIndex >= newMatches.length ? 0 : currentIndex
      setMatchIndex(next)
      activeMatchRef.current = newMatches[next]
      navigateTo(newMatches[next])
    }
    api?.refreshCells({ force: true })
    evaluateAndRedrawRef.current?.(colDefsRef.current, newRowData)
  }

  function doReplaceAll(term, replaceWith, isRegex, isCaseSensitive, currentMatches) {
    if (!currentMatches.length) return
    const api = gridRef.current?.api

    // Group replacements by rid
    const updates = new Map()
    currentMatches.forEach(({ rid, field }) => {
      const row = rowDataRef.current.find(r => r[RID] === rid)
      if (!row) return
      const newVal = applyReplace(String(row[field] ?? ''), term, replaceWith, isRegex, isCaseSensitive)
      if (!updates.has(rid)) updates.set(rid, {})
      updates.get(rid)[field] = newVal
    })

    const newRowData = rowDataRef.current.map(r => {
      if (!updates.has(r[RID])) return r
      return { ...r, ...updates.get(r[RID]) }
    })
    pushHistory(colDefsRef.current, newRowData)
    setRowData(newRowData)

    // Patch AG Grid's internal nodes
    if (api) {
      updates.forEach((fields, rid) => {
        const node = api.getRowNode(String(rid))
        if (node) Object.assign(node.data, fields)
      })
    }

    matchSetRef.current = new Set()
    activeMatchRef.current = null
    setMatches([])
    setMatchIndex(-1)
    setDirty(true)
    setStatus(`Replaced ${currentMatches.length} cell${currentMatches.length !== 1 ? 's' : ''}`)
    api?.refreshCells({ force: true })
    evaluateAndRedrawRef.current?.(colDefsRef.current, newRowData)
  }

  // ── AG Grid callbacks ─────────────────────────────────────────────────────

  const onCellClicked      = useCallback(e => {
    const colId = e.column.getId()
    if (colId === ROW_NUM_FIELD) return
    setActiveCol(colId)
    setColStats(computeColStats(e.api, colId))
    setStatus('')
  }, [])
  const onCellValueChanged = useCallback(({ data, colDef, newValue }) => {
    const rid = data[RID]
    const field = colDef.field
    let newRowData = rowDataRef.current.map(r => r[RID] === rid ? { ...r, [field]: newValue } : r)

    // Multi-cell fill: if other rows are selected, write the same value into them too
    const api = gridRef.current?.api
    if (api && field !== ROW_NUM_FIELD) {
      const others = api.getSelectedNodes().filter(n => n.data[RID] !== rid)
      if (others.length > 0) {
        const ridSet = new Set(others.map(n => n.data[RID]))
        newRowData = newRowData.map(r => ridSet.has(r[RID]) ? { ...r, [field]: newValue } : r)
        others.forEach(node => { node.data[field] = newValue })
      }
    }

    pushHistoryRef.current?.(colDefsRef.current, newRowData)
    setRowData(newRowData)
    setDirty(true)
    // Update formula bar if this cell is focused
    if (focusedCellRef.current?.rid === rid && focusedCellRef.current?.field === field)
      setFormulaBarValue(newValue == null ? '' : String(newValue))
    evaluateAndRedrawRef.current?.(colDefsRef.current, newRowData)
  }, [])
  const getRowId           = useCallback(p => String(p.data[RID]), [])
  const onFilterChanged    = useCallback(e => {
    setFilteredCount(e.api.getDisplayedRowCount())
    setStatus('')
    e.api.refreshCells({ columns: [ROW_NUM_FIELD], force: true })
    if (activeColRef.current) setColStats(computeColStats(e.api, activeColRef.current))
  }, [])
  const onSortChanged      = useCallback(e => {
    setStatus('')
    e.api.refreshCells({ columns: [ROW_NUM_FIELD], force: true })
    if (activeColRef.current) setColStats(computeColStats(e.api, activeColRef.current))
  }, [])

  // ── Effects ───────────────────────────────────────────────────────────────

  // Auto-size columns when the column set changes (new file, column add/rename)
  useEffect(() => {
    if (colDefs.length === 0) return
    const id = setTimeout(() => gridRef.current?.api?.autoSizeAllColumns(false), 80)
    return () => clearTimeout(id)
  }, [colDefs])

  // Re-run find whenever the term or options change
  useEffect(() => {
    if (!showFind) return
    runFind(findTerm, findRegex, findCase)
  }, [findTerm, findRegex, findCase, showFind, runFind])

  // Disable AG Grid cell focus while find bar is open so it cannot steal focus back
  useEffect(() => {
    const api = gridRef.current?.api
    if (!api) return
    api.setGridOption('suppressCellFocus', showFind)
    if (showFind) api.clearFocusedCell()
  }, [showFind])

  // Recompute CF outlier bounds after a new file is loaded (gridKey increments on each load)
  useEffect(() => {
    if (!cfEnabledRef.current) return
    // Slight delay so auto-size (80ms) finishes first
    const id = setTimeout(() => {
      if (!cfEnabledRef.current) return
      if (cfOutliersRef.current) computeCfStats()
      const api = gridRef.current?.api
      if (api) api.redrawRows()
    }, 100)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridKey])

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); saveRef.current?.()
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        // Skip if AG Grid has an active cell editor OR the focus is inside a text input
        const editing = gridRef.current?.api?.getEditingCells?.()
        const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'
        if (!editing?.length && !inInput) { e.preventDefault(); undoRef.current?.() }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        const editing = gridRef.current?.api?.getEditingCells?.()
        const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'
        if (!editing?.length && !inInput) { e.preventDefault(); redoRef.current?.() }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault(); e.stopPropagation()
        setShowFind(true); setFindMode('find')
        setTimeout(() => findInputRef.current?.focus(), 0)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault(); e.stopPropagation()
        setShowFind(true); setFindMode('replace')
        setTimeout(() => findInputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape') {
        if (showFindRef.current) { setShowFind(false); clearFind() }
        else setShowHelp(false)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !hasDataRef.current) {
        e.preventDefault()
        pasteFromClipboardRef.current?.()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Home' && hasDataRef.current) {
        e.preventDefault()
        const api = gridRef.current?.api
        if (api) {
          api.ensureIndexVisible(0, 'top')
          const allCols = api.getAllDisplayedColumns?.() ?? []
          const firstDataCol = allCols.find(col => col.getId() !== ROW_NUM_FIELD)
          if (firstDataCol) api.setFocusedCell(0, firstDataCol.getId())
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'End' && hasDataRef.current) {
        e.preventDefault()
        const api = gridRef.current?.api
        if (api) {
          const lastRow = api.getDisplayedRowCount() - 1
          const allCols = api.getAllDisplayedColumns?.() ?? []
          const lastDataCol = [...allCols].reverse().find(col => col.getId() !== ROW_NUM_FIELD)
          if (lastRow >= 0 && lastDataCol) {
            api.ensureIndexVisible(lastRow, 'bottom')
            api.setFocusedCell(lastRow, lastDataCol.getId())
          }
        }
      }
      // Ctrl+D — fill down: copy focused column's top-selected-row value to all other selected rows
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && hasDataRef.current) {
        const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'
        if (!inInput) {
          e.preventDefault()
          const api = gridRef.current?.api
          if (api) {
            const focused = api.getFocusedCell()
            const field = focused?.column?.getId()
            if (field && field !== ROW_NUM_FIELD) {
              const selected = api.getSelectedNodes()
                .filter(n => n.rowIndex != null)
                .sort((a, b) => a.rowIndex - b.rowIndex)
              if (selected.length >= 2) {
                const topNode = selected[0]
                const rawValue = topNode.data[field]
                const changes = {}
                selected.slice(1).forEach(node => {
                  const dRow = node.rowIndex - topNode.rowIndex
                  changes[node.data[RID]] = (typeof rawValue === 'string' && rawValue.startsWith('='))
                    ? shiftFormula(rawValue, dRow)
                    : rawValue
                })
                const newRowData = rowDataRef.current.map(r =>
                  changes[r[RID]] !== undefined ? { ...r, [field]: changes[r[RID]] } : r
                )
                selected.slice(1).forEach(node => { node.data[field] = changes[node.data[RID]] })
                pushHistoryRef.current?.(colDefsRef.current, newRowData)
                setRowData(newRowData)
                setDirty(true)
                evaluateAndRedrawRef.current?.(colDefsRef.current, newRowData)
              }
            }
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [clearFind])

  // ── Derived state ─────────────────────────────────────────────────────────

  const dataColCount = colDefs.filter(c => c.field !== ROW_NUM_FIELD).length
  const hasData      = dataColCount > 0
  const isFiltered   = filteredCount !== null && filteredCount !== rowData.length
  // historyRevision used only to force re-render when history stack changes
  void historyRevision
  const canUndo = historyIndexRef.current > 0
  const canRedo = historyIndexRef.current < historyRef.current.length - 1

  function fmtNum(n) {
    if (n === null || n === undefined) return '—'
    const abs = Math.abs(n)
    if (!Number.isInteger(n) && abs < 1e6) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
    return n.toLocaleString()
  }

  let statsText = ''
  if (colStats) {
    statsText = ` — "${colStats.colId}"  ${colStats.count} values · ${colStats.unique} unique · ${colStats.nulls} empty`
    if (colStats.isNumeric) statsText += `  |  min ${fmtNum(colStats.min)} · max ${fmtNum(colStats.max)} · avg ${fmtNum(colStats.avg)}`
  } else if (activeCol) {
    statsText = ` — "${activeCol}"`
  }

  const statusText = status || (hasData
    ? `${isFiltered ? `${filteredCount} of ` : ''}${rowData.length} rows × ${dataColCount} cols${isFiltered ? ' (filtered)' : ''}${statsText}`
    : 'Ready')

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.shell}>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          {/* File */}
          <div className={styles.group}>
            <button className={styles.btnIcon} onClick={newFile} title="New spreadsheet">
              <IcoNewFile />
            </button>
            <button className={styles.btnIcon} onClick={openFile} title="Open file — CSV / TSV / XLSX">
              <IcoOpen />
            </button>
            <button
              className={`${styles.btnIcon} ${dirty ? styles.btnIconDirty : ''}`}
              onClick={save} disabled={!hasData} title="Save (Ctrl+S)"
            >
              <IcoSave />
            </button>
          </div>
          <div className={styles.sep} />
          {/* Undo / Redo */}
          <div className={styles.group}>
            <button className={styles.btnIcon} onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
              <IcoUndo />
            </button>
            <button className={styles.btnIcon} onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
              <IcoRedo />
            </button>
          </div>
          <div className={styles.sep} />
          {/* Rows / Columns */}
          <div className={styles.group}>
            <button className={styles.btnIcon} onClick={addRow} disabled={!hasData} title="Add row">
              <IcoAddRow />
            </button>
            <button className={styles.btnIcon} onClick={deleteRows} disabled={!hasData} title="Delete selected rows">
              <IcoDelRow />
            </button>
            <button className={styles.btnIcon} onClick={addColumn} title="Add column">
              <IcoAddCol />
            </button>
            <button
              className={styles.btnIcon} onClick={deleteColumn} disabled={!activeCol}
              title={activeCol ? `Delete column "${activeCol}"` : 'Delete column — click any cell first'}
            >
              <IcoDelCol />
            </button>
          </div>
          <div className={styles.sep} />
          {/* Find */}
          <div className={styles.group}>
            <button
              className={styles.btnIcon}
              onClick={() => { setShowFind(true); setFindMode('find'); setTimeout(() => findInputRef.current?.focus(), 0) }}
              title="Find / Replace (Ctrl+F)"
            >
              <IcoSearch />
            </button>
            <button
              className={`${styles.btnIcon} ${cfEnabled ? styles.btnIconActive : ''}`}
              onClick={cfToggle}
              title="Conditional formatting"
              disabled={!hasData}
            >
              <IcoCF />
            </button>
          </div>
          <div className={styles.sep} />
          {/* Export */}
          <div className={styles.group}>
            <button className={styles.btnSm} onClick={() => exportAs('csv')} disabled={!hasData} title="Export as CSV">CSV</button>
            <button className={styles.btnSm} onClick={() => exportAs('tsv')} disabled={!hasData} title="Export as TSV">TSV</button>
            <button className={styles.btnSm} onClick={() => exportAs('json')} disabled={!hasData} title="Export as JSON">JSON</button>
            <button className={styles.btnSm} onClick={() => exportAs('xlsx')} disabled={!hasData} title="Export as Excel">XLSX</button>
            <button className={styles.btnSm} onClick={() => exportAs('sql')} disabled={!hasData} title="Export as SQL INSERT statements">SQL</button>
          </div>
          <div className={styles.toolbarEnd}>
            {fileName && <span className={styles.fileTag}>{fileName}{dirty ? ' *' : ''}</span>}
            <button className={styles.helpBtn} onClick={() => setShowHelp(true)} title="Shortcuts & guide">?</button>
          </div>
        </div>

        {/* Formula bar — always visible when data is loaded */}
        {hasData && (
          <div className={styles.formulaBar}>
            <span className={styles.cellAddr}>{formulaBarAddr || '—'}</span>
            <span className={styles.fxLabel}>ƒx</span>
            <input
              ref={formulaBarInputRef}
              className={`${styles.formulaInput} ${formulaBarValue.startsWith('=') ? styles.formulaInputActive : ''}`}
              value={formulaBarValue}
              placeholder="Select a cell to view or edit its value or formula"
              onChange={e => setFormulaBarValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); applyFormulaBarValue() }
                if (e.key === 'Escape') {
                  // Revert to stored raw value
                  const focused = focusedCellRef.current
                  if (focused) {
                    const row = rowDataRef.current.find(r => r[RID] === focused.rid)
                    setFormulaBarValue(row ? String(row[focused.field] ?? '') : '')
                  }
                  gridRef.current?.api?.setFocusedCell(
                    rowDataRef.current.findIndex(r => r[RID] === focusedCellRef.current?.rid),
                    focusedCellRef.current?.field
                  )
                }
              }}
            />
          </div>
        )}

        {/* Find & Replace bar */}
        {showFind && (
          <div className={styles.findBar}>
            <div className={styles.findRow}>
              <input
                ref={findInputRef}
                className={`${styles.findInput} ${findTerm && !matches.length ? styles.findNoMatch : ''}`}
                placeholder="Find…"
                value={findTerm}
                onChange={e => setFindTerm(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') navigateMatch(e.shiftKey ? -1 : 1, matches, matchIndex)
                  if (e.key === 'Escape') { setShowFind(false); clearFind() }
                }}
              />
              <span className={styles.findCount}>
                {findTerm
                  ? matches.length ? `${matchIndex + 1} / ${matches.length}` : 'No results'
                  : ''}
              </span>
              <button className={styles.findNavBtn} onClick={() => navigateMatch(-1, matches, matchIndex)} disabled={matches.length < 2} title="Previous (Shift+Enter)">↑</button>
              <button className={styles.findNavBtn} onClick={() => navigateMatch(1, matches, matchIndex)} disabled={matches.length < 2} title="Next (Enter)">↓</button>
              <button
                className={`${styles.findOptBtn} ${findCase ? styles.findOptActive : ''}`}
                onClick={() => setFindCase(v => !v)}
                title="Match case"
              >Aa</button>
              <button
                className={`${styles.findOptBtn} ${findRegex ? styles.findOptActive : ''}`}
                onClick={() => setFindRegex(v => !v)}
                title="Regular expression"
              >.*</button>
              {findMode === 'find' && (
                <button className={styles.findOptBtn} onClick={() => setFindMode('replace')} title="Open Replace (Ctrl+H)">⇄</button>
              )}
              <button className={styles.findCloseBtn} onClick={() => { setShowFind(false); clearFind() }} title="Close (Escape)">✕</button>
            </div>
            {findMode === 'replace' && (
              <div className={styles.findRow}>
                <input
                  className={styles.findInput}
                  placeholder="Replace with…"
                  value={replaceTerm}
                  onChange={e => setReplaceTerm(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') doReplace(findTerm, replaceTerm, findRegex, findCase, matches, matchIndex)
                    if (e.key === 'Escape') { setShowFind(false); clearFind() }
                  }}
                />
                <button
                  className={styles.findActionBtn}
                  onClick={() => doReplace(findTerm, replaceTerm, findRegex, findCase, matches, matchIndex)}
                  disabled={!matches.length}
                >Replace</button>
                <button
                  className={styles.findActionBtn}
                  onClick={() => doReplaceAll(findTerm, replaceTerm, findRegex, findCase, matches)}
                  disabled={!matches.length}
                >Replace All</button>
                <button className={styles.findOptBtn} onClick={() => setFindMode('find')} title="Close replace">⊠</button>
              </div>
            )}
          </div>
        )}

        {/* Conditional formatting bar */}
        {cfEnabled && hasData && (
          <div className={styles.cfBar}>
            <label className={styles.cfToggle}>
              <input type="checkbox" checked={cfEmpty} onChange={e => cfSetEmpty(e.target.checked)} />
              <span className={styles.cfSwatch} style={{ background: 'rgba(155,89,182,0.7)' }} />
              Empty cells
            </label>
            <div className={styles.cfDivider} />
            <label className={styles.cfToggle}>
              <input type="checkbox" checked={cfOutliers} onChange={e => cfSetOutliers(e.target.checked)} />
              <span className={styles.cfSwatch} style={{ background: 'linear-gradient(to right, #27ae60 40%, #c0392b 60%)' }} />
              Outliers (IQR)
            </label>
            <div className={styles.cfDivider} />
            <span className={styles.cfLabel}>Threshold:</span>
            <input
              className={`${styles.cfInput} ${cfThreshold && !cfThresholdParsedRef.current ? styles.cfInputInvalid : (cfThreshold ? styles.cfInputValid : '')}`}
              placeholder="e.g. &gt; 100"
              value={cfThreshold}
              onChange={e => cfSetThreshold(e.target.value)}
              title="Numeric comparison: > < >= <= = !="
            />
            <span className={styles.cfHint}>&gt; &lt; &gt;= &lt;= = !=</span>
            <button
              className={styles.findCloseBtn}
              onClick={cfClose}
              title="Close conditional formatting"
              style={{ marginLeft: 'auto' }}
            >✕</button>
          </div>
        )}

        {/* Grid or empty state */}
        {!hasData ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⊞</div>
            <p className={styles.emptyText}>Open a CSV, TSV, or Excel (.xlsx) file to edit, create a new spreadsheet, or paste CSV data from the clipboard</p>
            <div className={styles.emptyActions}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={openFile}>Open File</button>
              <button className={styles.btn} onClick={newFile}>New Spreadsheet</button>
              <button className={styles.btn} onClick={pasteFromClipboard} title="Paste CSV or TSV text from clipboard (Ctrl+V)">Paste CSV</button>
            </div>
          </div>
        ) : (
          <div ref={gridContainerRef} className={`ag-theme-alpine ${styles.grid}`}>
            <AgGridReact
              key={gridKey}
              ref={gridRef}
              rowData={rowData}
              columnDefs={colDefs}
              defaultColDef={defaultColDef}
              getRowId={getRowId}
              theme="legacy"
              tooltipShowDelay={400}
              rowSelection={{ mode: 'multiRow', checkboxes: false, headerCheckbox: false, enableClickSelection: true }}
              onCellClicked={onCellClicked}
              onCellFocused={onCellFocused}
              onCellValueChanged={onCellValueChanged}
              onSortChanged={onSortChanged}
              onFilterChanged={onFilterChanged}
              onBodyScroll={onBodyScroll}
              onCellEditingStarted={() => setFillHandle(null)}
              suppressMovableColumns={false}
              enableCellTextSelection
            />
          </div>
        )}

        <div className={styles.statusBar}>{statusText}</div>

        {/* Fill handle — fixed-positioned square at bottom-right of focused formula cell */}
        {fillHandle && (
          <div
            className={styles.fillHandle}
            style={{ left: fillHandle.x, top: fillHandle.y }}
            onMouseDown={startFillDrag}
            title="Drag to fill formula down/up"
          />
        )}

        {/* Help modal */}
      {showHelp && (
        <div className={styles.helpOverlay} onClick={() => setShowHelp(false)}>
          <div className={styles.helpPanel} onClick={e => e.stopPropagation()}>
            <div className={styles.helpHeader}>
              <span>Shortcuts &amp; Guide</span>
              <button className={styles.helpClose} onClick={() => setShowHelp(false)}>✕</button>
            </div>
            <div className={styles.helpBody}>

              {/* ── File & I/O ─────────────────────────────────────────────── */}
              <div className={styles.helpSection}>
                <h4>File</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td><Kbd>Ctrl</Kbd>+<Kbd>S</Kbd></td><td>Save — writes back to the original file; prompts Save As for new unsaved files</td></tr>
                  <tr><td>New button</td><td>Create a blank 3-column spreadsheet</td></tr>
                  <tr><td>Open button</td><td>Open a CSV, TSV, TXT, or XLSX file</td></tr>
                  <tr><td>Export → CSV / TSV / JSON / XLSX / SQL</td><td>Save a copy in the chosen format — respects active filter &amp; sort order</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpSectionSep} />

              <div className={styles.helpSection}>
                <h4>Excel (.xlsx) support</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td>Open → select .xlsx file</td><td>Loads the first sheet of the workbook</td></tr>
                  <tr><td><Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> on an .xlsx file</td><td>Saves back as Excel workbook</td></tr>
                  <tr><td>Export → XLSX button</td><td>Save a copy as Excel workbook</td></tr>
                  <tr><td>Export → CSV / TSV / JSON / SQL</td><td>Convert an open .xlsx to other formats</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpSectionSep} />

              <div className={styles.helpSection}>
                <h4>Paste CSV from clipboard</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td><Kbd>Ctrl</Kbd>+<Kbd>V</Kbd> (grid empty)</td><td>Paste CSV or TSV text from clipboard and load it as a spreadsheet</td></tr>
                  <tr><td>"Paste CSV" button</td><td>Same as Ctrl+V — available on the empty state screen</td></tr>
                  <tr><td>Auto-detects format</td><td>Tab characters → treated as TSV; otherwise CSV</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpSectionSep} />

              <div className={styles.helpSection}>
                <h4>SQL export</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td>Export → SQL button</td><td>Saves data as ANSI SQL <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>INSERT INTO</code> statements in a <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>.sql</code> file</td></tr>
                  <tr><td>Table name</td><td>Derived from the file name (special characters replaced with <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>_</code>); rename the file first to control the table name</td></tr>
                  <tr><td>Column names</td><td>Quoted with double quotes (<code style={{fontFamily:'var(--font-mono)',fontSize:11}}>"column"</code>) — ANSI SQL, works with PostgreSQL, SQLite, SQL Server</td></tr>
                  <tr><td>NULL values</td><td>Empty cells are exported as <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>NULL</code></td></tr>
                  <tr><td>Numeric values</td><td>Numbers exported without quotes; strings are single-quoted with <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>'</code> escaped as <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>''</code></td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpGroupSep} />

              {/* ── Editing ────────────────────────────────────────────────── */}
              <div className={styles.helpSection}>
                <h4>Editing cells</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td><Kbd>F2</Kbd> or double-click</td><td>Start editing cell</td></tr>
                  <tr><td><Kbd>Enter</Kbd></td><td>Confirm edit &amp; move down</td></tr>
                  <tr><td><Kbd>Escape</Kbd></td><td>Cancel edit</td></tr>
                  <tr><td>Start typing</td><td>Replace cell value immediately</td></tr>
                  <tr><td><Kbd>Delete</Kbd> / <Kbd>Backspace</Kbd></td><td>Clear focused cell</td></tr>
                  <tr><td><Kbd>Ctrl</Kbd>+<Kbd>C</Kbd></td><td>Copy selected cell(s)</td></tr>
                  <tr><td>Edit while multiple rows selected</td><td>Typed value is written into all selected rows in the same column</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpSectionSep} />

              <div className={styles.helpSection}>
                <h4>Fill down</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td><Kbd>Ctrl</Kbd>+<Kbd>D</Kbd></td><td>Fill the focused column's value from the top-most selected row into all other selected rows</td></tr>
                  <tr><td>Formula fill</td><td>Row references shift automatically — =B1*C1 in row 1 becomes =B2*C2 in row 2, etc.</td></tr>
                  <tr><td>Fill handle drag (■)</td><td>Drag the corner of any formula cell to fill shifted formulas into adjacent rows</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpSectionSep} />

              <div className={styles.helpSection}>
                <h4>Undo &amp; Redo</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td><Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd></td><td>Undo last change</td></tr>
                  <tr><td><Kbd>Ctrl</Kbd>+<Kbd>Y</Kbd> or <Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>Z</Kbd></td><td>Redo</td></tr>
                  <tr><td>↩ Undo / ↪ Redo buttons</td><td>Same as keyboard shortcuts</td></tr>
                  <tr><td>History cap</td><td>Up to 50 steps tracked per session</td></tr>
                  <tr><td>What's tracked</td><td>Cell edits, add/delete rows &amp; columns, renames, find &amp; replace, fill down</td></tr>
                  <tr><td>What's not tracked</td><td>Column freeze, column resize/reorder</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpSectionSep} />

              <div className={styles.helpSection}>
                <h4>Find &amp; Replace</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td><Kbd>Ctrl</Kbd>+<Kbd>F</Kbd></td><td>Open find bar</td></tr>
                  <tr><td><Kbd>Ctrl</Kbd>+<Kbd>H</Kbd></td><td>Open find &amp; replace</td></tr>
                  <tr><td><Kbd>Enter</Kbd> in find</td><td>Next match</td></tr>
                  <tr><td><Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> in find</td><td>Previous match</td></tr>
                  <tr><td>Aa / .* buttons</td><td>Case-sensitive / regex mode</td></tr>
                  <tr><td>Searches formula results</td><td>Find matches both the raw formula string and its evaluated result</td></tr>
                  <tr><td><Kbd>Escape</Kbd></td><td>Close find bar</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpGroupSep} />

              {/* ── Navigation & Selection ─────────────────────────────────── */}
              <div className={styles.helpSection}>
                <h4>Navigation</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td><Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>←</Kbd><Kbd>→</Kbd></td><td>Move between cells</td></tr>
                  <tr><td><Kbd>Tab</Kbd></td><td>Next cell</td></tr>
                  <tr><td><Kbd>Shift</Kbd>+<Kbd>Tab</Kbd></td><td>Previous cell</td></tr>
                  <tr><td><Kbd>Ctrl</Kbd>+<Kbd>Home</Kbd></td><td>Jump to first cell</td></tr>
                  <tr><td><Kbd>Ctrl</Kbd>+<Kbd>End</Kbd></td><td>Jump to last cell</td></tr>
                  <tr><td><Kbd>Page Up</Kbd> / <Kbd>Page Down</Kbd></td><td>Scroll one page</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpSectionSep} />

              <div className={styles.helpSection}>
                <h4>Row selection &amp; deletion</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td>Click row</td><td>Select row (highlighted)</td></tr>
                  <tr><td><Kbd>Ctrl</Kbd>+Click</td><td>Toggle individual row</td></tr>
                  <tr><td><Kbd>Shift</Kbd>+Click</td><td>Select a range of rows</td></tr>
                  <tr><td>− Row button</td><td>Delete all selected rows</td></tr>
                  <tr><td>+ Row button</td><td>Append an empty row</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpGroupSep} />

              {/* ── Columns & Structure ────────────────────────────────────── */}
              <div className={styles.helpSection}>
                <h4>Columns</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td>Click header</td><td>Sort asc → desc → off</td></tr>
                  <tr><td><Kbd>Shift</Kbd>+Click header</td><td>Add column to multi-sort</td></tr>
                  <tr><td>Funnel icon (▽) in header</td><td>Open column filter</td></tr>
                  <tr><td>Double-click header name</td><td>Rename column</td></tr>
                  <tr><td>Drag header edge</td><td>Resize column</td></tr>
                  <tr><td>Drag header</td><td>Reorder columns</td></tr>
                  <tr><td>Click any cell</td><td>Select that column (for − Col)</td></tr>
                  <tr><td>+ Col / − Col buttons</td><td>Add or remove a column</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpSectionSep} />

              <div className={styles.helpSection}>
                <h4>Freeze columns</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td>Right-click column header</td><td>Open freeze menu</td></tr>
                  <tr><td>Freeze up to here</td><td>Pin all columns from the left up to and including this one; they stay visible when scrolling right</td></tr>
                  <tr><td>Move freeze to here</td><td>Adjust the freeze boundary to this column</td></tr>
                  <tr><td>Unfreeze all columns</td><td>Remove all column pins</td></tr>
                  <tr><td>📌 icon in header</td><td>Indicates the column is currently frozen</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpSectionSep} />

              <div className={styles.helpSection}>
                <h4>Row numbers</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td># column (leftmost)</td><td>Shows the 1-based row position in the current view</td></tr>
                  <tr><td>After sorting or filtering</td><td>Row numbers update to reflect the displayed order</td></tr>
                  <tr><td>Not exported</td><td>The # column is display-only and excluded from all exports</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpGroupSep} />

              {/* ── Data & Analysis ────────────────────────────────────────── */}
              <div className={styles.helpSection}>
                <h4>Data type detection</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td>Detected on open</td><td>Each column is scanned when a file is loaded</td></tr>
                  <tr><td><code style={{fontFamily:'var(--font-mono)',fontSize:11}}>123</code> badge in header</td><td>Column values are all numeric — sort is 1, 2, 10 (not 1, 10, 2)</td></tr>
                  <tr><td><code style={{fontFamily:'var(--font-mono)',fontSize:11}}>date</code> badge in header</td><td>Column values are all dates — sort is chronological</td></tr>
                  <tr><td>No badge</td><td>Text column — sort is alphabetical</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpSectionSep} />

              <div className={styles.helpSection}>
                <h4>Column stats</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td>Click column header or any cell</td><td>Shows stats for that column in the status bar</td></tr>
                  <tr><td>Values · Unique · Empty</td><td>Always shown for any column type</td></tr>
                  <tr><td>Min · Max · Avg</td><td>Shown when all non-empty values are numeric</td></tr>
                  <tr><td>Stats update on filter/sort</td><td>Reflect only the currently visible rows</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpSectionSep} />

              <div className={styles.helpSection}>
                <h4>Conditional formatting</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td>CF button in toolbar</td><td>Toggle the conditional formatting bar on/off</td></tr>
                  <tr><td>Empty cells <span style={{display:'inline-block',width:10,height:10,background:'rgba(155,89,182,0.7)',borderRadius:2,verticalAlign:'middle'}} /></td><td>Highlights cells with no value in purple</td></tr>
                  <tr><td>Outliers (IQR) <span style={{display:'inline-block',width:10,height:10,background:'#27ae60',borderRadius:2,verticalAlign:'middle',marginRight:2}} /><span style={{display:'inline-block',width:10,height:10,background:'#c0392b',borderRadius:2,verticalAlign:'middle'}} /></td><td>Red = above Q3 + 1.5×IQR; Green = below Q1 − 1.5×IQR (per column)</td></tr>
                  <tr><td>Threshold</td><td>Enter a numeric comparison like <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>&gt; 100</code> or <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>!= 0</code> — matching cells highlighted amber</td></tr>
                  <tr><td>Operators</td><td><code style={{fontFamily:'var(--font-mono)',fontSize:11}}>&gt; &lt; &gt;= &lt;= = !=</code></td></tr>
                  <tr><td>Works with formulas</td><td>CF highlights based on the <em>evaluated result</em> of formula cells, not the raw formula string</td></tr>
                </tbody></table>
              </div>

              <div className={styles.helpGroupSep} />

              {/* ── Formulas ───────────────────────────────────────────────── */}
              <div className={styles.helpSection}>
                <h4>Formulas</h4>
                <table className={styles.helpTable}><tbody>
                  <tr><td>Enter a formula</td><td>Type <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>=</code> in a cell or the formula bar, then any Excel-style expression</td></tr>
                  <tr><td>Cell references</td><td><code style={{fontFamily:'var(--font-mono)',fontSize:11}}>A1</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>B3</code> — column letter (A, B, …) + row number (1-based, original order)</td></tr>
                  <tr><td>Ranges</td><td><code style={{fontFamily:'var(--font-mono)',fontSize:11}}>A1:A10</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>B2:D5</code></td></tr>
                  <tr><td>Math</td><td><code style={{fontFamily:'var(--font-mono)',fontSize:11}}>=A1+B1</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>=A1*2</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>=A1/B1</code></td></tr>
                  <tr><td>Common functions</td><td><code style={{fontFamily:'var(--font-mono)',fontSize:11}}>SUM</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>AVERAGE</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>COUNT</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>MIN</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>MAX</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>IF</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>VLOOKUP</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>CONCATENATE</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>LEN</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>ROUND</code>, …</td></tr>
                  <tr><td>Formula bar (ƒx)</td><td>Shows the raw formula of the focused cell; edit here and press <kbd style={{fontFamily:'var(--font-sans)',fontSize:11,padding:'1px 5px',border:'1px solid var(--separator)',borderRadius:3}}>Enter</kbd> to apply</td></tr>
                  <tr><td>Cell address (left of bar)</td><td>Shows A1-style address of the focused cell — matches the references you use in formulas</td></tr>
                  <tr><td><code style={{fontFamily:'var(--font-mono)',fontSize:11}}>A</code> badge in header</td><td>Column letter shown in each header — tells you which letter to use in formulas (A=1st column, B=2nd, …)</td></tr>
                  <tr><td>Fill handle (■ at cell corner)</td><td>Appears on focused formula cells — drag down/up to fill the formula into adjacent rows with shifted references (=B1*C1 → =B2*C2)</td></tr>
                  <tr><td>Error values</td><td><code style={{fontFamily:'var(--font-mono)',fontSize:11,color:'#e74c3c'}}>#DIV/0!</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11,color:'#e74c3c'}}>#VALUE!</code>, <code style={{fontFamily:'var(--font-mono)',fontSize:11,color:'#e74c3c'}}>#REF!</code> — shown in red italic when a formula fails</td></tr>
                  <tr><td>Exported value</td><td>Formulas are exported as raw strings (<code style={{fontFamily:'var(--font-mono)',fontSize:11}}>=SUM(A1:A5)</code>), not evaluated results</td></tr>
                </tbody></table>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Kbd({ children }) {
  return <kbd style={{
    background: 'var(--fill-3)', border: '1px solid var(--separator)',
    borderRadius: 3, padding: '1px 5px', fontSize: 11,
    fontFamily: 'var(--font-sans)', color: 'var(--color-label)',
    lineHeight: 1.4, display: 'inline-block', marginRight: 2,
  }}>{children}</kbd>
}
