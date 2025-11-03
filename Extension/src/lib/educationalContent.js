/**
 * Educational content for security indicators
 * This data structure provides explanations for each security metric
 */

export const EDUCATIONAL_CONTENT = {
  cert: [
    {
      title: "Certificate Validation",
      description: "This website's digital certificate has been verified by a trusted authority, confirming the site owner's identity."
    },
    {
      title: "Expiration Status",
      description: "The certificate is current and properly maintained, showing the site owner actively manages their security."
    },
    {
      title: "Certificate Chain",
      description: "The complete chain of trust from this website to the root certificate authority has been validated successfully."
    }
  ],
  connection: [
    {
      title: "Encryption Protocol",
      description: "Your connection uses modern TLS encryption to scramble data between your browser and the website."
    },
    {
      title: "HTTPS Security",
      description: "All information sent to this website is encrypted before leaving your device, protecting it from interception."
    },
    {
      title: "Forward Secrecy",
      description: "Session keys are temporary and unique, ensuring that even if encryption keys are compromised later, past communications remain secure."
    }
  ],
  domain: [
    {
      title: "Domain History",
      description: "This domain has been analyzed for suspicious activity, malware distribution, and phishing attempts across security databases."
    },
    {
      title: "Trust Signals",
      description: "The domain age, registration patterns, and online presence are evaluated to assess legitimacy."
    },
    {
      title: "Threat Intelligence",
      description: "Cross-referenced with global threat feeds to detect if this domain has been flagged for malicious behavior."
    }
  ],
  credentials: [
    {
      title: "Login Security",
      description: "Evaluates whether this site properly protects passwords and login information during transmission and storage."
    },
    {
      title: "Known Breaches",
      description: "Checked against databases of compromised websites to determine if this site has suffered credential leaks."
    },
    {
      title: "Authentication Standards",
      description: "Assesses if the site follows current best practices for handling user authentication and session management."
    }
  ],
  ip: [
    {
      title: "IP Address Analysis",
      description: "The server's IP address is checked against databases of known malicious infrastructure and compromised hosts."
    },
    {
      title: "Geolocation Verification",
      description: "Server location is verified to match expected hosting patterns for legitimate services."
    },
    {
      title: "Network Reputation",
      description: "The hosting network is evaluated for history of abuse, spam, or malicious activity."
    }
  ],
  dns: [
    {
      title: "DNS Configuration",
      description: "Domain Name System records are examined for proper setup and signs of DNS hijacking or manipulation."
    },
    {
      title: "Record Consistency",
      description: "DNS entries are verified across multiple servers to detect inconsistencies that could indicate attacks."
    },
    {
      title: "Security Extensions",
      description: "Checks for DNSSEC and other security features that prevent DNS spoofing and cache poisoning."
    }
  ],
  whois: [
    {
      title: "Registration Patterns",
      description: "Domain registration information is analyzed for red flags like privacy shields on new domains or suspicious registration details."
    },
    {
      title: "Ownership Transparency",
      description: "Evaluates whether the domain owner provides verifiable contact information and legitimate business details."
    },
    {
      title: "Historical Changes",
      description: "Monitors for rapid ownership changes or other registration patterns commonly associated with fraudulent sites."
    }
  ]
}

/**
 * Gets educational content for a specific indicator
 * @param {string} indicatorId - The ID of the indicator
 * @returns {Array} Array of educational content items
 */
export function getEducationalContent(indicatorId) {
  return EDUCATIONAL_CONTENT[indicatorId] || EDUCATIONAL_CONTENT.connection
}

