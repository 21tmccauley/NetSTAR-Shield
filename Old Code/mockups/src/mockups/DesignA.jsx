import React from 'react'

// Design A: Verdict-first, compact card with semicircle gauge and chips
export function DesignA({ data }) {
  return (
    <div className={`design design-a verdict-${data.verdict.toLowerCase()}`}>
      <div className="card verdict">
        <div className="verdict-left">
          <div className="domain">{data.url}</div>
          <div className={`badge ${data.verdict.toLowerCase()}`}>{data.verdict}</div>
          <div className="subtitle">Overall Security</div>
          <div className="actions">
            <button className="primary">Continue</button>
            <button className="ghost">Show details</button>
          </div>
        </div>
        <div className="gauge">
          <div className="donut" style={{
            background: `conic-gradient(var(--accent) ${data.score * 3.6}deg, var(--border) 0)`
          }}>
            <div className="donut-hole">{data.score}</div>
          </div>
        </div>
      </div>

      <div className="card breakdown">
        {data.breakdown.map(item => (
          <div key={item.label} className="row">
            <div className="label">{item.label}</div>
            <div className="bar">
              <span style={{ width: `${item.value}%` }} />
            </div>
            <div className="value">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}


