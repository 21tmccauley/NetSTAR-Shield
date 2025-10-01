
import React, { useEffect, useMemo, useState } from 'react'
import { getSettings, saveSettings, scanUrl } from '../api'

function Switch({checked, onChange}) {
  return (
    <div className={'switch' + (checked ? ' on' : '')} onClick={() => onChange(!checked)}>
      <div className="knob" />
    </div>
  )
}

function RiskMeter({value}) {
  return (
    <div className="risk-meter" style={{ ['--val']: value }}>
      <div className="inner">{value}</div>
    </div>
  )
}

function ProgressRow({label, value}) {
  return (
    <div className="progress-row">
      <div className="progress-label">{label}</div>
      <div className="progress"><div className="bar" style={{ width: value + '%' }} /></div>
      <div className="value">{value}</div>
    </div>
  )
}

function Summary({state}) {
  const when = useMemo(() => new Date().toLocaleTimeString([], { hour: 'numeric', minute:'2-digit' }), [])
  return (
    <div>
      <div className="card">
        <div className="row">
          <div className="left">
            <div className="small">{state.domain}</div>
            <div className="warning">Caution</div>
          </div>
          <div className="right"><RiskMeter value={state.overall} /></div>
        </div>
        <div className="hr" />
        <div>
          <div style={{fontWeight:700, marginBottom:4}}>Risk Score</div>
          <div className="small" style={{marginBottom:6}}>Overall Security</div>
          <div className="small" style={{marginBottom:8}}>
            {state.verdict === 'Caution' ? 'Exercise caution when using this website.' : 'Safe to browse, routine caution advised.'}
          </div>
          <div className="small">Last visited: Today, {when}</div>
        </div>
      </div>

      <div style={{height:8}} />
      <button className="btn primary" onClick={() => alert('Details coming soon')}>Show Details</button>

      <div className="section-title">Security Analysis</div>
      <ProgressRow label="Domain Reputation" value={state.metrics.domainReputation} />
      <ProgressRow label="Domain Signals" value={state.metrics.domainSignals} />
      <ProgressRow label="Certificate Trust" value={state.metrics.certificateTrust} />
      <ProgressRow label="Connection Security" value={state.metrics.connectionSecurity} />
      <ProgressRow label="Credential Safety" value={state.metrics.credentialSafety} />
      <ProgressRow label="Page Content" value={state.metrics.pageContent} />
    </div>
  )
}

function Details() { return <div className="panel"><div className="section-title">Details</div><ul className="list"><li>Signals and evidence items here…</li></ul></div> }
function Build()   { return <div className="panel"><div className="section-title">Build</div><ul className="list"><li>Version info & changelog…</li></ul></div> }
function History() { return <div className="panel"><div className="section-title">History</div><ul className="list"><li>Recent scans…</li></ul></div> }

function Settings({settings, update}) {
  const [enabled, setEnabled] = useState(settings.enabled)
  useEffect(() => { setEnabled(settings.enabled) }, [settings.enabled])
  return (
    <div className="panel">
      <div className="section-title">Settings</div>
      <div className="toggle">
        <span style={{fontWeight:600, color: enabled ? '#16a34a' : '#475569'}}>{enabled ? 'On' : 'Off'}</span>
        <Switch checked={enabled} onChange={async v => { setEnabled(v); await update({ enabled: v }) }} />
      </div>
    </div>
  )
}

export default function App() {
  const [active, setActive] = useState('Summary')
  const [settings, setSettings] = useState({ enabled: true })
  const [state, setState] = useState({
    overall: 50,
    metrics: { domainReputation:50, domainSignals:50, certificateTrust:50, connectionSecurity:50, credentialSafety:50, pageContent:50 },
    verdict: 'Caution',
    domain: 'example.com'
  })

  useEffect(() => {
    (async () => {
      const s = await getSettings()
      setSettings(s)
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        const url = tab?.url || 'https://example.com'
        const res = await scanUrl(url)
        setState({ ...res, domain: new URL(url).hostname })
      } catch (e) { console.warn(e) }
    })()
  }, [])

  async function handleScan() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const url = tab?.url || 'https://example.com'
      const res = await scanUrl(url)
      setState({ ...res, domain: new URL(url).hostname })
    } catch (e) { alert('Scan failed: ' + e) }
  }

  async function updateSettings(patch) {
    const next = await saveSettings(patch)
    setSettings(next)
  }

  return (
    <div>
      <div className="header">
        <div>
          <div className="title">NetStarShield</div>
          <div className="version">Security Extension v1.36.0</div>
        </div>
        <div className="toggle">
          <span style={{fontWeight:600, color: settings.enabled ? '#16a34a' : '#475569'}}>{settings.enabled ? 'On' : 'Off'}</span>
          <Switch checked={settings.enabled} onChange={v => updateSettings({ enabled: v })} />
        </div>
      </div>

      <div className="tabs">
        {['Summary','Details','Build','History','Settings'].map(name => (
          <button key={name} className={'tab' + (active === name ? ' active' : '')} onClick={() => setActive(name)}>
            {name}
          </button>
        ))}
      </div>

      {active === 'Summary'  && <Summary state={state} />}
      {active === 'Details'  && <Details />}
      {active === 'Build'    && <Build />}
      {active === 'History'  && <History />}
      {active === 'Settings' && <Settings settings={settings} update={updateSettings} />}

      <div style={{height:8}} />
      <button className="btn" onClick={handleScan}>Scan current tab</button>
    </div>
  )
}
