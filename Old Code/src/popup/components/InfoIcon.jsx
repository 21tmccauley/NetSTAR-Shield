import React, { useState, useRef, useEffect } from 'react'

export default function InfoIcon({ tooltip, position = 'top', children }) {
  const [isVisible, setIsVisible] = useState(false)
  const [actualPosition, setActualPosition] = useState(position)
  const containerRef = useRef(null)
  const tooltipRef = useRef(null)

  // Auto-adjust position if tooltip would go off-screen
  useEffect(() => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const tooltip = tooltipRef.current
      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      
      let newPosition = position
      
      // Check if tooltip goes off the right edge
      if (rect.left + tooltipRect.width > window.innerWidth - 20) {
        newPosition = position === 'top' || position === 'bottom' ? 'left' : 'top'
      }
      // Check if tooltip goes off the left edge
      else if (rect.left < 20) {
        newPosition = position === 'top' || position === 'bottom' ? 'right' : 'top'
      }
      // Check if tooltip goes off the top edge
      else if (rect.top - tooltipRect.height < 20) {
        newPosition = 'bottom'
      }
      // Check if tooltip goes off the bottom edge
      else if (rect.top + tooltipRect.height > window.innerHeight - 20) {
        newPosition = 'top'
      }
      
      setActualPosition(newPosition)
    }
  }, [isVisible, position])

  const handleMouseEnter = () => setIsVisible(true)
  const handleMouseLeave = () => setIsVisible(false)
  const handleFocus = () => setIsVisible(true)
  const handleBlur = () => setIsVisible(false)

  return (
    <div 
      ref={containerRef}
      className="info-icon-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={0}
      role="button"
      aria-label="Show more information"
    >
      {children || <div className="info-icon">ℹ️</div>}
      {isVisible && (
        <div 
          ref={tooltipRef}
          className={`info-tooltip info-tooltip-${actualPosition}`}
          role="tooltip"
        >
          {tooltip}
        </div>
      )}
    </div>
  )
}
