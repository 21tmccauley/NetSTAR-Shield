import React from 'react'

export default function Switch({ checked, onChange }) {
  return (
    <div className={'switch' + (checked ? ' on' : '')} onClick={() => onChange(!checked)}>
      <div className="knob" />
    </div>
  )
}
