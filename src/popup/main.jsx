
import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

// Dynamically select UI variant via VITE_UI_VARIANT env var (tabs | compact | traffic)
const variant = import.meta.env.VITE_UI_VARIANT || 'tabs'

async function bootstrap() {
  let Component
  if (variant === 'compact') {
    Component = (await import('./variants/Compact.jsx')).default
  } else if (variant === 'traffic') {
    Component = (await import('./variants/Traffic.jsx')).default
  } else {
    Component = (await import('./App.jsx')).default
  }
  const rootEl = document.getElementById('root')
  createRoot(rootEl).render(<Component />)
}

bootstrap()
