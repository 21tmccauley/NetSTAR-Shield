import { Moon, Sun } from "lucide-react"

/**
 * Reusable theme toggle icon component
 * @param {string} mode - Current theme mode: "light" or "dark"
 * @param {string} className - Additional CSS classes
 */
export function ThemeToggleIcon({ mode, className = "" }) {
  if (mode === "light") {
    return <Moon className={`h-4 w-4 text-slate-700 ${className}`} />
  }
  
  return <Sun className={`h-4 w-4 text-amber-300 ${className}`} />
}

