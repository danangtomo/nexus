import Papa from 'papaparse'

// Detects freeform lines like "Label: 40%", "Label - 40", "Label = 40", "Label  40"
const FREEFORM_RE = /^(.+?)[\s]*[:=\-–—][\s]*(\d[\d.,]*)[\s]*%?\s*$/

function parseFreeform(raw) {
  const lines = raw.trim().split(/\r?\n/).filter(l => l.trim())
  const rows = []
  for (const line of lines) {
    const m = line.trim().match(FREEFORM_RE)
    if (!m) return null  // not all lines match → not freeform
    const label = m[1].trim()
    const value = parseFloat(m[2].replace(',', '.'))
    if (!label || isNaN(value)) return null
    rows.push([label, value])
  }
  if (rows.length < 2) return null

  // Detect numeric-prefix labels like "1 hour", "2 hours", "3 weeks"
  // If all labels start with a number and they're unique + increasing, treat as X-axis numeric values
  const numParts = rows.map(r => {
    const nm = String(r[0]).trim().match(/^(\d+[\d.,]*)\s*(.*)?$/)
    return nm ? { num: parseFloat(nm[1].replace(',', '.')), unit: (nm[2] || '').trim() } : null
  })
  const allHaveNumPrefix = numParts.every(p => p !== null)
  if (allHaveNumPrefix) {
    const nums = numParts.map(p => p.num)
    const isUnique = new Set(nums).size === nums.length
    const isMonotone = nums.every((n, i) => i === 0 || n >= nums[i - 1])
    if (isUnique && isMonotone) {
      const rawUnit = numParts[0].unit.replace(/s$/i, '').trim()
      const xHeader = rawUnit ? rawUnit.charAt(0).toUpperCase() + rawUnit.slice(1) : 'X'
      return { headers: [xHeader, 'Value'], rows: nums.map((n, i) => [n, rows[i][1]]) }
    }
  }

  return { headers: ['Category', 'Value'], rows }
}

export function parseDataInput(raw) {
  if (!raw.trim()) return { headers: [], rows: [] }

  // JSON
  if (raw.trim().startsWith('[') || raw.trim().startsWith('{')) {
    try {
      let json = JSON.parse(raw.trim())
      if (!Array.isArray(json)) json = [json]
      if (json.length === 0) return { headers: [], rows: [] }
      const headers = Object.keys(json[0])
      const rows = json.map(obj => headers.map(h => obj[h] ?? ''))
      return { headers, rows }
    } catch {}
  }

  // Freeform: "Label: value%", "Label - value", "Label = value"
  const freeform = parseFreeform(raw)
  if (freeform) return freeform

  // CSV / TSV
  const result = Papa.parse(raw.trim(), { skipEmptyLines: true, dynamicTyping: true })
  if (!result.data || result.data.length === 0) return { headers: [], rows: [] }

  const first = result.data[0]
  const hasHeaders = first.some(v => typeof v === 'string' && v.trim() !== '' && isNaN(Number(v)))

  if (hasHeaders) {
    return { headers: first.map(h => String(h ?? '')), rows: result.data.slice(1) }
  }
  return { headers: first.map((_, i) => `Col ${i + 1}`), rows: result.data }
}

// Validate a raw string and return a human-readable status
export function validateFileContent(raw) {
  if (!raw.trim()) return null
  const { headers, rows } = parseDataInput(raw)
  if (rows.length === 0) return { ok: false, message: 'Cannot read this file — no data rows found' }
  if (headers.length < 2) return { ok: false, message: 'Need at least 2 columns of data' }
  return {
    ok: true,
    message: `${rows.length} row${rows.length !== 1 ? 's' : ''} × ${headers.length} column${headers.length !== 1 ? 's' : ''} detected`,
  }
}

const TIME_PATTERNS = [
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  /^q[1-4]/i,
  /^\d{4}$/,             // year: 2020
  /^\d{1,2}\/\d{1,2}/,  // date: 1/1
  /^\d{4}-\d{2}/,        // ISO date: 2024-01
  /^(mon|tue|wed|thu|fri|sat|sun)/i,
  /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /^(week|wk)\s*\d+/i,
  /^(h1|h2|hy1|hy2)/i,  // half-year
]

function isTimeLike(values) {
  const sample = values.slice(0, Math.min(5, values.length))
  return sample.filter(v => TIME_PATTERNS.some(p => p.test(String(v).trim()))).length >= Math.ceil(sample.length * 0.5)
}

function allNumeric(values) {
  return values.every(v => v !== '' && v !== null && !isNaN(Number(v)))
}

// Returns { type, reason, confidence: 'high'|'medium' }
export function recommendChart(headers, rows) {
  if (!rows.length || headers.length < 2) return null

  const numCols = headers.length        // includes label col
  const numSeries = numCols - 1         // data columns
  const numRows = rows.length
  const labelCol = rows.map(r => r[0])
  const dataColsAllNumeric = Array.from({ length: numSeries }, (_, i) =>
    allNumeric(rows.map(r => r[i + 1]))
  ).every(Boolean)

  // All columns numeric (no string label col) → Scatter
  if (allNumeric(labelCol) && dataColsAllNumeric && numSeries >= 1) {
    return { type: 'Scatter', reason: 'All columns are numeric — X/Y relationship chart', confidence: 'high' }
  }

  // Hierarchical data: first column has repeated values (parent → child → value)
  if (numCols >= 3 && !allNumeric(labelCol)) {
    const uniqueLabels = new Set(labelCol.map(v => String(v).trim()))
    if (uniqueLabels.size < numRows) {
      return { type: 'Treemap', reason: `${uniqueLabels.size} parent groups — nested hierarchy chart`, confidence: 'high' }
    }
  }

  const timeSeries = isTimeLike(labelCol)

  // Time-based labels
  if (timeSeries) {
    if (numSeries === 1) {
      return { type: 'Line', reason: `Time-series data detected (${numRows} points)`, confidence: 'high' }
    }
    // Multiple series over time → Area shows volume and relative contribution better
    return { type: 'Area', reason: `Time-series with ${numSeries} series — area chart shows volume over time`, confidence: 'high' }
  }

  // 2 columns, categorical labels
  if (numSeries === 1) {
    const values = rows.map(r => Number(r[1] ?? 0))
    const sum = values.reduce((a, b) => a + b, 0)
    const looksLikeProportions = numRows <= 6 && Math.abs(sum - 100) < 5
    if (looksLikeProportions) {
      return { type: 'Pie', reason: `${numRows} categories summing to ~100% — proportions of a whole`, confidence: 'medium' }
    }
    if (numRows <= 12) {
      return { type: 'Bar', reason: `${numRows} categories — comparing values`, confidence: 'high' }
    }
    return { type: 'Bar', reason: `${numRows} categories — bar chart handles many items`, confidence: 'high' }
  }

  // Multiple series, few rows → Radar works well
  if (numSeries >= 3 && numSeries <= 7 && numRows <= 4) {
    return { type: 'Radar', reason: `${numRows} groups × ${numSeries} metrics — good for comparison profiles`, confidence: 'medium' }
  }

  // Multiple series, many rows
  if (numSeries >= 2 && numRows > 10) {
    return { type: 'Area', reason: `${numRows} rows × ${numSeries} series — area chart shows volume over many points`, confidence: 'medium' }
  }

  // Default: grouped bar
  return { type: 'Bar', reason: `${numRows} categories × ${numSeries} series — grouped bar chart`, confidence: 'medium' }
}

// Validate pie/doughnut data against design principles
export function validatePie(rows) {
  const warnings = []
  if (rows.length > 5) {
    warnings.push(`${rows.length} slices detected — best practice is 5 or fewer. Consider a Bar chart instead.`)
  }
  return warnings
}

export const COLOR_THEMES = {
  Default:     ['#5470c6','#91cc75','#fac858','#ee6666','#73c0de','#3ba272','#fc8452','#9a60b4'],
  Ocean:       ['#0077b6','#00b4d8','#48cae4','#90e0ef','#ade8f4','#caf0f8','#023e8a','#0096c7'],
  Sunset:      ['#f94144','#f3722c','#f8961e','#f9c74f','#90be6d','#43aa8b','#577590','#277da1'],
  Pastel:      ['#ffadad','#ffd6a5','#fdffb6','#caffbf','#9bf6ff','#a0c4ff','#bdb2ff','#ffc6ff'],
  Mono:        ['#6c757d','#495057','#adb5bd','#343a40','#ced4da','#212529','#868e96','#dee2e6'],
  // ColorBrewer qualitative safe palette (colorblind + B&W distinguishable)
  Colorblind:  ['#e69f00','#56b4e9','#009e73','#f0e442','#0072b2','#d55e00','#cc79a7','#000000'],
}

export const CHART_TYPES = ['Bar', 'Line', 'Area', 'Pie', 'Doughnut', 'Scatter', 'Radar', 'Treemap']

export function buildOption({ type, headers, rows, title, source, colors, showLegend, smooth, chartColors }) {
  if (!rows.length) return {}

  // chartColors: theme-aware values read from CSS variables at call time
  const c = chartColors ?? {
    label:  '#e5e5e7',
    label2: 'rgba(235,235,245,0.60)',
    label3: 'rgba(235,235,245,0.30)',
    sep:    'rgba(84,84,88,0.65)',
    bg:     '#000000',
    bgElev: '#1c1c1e',
  }

  const axisStyle = {
    axisLabel: { color: c.label2 },
    axisLine:  { lineStyle: { color: c.sep } },
    splitLine: { lineStyle: { color: c.sep, opacity: 0.5 } },
  }

  const tooltipStyle = {
    backgroundColor: c.bgElev,
    borderColor:     c.sep,
    textStyle:       { color: c.label },
  }

  const palette = colors
  const topPad  = title ? 44 : 16

  const titleObj = title
    ? { text: title, left: 'center', top: 6, textStyle: { fontSize: 15, color: c.label, fontWeight: 700 } }
    : undefined

  const subtitleObj = source
    ? { subtext: `Source: ${source}`, left: 'center', bottom: 2, subtextStyle: { fontSize: 10, color: c.label3 } }
    : undefined

  const mergedTitle = titleObj
    ? { ...titleObj, subtext: subtitleObj?.subtext, subtextStyle: subtitleObj?.subtextStyle }
    : subtitleObj
      ? { text: '', subtext: subtitleObj.subtext, left: 'center', bottom: 2, subtextStyle: subtitleObj.subtextStyle }
      : undefined

  if (type === 'Pie' || type === 'Doughnut') {
    const data = rows
      .map(r => ({ name: String(r[0] ?? ''), value: Number(r[1] ?? 0) }))
      .sort((a, b) => b.value - a.value)
    return {
      color: palette,
      title: mergedTitle,
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)', ...tooltipStyle },
      legend: showLegend ? { bottom: source ? 18 : 4, type: 'scroll', textStyle: { color: c.label2 } } : undefined,
      series: [{
        type: 'pie',
        radius: type === 'Doughnut' ? ['40%', '70%'] : '65%',
        startAngle: 90,
        top: title ? 30 : 0,
        data,
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.3)' } },
        label: { show: true, formatter: '{b}\n{d}%', color: c.label2, fontSize: 11 },
      }],
    }
  }

  if (type === 'Scatter') {
    const numSeries = Math.max(1, headers.length - 1)
    const series = Array.from({ length: numSeries }, (_, si) => ({
      name: headers[si + 1] ?? `Series ${si + 1}`,
      type: 'scatter',
      data: rows.map(r => [Number(r[0] ?? 0), Number(r[si + 1] ?? 0)]),
      symbolSize: 8,
    }))
    return {
      color: palette,
      title: mergedTitle,
      tooltip: { trigger: 'item', formatter: p => `${p.seriesName}<br/>X: ${p.value[0]}, Y: ${p.value[1]}`, ...tooltipStyle },
      legend: showLegend && numSeries > 1 ? { bottom: source ? 18 : 4, textStyle: { color: c.label2 } } : undefined,
      xAxis: { type: 'value', name: headers[0] ?? 'X', nameTextStyle: { color: c.label2 }, ...axisStyle },
      yAxis: { type: 'value', ...axisStyle },
      series,
    }
  }

  if (type === 'Radar') {
    const axisHeaders = headers.slice(1)
    const indicators = axisHeaders.map((h, i) => {
      const vals = rows.map(r => Number(r[i + 1] ?? 0))
      const maxVal = Math.max(...vals) * 1.2
      return { name: h, max: maxVal > 0 ? maxVal : 100 }
    })
    const seriesData = rows.map(r => ({
      name: String(r[0] ?? ''),
      value: axisHeaders.map((_, i) => Number(r[i + 1] ?? 0)),
    }))
    return {
      color: palette,
      title: mergedTitle,
      tooltip: { ...tooltipStyle },
      legend: showLegend ? { bottom: source ? 18 : 4, textStyle: { color: c.label2 } } : undefined,
      radar: {
        indicator: indicators,
        name: { textStyle: { color: c.label2 } },
        axisLine: { lineStyle: { color: c.sep } },
        splitLine: { lineStyle: { color: c.sep, opacity: 0.5 } },
      },
      series: [{ type: 'radar', data: seriesData }],
    }
  }

  if (type === 'Treemap') {
    let data
    if (headers.length >= 3) {
      const parentMap = new Map()
      for (const r of rows) {
        const parent = String(r[0] ?? '')
        const child  = String(r[1] ?? '')
        const val    = Number(r[2] ?? 0)
        if (!parentMap.has(parent)) parentMap.set(parent, [])
        parentMap.get(parent).push({ name: child, value: val })
      }
      data = [...parentMap.entries()].map(([name, children]) => ({ name, children }))
    } else {
      data = rows.map(r => ({ name: String(r[0] ?? ''), value: Number(r[1] ?? 0) }))
    }
    return {
      color: palette,
      title: mergedTitle,
      tooltip: {
        formatter: p => {
          if (!p.treePathInfo || p.treePathInfo.length <= 1) return `${p.name}: ${p.value}`
          return p.treePathInfo.map(n => n.name).filter(Boolean).join(' → ') + `<br/>Value: ${p.value}`
        },
        ...tooltipStyle,
      },
      series: [{
        type: 'treemap',
        top: title ? 44 : 10,
        bottom: source ? 28 : 6,
        data,
        label: { show: true, formatter: p => `${p.name}\n${p.value}`, color: '#fff', fontSize: 12, lineHeight: 18, overflow: 'truncate' },
        upperLabel: { show: true, height: 26, formatter: '{b}', color: '#fff', fontSize: 12, fontWeight: 600 },
        breadcrumb: {
          show: true,
          bottom: source ? 28 : 6,
          itemStyle: { color: c.bgElev, borderColor: c.sep, textStyle: { color: c.label } },
        },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.4)' } },
        levels: [
          { itemStyle: { borderColor: c.bg, borderWidth: 2, gapWidth: 2 } },
          { colorSaturation: [0.4, 0.6], itemStyle: { borderWidth: 4, gapWidth: 1, borderColorSaturation: 0.7 } },
        ],
      }],
    }
  }

  // Bar, Line, Area
  const categories = rows.map(r => String(r[0] ?? ''))
  const seriesCount = Math.max(1, headers.length - 1)
  const bottomPad = (showLegend ? 36 : 10) + (source ? 20 : 0)

  const series = Array.from({ length: seriesCount }, (_, si) => {
    const data = rows.map(r => Number(r[si + 1] ?? 0))
    const base = { name: headers[si + 1] ?? `Series ${si + 1}`, data }
    if (type === 'Bar')  return { ...base, type: 'bar' }
    if (type === 'Line') return { ...base, type: 'line', smooth }
    if (type === 'Area') return { ...base, type: 'line', smooth, areaStyle: { opacity: 0.25 } }
    return { ...base, type: 'bar' }
  })

  return {
    color: palette,
    title: mergedTitle,
    tooltip: { trigger: 'axis', ...tooltipStyle },
    legend: showLegend ? { bottom: source ? 22 : 6, textStyle: { color: c.label2 } } : undefined,
    grid: { left: 40, right: 20, bottom: bottomPad, top: topPad, containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { color: c.label2, rotate: categories.length > 8 ? 30 : 0 },
      axisLine: { lineStyle: { color: c.sep } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: type === 'Bar' ? 0 : undefined,
      ...axisStyle,
    },
    series,
  }
}

export const DEFAULT_DATA = {
  // Grouped bar — compare budget vs spent per department (no time pattern → Bar)
  Bar:      'Department,Budget,Spent\nEngineering,120,95\nMarketing,80,72\nSales,100,88\nSupport,60,45\nDesign,40,35',
  // Single time-series trend → Line
  Line:     'Month,Revenue\nJan,42000\nFeb,45000\nMar,51000\nApr,48000\nMay,56000\nJun,62000\nJul,59000\nAug,67000',
  // Multi-series over time → Area
  Area:     'Quarter,North,South,East,West\nQ1 2023,120,85,95,70\nQ2 2023,135,92,108,78\nQ3 2023,148,98,115,84\nQ4 2023,162,105,122,91\nQ1 2024,178,112,130,98\nQ2 2024,195,120,145,107',
  // Values sum to exactly 100 → Pie
  Pie:      'Source,Percentage\nOrganic Search,38\nDirect,24\nSocial Media,18\nEmail,12\nReferral,8',
  // Budget allocation summing to 100 → Doughnut
  Doughnut: 'Category,Allocation\nR&D,35\nMarketing,25\nOperations,20\nHR,12\nAdmin,8',
  // All numeric X/Y — study hours vs score → Scatter
  Scatter:  'Study Hours,Test Score\n2,58\n3,65\n4,70\n5,75\n6,78\n7,83\n8,86\n9,89\n10,91\n12,94',
  // 5 metrics × 3 groups, ≤4 rows → Radar
  Radar:    'Team,Speed,Power,Technique,Stamina,Teamwork\nAlpha,85,72,90,78,88\nBeta,70,88,75,92,80\nGamma,92,65,85,70,75',
  // Repeated parent col (hierarchy) → Treemap
  Treemap:  'Category,Subcategory,Value\nElectronics,Phones,50\nElectronics,Laptops,30\nElectronics,Tablets,20\nFurniture,Chairs,40\nFurniture,Desks,30\nClothing,Shirts,60\nClothing,Pants,45',
}
