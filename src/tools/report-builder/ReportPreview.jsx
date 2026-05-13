import { useEffect, useRef, useMemo } from 'react'
import styles from './index.module.css'
import { parseNumericVal, inferCols, fmtVal, buildKeyStats } from './insightUtils'

const COLORS = ['#0a84ff','#34c759','#ff9f0a','#ff375f','#bf5af2','#32ade6','#ff6b35','#30d158']

function hexToRgba(hex, alpha) {
  if (!hex || hex.length < 7 || hex[0] !== '#') return `rgba(10,132,255,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ── Key stats strip ───────────────────────────────────────────────────────────

function StatsStrip({ dataset, theme }) {
  const rows  = dataset?.rows ?? []
  const cols  = useMemo(() => inferCols(rows, dataset?.columns ?? []), [dataset])
  const stats = useMemo(() => buildKeyStats(rows, cols), [rows, cols])
  if (!stats.length) return null
  return (
    <div className={styles.statsStrip}>
      {stats.map((s, i) => (
        <div key={i} className={styles.statCard} style={{
          background: theme?.statBg,
          border: `1px solid ${theme?.statBorder ?? '#e8e8ec'}`,
          borderTop: theme?.accent ? `3px solid ${theme.accent}` : undefined,
        }}>
          <div className={styles.statValue} style={{ color: theme?.statValue }}>{s.value}</div>
          <div className={styles.statLabel} style={{ color: theme?.statLabel }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Chart data helpers ────────────────────────────────────────────────────────

function aggEntries(rows, xCol, yCol, max = 20, sortAsc = false) {
  if (yCol === '__count__') {
    const freq = {}
    rows.forEach(r => {
      const cat = String(r[xCol] ?? '').trim()
      if (cat) freq[cat] = (freq[cat] || 0) + 1
    })
    return Object.entries(freq)
      .map(([cat, val]) => ({ cat, val }))
      .sort((a, b) => sortAsc ? a.val - b.val : b.val - a.val)
      .slice(0, max)
  }
  const agg = {}
  rows.forEach(r => {
    const cat = String(r[xCol] ?? '').trim()
    const val = parseNumericVal(r[yCol])
    if (!cat || isNaN(val)) return
    agg[cat] = (agg[cat] || 0) + val
  })
  return Object.entries(agg)
    .map(([cat, val]) => ({ cat, val }))
    .sort((a, b) => sortAsc ? a.val - b.val : b.val - a.val)
    .slice(0, max)
}

function lineEntries(rows, xCol, yCol) {
  const seen = []
  const seenMap = {}
  rows.forEach(r => {
    const cat = String(r[xCol] ?? '').trim()
    if (!cat) return
    const val = yCol === '__count__' ? 1 : parseNumericVal(r[yCol])
    if (isNaN(val)) return
    if (seenMap[cat] !== undefined) {
      seen[seenMap[cat]].val += val
    } else {
      seenMap[cat] = seen.length
      seen.push({ cat, val })
    }
  })
  return seen
}

// ── H2 heading style ──────────────────────────────────────────────────────────

function DocHeading({ text, theme }) {
  const accent = theme?.accent
  const style = theme?.h2Style ?? 'left'

  const base = { color: theme?.h2 }

  if (style === 'underline') {
    return (
      <h2 className={styles.docH2} style={{
        ...base,
        borderBottom: `2px solid ${accent ?? '#111'}`,
        paddingBottom: 8,
      }}>
        {text || 'Heading'}
      </h2>
    )
  }

  if (style === 'chip') {
    return (
      <h2 className={styles.docH2} style={{
        ...base,
        background: hexToRgba(accent ?? '#0a84ff', 0.08),
        borderLeft: `4px solid ${accent ?? '#0a84ff'}`,
        padding: '8px 14px',
        borderRadius: '0 6px 6px 0',
        margin: '0 0 12px',
      }}>
        {text || 'Heading'}
      </h2>
    )
  }

  // 'left' (default)
  return (
    <h2 className={styles.docH2} style={{
      ...base,
      borderLeft: `3px solid ${accent ?? '#111'}`,
      paddingLeft: 10,
    }}>
      {text || 'Heading'}
    </h2>
  )
}

// ── User-configured chart ─────────────────────────────────────────────────────

function UserChart({ section, dataset, themeColors }) {
  const ref = useRef(null)
  const {
    xCol = '', yCol = '', chartType = 'bar',
    chartTitle = '',
    sortOrder = 'desc',
    maxItems = 20,
    colorMode = 'multi',
  } = section
  const rows    = dataset?.rows ?? []
  const sortAsc = sortOrder === 'asc'
  const limit   = Math.max(1, Math.min(50, Number(maxItems) || 20))

  const TCOLS = themeColors ?? COLORS
  const TACC  = TCOLS[0]

  const chartHeight = useMemo(() => {
    if (!xCol || !yCol || !rows.length) return 280

    if (chartType === 'hbar') {
      let count
      if (yCol === '__count__') {
        count = new Set(rows.map(r => String(r[xCol] ?? '').trim()).filter(Boolean)).size
      } else {
        count = new Set(
          rows.filter(r => !isNaN(parseNumericVal(r[yCol])))
            .map(r => String(r[xCol] ?? '').trim()).filter(Boolean)
        ).size
      }
      return Math.max(200, Math.min(540, Math.min(count, limit) * 36 + 56))
    }

    if (chartType === 'bar') {
      const sampleEntries = aggEntries(rows, xCol, yCol, limit, sortOrder === 'asc')
      if (!sampleEntries.length) return 280
      const maxCatLen  = Math.max(...sampleEntries.map(e => e.cat.length))
      const approxColW = sampleEntries.length > 1 ? 620 / sampleEntries.length : 620
      const needsRotate = maxCatLen * 7 > approxColW * 0.8
      if (!needsRotate) return 280
      return Math.max(280, 220 + Math.min(maxCatLen * 7, 150))
    }

    return 280
  }, [section, dataset]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ref.current || !xCol || !yCol || !rows.length) return
    if (chartType === 'scatter' && yCol === '__count__') return

    let chart = null
    import('echarts').then(echarts => {
      if (!ref.current) return
      chart = echarts.init(ref.current, null, { renderer: 'svg' })

      const isCount = yCol === '__count__'
      const fmt  = v => isCount ? Number(v).toLocaleString() : fmtVal(v, yCol)
      const yLabel = isCount ? 'Count' : yCol
      const noData = txt => chart.setOption({
        title: { text: txt, left: 'center', top: 'middle', textStyle: { color: '#bbb', fontSize: 13 } },
      })

      // ── Scatter ──────────────────────────────────────────────────────────────
      if (chartType === 'scatter') {
        const points = rows
          .map(r => [parseNumericVal(r[xCol]), parseNumericVal(r[yCol])])
          .filter(([x, y]) => !isNaN(x) && !isNaN(y))
        if (!points.length) { noData('No numeric data — both columns must be numeric for Scatter'); return }
        const yVals  = points.map(p => p[1])
        const yMin   = yVals.reduce((a, b) => a < b ? a : b, yVals[0])
        const yMax   = yVals.reduce((a, b) => a > b ? a : b, yVals[0])
        const scatterOpt = {
          tooltip: { formatter: p => `${xCol}: ${fmtVal(p.value[0], xCol)}<br/>${yLabel}: ${fmt(p.value[1])}` },
          xAxis: {
            name: xCol, nameLocation: 'middle', nameGap: 28, type: 'value',
            axisLabel: { fontSize: 11, color: '#aaa', formatter: v => fmtVal(v, xCol) },
            splitLine: { lineStyle: { color: '#f4f4f4' } }, axisLine: { show: false },
          },
          yAxis: {
            name: yLabel, nameLocation: 'middle', nameGap: 48, type: 'value',
            axisLabel: { fontSize: 11, color: '#aaa', formatter: fmt },
            splitLine: { lineStyle: { color: '#f4f4f4' } }, axisLine: { show: false },
          },
          series: [{ type: 'scatter', data: points, symbolSize: 7, itemStyle: { opacity: 0.75 } }],
          grid: { left: 72, right: 24, top: 24, bottom: 52 },
        }
        if (colorMode === 'multi') {
          scatterOpt.visualMap = {
            show: false, min: yMin, max: yMax,
            inRange: { color: TCOLS.slice(0, 4) },
          }
        } else {
          scatterOpt.series[0].itemStyle.color = TACC
        }
        chart.setOption(scatterOpt)
        return
      }

      // ── Line / Area ───────────────────────────────────────────────────────────
      if (chartType === 'line' || chartType === 'area') {
        const entries = lineEntries(rows, xCol, yCol)
        if (!entries.length) { noData('No data to chart'); return }
        const maxLen      = entries.length ? Math.max(...entries.map(e => e.cat.length)) : 0
        const approxColW  = entries.length > 1 ? 620 / entries.length : 620
        const rotateDeg   = maxLen * 7 > approxColW * 0.8 ? 90 : 0
        const labelHeight = rotateDeg === 90 ? Math.min(maxLen * 7, 150) : 16
        const labelBot    = labelHeight + 8
        const botPad      = labelBot + 20
        const valRotate   = approxColW < 80 ? 90 : 0
        const gridTop     = valRotate === 90 ? 90 : 44
        const areaColor   = hexToRgba(TACC, 0.09)
        chart.setOption({
          tooltip: { trigger: 'axis', formatter: p => `${p[0].name}: ${fmt(p[0].value)}` },
          xAxis: {
            type: 'category', data: entries.map(e => e.cat),
            name: xCol, nameLocation: 'middle', nameGap: labelBot + 4,
            nameTextStyle: { fontSize: 11, color: '#888', fontWeight: 600 },
            axisLabel: { rotate: rotateDeg, fontSize: 11, color: '#aaa', interval: 0 },
            axisLine: { lineStyle: { color: '#eee' } }, axisTick: { show: false },
          },
          yAxis: {
            name: yLabel, nameLocation: 'end', type: 'value',
            nameTextStyle: { fontSize: 11, color: '#888', fontWeight: 600 },
            axisLabel: { fontSize: 11, color: '#aaa', formatter: fmt },
            splitLine: { lineStyle: { color: '#f4f4f4' } }, axisLine: { show: false },
          },
          series: [{
            type: 'line', data: entries.map(e => e.val), smooth: true,
            symbol: 'circle', symbolSize: 5,
            lineStyle: { color: TACC, width: 2.5 },
            areaStyle: chartType === 'area' ? { color: areaColor } : undefined,
            itemStyle: { color: TACC },
            label: { show: true, position: 'top', rotate: valRotate, fontSize: 10, color: '#888', formatter: p => fmt(p.value) },
          }],
          grid: { left: 64, right: 24, top: gridTop, bottom: botPad },
        })
        return
      }

      // ── Donut ─────────────────────────────────────────────────────────────────
      if (chartType === 'donut') {
        const entries = aggEntries(rows, xCol, yCol, Math.min(limit, 12), sortAsc)
        if (!entries.length) { noData('No data to chart'); return }
        const getColor = (i) => colorMode === 'single' ? TACC : TCOLS[i % TCOLS.length]
        const valLabel = isCount ? 'Count' : yCol
        chart.setOption({
          title: [{
            subtext: `${xCol}  ·  ${valLabel}`,
            left: 'center', bottom: 2,
            subtextStyle: { fontSize: 11, color: '#888', fontWeight: 600 },
          }],
          tooltip: { trigger: 'item', formatter: p => `${xCol}: ${p.name}<br/>${valLabel}: ${fmt(p.value)} (${p.percent}%)` },
          series: [{
            type: 'pie', radius: ['40%', '68%'], center: ['50%', '48%'],
            data: entries.map((e, i) => ({
              name: e.cat, value: Math.abs(e.val),
              itemStyle: { color: getColor(i), borderRadius: 3 },
            })),
            label: { show: true, fontSize: 11, formatter: p => `${p.name}\n${p.percent}%` },
            labelLine: { show: true },
            emphasis: { itemStyle: { shadowBlur: 8 } },
          }],
        })
        return
      }

      // ── Bar + Horizontal Bar ──────────────────────────────────────────────────
      const entries = aggEntries(rows, xCol, yCol, limit, sortAsc)
      if (!entries.length) { noData('No data to chart'); return }
      const total = entries.reduce((s, e) => s + Math.abs(e.val), 0)
      const pct   = v => total > 0 ? Math.round(Math.abs(v) / total * 100) : 0
      const getColor = (i) => colorMode === 'single' ? TACC : TCOLS[i % TCOLS.length]

      if (chartType === 'hbar') {
        const rev = [...entries].reverse()
        const maxCatLen  = rev.length ? Math.max(...rev.map(e => e.cat.length)) : 0
        const yLabelW    = Math.min(Math.max(80, maxCatLen * 7), 220)
        const gridLeft   = yLabelW + 20
        const maxValLen  = rev.length ? Math.max(...rev.map(e => fmt(e.val).length)) : 5
        const xRotate    = maxValLen > 7 ? 45 : 0
        const xNameGap   = xRotate > 0 ? 42 : 28
        const xBotPad    = xRotate > 0 ? 58 : 44
        chart.setOption({
          tooltip: { trigger: 'axis', formatter: p => `${xCol}: ${p[0].name}<br/>${yLabel}: ${fmt(p[0].value)} (${pct(p[0].value)}%)` },
          xAxis: {
            type: 'value',
            name: yLabel, nameLocation: 'middle', nameGap: xNameGap,
            nameTextStyle: { fontSize: 11, color: '#888', fontWeight: 600 },
            axisLabel: { fontSize: 11, color: '#aaa', formatter: fmt, rotate: xRotate },
            splitLine: { lineStyle: { color: '#f4f4f4' } }, axisLine: { show: false },
          },
          yAxis: {
            type: 'category', data: rev.map(e => e.cat),
            name: xCol, nameLocation: 'end',
            nameTextStyle: { fontSize: 11, color: '#888', fontWeight: 600, align: 'right' },
            axisLabel: { fontSize: 11, color: '#555', width: yLabelW, overflow: 'break', interval: 0 },
            axisLine: { show: false }, axisTick: { show: false },
          },
          series: [{
            type: 'bar',
            data: rev.map((e, i) => ({ value: e.val, itemStyle: { color: getColor(i), borderRadius: [0, 3, 3, 0] } })),
            label: { show: true, position: 'right', fontSize: 11, color: '#888', formatter: p => `${fmt(p.value)} (${pct(p.value)}%)` },
          }],
          grid: { left: gridLeft, right: 80, top: 28, bottom: xBotPad },
        })
        return
      }

      // Vertical bar (default)
      const maxCatLen  = entries.length ? Math.max(...entries.map(e => e.cat.length)) : 0
      const approxColW = entries.length > 1 ? 620 / entries.length : 620
      const rotateDeg  = maxCatLen * 12 > approxColW * 0.8 ? 90 : 0
      const labelHeight = rotateDeg === 90 ? Math.min(maxCatLen * 7, 150) : 16
      const labelBot   = labelHeight + 8
      const botPad     = labelBot + 20
      chart.setOption({
        tooltip: { trigger: 'axis', formatter: p => `${xCol}: ${p[0].name}<br/>${yLabel}: ${fmt(p[0].value)} (${pct(p[0].value)}%)` },
        xAxis: {
          type: 'category', data: entries.map(e => e.cat),
          name: xCol, nameLocation: 'middle', nameGap: labelBot + 4,
          nameTextStyle: { fontSize: 11, color: '#888', fontWeight: 600 },
          axisLabel: { rotate: rotateDeg, fontSize: 11, color: '#aaa', interval: 0 },
          axisLine: { lineStyle: { color: '#eee' } }, axisTick: { show: false },
        },
        yAxis: {
          name: yLabel, nameLocation: 'end', type: 'value',
          nameTextStyle: { fontSize: 11, color: '#888', fontWeight: 600 },
          axisLabel: { fontSize: 11, color: '#aaa', formatter: fmt },
          splitLine: { lineStyle: { color: '#f4f4f4' } }, axisLine: { show: false },
        },
        series: [{
          type: 'bar',
          data: entries.map((e, i) => ({ value: e.val, itemStyle: { color: getColor(i), borderRadius: [3, 3, 0, 0] } })),
          label: { show: true, position: 'inside', rotate: 90, fontSize: 8, color: '#fff',
              textBorderColor: 'rgba(0,0,0,0.45)', textBorderWidth: 2.5,
              formatter: p => `${fmt(p.value)} (${pct(p.value)}%)` },
        }],
        grid: { left: 64, right: 24, top: 36, bottom: botPad },
      })
    })
    return () => { chart?.dispose() }
  }, [section, dataset, themeColors]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!xCol || !yCol) {
    return <p className={styles.placeholder}>Select X and Y columns in the panel on the left.</p>
  }
  if (chartType === 'scatter' && yCol === '__count__') {
    return <p className={styles.placeholder}>Count rows is not supported for Scatter — select a numeric column for Y.</p>
  }
  return (
    <>
      {chartTitle && <div className={styles.chartSectionTitle}>{chartTitle}</div>}
      <div ref={ref} style={{ width: '100%', height: chartHeight }} />
    </>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────

function TableSection({ dataset, theme }) {
  if (!dataset?.rows?.length) return <p className={styles.placeholder}>No dataset loaded.</p>
  const rows = dataset.rows
  const cols = dataset.columns ?? []
  const thBg    = theme?.tableHeaderBg
  const thColor = theme?.tableHeaderColor
  return (
    <div className={styles.tableWrap}>
      <table className={styles.previewTable}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.name} style={{ background: thBg, color: thColor, borderColor: thBg ? 'transparent' : undefined }}>
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>{cols.map(c => <td key={c.name}>{row[c.name] ?? ''}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {rows.length > 100 && <p className={styles.tableNote}>Showing all {rows.length} rows</p>}
    </div>
  )
}

// ── Report document ───────────────────────────────────────────────────────────

export default function ReportPreview({ sections, dataset, reportTitle, theme }) {
  const generated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const source    = dataset?.name ?? null
  const hasBanner = !!(theme?.headerBg)
  const accent    = theme?.accent
  const c2        = theme?.chartColors?.[1]

  const sectionNodes = sections.map(s => (
    <div key={s.id} className={styles.docSection}>
      {s.type === 'stats'   && <StatsStrip dataset={dataset} theme={theme} />}
      {s.type === 'heading' && <DocHeading text={s.text} theme={theme} />}
      {s.type === 'text'    && s.text && <p className={styles.docP}>{s.text}</p>}
      {s.type === 'chart'   && <UserChart section={s} dataset={dataset} themeColors={theme?.chartColors} />}
      {s.type === 'table'   && <TableSection dataset={dataset} theme={theme} />}
    </div>
  ))

  return (
    <div className={styles.previewDoc} data-report-preview style={{ background: theme?.paper, padding: 0 }}>
      {hasBanner ? (
        <>
          <div className={styles.docBanner} style={{ background: theme.headerBg }}>
            <h1 className={styles.docTitle} style={{ color: theme.title }}>
              {reportTitle || 'Untitled Report'}
            </h1>
            <p className={styles.docMeta} style={{ color: theme.meta, borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
              Generated {generated}{source ? ` · Source: ${source}` : ''}
            </p>
          </div>
          <div className={styles.docBody}>{sectionNodes}</div>
        </>
      ) : (
        <div className={styles.docBody}>
          <h1 className={styles.docTitle} style={{ color: theme?.title }}>
            {reportTitle || 'Untitled Report'}
          </h1>
          <p className={styles.docMeta} style={{
            color: theme?.meta,
            borderBottomColor: theme?.titleBorder === 'none' ? 'transparent' : (theme?.titleBorder ?? '#111'),
          }}>
            Generated {generated}{source ? ` · Source: ${source}` : ''}
          </p>
          {sectionNodes}
        </div>
      )}

      {accent && (
        <div className={styles.docFooterAccent} style={{
          background: `linear-gradient(90deg, ${accent}, ${c2 ?? accent}80)`,
        }} />
      )}
    </div>
  )
}
