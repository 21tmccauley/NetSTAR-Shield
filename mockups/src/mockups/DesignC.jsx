import React from 'react'

// Design C: Two-column dashboard with cards and table-like analysis
export function DesignC({ data }) {
  return (
    <div className={`design design-c grid verdict-${data.verdict.toLowerCase()}`}>
      <div className="card col">
        <div className="title">Overview</div>
        <div className="bigscore" aria-label={`Risk score ${data.score}`}>{data.score}</div>
        <div className="badge-row">
          <span className={`badge ${data.verdict.toLowerCase()}`}>{data.verdict}</span>
        </div>
        <div className="cta-row">
          <button className="primary">Continue</button>
          <button className="ghost">Block & Report</button>
        </div>
      </div>
      <div className="card col">
        <div className="title">Security Analysis</div>
        <div className="table">
          {data.breakdown.map(item => (
            <div key={item.label} className="tr">
              <div className="td label">{item.label}</div>
              <div className="td bar"><span style={{ width: `${item.value}%`, background: `linear-gradient(90deg, #dc2626 0%, #f59e0b 50%, #16a34a 100%)`, backgroundSize: '100% 100%', backgroundPosition: `${item.value * 2}% 0%` }} /></div>
              <div className="td val">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


