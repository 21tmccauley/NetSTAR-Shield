import React, { useEffect, useMemo, useState } from 'react'
import { getSettings, scanUrl } from '../../api'

function HeaderStrip({ verdict, when }) {
  const map = {
    Safe: { cls: 'success', icon: '✔️', text: 'Safe to browse' },
    Caution: { cls: 'warn', icon: '⚠️', text: 'Proceed with caution' },
    Risky: { cls: 'danger', icon: '⛔', text: 'High risk detected' },
  }
  const v = map[verdict] || map.Caution
  return (
    <div className={`header-strip ${v.cls}`}>
      <div className="verdict"><span>{v.icon}</span> {v.text}</div>
      <div className="small">Last scan: {when}</div>
    </div>
  )
}

export default function Traffic() {
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

  const labels = {
    domainReputation: 'Domain Reputation',
    domainSignals: 'Trackers',
    certificateTrust: 'Certificate Trust',
    connectionSecurity: 'Connection Security',
    credentialSafety: 'Credential Safety',
    pageContent: 'Page Content',
  }

  const safe = []
  const attention = []
  Object.entries(state.metrics).forEach(([k, v]) => {
    const label = labels[k] || k
    if (v >= 70) safe.push({ label, value: v })
    else attention.push({ label, value: v })
  })

  return (
    <div>
      <div className="header">
        <div>
          <div className="title">NetStarShield</div>
          <div className="version">{state.domain}</div>
        </div>
        <div className="risk-meter" style={{ ['--val']: state.overall }}>
          <div className="inner">{state.overall}</div>
        </div>
      </div>

      <HeaderStrip verdict={state.verdict} when={when} />

      <div className="cols">
        <div className="col">
          <div className="col-title">What's safe</div>
          <ul>
            {safe.length === 0 && <li className="small">No strong signals yet</li>}
            {safe.map((it) => (
              <li key={it.label}>{it.label}: {it.value}</li>
            ))}
          </ul>
        </div>
        <div className="col">
          <div className="col-title">Needs attention</div>
          <ul>
            {attention.length === 0 && <li className="small">No issues detected</li>}
            {attention.map((it) => (
              <li key={it.label}>{it.label}: {it.value}</li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ height: 10 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn primary" onClick={() => alert('Open detailed report')}>See detailed report</button>
        <button className="btn" onClick={() => alert('Fix settings coming soon')}>Fix settings</button>
      </div>

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
