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
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-600 dark:text-green-400",
        gradient: "from-green-500 to-emerald-500"
      }
    case "good":
      return {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-600 dark:text-blue-400",
        gradient: "from-blue-500 to-cyan-500"
      }
    case "moderate":
      return {
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-600 dark:text-amber-400",
        gradient: "from-amber-500 to-orange-500"
      }
    case "poor":
      return {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-600 dark:text-red-400",
        gradient: "from-red-500 to-pink-500"
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
        bgGradient: "from-green-900/30 to-emerald-900/30 dark:from-green-900/30 dark:to-emerald-900/30",
        iconBg: "bg-green-100 dark:bg-green-900/50",
        iconColor: "text-green-600 dark:text-green-400",
        textColor: "text-green-700 dark:text-green-300",
        scoreColor: "text-green-600 dark:text-green-400",
        badgeBg: "bg-green-500",
        message: "Everything looks perfect!"
      }
    case "good":
      return {
        bgGradient: "from-blue-900/30 to-cyan-900/30 dark:from-blue-900/30 dark:to-cyan-900/30",
        iconBg: "bg-blue-100 dark:bg-blue-900/50",
        iconColor: "text-blue-600 dark:text-blue-400",
        textColor: "text-blue-700 dark:text-blue-300",
        scoreColor: "text-blue-600 dark:text-blue-400",
        badgeBg: "bg-blue-500",
        message: "Looking good!"
      }
    case "moderate":
      return {
        bgGradient: "from-amber-900/30 to-orange-900/30 dark:from-amber-900/30 dark:to-orange-900/30",
        iconBg: "bg-amber-100 dark:bg-amber-900/50",
        iconColor: "text-amber-600 dark:text-amber-400",
        textColor: "text-amber-700 dark:text-amber-300",
        scoreColor: "text-amber-600 dark:text-amber-400",
        badgeBg: "bg-amber-500",
        message: "Could be improved"
      }
    case "poor":
      return {
        bgGradient: "from-red-900/30 to-pink-900/30 dark:from-red-900/30 dark:to-pink-900/30",
        iconBg: "bg-red-100 dark:bg-red-900/50",
        iconColor: "text-red-600 dark:text-red-400",
        textColor: "text-red-700 dark:text-red-300",
        scoreColor: "text-red-600 dark:text-red-400",
        badgeBg: "bg-red-500",
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

