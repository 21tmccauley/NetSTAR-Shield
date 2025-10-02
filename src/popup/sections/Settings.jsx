import React from 'react'
import Switch from '../components/Switch'

export default function Settings({ settings, onUpdateSettings }) {
  return (
    <div className="panel">
      <div className="section-title">Settings</div>
      <div className="toggle">
        <span>{settings.enabled ? 'On' : 'Off'}</span>
        <Switch 
          checked={settings.enabled} 
          onChange={v => onUpdateSettings({ enabled: v })} 
        />
      </div>
    </div>
  )
}
