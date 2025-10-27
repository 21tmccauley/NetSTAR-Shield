import React, { useMemo, useState } from 'react'
import { DesignA } from './DesignA'
import { DesignB } from './DesignB'
import { DesignC } from './DesignC'
import { DesignD } from './DesignD'

const SAMPLE = {
  url: 'extensions',
  verdict: 'Caution',
  score: 50,
  breakdown: [
    { label: 'Domain Reputation', value: 50 },
    { label: 'Domain Signals', value: 50 },
    { label: 'Certificate Trust', value: 50 },
    { label: 'Connection Security', value: 50 },
    { label: 'Credential Safety', value: 50 },
    { label: 'Page Content', value: 50 },
  ],
  reasons: ['New domain', 'HTTPS', 'Ad trackers'],
}

export function App() {
  const [design, setDesign] = useState('A')
  const [theme, setTheme] = useState('neutral') // neutral | vibrant | neon
  const [mode, setMode] = useState('light') // light | dark
  const [verdict, setVerdict] = useState('caution') // safe | caution | risky | dangerous
  const [metrics, setMetrics] = useState(SAMPLE.breakdown.map(m => ({ ...m })))

  const overall = Math.round(metrics.reduce((s, m) => s + (Number(m.value) || 0), 0) / metrics.length)
  const computedData = {
    ...SAMPLE,
    score: overall,
    breakdown: metrics,
    verdict: ({ safe: 'Safe', caution: 'Caution', risky: 'Risky', dangerous: 'Dangerous' }[verdict]) || 'Caution',
  }

  const updateMetric = (idx, value) => {
    setMetrics(prev => prev.map((m, i) => i === idx ? { ...m, value: Number(value) } : m))
  }

  const View = useMemo(() => {
    switch (design) {
      case 'A':
        return DesignA
      case 'B':
        return DesignB
      case 'C':
        return DesignC
      case 'D':
        return DesignD
      default:
        return DesignA
    }
  }, [design])

  return (
    <div className={`container theme-${theme} mode-${mode} verdict-${verdict}`}>
      <header className="header">
        <div className="brand">NetStarShield – UI Mockups</div>
        <div className="hint">All designs shown side-by-side in extension frames.</div>
        <div className="switcher" aria-label="Theme">
          {['neutral','vibrant','neon'].map(t => (
            <button
              key={t}
              aria-pressed={theme===t}
              className={`seg ${theme===t ? 'active' : ''}`}
              onClick={() => setTheme(t)}
            >{t}</button>
          ))}
        </div>
        <div className="switcher" aria-label="Mode">
          {['light','dark'].map(m => (
            <button
              key={m}
              aria-pressed={mode===m}
              className={`seg ${mode===m ? 'active' : ''}`}
              onClick={() => setMode(m)}
            >{m}</button>
          ))}
        </div>
        <div className="switcher" aria-label="Verdict">
          {['safe','caution','risky','dangerous'].map(v => (
            <button
              key={v}
              aria-pressed={verdict===v}
              className={`seg ${verdict===v ? 'active' : ''}`}
              onClick={() => setVerdict(v)}
            >{v}</button>
          ))}
        </div>
      </header>
      <main className="stage">
        <div className="controls-panel">
          {metrics.map((m, i) => (
            <div key={m.label} className="ctrl-row">
              <label className="ctrl-label">{m.label}</label>
              <input className="ctrl-range" type="range" min="0" max="100" value={m.value} onChange={e => updateMetric(i, e.target.value)} />
              <input className="ctrl-number" type="number" min="0" max="100" value={m.value} onChange={e => updateMetric(i, e.target.value)} />
            </div>
          ))}
          <div className="ctrl-overall">Overall Score: <strong>{overall}</strong></div>
        </div>
        <div className="grid-frames">
          <div className="frame">
            <div className="frame-title">Design A</div>
            <div className="frame-body"><DesignA data={computedData} label={{safe:'Safe',caution:'Warning',risky:'Unsafe',dangerous:'Dangerous'}[verdict] || 'Unknown'} /></div>
          </div>
          <div className="frame">
            <div className="frame-title">Design B</div>
            <div className="frame-body"><DesignB data={computedData} label={{safe:'Safe',caution:'Warning',risky:'Unsafe',dangerous:'Dangerous'}[verdict] || 'Unknown'} /></div>
          </div>
          <div className="frame">
            <div className="frame-title">Design C</div>
            <div className="frame-body"><DesignC data={computedData} label={{safe:'Safe',caution:'Warning',risky:'Unsafe',dangerous:'Dangerous'}[verdict] || 'Unknown'} /></div>
          </div>
          <div className="frame">
            <div className="frame-title">Design D</div>
            <div className="frame-body"><DesignD data={computedData} label={{safe:'Safe',caution:'Warning',risky:'Unsafe',dangerous:'Dangerous'}[verdict] || 'Unknown'} /></div>
          </div>
        </div>
      </main>
      <footer className="footer">Resize the window to see the frames respond. Theme affects all frames.</footer>
    </div>
  )
}


