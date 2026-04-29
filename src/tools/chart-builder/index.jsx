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

import { useState, useEffect, useRef, useMemo } from 'react'
import * as echarts from 'echarts'
import { parseDataInput, buildOption, validatePie, validateFileContent, recommendChart, COLOR_THEMES, CHART_TYPES, DEFAULT_DATA } from './handler'
import styles from './index.module.css'

function getChartColors() {
  const s = getComputedStyle(document.documentElement)
  const g = v => s.getPropertyValue(v).trim()
  return {
    label:  g('--color-label'),
    label2: g('--color-label-2'),
    label3: g('--color-label-3'),
    sep:    g('--separator'),
    bg:     g('--color-bg'),
    bgElev: g('--color-bg-elevated'),
  }
}

const TYPE_ICONS = {
  Bar: '▊', Line: '╱', Area: '◿', Pie: '◔', Doughnut: '◎', Scatter: '⁘', Radar: '⬡', Treemap: '⊞',
}

function GuideModal({ onClose }) {
  return (
    <div className={styles.helpOverlay} onClick={onClose}>
      <div className={styles.helpPanel} onClick={e => e.stopPropagation()}>
        <div className={styles.helpHeader}>
          <span>Chart Builder — Guide</span>
          <button className={styles.helpClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.helpBody}>

          <div className={styles.helpSection}>
            <h4>Loading data</h4>
            <table className={styles.helpTable}><tbody>
              <tr><td>Import file button</td><td>Opens a file picker — accepts <code className={styles.inlineCode}>.csv</code>, <code className={styles.inlineCode}>.tsv</code>, and <code className={styles.inlineCode}>.json</code> files</td></tr>
              <tr><td>Drag &amp; drop</td><td>Drop a CSV, TSV, or JSON file anywhere onto the Data panel</td></tr>
              <tr><td>Type or paste</td><td>Paste CSV, freeform (<code className={styles.inlineCode}>Label: value%</code>), or JSON directly into the textarea</td></tr>
              <tr><td>Reset button</td><td>Restores the built-in example data for the current chart type</td></tr>
            </tbody></table>
          </div>

          <div className={styles.helpSectionSep} />

          <div className={styles.helpSection}>
            <h4>Data format — CSV</h4>
            <table className={styles.helpTable}><tbody>
              <tr><td>First row</td><td>Column headers — auto-detected if any cell is non-numeric</td></tr>
              <tr><td>First column</td><td>Category labels (X-axis, pie slices, radar groups)</td></tr>
              <tr><td>Other columns</td><td>Each column becomes one series / data set</td></tr>
              <tr><td>Paste from Excel</td><td>Tab-separated data is auto-parsed — no conversion needed</td></tr>
            </tbody></table>
          </div>

          <div className={styles.helpSectionSep} />

          <div className={styles.helpSection}>
            <h4>Data format — Freeform</h4>
            <table className={styles.helpTable}><tbody>
              <tr><td><code className={styles.inlineCode}>Label: 40%</code></td><td>Colon separator, optional % sign — stripped automatically</td></tr>
              <tr><td><code className={styles.inlineCode}>Label - 40</code></td><td>Dash separator</td></tr>
              <tr><td><code className={styles.inlineCode}>Label = 40</code></td><td>Equals separator</td></tr>
              <tr><td>One item per line</td><td>Parsed as Category + Value — ideal for quick Pie / Bar data</td></tr>
            </tbody></table>
          </div>

          <div className={styles.helpSectionSep} />

          <div className={styles.helpSection}>
            <h4>Data format — JSON</h4>
            <table className={styles.helpTable}><tbody>
              <tr><td>Array of objects</td><td><code className={styles.inlineCode}>{`[{"Month":"Jan","Sales":120}, ...]`}</code></td></tr>
              <tr><td>Keys become headers</td><td>First object's keys are used as column names</td></tr>
            </tbody></table>
          </div>

          <div className={styles.helpGroupSep} />

          <div className={styles.helpSection}>
            <h4>Chart types</h4>
            <table className={styles.helpTable}><tbody>
              <tr><td>Bar / Line / Area</td><td>Col 1 = X labels, col 2+ = numeric series values</td></tr>
              <tr><td>Pie / Doughnut</td><td>Col 1 = slice name, col 2 = slice value (best when values sum to 100%)</td></tr>
              <tr><td>Scatter</td><td>Col 1 = X value, col 2+ = Y values (one series per col)</td></tr>
              <tr><td>Radar</td><td>Col 1 = group name, col 2+ = metric values per axis</td></tr>
              <tr><td>Treemap</td><td>Col 1 = parent group, col 2 = item name, col 3 = value — area shows hierarchy</td></tr>
            </tbody></table>
          </div>

          <div className={styles.helpGroupSep} />

          <div className={styles.helpSection}>
            <h4>Design principles applied</h4>
            <table className={styles.helpTable}><tbody>
              <tr><td>Bar Y-axis at zero</td><td>Always enforced — truncating the Y-axis on bar charts misleads readers</td></tr>
              <tr><td>Pie slice order</td><td>Auto-sorted largest→smallest clockwise from 12 o'clock</td></tr>
              <tr><td>Pie slice limit</td><td>Warning shown when more than 5 slices — consider a bar chart instead</td></tr>
              <tr><td>Colorblind theme</td><td>"Colorblind" preset uses the Wong palette, safe for deuteranopia &amp; protanopia</td></tr>
              <tr><td>Source field</td><td>Adds a source credit line to the chart for transparency</td></tr>
            </tbody></table>
          </div>

          <div className={styles.helpGroupSep} />

          <div className={styles.helpSection}>
            <h4>Settings</h4>
            <table className={styles.helpTable}><tbody>
              <tr><td>Title</td><td>Short, descriptive — should convey the story independently</td></tr>
              <tr><td>Source</td><td>Data source or credit shown at the bottom of the chart</td></tr>
              <tr><td>Color theme</td><td>6 presets — Default, Ocean, Sunset, Pastel, Mono, Colorblind</td></tr>
              <tr><td>Show legend</td><td>Toggles the series legend on/off</td></tr>
              <tr><td>Smooth curves</td><td>Applies smooth bezier curves to Line and Area charts</td></tr>
              <tr><td>Download PNG</td><td>Exports the current chart at 2× resolution as a PNG file</td></tr>
            </tbody></table>
          </div>

        </div>
      </div>
    </div>
  )
}

export default function ChartBuilder() {
  const [chartType, setChartType] = useState('Bar')
  const [dataInput, setDataInput] = useState(DEFAULT_DATA['Bar'])
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [themeName, setThemeName] = useState('Default')
  const [showLegend, setShowLegend] = useState(true)
  const [smooth, setSmooth] = useState(true)
  const [showGuide, setShowGuide] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [isDark, setIsDark] = useState(document.documentElement.dataset.theme !== 'light')

  const chartRef = useRef(null)
  const instanceRef = useRef(null)
  const fileInputRef = useRef(null)

  // Re-render chart when theme changes
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.dataset.theme !== 'light')
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const { headers, rows } = useMemo(() => parseDataInput(dataInput), [dataInput])

  const fileValidation = useMemo(() => validateFileContent(dataInput), [dataInput])

  const recommendation = useMemo(() => recommendChart(headers, rows), [headers, rows])

  // Pie and Doughnut are the same family — treat them as equivalent for recommendation purposes
  const PIE_FAMILY = new Set(['Pie', 'Doughnut'])
  const recMatches = recommendation && (
    recommendation.type === chartType ||
    (PIE_FAMILY.has(recommendation.type) && PIE_FAMILY.has(chartType))
  )

  const pieWarnings = useMemo(() => {
    if (chartType === 'Pie' || chartType === 'Doughnut') return validatePie(rows)
    return []
  }, [chartType, rows])

  const option = useMemo(() => buildOption({
    type: chartType,
    headers,
    rows,
    title,
    source,
    colors: COLOR_THEMES[themeName],
    showLegend,
    smooth,
    chartColors: getChartColors(),
  // isDark is a dependency so the option rebuilds whenever the theme switches
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [chartType, headers, rows, title, source, themeName, showLegend, smooth, isDark])

  useEffect(() => {
    if (!chartRef.current) return
    const instance = echarts.init(chartRef.current, null, { renderer: 'canvas' })
    instanceRef.current = instance
    const t = setTimeout(() => instance.resize(), 50)
    const ro = new ResizeObserver(() => instance.resize())
    ro.observe(chartRef.current)
    return () => {
      clearTimeout(t)
      ro.disconnect()
      instance.dispose()
    }
  }, [])

  useEffect(() => {
    instanceRef.current?.setOption(option, { notMerge: true })
  }, [option])

  function handleTypeChange(t) {
    // Only reset data when switching from default/example data (no real user data loaded)
    const isDefaultData = Object.values(DEFAULT_DATA).includes(dataInput.trim())
    setChartType(t)
    if (isDefaultData) setDataInput(DEFAULT_DATA[t])
  }

  function downloadPng() {
    if (!chartRef.current) return

    const cc = getChartColors()
    const bgColor = cc.bgElev || '#1c1c1e'

    // Count legend items to calculate extra height needed
    const legendItems = (() => {
      if (chartType === 'Treemap') return 0
      if (chartType === 'Pie' || chartType === 'Doughnut') return rows.length
      return Math.max(1, headers.length - 1)
    })()
    const legendRows = Math.ceil(legendItems / 4)
    const legendHeight = showLegend ? legendRows * 22 + 12 : 0

    // Build a full-legend option: plain (no scroll), extra bottom padding
    const fullLegendOption = JSON.parse(JSON.stringify(option))
    if (fullLegendOption.legend) {
      fullLegendOption.legend.type = 'plain'
      fullLegendOption.legend.bottom = (source ? 22 : 6)
    }
    if (fullLegendOption.grid) {
      fullLegendOption.grid.bottom = (showLegend ? legendHeight + 16 : 10) + (source ? 20 : 0)
    }

    // Render into a temporary off-screen div so the live chart is never touched
    const w = chartRef.current.offsetWidth
    const h = chartRef.current.offsetHeight + legendHeight
    const tmpDiv = document.createElement('div')
    tmpDiv.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px;height:${h}px;`
    document.body.appendChild(tmpDiv)

    const tmpChart = echarts.init(tmpDiv, null, { renderer: 'canvas' })
    fullLegendOption.animation = false
    tmpChart.setOption(fullLegendOption, { notMerge: true })

    const url = tmpChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: bgColor })
    tmpChart.dispose()
    document.body.removeChild(tmpDiv)

    const slug = title
      ? `-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
      : ''
    const a = document.createElement('a')
    a.href = url
    a.download = `chart-${chartType.toLowerCase()}${slug}.png`
    a.click()
  }

  function readFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => setDataInput(e.target.result ?? '')
    reader.readAsText(file, 'UTF-8')
  }

  function handleFileInput(e) {
    readFile(e.target.files?.[0])
    e.target.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    readFile(e.dataTransfer.files?.[0])
  }

  const hasData = rows.length > 0

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>

        {/* Chart type */}
        <div className={styles.sideSection}>
          <div className={styles.sideLabelRow}>
            <span className={styles.sideLabel}>Chart type</span>
          </div>

          {/* Recommendation banner */}
          {recommendation && !recMatches && (
            <div className={styles.recBanner}>
              <div className={styles.recText}>
                <span className={styles.recLabel}>Recommended</span>
                <span className={styles.recType}>{recommendation.type}</span>
                <span className={styles.recReason}>{recommendation.reason}</span>
              </div>
              <button className={styles.recApply} onClick={() => setChartType(recommendation.type)}>
                Use
              </button>
            </div>
          )}
          {recommendation && recMatches && (
            <div className={styles.recMatch}>
              ✓ Good choice for this data
            </div>
          )}

          <div className={styles.typeGrid}>
            {CHART_TYPES.map(t => (
              <button
                key={t}
                className={`${styles.typeBtn} ${chartType === t ? styles.typeBtnActive : ''} ${recommendation?.type === t && !recMatches ? styles.typeBtnRec : ''}`}
                onClick={() => setChartType(t)}
              >
                <span className={styles.typeIcon}>{TYPE_ICONS[t]}</span>
                <span className={styles.typeLabel}>{t}</span>
                {recommendation?.type === t && !recMatches && <span className={styles.recDot} />}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.sideDivider} />

        {/* Data input */}
        <div className={styles.sideSection}>
          <div className={styles.sideLabelRow}>
            <span className={styles.sideLabel}>Data</span>
            <div className={styles.dataActions}>
              <button className={styles.importBtn} onClick={() => fileInputRef.current?.click()}>Import file</button>
              <button className={styles.resetBtn} onClick={() => setDataInput(DEFAULT_DATA[chartType])}>Reset</button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt,.json"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
          <textarea
            className={`${styles.dataTextarea} ${dragOver ? styles.dataTextareaDrag : ''}`}
            value={dataInput}
            onChange={e => setDataInput(e.target.value)}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            spellCheck={false}
            placeholder={'── CSV ──\nMonth,Sales,Profit\nJan,120,45\nFeb,135,52\n\n── Freeform ──\nMarketing: 40%\nR&D: 30%\nSales: 20%\n\n── Treemap ──\nCategory,Subcategory,Value\nElectronics,Phones,50\nFurniture,Chairs,40\n\n── JSON ──\n[{"Label":"A","Value":10}]\n\nOr drop a CSV / JSON file here'}
          />
          {/* File validation status */}
          {fileValidation && (
            <p className={fileValidation.ok ? styles.fileStatusOk : styles.fileStatusErr}>
              {fileValidation.ok ? '✓' : '✗'} {fileValidation.message}
            </p>
          )}
          {!fileValidation && (
            <p className={styles.dataHint}>CSV, TSV, JSON — or drag &amp; drop a file</p>
          )}

          {/* Pie slice count warning */}
          {pieWarnings.map((w, i) => (
            <div key={i} className={styles.warning}>⚠ {w}</div>
          ))}
        </div>

        <div className={styles.sideDivider} />

        {/* Settings */}
        <div className={styles.sideSection}>
          <span className={styles.sideLabel}>Settings</span>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Title</label>
            <input
              className={styles.fieldInput}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Describe what the chart shows"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Source</label>
            <input
              className={styles.fieldInput}
              value={source}
              onChange={e => setSource(e.target.value)}
              placeholder="e.g. World Bank, 2024"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Color theme</label>
            <select className={styles.fieldSelect} value={themeName} onChange={e => setThemeName(e.target.value)}>
              {Object.keys(COLOR_THEMES).map(k => <option key={k}>{k}</option>)}
            </select>
            {themeName === 'Colorblind' && (
              <p className={styles.themeNote}>Wong palette — safe for deuteranopia &amp; protanopia</p>
            )}
          </div>

          <div className={styles.toggleRow}>
            <label className={styles.toggleLabel}>
              <input type="checkbox" checked={showLegend} onChange={e => setShowLegend(e.target.checked)} />
              Show legend
            </label>
            <label className={styles.toggleLabel}>
              <input type="checkbox" checked={smooth} onChange={e => setSmooth(e.target.checked)} />
              Smooth curves
            </label>
          </div>
        </div>

      </aside>

      {/* Right: chart */}
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <span className={styles.toolbarTitle}>{chartType} Chart{title ? ` — ${title}` : ''}</span>
          <div className={styles.toolbarActions}>
            <button className={styles.helpBtn} onClick={() => setShowGuide(true)} title="Guide">?</button>
            <button className={styles.downloadBtn} onClick={downloadPng} disabled={!hasData}>
              Download PNG
            </button>
          </div>
        </div>
        <div className={styles.chartWrap}>
          {!hasData && (
            <div className={styles.emptyState}>Enter data on the left to see the chart</div>
          )}
          <div ref={chartRef} className={styles.chart} />
        </div>
      </main>

      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  )
}
