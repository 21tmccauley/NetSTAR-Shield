import React from 'react'
import RiskMeter from '../components/RiskMeter'
import ProgressBar from '../components/ProgressBar'

export default function Summary({ state }) {
  return (
    <div>
      <div className="card">
        <div className="row">
          <div className="left">
            <div className="small">{state.domain || 'example.com'}</div>
            <div className="warning">{state.verdict || 'Caution'}</div>
          </div>
          <div className="right">
            <RiskMeter value={state.overall || 0} />
          </div>
        </div>
        <div className="hr" />
        <div>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>Risk Score</div>
          <div className="small" style={{ marginBottom: '6px' }}>Overall Security</div>
        </div>
      </div>
      
      <div style={{ height: '8px' }} />
      
      <button 
        className="btn primary" 
        onClick={() => alert('Details coming soon')}
      >
        Show Details
      </button>
      
      <div>
        <div className="section-title">Security Analysis</div>
        <ProgressBar 
          label="Domain Reputation" 
          value={state.metrics?.domainReputation || 0} 
          tooltip="How trustworthy this domain is based on historical data, blacklists, and community reports."
        />
        <ProgressBar 
          label="Domain Signals" 
          value={state.metrics?.domainSignals || 0} 
          tooltip="Technical indicators like domain age, registration details, and suspicious patterns."
        />
        <ProgressBar 
          label="Certificate Trust" 
          value={state.metrics?.certificateTrust || 0} 
          tooltip="SSL/TLS certificate validity, issuer reputation, and encryption strength."
        />
        <ProgressBar 
          label="Connection Security" 
          value={state.metrics?.connectionSecurity || 0} 
          tooltip="Network security measures, HTTPS implementation, and connection integrity."
        />
        <ProgressBar 
          label="Credential Safety" 
          value={state.metrics?.credentialSafety || 0} 
          tooltip="Protection of login forms, password policies, and credential handling practices."
        />
        <ProgressBar 
          label="Page Content" 
          value={state.metrics?.pageContent || 0} 
          tooltip="Malicious scripts, suspicious content, and potential security threats on the page."
        />
      </div>
    </div>
  )
}
