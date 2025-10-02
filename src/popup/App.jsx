import React, { useEffect, useState } from 'react'
import { getSettings, saveSettings, scanUrl } from '../api'
import Switch from './components/Switch'
import Tabs from './components/Tabs'
import Summary from './sections/Summary'
import Details from './sections/Details'
import History from './sections/History'
import Settings from './sections/Settings'
import Build from './sections/Build'

export default function App() {
  const [settings, setSettings] = useState({ enabled: true, blockHighRisk: false })
  const [state, setState] = useState({ 
    domain: 'example.com', 
    overall: 50, 
    verdict: 'Caution',
    metrics: {
      domainReputation: 50,
      domainSignals: 50,
      certificateTrust: 50,
      connectionSecurity: 50,
      credentialSafety: 50,
      pageContent: 50,
    }
  })
  const [activeTab, setActiveTab] = useState('Summary')

  const tabs = ['Summary', 'Details', 'Build', 'History', 'Settings']

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings()
        setSettings(s)
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

  function renderContent() {
    switch (activeTab) {
      case 'Summary': return <Summary state={state} />
      case 'Details': return <Details />
      case 'Build': return <Build />
      case 'History': return <History />
      case 'Settings': return <Settings settings={settings} onUpdateSettings={updateSettings} />
      default: return <Summary state={state} />
    }
  }

  return (
    <div>
      <div className="header">
        <div>
          <div className="title">🛡️ NetStarShield 🔥</div>
          <div className="version">Security Extension v1.36.0</div>
        </div>
        <div className="toggle">
          <span style={{fontWeight:600, color: settings.enabled ? '#16a34a' : '#475569'}}>
            {settings.enabled ? 'On' : 'Off'}
          </span>
          <Switch checked={settings.enabled} onChange={v => updateSettings({ enabled: v })} />
        </div>
      </div>
      
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div id="content">
        {renderContent()}
      </div>
      
      <div style={{ height: '8px' }} />
      
      <button className="btn" onClick={handleScan}>
        Scan current tab
      </button>
    </div>
  )
}