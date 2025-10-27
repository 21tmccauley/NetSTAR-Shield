import React from 'react'

// Design B: Full-bleed hero verdict with vertical steps
export function DesignB({ data }) {
  return (
    <div className={`design design-b verdict-${data.verdict.toLowerCase()}`}>
      <section className={`hero ${data.verdict.toLowerCase()}`}>
        <div className="hero-content">
          <h1>{data.verdict}</h1>
          <p className="domain">{data.url}</p>
          <div className="score">{data.score}</div>
          <div className="hero-actions">
            <button className="primary">Open in isolated tab</button>
            <button className="secondary">View history</button>
          </div>
        </div>
      </section>
      <section className="steps">
        {data.breakdown.map(item => (
          <div key={item.label} className="step">
            <div className="step-header">
              <div className="step-dot" />
              <div className="label">{item.label}</div>
              <div className="value">{item.value}</div>
            </div>
            <div className="progress">
              <span style={{ width: `${item.value}%` }} />
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}


