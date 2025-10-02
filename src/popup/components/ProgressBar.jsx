import React from 'react'
import InfoIcon from './InfoIcon'

export default function ProgressBar({ label, value, tooltip }) {
  return (
    <div className="progress-row">
      <div className="progress-label">
        {label}
        {tooltip && <InfoIcon tooltip={tooltip} />}
      </div>
      <div className="progress">
        <div className="bar" style={{ width: `${value}%` }} />
      </div>
      <div className="value">{value}</div>
    </div>
  )
}
