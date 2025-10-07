import React, { useEffect, useMemo, useState } from 'react'
import { getSettings, scanUrl } from '../../api'

function Badge({ intent = 'info', children }) {
  return <span className={`badge ${intent}`}>{children}</span>
}

function Chip({ children }) {
  return <span className="chip">{children}</span>
}

function RiskBadge({ verdict }) {
  const map = {
    Safe: { label: 'Safe', intent: 'success' },
    Caution: { label: 'Caution', intent: 'warn' },
    Risky: { label: 'High Risk', intent: 'danger' },
  }
  const v = map[verdict] || map.Caution
  return <Badge intent={v.intent}>{v.label}</Badge>
}

export default function Compact() {
  const [settings, setSettings] = useState({ enabled: true })
  const [state, setState] = useState({
    overall: 50,
    metrics: {
      domainReputation: 50,
      domainSignals: 50,
      certificateTrust: 50,
      connectionSecurity: 50,
      credentialSafety: 50,
      pageContent: 50,
    },
    verdict: 'Caution',
    domain: 'example.com',
  })

  const when = useMemo(
    () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    []
  )

  useEffect(() => {
    ;(async () => {
      const s = await getSettings()
      setSettings(s)
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        const url = tab?.url || 'https://example.com'
        const res = await scanUrl(url)
        setState({ ...res, domain: new URL(url).hostname })
      } catch (e) {
        console.warn(e)
      }
    })()
  }, [])

  return (
    <div>
      <div className="header">
        <div>
          <div className="title">NetStarShield</div>
          <div className="version">Scanned: Today, {when}</div>
        </div>
        <RiskBadge verdict={state.verdict} />
      </div>

      <div className="card" style={{ background: '#fff' }}>
        <div className="row">
          <div className="left">
            <div className="small">{state.domain}</div>
            <div style={{ fontWeight: 700, marginTop: 2 }}>Overall score</div>
          </div>
          <div className="right">
            <div className="risk-meter" style={{ ['--val']: state.overall }}>
              <div className="inner">{state.overall}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          <Chip>Trackers: {state.metrics.domainSignals}</Chip>
          <Chip>Cert: {state.metrics.certificateTrust}</Chip>
          <Chip>Reputation: {state.metrics.domainReputation}</Chip>
          <Chip>Connection: {state.metrics.connectionSecurity}</Chip>
        </div>
      </div>

      <div style={{ height: 10 }} />
      <button className="btn primary" onClick={() => alert('Details coming soon')}>View details</button>
      <div style={{ height: 8 }} />
      <button className="btn" onClick={async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
          const url = tab?.url || 'https://example.com'
          const res = await scanUrl(url)
          setState({ ...res, domain: new URL(url).hostname })
        } catch (e) {
          alert('Scan failed: ' + e)
        }
      }}>Scan current tab</button>
    </div>
  )
}
