/**
 * Application-wide constants
 */

// Default indicator data (for testing/demo)
// Note: Icons are imported as components, so only data fields are here
export const DEFAULT_INDICATOR_DATA = [
  { id: "cert", name: "Certificate Health", score: 95 },
  { id: "connection", name: "Connection Security", score: 100 },
  { id: "domain", name: "Domain Reputation", score: 78 },
  { id: "credentials", name: "Credential Safety", score: 85 },
  { id: "ip", name: "IP Reputation", score: 92 },
  { id: "dns", name: "DNS Record Health", score: 88 },
  { id: "whois", name: "WHOIS Pattern", score: 71 },
]

// Default recent scans (for demo)
export const DEFAULT_RECENT_SCANS = [
  { url: "github.com", safe: true },
  { url: "google.com", safe: true },
  { url: "amazon.com", safe: true },
]

