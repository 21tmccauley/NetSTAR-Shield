/**
 * Theme and styling utility functions
 */

/**
 * Theme mode helper - returns value based on current theme mode
 * @param {string} mode - Current theme mode: "light" or "dark"
 * @param {string|object} lightValue - Value to return for light mode
 * @param {string|object} darkValue - Value to return for dark mode
 * @returns {string|object} The appropriate value based on theme mode
 */
export function themeValue(mode, lightValue, darkValue) {
  return mode === "dark" ? darkValue : lightValue
}

/**
 * Gets color classes based on security status for use in indicators
 * @param {string} status - Status: "excellent", "good", "moderate", or "poor"
 * @returns {object} Object with bg, text, and gradient color classes
 */
export function getColorClasses(status) {
  switch (status) {
    case "excellent":
      return {
        bg: "bg-[var(--status-excellent-bg)]",
        text: "text-[var(--status-excellent-text)]",
        gradient: "from-[var(--status-excellent-badge)] to-[var(--status-excellent-gradient)]"
      }
    case "good":
      return {
        bg: "bg-[var(--status-good-bg)]",
        text: "text-[var(--status-good-text)]",
        gradient: "from-[var(--status-good-badge)] to-[var(--status-good-gradient)]"
      }
    case "moderate":
      return {
        bg: "bg-[var(--status-moderate-bg)]",
        text: "text-[var(--status-moderate-text)]",
        gradient: "from-[var(--status-moderate-badge)] to-[var(--status-moderate-gradient)]"
      }
    case "poor":
      return {
        bg: "bg-[var(--status-poor-bg)]",
        text: "text-[var(--status-poor-text)]",
        gradient: "from-[var(--status-poor-badge)] to-[var(--status-poor-gradient)]"
      }
    default:
      return {
        bg: "bg-gray-100 dark:bg-gray-900/30",
        text: "text-gray-600 dark:text-gray-400",
        gradient: "from-gray-500 to-slate-500"
      }
  }
}

/**
 * Gets comprehensive status styling info for detail cards
 * @param {string} status - Status: "excellent", "good", "moderate", or "poor"
 * @param {string} mode - Theme mode: "light" or "dark"
 * @returns {object} Object with various styling classes and message
 */
export function getStatusInfo(status) {
  switch (status) {
    case "excellent":
      return {
        bgGradient: "from-[var(--status-excellent-badge)]/30 to-[var(--status-excellent-badge)]/30",
        iconBg: "bg-[var(--status-excellent-bg)]",
        iconColor: "text-[var(--status-excellent-text)]",
        textColor: "text-[var(--status-excellent-text)]",
        scoreColor: "text-[var(--status-excellent-text)]",
        badgeBg: "bg-[var(--status-excellent-badge)]",
        message: "Everything looks perfect!"
      }
    case "good":
      return {
        bgGradient: "from-[var(--status-good-badge)]/30 to-[var(--status-good-badge)]/30",
        iconBg: "bg-[var(--status-good-bg)]",
        iconColor: "text-[var(--status-good-text)]",
        textColor: "text-[var(--status-good-text)]",
        scoreColor: "text-[var(--status-good-text)]",
        badgeBg: "bg-[var(--status-good-badge)]",
        message: "Looking good!"
      }
    case "moderate":
      return {
        bgGradient: "from-[var(--status-moderate-badge)]/30 to-[var(--status-moderate-badge)]/30",
        iconBg: "bg-[var(--status-moderate-bg)]",
        iconColor: "text-[var(--status-moderate-text)]",
        textColor: "text-[var(--status-moderate-text)]",
        scoreColor: "text-[var(--status-moderate-text)]",
        badgeBg: "bg-[var(--status-moderate-badge)]",
        message: "Could be improved"
      }
    case "poor":
      return {
        bgGradient: "from-[var(--status-poor-badge)]/30 to-[var(--status-poor-badge)]/30",
        iconBg: "bg-[var(--status-poor-bg)]",
        iconColor: "text-[var(--status-poor-text)]",
        textColor: "text-[var(--status-poor-text)]",
        scoreColor: "text-[var(--status-poor-text)]",
        badgeBg: "bg-[var(--status-poor-badge)]",
        message: "Needs attention"
      }
    default:
      return {
        bgGradient: "from-gray-900/30 to-slate-900/30 dark:from-gray-900/30 dark:to-slate-900/30",
        iconBg: "bg-gray-100 dark:bg-gray-900/50",
        iconColor: "text-gray-600 dark:text-gray-400",
        textColor: "text-gray-700 dark:text-gray-300",
        scoreColor: "text-gray-600 dark:text-gray-400",
        badgeBg: "bg-gray-500",
        message: "Unknown status"
      }
  }
}

