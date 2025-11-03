import React from 'react'

export default function RiskMeter({ value }) {
  return (
    <div className="risk-meter" style={{ ['--val']: value }}>
      <div className="inner">{value}</div>
    </div>
  )
}
