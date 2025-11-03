import React from 'react'

// Design D: Minimal list-first with inline actions and toast-like verdict
export function DesignD({ data }) {
  return (
    <div className={`design design-d verdict-${data.verdict.toLowerCase()}`}>
      <div className={`toast ${data.verdict.toLowerCase()}`} role="status">
        <div className="toast-title">{data.verdict}</div>
        <div className="toast-sub">{data.url} • Score {data.score}</div>
        <div className="toast-actions">
          <button className="link">Details</button>
          <button className="link">Exclude</button>
        </div>
      </div>
      <ul className="list">
        {data.breakdown.map(item => (
          <li key={item.label} className="li">
            <div className="li-head">
              <span className="label">{item.label}</span>
              <span className="val">{item.value}</span>
            </div>
            <div className="slim">
              <span style={{ width: `${item.value}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="controls">
        <button className="primary">Scan current tab</button>
        <button className="secondary">Copy report</button>
      </div>
    </div>
  )
}


