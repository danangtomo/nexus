import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import * as echarts from 'echarts'
import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import {
  csvToRows, jsonToRows, xlsxToRows, buildTableSql, buildInsertPlaceholders,
  resultsToCSV, resultsToJSON, resultsToSQLInsert,
  sqlExamples, sanitizeName, inferColType,
  formatSQL, computeColStats, highlightSQL, buildChartOption, getDialectKeywords,
  detectExplainResult, buildExplainTree, buildPivotData,
} from './handler'
import ConnectionPanel from './ConnectionPanel'
import styles from './index.module.css'

const PAGE_SIZE = 200

// Dialect-aware identifier quoting (prevents SQL errors on reserved words)
function quoteIdent(name, dbType) {
  if (dbType === 'mssql')      return `[${name.replace(/]/g, ']]')}]`
  if (dbType === 'mysql')      return `\`${name.replace(/`/g, '``')}\``
  return `"${name.replace(/"/g, '""')}"` // postgresql, sqlite, default
}

const mkTab = (id, label) => ({
  id, label, sql: '', results: null, resultKey: 0, error: null, runTime: null, running: false,
})

// ── EXPLAIN tree ───────────────────────────────────────────────────────────────
function ExplainNode({ node, depth }) {
  const [open, setOpen] = useState(true)
  const hasKids = node.children && node.children.length > 0
  return (
    <div className={styles.explainNode} style={{ paddingLeft: depth * 18 }}>
      <div className={styles.explainRow}>
        {hasKids
          ? <button className={styles.explainToggle} onClick={() => setOpen(p => !p)}>{open ? '▼' : '▶'}</button>
          : <span className={styles.explainLeaf}>◆</span>
        }
        <span className={styles.explainDetail}>{node.detail}</span>
        {node.extra && <span className={styles.explainExtra}>{node.extra}</span>}
      </div>
      {open && hasKids && node.children.map((c, i) => (
        <ExplainNode key={i} node={c} depth={depth + 1} />
      ))}
    </div>
  )
}

function ExplainTree({ roots }) {
  return (
    <div className={styles.explainTree}>
      {roots.length === 0
        ? <div className={styles.explainEmpty}>No plan nodes to display</div>
        : roots.map((n, i) => <ExplainNode key={i} node={n} depth={0} />)
      }
    </div>
  )
}

// ── Pivot table ────────────────────────────────────────────────────────────────
function PivotTable({ columns, rows }) {
  const [rowFields, setRowFields] = useState([])
  const [colFields, setColFields] = useState([])
  const [valueField, setValueField] = useState(null)
  const [agg, setAgg] = useState('count')
  const dragField = useRef(null)

  const assigned = new Set([...rowFields, ...colFields, ...(valueField ? [valueField] : [])])
  const available = columns.filter(c => !assigned.has(c))

  const pivotData = useMemo(
    () => buildPivotData(rows, rowFields, colFields, valueField, agg),
    [rows, rowFields, colFields, valueField, agg]
  )

  function onDragStart(field, zone) { dragField.current = { field, zone } }

  function onDrop(to, e) {
    e.preventDefault()
    const src = dragField.current
    if (!src) return
    const { field, zone } = src
    if (zone === 'row') setRowFields(p => p.filter(f => f !== field))
    if (zone === 'col') setColFields(p => p.filter(f => f !== field))
    if (zone === 'value') setValueField(null)
    if (to === 'row')   setRowFields(p => p.includes(field) ? p : [...p, field])
    if (to === 'col')   setColFields(p => p.includes(field) ? p : [...p, field])
    if (to === 'value') setValueField(field)
    dragField.current = null
  }

  function removeField(field, zone) {
    if (zone === 'row') setRowFields(p => p.filter(f => f !== field))
    if (zone === 'col') setColFields(p => p.filter(f => f !== field))
    if (zone === 'value') setValueField(null)
  }

  function FieldChip({ field, zone, active }) {
    return (
      <div
        className={active ? styles.pivotChipActive : styles.pivotChip}
        draggable
        onDragStart={() => onDragStart(field, zone)}
      >
        {field}
        {active && (
          <button className={styles.pivotChipX} onClick={e => { e.stopPropagation(); removeField(field, zone) }}>×</button>
        )}
      </div>
    )
  }

  function DropZone({ zone, label, children, hint }) {
    const [over, setOver] = useState(false)
    return (
      <div className={styles.pivotZone}>
        <div className={styles.pivotZoneLabel}>{label}</div>
        <div
          className={`${styles.pivotDropZone} ${over ? styles.pivotDropOver : ''}`}
          onDragOver={e => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { setOver(false); onDrop(zone, e) }}
        >
          {children}
          {!children && <span className={styles.pivotDropHint}>{hint}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.pivotWrap}>
      <div className={styles.pivotConfig}>
        <DropZone zone="available" label="Fields" hint="—">
          {available.length > 0 && available.map(f => <FieldChip key={f} field={f} zone="available" />)}
        </DropZone>
        <DropZone zone="row" label="Rows" hint="Drop field here">
          {rowFields.length > 0 && rowFields.map(f => <FieldChip key={f} field={f} zone="row" active />)}
        </DropZone>
        <DropZone zone="col" label="Columns" hint="Drop field here">
          {colFields.length > 0 && colFields.map(f => <FieldChip key={f} field={f} zone="col" active />)}
        </DropZone>
        <DropZone zone="value" label="Values" hint="Drop field here">
          {valueField && <FieldChip key={valueField} field={valueField} zone="value" active />}
        </DropZone>
        <div className={styles.pivotZone}>
          <div className={styles.pivotZoneLabel}>Aggregate</div>
          <select className={styles.pivotAgg} value={agg} onChange={e => setAgg(e.target.value)}>
            {['count','sum','avg','min','max'].map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      {pivotData ? (
        <div className={styles.pivotTableWrap}>
          <table className={styles.pivotTable}>
            <thead>
              <tr>
                <th className={styles.pivotTh0}>{pivotData.rowLabel}</th>
                {pivotData.colVals.map(cv => <th key={cv} className={styles.pivotTh}>{cv || '(blank)'}</th>)}
              </tr>
            </thead>
            <tbody>
              {pivotData.pivotRows.map((row, i) => (
                <tr key={i} className={i % 2 ? styles.trOdd : styles.trEven}>
                  <td className={styles.pivotRowKey}>{row._rk || '(blank)'}</td>
                  {pivotData.colVals.map(cv => (
                    <td key={cv} className={styles.pivotVal}>
                      {row[cv] == null ? '' : typeof row[cv] === 'number' && !Number.isInteger(row[cv])
                        ? row[cv].toFixed(2) : row[cv]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.pivotEmpty}>
          Drag fields from Fields → Rows and Values to build the pivot table
        </div>
      )}
    </div>
  )
}

// ── ER diagram ────────────────────────────────────────────────────────────────
function ErDiagram({ tables, foreignKeys, onClose }) {
  const BOX_W    = 180
  const HEADER_H = 28
  const COL_H    = 20
  const BOX_PAD  = 10
  const MAX_COLS = 8
  const COLS_PER_ROW = 3
  const H_GAP = 80
  const V_GAP = 44

  const [expanded, setExpanded] = useState({})
  const [zoom, setZoom]         = useState(1)
  const [pan,  setPan]          = useState({ x: 24, y: 24 })

  // Refs that mirror state so stable event handlers always read current values
  const zoomRef       = useRef(1)
  const panRef        = useRef({ x: 24, y: 24 })
  const canvasRef     = useRef(null)
  const boxDragRef    = useRef(null)   // { name, ox, oy }
  const canvasDragRef = useRef(null)   // { startX, startY, panX, panY }

  useEffect(() => { zoomRef.current = zoom },    [zoom])
  useEffect(() => { panRef.current  = pan  },    [pan])

  function visCount(t) { return expanded[t.name] ? t.columns.length : Math.min(t.columns.length, MAX_COLS) }
  function tableH(t)   { return HEADER_H + visCount(t) * COL_H + BOX_PAD }

  // Infer FK relationships from {table}_id naming when no explicit FKs exist
  const inferredFKs = useMemo(() => {
    if (foreignKeys.length > 0) return []
    const result = []
    for (const t of tables) {
      for (const col of t.columns) {
        if (!col.name.toLowerCase().endsWith('_id')) continue
        const prefix = col.name.slice(0, -3).toLowerCase()
        const match = tables.find(other =>
          other.name !== t.name && (
            other.name.toLowerCase() === prefix ||
            other.name.toLowerCase() + 's' === prefix ||
            other.name.toLowerCase() === prefix + 's'
          )
        )
        if (match) {
          const toCol = match.columns.find(c => c.name.toLowerCase() === 'id')
          result.push({ fromTable: t.name, fromCol: col.name, toTable: match.name, toCol: toCol?.name ?? 'id', inferred: true })
        }
      }
    }
    return result
  }, [tables, foreignKeys.length])

  const allFKs = foreignKeys.length > 0 ? foreignKeys : inferredFKs

  // Cardinality: junction table (≥2 FK cols, ≤ FK count + 2 total cols) → M:N, else 1:N
  function getCardinality(fk) {
    const fromT = tables.find(t => t.name === fk.fromTable)
    if (!fromT) return { fromLabel: 'N', toLabel: '1' }
    const fksFromT   = allFKs.filter(f => f.fromTable === fk.fromTable)
    const idLikeCols = fromT.columns.filter(c => c.name.toLowerCase().endsWith('_id') || c.name.toLowerCase() === 'id')
    if (fksFromT.length >= 2 && fromT.columns.length <= fksFromT.length + 2 && idLikeCols.length >= 2) {
      return { fromLabel: 'M', toLabel: 'N' }
    }
    return { fromLabel: 'N', toLabel: '1' }
  }

  function initPos() {
    const p = {}
    tables.forEach((t, i) => {
      const col = i % COLS_PER_ROW
      const row = Math.floor(i / COLS_PER_ROW)
      p[t.name] = { x: col * (BOX_W + H_GAP), y: row * (180 + V_GAP) }
    })
    return p
  }

  const [pos, setPos] = useState(initPos)
  useEffect(() => { setPos(initPos()) }, [tables.length])

  // Convert screen coords → content coords (accounting for pan + zoom)
  function toContent(screenX, screenY) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (screenX - rect.left - panRef.current.x) / zoomRef.current,
      y: (screenY - rect.top  - panRef.current.y) / zoomRef.current,
    }
  }

  // Shared mouse handlers — stable effect, reads current values via refs
  useEffect(() => {
    function onMove(e) {
      if (boxDragRef.current) {
        const { name, ox, oy } = boxDragRef.current
        const c = toContent(e.clientX, e.clientY)
        setPos(p => ({ ...p, [name]: { x: c.x - ox, y: c.y - oy } }))
      } else if (canvasDragRef.current) {
        const { startX, startY, panX, panY } = canvasDragRef.current
        const np = { x: panX + (e.clientX - startX), y: panY + (e.clientY - startY) }
        panRef.current = np
        setPan(np)
      }
    }
    function onUp() { boxDragRef.current = null; canvasDragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',  onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // Wheel zoom — non-passive, zooms around the cursor position
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    function onWheel(e) {
      e.preventDefault()
      const rect   = canvas.getBoundingClientRect()
      const mx     = e.clientX - rect.left
      const my     = e.clientY - rect.top
      const delta  = e.deltaY < 0 ? 0.1 : -0.1
      setZoom(z => {
        const nz    = +(Math.max(0.2, Math.min(4, z + delta)).toFixed(2))
        const scale = nz / z
        zoomRef.current = nz
        // Keep the point under the cursor fixed
        const np = { x: mx - scale * (mx - panRef.current.x), y: my - scale * (my - panRef.current.y) }
        panRef.current = np
        setPan(np)
        return nz
      })
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  function adjZoom(delta) {
    const canvas = canvasRef.current
    const cx = canvas ? canvas.clientWidth  / 2 : 0
    const cy = canvas ? canvas.clientHeight / 2 : 0
    setZoom(z => {
      const nz    = +(Math.max(0.2, Math.min(4, z + delta)).toFixed(1))
      const scale = nz / z
      zoomRef.current = nz
      const np = { x: cx - scale * (cx - panRef.current.x), y: cy - scale * (cy - panRef.current.y) }
      panRef.current = np
      setPan(np)
      return nz
    })
  }

  function resetView() {
    setZoom(1); zoomRef.current = 1
    const np = { x: 24, y: 24 }; panRef.current = np; setPan(np)
  }

  function renderArrow(fk, fi) {
    const fp = pos[fk.fromTable]; const tp = pos[fk.toTable]
    if (!fp || !tp || fk.fromTable === fk.toTable) return null
    const fromT = tables.find(t => t.name === fk.fromTable)
    const toT   = tables.find(t => t.name === fk.toTable)
    if (!fromT || !toT) return null
    const fci = fromT.columns.findIndex(c => c.name === fk.fromCol)
    const tci = toT.columns.findIndex(c => c.name === fk.toCol)
    const fy = fp.y + HEADER_H + (fci >= 0 ? Math.min(fci, visCount(fromT) - 1) : 0) * COL_H + COL_H / 2
    const ty = tp.y + HEADER_H + (tci >= 0 ? Math.min(tci, visCount(toT)  - 1) : 0) * COL_H + COL_H / 2
    const goRight = fp.x >= tp.x
    const fx = goRight ? fp.x : fp.x + BOX_W
    const tx = goRight ? tp.x + BOX_W : tp.x
    const mx = (fx + tx) / 2
    const { fromLabel, toLabel } = getCardinality(fk)
    const isInf  = !!fk.inferred
    const color  = isInf ? 'var(--text-secondary)' : 'var(--accent)'
    const nLabelX   = goRight ? fx - 8 : fx + 8
    const nLabelA   = goRight ? 'end'   : 'start'
    const oneLabelX = goRight ? tx + 8  : tx - 8
    const oneLabelA = goRight ? 'start' : 'end'
    return (
      <g key={`fk-${fi}`}>
        <path d={`M${fx},${fy} C${mx},${fy} ${mx},${ty} ${tx},${ty}`}
          fill="none" stroke={color}
          strokeWidth={isInf ? '1.5' : '2'}
          opacity={isInf ? '0.6' : '0.9'}
          strokeDasharray={isInf ? '6,3' : 'none'}
          markerEnd={isInf ? 'url(#er-arrow-inf)' : 'url(#er-arrow)'} />
        <text x={nLabelX} y={fy - 4} textAnchor={nLabelA}
          fill={color} fontSize="10" fontWeight="700"
          fontFamily="system-ui,sans-serif" opacity={isInf ? '0.75' : '1'}>
          {fromLabel}
        </text>
        <text x={oneLabelX} y={ty - 4} textAnchor={oneLabelA}
          fill={color} fontSize="10" fontWeight="700"
          fontFamily="system-ui,sans-serif" opacity={isInf ? '0.75' : '1'}>
          {toLabel}
        </text>
      </g>
    )
  }

  const relHint = foreignKeys.length > 0
    ? `${foreignKeys.length} FK relation${foreignKeys.length !== 1 ? 's' : ''}`
    : inferredFKs.length > 0
    ? `${inferredFKs.length} inferred relation${inferredFKs.length !== 1 ? 's' : ''} (via _id columns)`
    : 'no relations found'

  return (
    <div className={styles.erWrap}>
      <div className={styles.erToolbar}>
        <span className={styles.erTitle}>ER Diagram</span>
        <span className={styles.erHint}>
          Drag canvas to pan · drag entity to move · {tables.length} table{tables.length !== 1 ? 's' : ''} · {relHint}
        </span>
        <div className={styles.erZoom}>
          <button onClick={() => adjZoom(0.2)}>+</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => adjZoom(-0.2)}>−</button>
          <button onClick={resetView}>1:1</button>
        </div>
        <button className={styles.erClose} onClick={onClose}>✕ Close</button>
      </div>
      {/* SVG fills the container; pan+zoom applied via <g> transform — no scrollbars needed */}
      <div className={styles.erCanvas} ref={canvasRef}>
        <svg width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <marker id="er-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <polygon points="0 0, 8 4, 0 8" fill="var(--accent)" />
            </marker>
            <marker id="er-arrow-inf" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <polygon points="0 0, 8 4, 0 8" fill="var(--text-secondary)" opacity="0.7" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Large transparent background — clicking empty space starts canvas pan */}
            <rect x="-9999" y="-9999" width="19998" height="19998"
              fill="transparent" style={{ cursor: 'grab' }}
              onMouseDown={e => {
                e.preventDefault()
                canvasDragRef.current = { startX: e.clientX, startY: e.clientY, panX: panRef.current.x, panY: panRef.current.y }
              }} />

            {/* Arrows behind boxes */}
            {allFKs.map((fk, fi) => renderArrow(fk, fi))}

            {/* Table boxes */}
            {tables.map(t => {
              const p = pos[t.name]; if (!p) return null
              const vc   = visCount(t)
              const h    = tableH(t)
              const more = t.columns.length - vc
              const isExp = !!expanded[t.name]
              return (
                <g key={t.name} style={{ cursor: 'grab', userSelect: 'none' }}
                  onMouseDown={e => {
                    e.preventDefault()
                    e.stopPropagation()  // don't let click bubble to background pan rect
                    const c = toContent(e.clientX, e.clientY)
                    boxDragRef.current = { name: t.name, ox: c.x - p.x, oy: c.y - p.y }
                  }}>
                  <rect x={p.x + 3} y={p.y + 3} width={BOX_W} height={h} rx="7" fill="rgba(0,0,0,0.13)" />
                  <rect x={p.x} y={p.y} width={BOX_W} height={h} rx="7" fill="var(--bg-secondary)" stroke="var(--border)" strokeWidth="1.5" />
                  <rect x={p.x} y={p.y} width={BOX_W} height={HEADER_H} rx="7" fill="var(--accent)" opacity="0.9" />
                  <rect x={p.x} y={p.y + HEADER_H - 7} width={BOX_W} height={7} fill="var(--accent)" opacity="0.9" />
                  <text x={p.x + BOX_W / 2} y={p.y + HEADER_H * 0.68}
                    textAnchor="middle" fill="white" fontSize="11" fontWeight="700"
                    fontFamily="system-ui,sans-serif">
                    {t.name.length > 22 ? t.name.slice(0, 21) + '…' : t.name}
                  </text>
                  <line x1={p.x} y1={p.y + HEADER_H} x2={p.x + BOX_W} y2={p.y + HEADER_H} stroke="var(--border)" strokeWidth="1" />
                  {t.columns.slice(0, vc).map((c, ci) => (
                    <g key={c.name}>
                      <text x={p.x + 10} y={p.y + HEADER_H + ci * COL_H + COL_H * 0.68}
                        fill="var(--color-label)" fontSize="10"
                        fontFamily="'Menlo','Consolas',monospace">
                        {c.name.length > 17 ? c.name.slice(0, 16) + '…' : c.name}
                      </text>
                      <text x={p.x + BOX_W - 7} y={p.y + HEADER_H + ci * COL_H + COL_H * 0.68}
                        textAnchor="end" fill="var(--accent)" fontSize="9" opacity="0.7"
                        fontFamily="system-ui,sans-serif">
                        {c.type.length > 10 ? c.type.slice(0, 9) : c.type}
                      </text>
                    </g>
                  ))}
                  {t.columns.length > MAX_COLS && (
                    <text
                      x={p.x + BOX_W / 2} y={p.y + HEADER_H + vc * COL_H + COL_H * 0.62}
                      textAnchor="middle" fill="var(--accent)" fontSize="9"
                      fontFamily="system-ui,sans-serif" style={{ cursor: 'pointer' }}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); setExpanded(prev => ({ ...prev, [t.name]: !isExp })) }}>
                      {isExp ? '▲ show less' : `+${more} more`}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}

// ── Multi-result tabs ──────────────────────────────────────────────────────────
function MultiResults({ sets }) {
  const [tab, setTab] = useState(0)
  return (
    <div className={styles.multiWrap}>
      <div className={styles.multiTabs}>
        {sets.map((s, i) => (
          <button key={i} className={tab === i ? styles.multiTabActive : styles.multiTab}
            onClick={() => setTab(i)}>
            Result {i + 1}
            <span className={styles.multiCount}>{s.rows.length.toLocaleString()}</span>
          </button>
        ))}
      </div>
      <ResultsTable results={sets[tab]} />
    </div>
  )
}

// ── Chart panel ────────────────────────────────────────────────────────────────
function ChartPanel({ results }) {
  const [type, setType] = useState('bar')
  const domRef   = useRef(null)
  const chartRef = useRef(null)
  const option   = useMemo(() => buildChartOption(results, type), [results, type])

  // Add inside dataZoom (mouse-wheel zoom + drag-to-pan) for non-pie charts
  const optWithZoom = useMemo(() => {
    if (!option || type === 'pie') return option
    return {
      ...option,
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        { type: 'inside', yAxisIndex: 0 },
      ],
    }
  }, [option, type])

  useEffect(() => {
    if (!domRef.current) return
    if (!chartRef.current) chartRef.current = echarts.init(domRef.current, null, { renderer: 'canvas' })
    optWithZoom ? chartRef.current.setOption(optWithZoom, true) : chartRef.current.clear()
  }, [optWithZoom])

  // Resize ECharts whenever the canvas element changes size
  useEffect(() => {
    const el = domRef.current; if (!el) return
    const ro = new ResizeObserver(() => chartRef.current?.resize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => () => { chartRef.current?.dispose(); chartRef.current = null }, [])

  return (
    <div className={styles.chartPanel}>
      <div className={styles.chartTypes}>
        {['bar','line','pie','scatter'].map(t => (
          <button key={t} className={type === t ? styles.chartTypeActive : styles.chartTypeBtn}
            onClick={() => setType(t)}>{t}</button>
        ))}
        {!option && <span className={styles.chartHint}>Need text + numeric columns to chart</span>}
      </div>
      <div ref={domRef} className={styles.chartCanvas} />
    </div>
  )
}

// ── Results table ──────────────────────────────────────────────────────────────
function ResultsTable({ results }) {
  const { columns, rows } = results
  const [viewMode,  setViewMode]  = useState('table') // 'table'|'tree'|'pivot'
  const [sortCol,   setSortCol]   = useState(null)
  const [sortDir,   setSortDir]   = useState('asc')
  const [search,    setSearch]    = useState('')
  const [page,      setPage]      = useState(0)
  const [copied,    setCopied]    = useState(null)
  const [tooltip,   setTooltip]   = useState(null)
  const [showChart, setShowChart] = useState(false)
  const [copyAllOk, setCopyAllOk] = useState(false)
  const tipTimer = useRef(null)

  const explainType = useMemo(() => detectExplainResult(columns), [columns])
  const explainRoots = useMemo(
    () => explainType ? buildExplainTree(columns, rows, explainType) : [],
    [columns, rows, explainType]
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r => columns.some(c => String(r[c] ?? '').toLowerCase().includes(q)))
  }, [rows, columns, search])

  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortCol]; const bv = b[sortCol]
      if (av == null && bv == null) return 0
      if (av == null) return 1; if (bv == null) return -1
      const an = parseFloat(av); const bn = parseFloat(bv)
      const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageRows   = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
    setPage(0)
  }

  function copyCell(val, key) {
    navigator.clipboard.writeText(String(val ?? '')).then(() => {
      setCopied(key); setTimeout(() => setCopied(null), 1000)
    })
  }

  function copyAll() {
    navigator.clipboard.writeText(resultsToCSV(columns, rows)).then(() => {
      setCopyAllOk(true); setTimeout(() => setCopyAllOk(false), 1500)
    })
  }

  function onHeaderEnter(col, e) {
    const rect = e.currentTarget.getBoundingClientRect()
    clearTimeout(tipTimer.current)
    tipTimer.current = setTimeout(() => {
      setTooltip({ col, stats: computeColStats(col, rows), x: rect.left, y: rect.bottom + 6 })
    }, 300)
  }
  const onHeaderLeave = () => { clearTimeout(tipTimer.current); setTooltip(null) }

  return (
    <div className={styles.resultsWrap}>
      <div className={styles.resultsToolbar}>
        {viewMode === 'table' && (
          <input className={styles.searchInput} placeholder="Filter rows…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} />
        )}
        {viewMode === 'table' && search && (
          <span className={styles.filterCount}>{sorted.length.toLocaleString()} / {rows.length.toLocaleString()}</span>
        )}
        <div className={styles.resultsActions}>
          {viewMode === 'table' && (
            <button className={copyAllOk ? styles.copyDoneBtn : styles.rBtn} onClick={copyAll}>
              {copyAllOk ? '✓ Copied' : 'Copy All'}
            </button>
          )}
          {viewMode === 'table' && (
            <button className={showChart ? styles.rBtnActive : styles.rBtn}
              onClick={() => setShowChart(p => !p)}>Chart</button>
          )}
          {explainType && (
            <button className={viewMode === 'tree' ? styles.rBtnActive : styles.rBtn}
              onClick={() => setViewMode(v => v === 'tree' ? 'table' : 'tree')}>
              Tree View
            </button>
          )}
          <button className={viewMode === 'pivot' ? styles.rBtnActive : styles.rBtn}
            onClick={() => setViewMode(v => v === 'pivot' ? 'table' : 'pivot')}>
            Pivot
          </button>
        </div>
      </div>

      {viewMode === 'tree' && (
        <ExplainTree roots={explainRoots} />
      )}

      {viewMode === 'pivot' && (
        <PivotTable columns={columns} rows={rows} />
      )}

      {viewMode === 'table' && (<>
        {showChart ? <ChartPanel results={results} /> : (<>

        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thNum}>#</th>
                {columns.map(c => (
                  <th key={c} className={styles.th}
                    onClick={() => handleSort(c)}
                    onMouseEnter={e => onHeaderEnter(c, e)}
                    onMouseLeave={onHeaderLeave}>
                    <span className={styles.thLabel}>{c}</span>
                    <span className={styles.sortIco}>{sortCol === c ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => {
                const abs = page * PAGE_SIZE + i + 1
                return (
                  <tr key={i} className={i % 2 ? styles.trOdd : styles.trEven}>
                    <td className={styles.tdNum}>{abs}</td>
                    {columns.map(c => {
                      const key = `${c}:${abs}`
                      return (
                        <td key={c} className={styles.td}
                          onClick={() => copyCell(row[c], key)} title="Click to copy">
                          {copied === key
                            ? <span className={styles.copied}>✓</span>
                            : row[c] == null
                            ? <span className={styles.nullVal}>NULL</span>
                            : String(row[c])}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn} onClick={() => setPage(0)}            disabled={page === 0}>«</button>
            <button className={styles.pageBtn} onClick={() => setPage(p => p - 1)}   disabled={page === 0}>‹</button>
            <span className={styles.pageInfo}>Page {page + 1} / {totalPages} · {sorted.length.toLocaleString()} rows</span>
            <button className={styles.pageBtn} onClick={() => setPage(p => p + 1)}   disabled={page >= totalPages - 1}>›</button>
            <button className={styles.pageBtn} onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</button>
          </div>
        )}
        </>)}
      </>)}

      {tooltip && (
        <div className={styles.tooltip} style={{ left: tooltip.x, top: tooltip.y }}>
          <div className={styles.tipTitle}>{tooltip.col}</div>
          <div className={styles.tipRow}><span>Rows</span><span>{tooltip.stats.total.toLocaleString()}</span></div>
          <div className={styles.tipRow}><span>Non-null</span><span>{tooltip.stats.count.toLocaleString()}</span></div>
          <div className={styles.tipRow}><span>Nulls</span><span>{tooltip.stats.nulls}</span></div>
          <div className={styles.tipRow}><span>Unique</span><span>{tooltip.stats.unique.toLocaleString()}</span></div>
          {tooltip.stats.min != null && <>
            <div className={styles.tipDivider} />
            <div className={styles.tipRow}><span>Min</span><span>{+tooltip.stats.min.toFixed(6)}</span></div>
            <div className={styles.tipRow}><span>Max</span><span>{+tooltip.stats.max.toFixed(6)}</span></div>
            <div className={styles.tipRow}><span>Avg</span><span>{+tooltip.stats.avg.toFixed(6)}</span></div>
          </>}
        </div>
      )}
    </div>
  )
}

// ── Schema panel helpers ───────────────────────────────────────────────────────
function SectionHead({ id, label, count, collapsed, onToggle }) {
  return (
    <div className={styles.sectionHead} onClick={() => onToggle(id)}>
      <span className={styles.sectionArrow}>{collapsed.has(id) ? '▶' : '▼'}</span>
      <span className={styles.sectionLabel}>{label}</span>
      <span className={styles.sectionCount}>{count}</span>
    </div>
  )
}

// ── Schema panel ───────────────────────────────────────────────────────────────
function SchemaPanel({
  tables, views, functions, procedures, databases, currentDb,
  examples, savedQueries, tableDetails, onLoadTableIndexes,
  onInsertTable, onInsertColumn, onExampleClick,
  onRemoveTable, onLoadSaved, onDeleteSaved, onSwitchDb,
  sidebarCollapsed, onToggleCollapse,
}) {
  const [collapsed,   setCollapsed]   = useState(new Set())
  const [openTables,  setOpenTables]  = useState(new Set())
  const [search, setSearch]           = useState('')

  const toggleSection = k => setCollapsed(p => { const s = new Set(p); s.has(k) ? s.delete(k) : s.add(k); return s })

  const toggleTable = tName => {
    const wasOpen = openTables.has(tName)
    setOpenTables(p => { const s = new Set(p); wasOpen ? s.delete(tName) : s.add(tName); return s })
    if (!wasOpen && onLoadTableIndexes && (tableDetails || {})[tName] === undefined) {
      onLoadTableIndexes(tName)
    }
  }

  const q = search.toLowerCase()
  const match = name => !q || name.toLowerCase().includes(q)

  const filteredTables = tables.filter(t => match(t.name))
  const filteredViews  = (views      || []).filter(v => match(v.name))
  const filteredFns    = (functions  || []).filter(f => match(f.name))
  const filteredProcs  = (procedures || []).filter(p => match(p.name))

  return (
    <aside className={`${styles.schema} ${sidebarCollapsed ? styles.schemaCollapsed : ''}`}>

      {/* Collapse / expand toggle — always visible */}
      <div className={styles.schemaCollapseRow}>
        {!sidebarCollapsed && <span className={styles.schemaLabel}>Schema</span>}
        <button className={styles.schemaCollapseBtn} onClick={onToggleCollapse}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {sidebarCollapsed ? '›' : '‹'}
        </button>
      </div>

      {!sidebarCollapsed && (<>
      {/* DB switcher + search — sticky so always visible when scrolling */}
      <div className={styles.schemaFixedTop}>
        {databases && databases.length > 0 && (
          <div className={styles.dbSwitcher}>
            <select className={styles.dbSelect} value={currentDb || ''} onChange={e => onSwitchDb(e.target.value)}>
              {databases.map(db => <option key={db} value={db}>{db}</option>)}
            </select>
          </div>
        )}
        <div className={styles.schemaSearchWrap}>
          <input className={styles.schemaSearchInput} placeholder="Search…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className={styles.schemaSearchClear} onClick={() => setSearch('')}>✕</button>}
        </div>
      </div>

      <div className={styles.schemaContent}>

      <SectionHead id="tables" label="Tables" count={filteredTables.length} collapsed={collapsed} onToggle={toggleSection} />
      {!collapsed.has('tables') && (<>
        {!filteredTables.length && <div className={styles.schemaEmpty}>{search ? 'No match' : 'No tables'}</div>}
        {filteredTables.map(t => {
          const detail  = (tableDetails || {})[t.name]
          const indexes = detail?.indexes ?? null
          return (
            <div key={t.name} className={styles.schemaTable}>
              <div className={styles.schemaTableHeader}>
                <button className={styles.schemaArrow} onClick={() => toggleTable(t.name)}>
                  {openTables.has(t.name) ? '▼' : '▶'}
                </button>
                <button className={styles.schemaTName} onClick={() => onInsertTable(t.name)}
                  title="SELECT * FROM this table">{t.name}</button>
                <span className={styles.schemaRows}>{t.rowCount.toLocaleString()} r · {t.columns.length} c</span>
                {onRemoveTable && (
                  <button className={styles.schemaRemove} onClick={() => onRemoveTable(t.name)}>✕</button>
                )}
              </div>
              {openTables.has(t.name) && (
                <div className={styles.schemaCols}>
                  {t.columns.map(c => (
                    <button key={c.name} className={styles.schemaCol}
                      onClick={() => onInsertColumn(c.name)} title={`Insert "${c.name}"`}>
                      <span className={styles.colName}>{c.name}</span>
                      <span className={styles.colType}>{c.type}</span>
                    </button>
                  ))}
                  {/* Indexes sub-section */}
                  {indexes === null && (
                    <div className={styles.schemaIndexHint}>Loading indexes…</div>
                  )}
                  {indexes && indexes.length > 0 && (
                    <div className={styles.schemaIndexSection}>
                      <div className={styles.schemaIndexTitle}>Indexes</div>
                      {indexes.map(idx => (
                        <div key={idx.name} className={styles.schemaIndex}
                          title={`Columns: ${idx.columns.join(', ')}`}>
                          <span className={`${styles.idxIcon} ${idx.primary ? styles.idxPK : idx.unique ? styles.idxUQ : ''}`}>
                            {idx.primary ? 'PK' : idx.unique ? 'UQ' : 'IX'}
                          </span>
                          <span className={styles.idxName}>{idx.name}</span>
                          <span className={styles.idxCols}>{idx.columns.join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {indexes && indexes.length === 0 && (
                    <div className={styles.schemaIndexHint}>No indexes</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </>)}

      {views && (<>
        <div className={styles.schemaDivider} />
        <SectionHead id="views" label="Views" count={filteredViews.length} collapsed={collapsed} onToggle={toggleSection} />
        {!collapsed.has('views') && (<>
          {!filteredViews.length && <div className={styles.schemaEmpty}>{search ? 'No match' : 'No views'}</div>}
          {filteredViews.map(v => (
            <button key={v.name} className={styles.schemaSimpleItem}
              onClick={() => onInsertTable(v.name)} title="SELECT * FROM this view">
              <span className={styles.siIcon}>V</span>{v.name}
            </button>
          ))}
        </>)}
      </>)}

      {functions && (<>
        <div className={styles.schemaDivider} />
        <SectionHead id="functions" label="Functions" count={filteredFns.length} collapsed={collapsed} onToggle={toggleSection} />
        {!collapsed.has('functions') && (<>
          {!filteredFns.length && <div className={styles.schemaEmpty}>{search ? 'No match' : 'No functions'}</div>}
          {filteredFns.map(f => (
            <button key={f.name} className={styles.schemaSimpleItem}
              onClick={() => onInsertColumn(f.name + '()')} title="Insert function at cursor">
              <span className={styles.siIcon}>F</span>{f.name}
            </button>
          ))}
        </>)}
      </>)}

      {procedures && (<>
        <div className={styles.schemaDivider} />
        <SectionHead id="procedures" label="Procedures" count={filteredProcs.length} collapsed={collapsed} onToggle={toggleSection} />
        {!collapsed.has('procedures') && (<>
          {!filteredProcs.length && <div className={styles.schemaEmpty}>{search ? 'No match' : 'No procedures'}</div>}
          {filteredProcs.map(p => (
            <button key={p.name} className={styles.schemaSimpleItem}
              onClick={() => onInsertColumn(p.name)} title="Insert procedure name at cursor">
              <span className={styles.siIcon}>P</span>{p.name}
            </button>
          ))}
        </>)}
      </>)}

      {savedQueries.length > 0 && (<>
        <div className={styles.schemaDivider} />
        <div className={styles.schemaTitle}>Saved Queries</div>
        {savedQueries.map(q => (
          <div key={q.id} className={styles.savedQuery}>
            <button className={styles.savedName} onClick={() => onLoadSaved(q.sql)} title={q.sql}>{q.name}</button>
            <button className={styles.savedDel} onClick={() => onDeleteSaved(q.id)}>✕</button>
          </div>
        ))}
      </>)}

      {examples.length > 0 && (<>
        <div className={styles.schemaDivider} />
        <div className={styles.schemaTitle}>Examples</div>
        {examples.map(ex => (
          <button key={ex.label} className={styles.exampleBtn} onClick={() => onExampleClick(ex.sql)}>
            {ex.label}
          </button>
        ))}
      </>)}

      </div>
      </>)}

    </aside>
  )
}

// ── Dropdown helper ────────────────────────────────────────────────────────────
function Dropdown({ label, disabled, items, right }) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 'auto', right: 'auto' })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const handleOpen = () => {
    if (disabled) return
    if (!open) {
      const r = btnRef.current.getBoundingClientRect()
      setMenuPos(right
        ? { top: r.bottom + 4, left: 'auto', right: window.innerWidth - r.right }
        : { top: r.bottom + 4, left: r.left, right: 'auto' })
    }
    setOpen(p => !p)
  }

  useEffect(() => {
    if (!open) return
    const h = e => {
      if (!btnRef.current?.contains(e.target) && !menuRef.current?.contains(e.target))
        setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div className={styles.dropWrap}>
      <button ref={btnRef} className={styles.actionBtn} onClick={handleOpen} disabled={disabled}>
        {label} ▾
      </button>
      {open && (
        <div ref={menuRef} className={styles.dropMenu}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, right: menuPos.right, zIndex: 1000 }}>
          {items.map(item => (
            <button key={item.label} className={styles.dropItem}
              onClick={() => { item.action(); setOpen(false) }}>{item.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SqlRunner() {
  // ── File mode state ───────────────────────────────────────────────────────────
  const [sqlReady, setSqlReady]   = useState(false)
  const [initErr,  setInitErr]    = useState(null)
  const [tables,   setTables]     = useState([])
  const [loading,  setLoading]    = useState(false)

  // ── Server mode state ─────────────────────────────────────────────────────────
  const [mode,             setMode]           = useState('file')
  const [connList,         setConnList]        = useState([])
  const [activeConnId,     setActiveConnId]    = useState(null)
  const [activeConnMeta,   setActiveConnMeta]  = useState(null)
  const [serverTables,     setServerTables]    = useState([])
  const [serverViews,      setServerViews]     = useState(null)
  const [serverFns,        setServerFns]       = useState(null)
  const [serverProcs,      setServerProcs]     = useState(null)
  const [databases,        setDatabases]       = useState(null)
  const [activeConnConfig, setActiveConnConfig]= useState(null)
  const [showConnPanel,    setShowConnPanel]   = useState(false)
  const [serverLoading,    setServerLoading]   = useState(false)
  const [pingHealth,       setPingHealth]      = useState(null)
  const [pingMs,           setPingMs]          = useState(null)

  // ── Query tabs ────────────────────────────────────────────────────────────────
  const tabCount = useRef(2)
  const [tabs,         setTabs]         = useState([mkTab('1', 'Query 1')])
  const [activeTabId,  setActiveTabId]  = useState('1')
  const [editingTabId, setEditingTabId] = useState(null)
  const [editingLabel, setEditingLabel] = useState('')

  // ── Shared state ──────────────────────────────────────────────────────────────
  const [history,         setHistory]         = useState([])
  const [status,          setStatus]          = useState('')
  const [savedQueries,    setSavedQueries]    = useState([])
  const [saveMode,        setSaveMode]        = useState(false)
  const [saveName,        setSaveName]        = useState('')
  const [ac,              setAc]              = useState(null)
  const [schemaCollapsed, setSchemaCollapsed] = useState(false)

  // ── Schema extras: indexes + ER ───────────────────────────────────────────────
  const [tableDetails, setTableDetails] = useState({}) // {tableName: {indexes: [...]}}
  const [foreignKeys,  setForeignKeys]  = useState([])
  const [erView,       setErView]       = useState(false)
  const fkLoadedRef = useRef(false)

  const SQLRef          = useRef(null)
  const dbRef           = useRef(null)
  const editorRef       = useRef(null)
  const highlightRef    = useRef(null)
  const charW           = useRef(7.8)
  const acRef           = useRef(null)
  const activeConnIdRef = useRef(null)

  const activeTab   = tabs.find(t => t.id === activeTabId) ?? tabs[0]
  const highlighted = useMemo(() => highlightSQL(activeTab.sql) + '\n', [activeTab.sql])

  useEffect(() => { activeConnIdRef.current = activeConnId }, [activeConnId])

  useEffect(() => {
    return () => {
      if (activeConnIdRef.current) {
        window.nexus.dbconn.disconnect(activeConnIdRef.current).catch(() => {})
      }
    }
  }, [])

  // ── Connection health ping ────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeConnId) { setPingHealth(null); setPingMs(null); return }
    let cancelled = false
    async function ping() {
      const t0 = performance.now()
      try {
        const res = await window.nexus.dbconn.query(activeConnId, 'SELECT 1')
        if (cancelled) return
        const ms = Math.round(performance.now() - t0)
        if (res.ok) { setPingMs(ms); setPingHealth(ms < 400 ? 'ok' : 'slow') }
        else         { setPingHealth('error'); setPingMs(null) }
      } catch { if (!cancelled) { setPingHealth('error'); setPingMs(null) } }
    }
    ping()
    const id = setInterval(ping, 30000)
    return () => { cancelled = true; clearInterval(id) }
  }, [activeConnId])

  // ── Init sql.js ───────────────────────────────────────────────────────────────
  useEffect(() => {
    initSqlJs({ locateFile: () => sqlWasmUrl })
      .then(SQL => { SQLRef.current = SQL; dbRef.current = new SQL.Database(); setSqlReady(true) })
      .catch(e => setInitErr('SQL engine failed to initialize: ' + e.message))
  }, [])

  // ── Load saved state ──────────────────────────────────────────────────────────
  useEffect(() => {
    window.nexus.getPref('sqlrunner_saved').then(raw => {
      if (raw) try { setSavedQueries(JSON.parse(raw)) } catch (_) {}
    })
    window.nexus.getPref('sqlrunner_connections').then(raw => {
      if (raw) try { setConnList(JSON.parse(raw)) } catch (_) {}
    })
  }, [])

  useEffect(() => {
    const span = document.createElement('span')
    span.style.cssText = 'position:absolute;visibility:hidden;font-family:Menlo,Monaco,"Cascadia Code",Consolas,monospace;font-size:13px;white-space:pre'
    span.textContent = 'M'.repeat(20)
    document.body.appendChild(span)
    charW.current = span.offsetWidth / 20
    document.body.removeChild(span)
  }, [])

  const flash = useCallback(msg => { setStatus(msg); setTimeout(() => setStatus(''), 2500) }, [])

  // ── Scroll sync ───────────────────────────────────────────────────────────────
  function syncScroll() {
    if (highlightRef.current && editorRef.current) {
      highlightRef.current.style.transform =
        `translate(-${editorRef.current.scrollLeft}px, -${editorRef.current.scrollTop}px)`
    }
  }

  // ── Autocomplete ──────────────────────────────────────────────────────────────
  function checkAc(el) {
    const pos = el.selectionStart
    const textBefore = el.value.slice(0, pos)
    const wordMatch = textBefore.match(/(\w+)$/)
    if (!wordMatch || wordMatch[1].length < 1) { setAc(null); return }

    const partial   = wordMatch[1]
    const wordStart = pos - partial.length
    const context   = textBefore.slice(0, wordStart).trimEnd().toUpperCase()
    const afterTableKw = /\b(FROM|JOIN|INTO|UPDATE|TABLE)\s*$/.test(context)

    const activeTables  = mode === 'server' ? serverTables : tables
    const tableNames    = activeTables.map(t => t.name)
    const colNames      = [...new Set(activeTables.flatMap(t => t.columns.map(c => c.name)))]
    const dialectType   = mode === 'server' ? (activeConnMeta?.type ?? 'sqlite') : 'sqlite'
    const pool = afterTableKw
      ? tableNames
      : [...tableNames, ...colNames, ...getDialectKeywords(dialectType)]

    const filtered = [...new Set(pool)]
      .filter(s => s.toLowerCase().startsWith(partial.toLowerCase()) && s.toLowerCase() !== partial.toLowerCase())
      .slice(0, 9)

    if (!filtered.length) { setAc(null); return }

    const rect  = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    const lineH   = parseFloat(style.lineHeight) || 21
    const padTop  = parseFloat(style.paddingTop) || 12
    const padLeft = parseFloat(style.paddingLeft) || 16
    const lines   = textBefore.split('\n')
    const lineNum = lines.length - 1
    const colNum  = lines[lines.length - 1].length

    const rawLeft = rect.left + padLeft + colNum * charW.current - el.scrollLeft
    const left = Math.min(rawLeft, rect.right - 220)
    const top  = rect.top + padTop + (lineNum + 1) * lineH - el.scrollTop

    setAc({ suggestions: filtered, pos: { left, top }, wordStart, selIdx: 0 })
  }

  function applyAc(word, wordStart) {
    const el  = editorRef.current
    const pos = el?.selectionStart ?? activeTab.sql.length
    const next = activeTab.sql.slice(0, wordStart) + word + activeTab.sql.slice(pos) + ' '
    setTabs(p => p.map(t => t.id === activeTabId ? { ...t, sql: next } : t))
    setAc(null)
    requestAnimationFrame(() => {
      el?.focus()
      if (el) el.selectionStart = el.selectionEnd = wordStart + word.length + 1
    })
  }

  function insertAtCursor(text) {
    const el = editorRef.current
    const s  = el?.selectionStart ?? activeTab.sql.length
    const e  = el?.selectionEnd   ?? activeTab.sql.length
    const next = activeTab.sql.slice(0, s) + text + activeTab.sql.slice(e)
    setTabs(p => p.map(t => t.id === activeTabId ? { ...t, sql: next } : t))
    requestAnimationFrame(() => { el?.focus(); if (el) el.selectionStart = el.selectionEnd = s + text.length })
  }

  // ── Tab management ────────────────────────────────────────────────────────────
  function addTab() {
    const id    = Date.now().toString()
    const label = `Query ${tabCount.current++}`
    setTabs(prev => [...prev, mkTab(id, label)])
    setActiveTabId(id)
    setAc(null)
  }

  function closeTab(id, e) {
    e?.stopPropagation()
    if (tabs.length <= 1) return
    const idx  = tabs.findIndex(t => t.id === id)
    const next = tabs.filter(t => t.id !== id)
    setTabs(next)
    if (activeTabId === id) setActiveTabId(next[Math.max(0, idx - 1)].id)
    if (editingTabId === id) { setEditingTabId(null); setEditingLabel('') }
    setAc(null)
  }

  function startRenameTab(id) {
    const t = tabs.find(t => t.id === id)
    setEditingTabId(id)
    setEditingLabel(t?.label ?? '')
  }

  function commitRenameTab() {
    if (editingTabId && editingLabel.trim()) {
      setTabs(prev => prev.map(t => t.id === editingTabId ? { ...t, label: editingLabel.trim() } : t))
    }
    setEditingTabId(null)
    setEditingLabel('')
  }

  // ── File mode: load data ──────────────────────────────────────────────────────
  async function ingestData(nameHint, columns, rows, targetTabId) {
    const tId = targetTabId ?? activeTabId
    const tableName = sanitizeName(nameHint)
    try { dbRef.current.run(`DROP TABLE IF EXISTS "${tableName}";`) } catch (_) {}
    dbRef.current.run(buildTableSql(tableName, columns, rows))
    const colMeta = columns.map(c => ({ name: c, type: inferColType(c, rows) }))
    if (rows.length) {
      const { cols, placeholders } = buildInsertPlaceholders(columns)
      const stmt = dbRef.current.prepare(`INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders})`)
      dbRef.current.run('BEGIN;')
      for (const row of rows) {
        stmt.run(colMeta.map(({ name, type }) => {
          const v = row[name]
          if (v == null || v === '') return null
          if (type === 'INTEGER') return parseInt(v, 10)
          if (type === 'REAL')    return parseFloat(v)
          return String(v)
        }))
      }
      dbRef.current.run('COMMIT;')
      stmt.free()
    }
    const numericCols = colMeta.filter(c => c.type !== 'TEXT').map(c => c.name)
    setTables(prev => [
      ...prev.filter(t => t.name !== tableName),
      { name: tableName, columns: colMeta, rowCount: rows.length, numericCols },
    ])
    setTableDetails(p => { const n = { ...p }; delete n[tableName]; return n }) // clear stale detail
    fkLoadedRef.current = false
    setTabs(p => p.map(t => t.id === tId
      ? { ...t, sql: `SELECT * FROM "${tableName}"\nLIMIT 100;`, results: null }
      : t
    ))
    flash(`Loaded "${tableName}" — ${rows.length.toLocaleString()} rows, ${columns.length} columns`)
  }

  async function loadFile(type) {
    const tabId  = activeTabId
    const extMap = { csv: ['csv','tsv','txt'], json: ['json'], xlsx: ['xlsx','xls'] }
    const fp = await window.nexus.openFile({ filters: [{ name: type.toUpperCase(), extensions: extMap[type] }] })
    if (!fp) return
    setLoading(true)
    setTabs(p => p.map(t => t.id === tabId ? { ...t, error: null } : t))
    try {
      if (type === 'xlsx') {
        const { columns, rows } = xlsxToRows(await window.nexus.readFile(fp, 'base64'))
        await ingestData(fp, columns, rows, tabId)
      } else {
        const text = await window.nexus.readFile(fp, 'utf8')
        const { columns, rows } = type === 'csv' ? csvToRows(text) : jsonToRows(text)
        await ingestData(fp, columns, rows, tabId)
      }
    } catch (e) {
      setTabs(p => p.map(t => t.id === tabId ? { ...t, error: 'Load failed: ' + e.message } : t))
    } finally { setLoading(false) }
  }

  async function pasteCSV() {
    const tabId = activeTabId
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) { flash('Clipboard is empty'); return }
      const { columns, rows } = csvToRows(text)
      await ingestData('clipboard_data', columns, rows, tabId)
    } catch (e) {
      setTabs(p => p.map(t => t.id === tabId ? { ...t, error: 'Paste failed: ' + e.message } : t))
    }
  }

  // ── Server mode: connection lifecycle ─────────────────────────────────────────
  function applySchema(res) {
    if (!res.ok) return
    setServerTables(res.tables   ?? [])
    setServerViews(res.views     ?? [])
    setServerFns(res.functions   ?? [])
    setServerProcs(res.procedures ?? [])
    setTableDetails({})
    fkLoadedRef.current = false
  }

  async function connectToDb(config) {
    const tabId = activeTabId
    setServerLoading(true)
    setTabs(p => p.map(t => t.id === tabId ? { ...t, error: null } : t))
    try {
      if (activeConnId) {
        await window.nexus.dbconn.disconnect(activeConnId).catch(() => {})
        setActiveConnId(null); setActiveConnMeta(null)
        setServerTables([]); setServerViews(null); setServerFns(null); setServerProcs(null)
        setDatabases(null)
      }
      const res = await window.nexus.dbconn.connect(config)
      if (!res.ok) {
        setTabs(p => p.map(t => t.id === tabId ? { ...t, error: res.error } : t))
        return
      }

      setActiveConnId(res.connId)
      setActiveConnMeta({ name: config.name, type: config.type, database: config.database })
      setActiveConnConfig(config)

      const [schemaRes, dbRes] = await Promise.all([
        window.nexus.dbconn.schema(res.connId),
        window.nexus.dbconn.databases(res.connId),
      ])
      applySchema(schemaRes)
      if (dbRes.ok) setDatabases(dbRes.list)
      setTabs(p => p.map(t => t.id === tabId
        ? { ...t,
            sql: schemaRes.ok && schemaRes.tables.length > 0
              ? `SELECT * FROM ${quoteIdent(schemaRes.tables[0].name, config.type)}\nLIMIT 100;`
              : t.sql,
            results: null }
        : t
      ))
      setShowConnPanel(false)
      flash(`Connected to ${config.name}`)
    } catch (e) {
      setTabs(p => p.map(t => t.id === tabId ? { ...t, error: 'Connection failed: ' + e.message } : t))
    } finally { setServerLoading(false) }
  }

  async function disconnectFromDb() {
    if (!activeConnId) return
    await window.nexus.dbconn.disconnect(activeConnId).catch(() => {})
    setActiveConnId(null); setActiveConnMeta(null); setActiveConnConfig(null)
    setServerTables([]); setServerViews(null); setServerFns(null); setServerProcs(null)
    setDatabases(null); setPingHealth(null); setPingMs(null)
    setTableDetails({}); setForeignKeys([]); fkLoadedRef.current = false
    setTabs(p => p.map(t => ({ ...t, results: null, error: null, runTime: null })))
    flash('Disconnected')
  }

  async function refreshSchema() {
    if (!activeConnId) return
    const tabId = activeTabId
    const [schemaRes, dbRes] = await Promise.all([
      window.nexus.dbconn.schema(activeConnId),
      window.nexus.dbconn.databases(activeConnId),
    ])
    applySchema(schemaRes)
    if (dbRes.ok) setDatabases(dbRes.list)
    if (schemaRes.ok) flash('Schema refreshed')
    else setTabs(p => p.map(t => t.id === tabId ? { ...t, error: schemaRes.error } : t))
  }

  async function switchDatabase(dbName) {
    if (!activeConnId || dbName === activeConnMeta?.database) return
    const tabId = activeTabId
    const type = activeConnMeta?.type
    if (type === 'postgresql') {
      await connectToDb({ ...activeConnConfig, database: dbName })
      return
    }
    const useQ = type === 'mssql' ? `USE [${dbName}]` : `USE \`${dbName}\``
    const res = await window.nexus.dbconn.query(activeConnId, useQ)
    if (!res.ok) { setTabs(p => p.map(t => t.id === tabId ? { ...t, error: res.error } : t)); return }
    setActiveConnMeta(prev => ({ ...prev, database: dbName }))
    setActiveConnConfig(prev => ({ ...prev, database: dbName }))
    const [schemaRes, dbRes] = await Promise.all([
      window.nexus.dbconn.schema(activeConnId),
      window.nexus.dbconn.databases(activeConnId),
    ])
    applySchema(schemaRes)
    if (dbRes.ok) setDatabases(dbRes.list)
    setTabs(p => p.map(t => t.id === tabId ? { ...t, results: null } : t))
    flash(`Switched to: ${dbName}`)
  }

  // ── Connection list persistence ───────────────────────────────────────────────
  async function saveConnection(config) {
    const next = connList.some(c => c.id === config.id)
      ? connList.map(c => c.id === config.id ? config : c)
      : [...connList, config]
    setConnList(next)
    await window.nexus.setPref('sqlrunner_connections', JSON.stringify(next))
  }

  async function deleteConnection(id) {
    const next = connList.filter(c => c.id !== id)
    setConnList(next)
    await window.nexus.setPref('sqlrunner_connections', JSON.stringify(next))
  }

  // ── Mode switch ───────────────────────────────────────────────────────────────
  async function switchMode(newMode) {
    if (newMode === mode) return
    if (newMode === 'file' && activeConnId) await disconnectFromDb()
    setMode(newMode)
    setTabs(p => p.map(t => ({ ...t, results: null, error: null, running: false })))
    setErView(false)
  }

  // ── Indexes: lazy load per table ──────────────────────────────────────────────
  async function loadTableIndexes(tableName) {
    setTableDetails(p => ({ ...p, [tableName]: null })) // null = loading
    try {
      if (mode === 'file') {
        const listRes = dbRef.current.exec(`PRAGMA index_list("${tableName.replace(/"/g, '""')}")`)
        if (!listRes.length) { setTableDetails(p => ({ ...p, [tableName]: { indexes: [] } })); return }
        const { columns: lc, values: lv } = listRes[0]
        const idxList = lv.map(v => Object.fromEntries(lc.map((c, i) => [c, v[i]])))
        const indexes = []
        for (const idx of idxList) {
          const infoRes = dbRef.current.exec(`PRAGMA index_info("${String(idx.name).replace(/"/g, '""')}")`)
          const infoCols = infoRes.length ? infoRes[0].values.map(v => v[2]) : []
          indexes.push({ name: idx.name, unique: idx.unique === 1 || idx.unique === '1', primary: false, columns: infoCols })
        }
        setTableDetails(p => ({ ...p, [tableName]: { indexes } }))
      } else if (activeConnId) {
        const res = await window.nexus.dbconn.indexes(activeConnId, tableName)
        setTableDetails(p => ({ ...p, [tableName]: { indexes: res.ok ? res.indexes : [] } }))
      }
    } catch (_) {
      setTableDetails(p => ({ ...p, [tableName]: { indexes: [] } }))
    }
  }

  // ── FK load (for ER diagram) ──────────────────────────────────────────────────
  async function loadForeignKeys() {
    if (fkLoadedRef.current) return
    fkLoadedRef.current = true
    try {
      if (mode === 'file') {
        const activeTbls = tables
        const fks = []
        for (const t of activeTbls) {
          try {
            const res = dbRef.current.exec(`PRAGMA foreign_key_list("${t.name.replace(/"/g, '""')}")`)
            if (!res.length) continue
            const { columns: fc, values: fv } = res[0]
            for (const v of fv) {
              const row = Object.fromEntries(fc.map((c, i) => [c, v[i]]))
              fks.push({ fromTable: t.name, fromCol: row.from, toTable: row.table, toCol: row.to })
            }
          } catch (_) {}
        }
        setForeignKeys(fks)
      } else if (activeConnId) {
        const res = await window.nexus.dbconn.foreignkeys(activeConnId)
        if (res.ok) setForeignKeys(res.fks)
      }
    } catch (_) {}
  }

  function toggleErView() {
    const next = !erView
    setErView(next)
    if (next) loadForeignKeys()
  }

  // ── Run query ─────────────────────────────────────────────────────────────────
  async function runQuery(sqlText) {
    const tabId = activeTabId
    const q = (sqlText ?? activeTab.sql).trim()
    if (!q) return

    const markOk  = (res, ms) => setTabs(p => p.map(t => t.id === tabId
      ? { ...t, results: res, error: null, runTime: ms, running: false, resultKey: t.resultKey + 1 }
      : t))
    const markErr = (msg, ms) => setTabs(p => p.map(t => t.id === tabId
      ? { ...t, results: null, error: msg, runTime: ms, running: false }
      : t))

    setTabs(p => p.map(t => t.id === tabId ? { ...t, error: null, running: true } : t))
    if (erView) setErView(false) // dismiss ER view when running a query
    const t0 = performance.now()

    if (mode === 'server') {
      if (!activeConnId) {
        flash('Not connected — click Connect to choose a database')
        setTabs(p => p.map(t => t.id === tabId ? { ...t, running: false } : t))
        return
      }
      try {
        const res = await window.nexus.dbconn.query(activeConnId, q)
        const ms  = performance.now() - t0
        if (!res.ok) { markErr(res.error, ms); return }
        const newResults = res.sets.length === 0
          ? { single: true, columns: ['Result'], rows: [{ Result: 'Query executed successfully' }] }
          : res.sets.length === 1
          ? { single: true, ...res.sets[0] }
          : { multi: true, sets: res.sets }
        markOk(newResults, ms)
        setHistory(prev => [q, ...prev.filter(h => h !== q)].slice(0, 10))
        const useMatch = q.match(/^\s*USE\s+[`\[]?([^`\];\s]+)[`\]]?\s*;?\s*$/i)
        if (useMatch) await switchDatabase(useMatch[1])
      } catch (e) { markErr(e.message, performance.now() - t0) }
      return
    }

    if (!sqlReady) return
    try {
      const allRes = dbRef.current.exec(q)
      const ms     = performance.now() - t0
      let newResults
      if (allRes.length === 0) {
        newResults = { single: true, columns: ['Result'], rows: [{ Result: 'Query executed successfully' }] }
      } else if (allRes.length === 1) {
        const r = allRes[0]
        newResults = { single: true, columns: r.columns, rows: r.values.map(vs => Object.fromEntries(r.columns.map((c, i) => [c, vs[i]]))) }
      } else {
        newResults = { multi: true, sets: allRes.map(r => ({ columns: r.columns, rows: r.values.map(vs => Object.fromEntries(r.columns.map((c, i) => [c, vs[i]]))) })) }
      }
      markOk(newResults, ms)
      setHistory(prev => [q, ...prev.filter(h => h !== q)].slice(0, 10))
    } catch (e) { markErr(e.message, performance.now() - t0) }
  }

  function runSelected() {
    const el  = editorRef.current
    const sel = el ? activeTab.sql.slice(el.selectionStart, el.selectionEnd).trim() : ''
    runQuery(sel || activeTab.sql)
  }

  function handleExplain() {
    if (mode === 'server') {
      const type = activeConnMeta?.type
      if (type === 'mssql') { flash('SQL Server: add SET SHOWPLAN_TEXT ON; GO before your query manually'); return }
      runQuery(`EXPLAIN ${activeTab.sql.trim().replace(/^EXPLAIN\s*/i, '')}`)
      return
    }
    runQuery(`EXPLAIN QUERY PLAN ${activeTab.sql.trim().replace(/^EXPLAIN\s+(QUERY\s+PLAN\s+)?/i, '')}`)
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────────
  function handleKey(e) {
    if (ac) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAc(p => ({ ...p, selIdx: (p.selIdx + 1) % p.suggestions.length })); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setAc(p => ({ ...p, selIdx: (p.selIdx - 1 + p.suggestions.length) % p.suggestions.length })); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyAc(ac.suggestions[ac.selIdx], ac.wordStart); return }
      if (e.key === 'Escape') { setAc(null); return }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runSelected(); return }
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = e.target; const s = el.selectionStart; const end = el.selectionEnd
      const next = activeTab.sql.slice(0, s) + '  ' + activeTab.sql.slice(end)
      setTabs(p => p.map(t => t.id === activeTabId ? { ...t, sql: next } : t))
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2 })
    }
  }

  function handleChange(e) {
    setTabs(p => p.map(t => t.id === activeTabId ? { ...t, sql: e.target.value } : t))
    checkAc(e.target)
  }

  // ── Export ────────────────────────────────────────────────────────────────────
  async function exportAs(fmt) {
    const { results } = activeTab
    if (!results) return
    const activeTables = mode === 'server' ? serverTables : tables
    const lastName = activeTables[0]?.name ?? 'results'
    const rowData  = results.single ? results.rows : (results.sets?.[0]?.rows ?? [])
    const colData  = results.single ? results.columns : (results.sets?.[0]?.columns ?? [])
    const map = {
      csv:  { data: resultsToCSV(colData, rowData),                 ext: 'csv',  name: 'query_results.csv' },
      json: { data: resultsToJSON(rowData),                         ext: 'json', name: 'query_results.json' },
      sql:  { data: resultsToSQLInsert(lastName, colData, rowData), ext: 'sql',  name: 'query_results.sql' },
    }
    const { data, ext, name: defaultPath } = map[fmt]
    const fp = await window.nexus.saveFile({ defaultPath, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] })
    if (!fp) return
    await window.nexus.writeFile(fp, data)
    flash('Saved ' + fp.split(/[\\/]/).pop())
  }

  // ── Save queries ──────────────────────────────────────────────────────────────
  async function doSave() {
    if (!saveName.trim() || !activeTab.sql.trim()) return
    const q    = { id: Date.now().toString(), name: saveName.trim(), sql: activeTab.sql.trim() }
    const next = [...savedQueries, q]
    setSavedQueries(next); await window.nexus.setPref('sqlrunner_saved', JSON.stringify(next))
    setSaveMode(false); setSaveName(''); flash(`Saved "${q.name}"`)
  }

  async function deleteSaved(id) {
    const next = savedQueries.filter(q => q.id !== id)
    setSavedQueries(next); await window.nexus.setPref('sqlrunner_saved', JSON.stringify(next))
  }

  // ── File mode: table actions ──────────────────────────────────────────────────
  function removeTable(name) {
    try { dbRef.current.run(`DROP TABLE IF EXISTS "${name}";`) } catch (_) {}
    setTables(prev => prev.filter(t => t.name !== name))
    setTableDetails(p => { const n = { ...p }; delete n[name]; return n })
    setTabs(p => p.map(t => t.id === activeTabId ? { ...t, results: null } : t))
  }

  function clearAll() {
    tables.forEach(t => { try { dbRef.current.run(`DROP TABLE IF EXISTS "${t.name}";`) } catch (_) {} })
    dbRef.current = new SQLRef.current.Database()
    setTables([])
    setTableDetails({}); setForeignKeys([]); fkLoadedRef.current = false
    setTabs([mkTab('1', 'Query 1')])
    setActiveTabId('1')
    tabCount.current = 2
    setHistory([])
    setAc(null)
    setErView(false)
  }

  // ── Derived values ────────────────────────────────────────────────────────────
  const activeTables   = mode === 'server' ? serverTables : tables
  const examples       = sqlExamples(activeTables)
  const hasData        = tables.length > 0
  const isConnected    = mode === 'server' && !!activeConnId
  const runDisabled    = activeTab.running || (mode === 'file' ? (!sqlReady || !activeTab.sql.trim()) : (!activeConnId || !activeTab.sql.trim()))
  const explainDisabled = runDisabled

  const loadItems = [
    { label: 'CSV / TSV',                action: () => loadFile('csv')  },
    { label: 'JSON',                     action: () => loadFile('json') },
    { label: 'Excel (.xlsx)',            action: () => loadFile('xlsx') },
    { label: 'Paste CSV from clipboard', action: pasteCSV               },
  ]
  const exportItems = [
    { label: 'Export as CSV',        action: () => exportAs('csv') },
    { label: 'Export as JSON',       action: () => exportAs('json') },
    { label: 'Export as SQL INSERT', action: () => exportAs('sql') },
  ]

  const statusText = activeTab.results
    ? activeTab.results.multi
      ? `${activeTab.results.sets.length} result sets · ${activeTab.results.sets.reduce((s, r) => s + r.rows.length, 0).toLocaleString()} total rows · ${activeTab.runTime?.toFixed(1)} ms`
      : `${activeTab.results.rows.length.toLocaleString()} row${activeTab.results.rows.length !== 1 ? 's' : ''} · ${activeTab.runTime?.toFixed(1)} ms`
    : null

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.root} onClick={() => { if (ac) setAc(null) }}>

      {showConnPanel && (
        <ConnectionPanel
          connections={connList}
          onClose={() => setShowConnPanel(false)}
          onConnect={connectToDb}
          onSave={saveConnection}
          onDelete={deleteConnection}
        />
      )}

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.modeTabs}>
            <button className={mode === 'file'   ? styles.modeTabActive : styles.modeTab} onClick={() => switchMode('file')}>File</button>
            <button className={mode === 'server' ? styles.modeTabActive : styles.modeTab} onClick={() => switchMode('server')}>Server</button>
          </div>
          <div className={styles.sep} />

          {mode === 'file' && (<>
            <Dropdown label={loading ? 'Loading…' : 'Load'} disabled={!sqlReady || loading} items={loadItems} />
            {hasData && (<>
              <div className={styles.sep} />
              {tables.map(t => (
                <span key={t.name} className={styles.chip}>
                  {t.name} <span className={styles.chipMeta}>{t.rowCount.toLocaleString()} × {t.columns.length}</span>
                </span>
              ))}
            </>)}
          </>)}

          {mode === 'server' && (<>
            <button className={styles.actionBtn} onClick={() => setShowConnPanel(true)} disabled={serverLoading}>
              {serverLoading ? 'Connecting…' : isConnected ? 'Connections' : 'Connect ▾'}
            </button>
            {isConnected && (<>
              <div className={styles.sep} />
              <span
                className={styles.serverChip}
                style={
                  pingHealth === 'slow'  ? { '--chip-color': '#f59e0b' } :
                  pingHealth === 'error' ? { '--chip-color': '#e05555' } :
                  undefined
                }
              >
                <span
                  className={
                    pingHealth === 'ok'    ? styles.serverDotOk    :
                    pingHealth === 'slow'  ? styles.serverDotSlow  :
                    pingHealth === 'error' ? styles.serverDotError :
                    styles.serverDot
                  }
                  title={
                    pingHealth === 'ok'    ? `Connected · ${pingMs}ms` :
                    pingHealth === 'slow'  ? `Slow connection · ${pingMs}ms` :
                    pingHealth === 'error' ? 'Connection lost or unreachable' :
                    'Checking connection…'
                  }
                />
                {activeConnMeta?.name}
                <span className={styles.chipMeta}>{activeConnMeta?.database}</span>
                {pingMs != null && pingHealth !== 'error' && <span className={styles.pingMs}>{pingMs}ms</span>}
                {pingHealth === 'error' && <span className={styles.pingMs}>offline</span>}
              </span>
              <button className={styles.actionBtn} onClick={refreshSchema} title="Reload schema from server">↺</button>
              <button className={styles.disconnectBtn} onClick={disconnectFromDb}>Disconnect</button>
            </>)}
          </>)}
        </div>

        <div className={styles.toolbarRight}>
          <button className={styles.actionBtn}
            onClick={() => setTabs(p => p.map(t => t.id === activeTabId ? { ...t, sql: formatSQL(t.sql) } : t))}
            disabled={!activeTab.sql.trim()}>Format</button>
          <button className={styles.actionBtn} onClick={handleExplain} disabled={explainDisabled}>Explain</button>
          <button
            className={erView ? styles.erBtnActive : styles.actionBtn}
            onClick={toggleErView}
            title="Show ER diagram of table relationships"
            disabled={activeTables.length === 0}
          >
            ER
          </button>
          <div className={styles.sep} />
          {saveMode ? (
            <div className={styles.saveRow}>
              <input autoFocus className={styles.saveInput} placeholder="Query name…"
                value={saveName} onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doSave(); if (e.key === 'Escape') { setSaveMode(false); setSaveName('') } }} />
              <button className={styles.primaryBtn} onClick={doSave} disabled={!saveName.trim()}>Save</button>
              <button className={styles.actionBtn} onClick={() => { setSaveMode(false); setSaveName('') }}>✕</button>
            </div>
          ) : (
            <button className={styles.actionBtn} onClick={() => setSaveMode(true)} disabled={!activeTab.sql.trim()}>Save Query</button>
          )}
          <div className={styles.sep} />
          <button className={styles.primaryBtn} onClick={runSelected} disabled={runDisabled}>
            {activeTab.running ? '…' : '▶ Run'}
          </button>
          <Dropdown label="Export" disabled={!activeTab.results} items={exportItems} right />
          {mode === 'file' && (
            <button className={styles.actionBtn} onClick={clearAll} disabled={!hasData && !activeTab.sql && !history.length}>Clear</button>
          )}
          {status && <span className={styles.statusMsg}>{status}</span>}
        </div>
      </div>

      {initErr && mode === 'file' && <div className={styles.initErr}>{initErr}</div>}

      {/* Main content */}
      <div className={styles.content}>
        <div className={styles.leftPanel}>

          {/* Query tab bar */}
          <div className={styles.queryTabBar}>
            {tabs.map(t => (
              <div
                key={t.id}
                className={t.id === activeTabId ? styles.queryTabActive : styles.queryTab}
                onClick={() => { setActiveTabId(t.id); setAc(null) }}>
                {editingTabId === t.id ? (
                  <input
                    autoFocus
                    className={styles.queryTabRenameInput}
                    value={editingLabel}
                    onChange={e => setEditingLabel(e.target.value)}
                    onBlur={commitRenameTab}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRenameTab()
                      if (e.key === 'Escape') { setEditingTabId(null); setEditingLabel('') }
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className={styles.queryTabLabel}
                    onDoubleClick={e => { e.stopPropagation(); startRenameTab(t.id) }}>
                    {t.label}
                  </span>
                )}
                {t.running && <span className={styles.queryTabRunning}>●</span>}
                {tabs.length > 1 && (
                  <button className={styles.queryTabClose} onClick={e => closeTab(t.id, e)} title="Close tab">×</button>
                )}
              </div>
            ))}
            <button className={styles.queryTabAdd} onClick={addTab} title="New query tab">+</button>
          </div>

          {/* Editor with syntax highlighting overlay */}
          <div className={styles.editorWrap}>
            <div className={styles.highlight} ref={highlightRef} aria-hidden="true">
              <div className={styles.highlightInner} dangerouslySetInnerHTML={{ __html: highlighted }} />
            </div>
            <textarea
              ref={editorRef}
              className={styles.editor}
              value={activeTab.sql}
              onChange={handleChange}
              onKeyDown={handleKey}
              onScroll={syncScroll}
              onBlur={() => setTimeout(() => setAc(null), 150)}
              placeholder={
                mode === 'server'
                  ? (!isConnected ? 'Connect to a database first…' : 'Write SQL for your connected database…')
                  : (!sqlReady ? 'Initializing SQL engine…' : 'SELECT * FROM mytable LIMIT 100;')
              }
              spellCheck={false}
              disabled={mode === 'file' ? !sqlReady : !isConnected}
            />
            {ac && (
              <div ref={acRef} className={styles.acDrop}
                style={{ left: ac.pos.left, top: ac.pos.top }}
                onMouseDown={e => e.preventDefault()}>
                {ac.suggestions.map((s, i) => (
                  <div key={s}
                    className={i === ac.selIdx ? styles.acItemSel : styles.acItem}
                    onMouseEnter={() => setAc(p => ({ ...p, selIdx: i }))}
                    onMouseDown={() => applyAc(s, ac.wordStart)}>
                    {s}
                  </div>
                ))}
                <div className={styles.acHint}>↑↓ navigate · Enter/Tab select · Esc close</div>
              </div>
            )}
          </div>

          {/* Shortcut bar */}
          <div className={styles.shortcutBar}>
            <span className={styles.kbd}>Ctrl+Enter</span> run · select text to run selection ·
            <span className={styles.kbd}>Tab/Enter</span> accept autocomplete ·
            <span className={styles.kbd}>Format</span> beautify ·
            double-click tab to rename
            {mode === 'server' && activeConnMeta && (
              <span className={styles.dbDialectHint}> · dialect: {activeConnMeta.type}</span>
            )}
          </div>

          {/* Status bar */}
          <div className={styles.statusBar}>
            {activeTab.error
              ? <span className={styles.errText}>{activeTab.error}</span>
              : activeTab.running
              ? <span className={styles.hintText}>Running query…</span>
              : statusText
              ? <span className={styles.okText}>{statusText}</span>
              : <span className={styles.hintText}>
                  {mode === 'file'
                    ? (!sqlReady ? 'Initializing…' : !hasData ? 'Use Load ▾ to open a file' : 'Ctrl+Enter to run')
                    : (!isConnected ? 'Click Connect ▾ to connect to a database' : 'Ctrl+Enter to run')}
                </span>
            }
          </div>

          {/* Results or ER diagram */}
          <div className={styles.resultsArea}>
            {erView ? (
              <ErDiagram
                tables={activeTables}
                foreignKeys={foreignKeys}
                onClose={() => setErView(false)}
              />
            ) : activeTab.results ? (
              activeTab.results.multi
                ? <MultiResults key={activeTab.resultKey} sets={activeTab.results.sets} />
                : <ResultsTable key={activeTab.resultKey} results={activeTab.results} />
            ) : (
              <div className={styles.emptyState}>
                {mode === 'server' && !isConnected ? (<>
                  <div className={styles.emptyIcon}>⚡</div>
                  <div className={styles.emptyTitle}>Not connected</div>
                  <div className={styles.emptyHint}>Click <strong>Connect ▾</strong> to connect to PostgreSQL, MySQL, MariaDB, or SQL Server</div>
                </>) : mode === 'server' ? (<>
                  <div className={styles.emptyIcon}>▶</div>
                  <div className={styles.emptyTitle}>Run a query</div>
                  <div className={styles.emptyHint}>Write SQL using your database's native syntax · Ctrl+Enter to run</div>
                </>) : !hasData ? (<>
                  <div className={styles.emptyIcon}>⌗</div>
                  <div className={styles.emptyTitle}>No data loaded</div>
                  <div className={styles.emptyHint}>Use <strong>Load ▾</strong> to open a CSV, JSON, or Excel file as a SQL table</div>
                </>) : (<>
                  <div className={styles.emptyIcon}>▶</div>
                  <div className={styles.emptyTitle}>Run a query to see results</div>
                  <div className={styles.emptyHint}>Click an example in the panel or write your own SQL · Run two SELECT statements at once to compare</div>
                </>)}
              </div>
            )}
          </div>

        </div>

        <SchemaPanel
          tables={activeTables}
          views={mode === 'server' ? serverViews : null}
          functions={mode === 'server' ? serverFns : null}
          procedures={mode === 'server' ? serverProcs : null}
          databases={mode === 'server' ? databases : null}
          currentDb={activeConnMeta?.database}
          examples={examples}
          savedQueries={savedQueries}
          tableDetails={tableDetails}
          onLoadTableIndexes={loadTableIndexes}
          onInsertTable={name => setTabs(p => p.map(t => t.id === activeTabId
            ? { ...t, sql: `SELECT * FROM ${quoteIdent(name, activeConnMeta?.type ?? 'sqlite')}\nLIMIT 100;` }
            : t
          ))}
          onInsertColumn={col => insertAtCursor(quoteIdent(col, activeConnMeta?.type ?? 'sqlite'))}
          onExampleClick={q => setTabs(p => p.map(t => t.id === activeTabId
            ? { ...t, sql: q, results: null, error: null }
            : t
          ))}
          onRemoveTable={mode === 'file' ? removeTable : null}
          onLoadSaved={q => setTabs(p => p.map(t => t.id === activeTabId
            ? { ...t, sql: q, results: null, error: null }
            : t
          ))}
          onDeleteSaved={deleteSaved}
          onSwitchDb={switchDatabase}
          sidebarCollapsed={schemaCollapsed}
          onToggleCollapse={() => setSchemaCollapsed(p => !p)}
        />
      </div>

      {/* History bar */}
      {history.length > 0 && (
        <div className={styles.history}>
          <span className={styles.historyLabel}>History</span>
          {history.map((h, i) => (
            <button key={i} className={styles.historyBtn}
              onClick={() => setTabs(p => p.map(t => t.id === activeTabId ? { ...t, sql: h, error: null } : t))}
              title={h}>
              {h.replace(/\s+/g, ' ').slice(0, 55)}{h.replace(/\s+/g, ' ').length > 55 ? '…' : ''}
            </button>
          ))}
        </div>
      )}

    </div>
  )
}
