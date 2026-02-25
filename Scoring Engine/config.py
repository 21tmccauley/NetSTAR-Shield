from typing import Dict, List

# --- Configuration and Constants ---

# Bitmasks for Method Scan (Flag)
METHOD_FLAGS = {
    'HEAD': 1, 'GET': 2, 'POST': 4,
    'PUT': 8, 'PATCH': 16, 'DELETE': 32,
    'TRACE': 64, 'CONNECT': 128
}

# Bitmasks for HVAL Scan (Security Flag)
SECURITY_FLAGS = {
    'HSTS': 1, 'CSP': 2, 'XCTO': 4,
    'ACAO': 8, 'COOP': 16, 'CORP': 32,
    'COEP': 64
}

# Weights for each component in the final score calculation.
# When Content_Safety is present, the orchestrator dynamically adds it.
# Base weights (without Content_Safety) sum to 100.
WEIGHTS = {
    'Connection_Security': 14,
    'Certificate_Health': 12,
    'DNS_Record_Health': 10,
    'Domain_Reputation': 20,
    'WHOIS_Pattern': 6,
    'IP_Reputation': 8,
    'Credential_Safety': 12,
    'Content_Safety': 18
}


BASE_URL = 'https://w4.netstar.dev/'
API_ENDPOINTS = [
    'cert',
    'dns',
    'hval',
    'mail',
    'method',
    'rdap',
    'firewall',
    'dead',
    'parked',
    'ip-info',
    'crtsh',
    'redirect',
    'webpage-inspect'
]

# Default target hostname used if no argument is provided
DEFAULT_URL = 'netstar.ai'

# Verbose mode flag
VERBOSE = False

MAL_TLDS = [
    "ac", "ai", "app", "at", "autos", "biz", "bond", "br", "bz", "ca", "cc",
    "cfd", "claims", "click", "cn", "co", "com", "coupons", "courses",
    "cx", "cy", "cyou", "dad", "de", "digital", "es", "eu", "fan",
    "finance", "fit", "fr", "fun", "gay", "gd", "gg", "help", "hk",
    "icu", "id", "im", "in", "info", "ink", "io", "is", "life", "live",
    "locker", "me", "mobi", "money", "ms", "my", "net", "network", "ng",
    "nl", "online", "org", "pl", "pro", "pw", "qpon", "rest", "rocks",
    "ru", "sbs", "sh", "shop", "site", "so", "st", "store", "su",
    "support","tel", "to", "today", "top", "tr", "tv", "ua", "uk",
    "us", "vip", "wiki", "world", "ws" ,"xn--q9jyb4c" ,"xyz"
]

MAL_TLDS_SLIM = [ #removed co, com, eu, uk, org, net
    "ac", "ai", "app", "at", "autos", "biz", "bond", "br", "bz", "ca", "cc",
    "cfd", "claims", "click", "cn", "coupons", "courses",
    "cx", "cy", "cyou", "dad", "de", "digital", "es", "fan",
    "finance", "fit", "fr", "fun", "gay", "gd", "gg", "help", "hk",
    "icu", "id", "im", "in", "info", "ink", "io", "is", "life", "live",
    "locker", "me", "mobi", "money", "ms", "my", "network", "ng",
    "nl", "online", "pl", "pro", "pw", "qpon", "rest", "rocks",
    "ru", "sbs", "sh", "shop", "site", "so", "st", "store", "su",
    "support","tel", "to", "today", "top", "tr", "tv", "ua",
    "us", "vip", "wiki", "world", "ws", "xn--q9jyb4c", "xyz"
]

# Countries with high rates of hosting malicious infrastructure
HIGH_RISK_COUNTRIES = [
    "RU", "CN", "KP", "IR", "NG", "RO", "UA", "BY", "VN", "PK"
]

# ASNs associated with bulletproof hosting providers
BULLETPROOF_ASNS = [
    "AS49981",  # WorldStream
    "AS44477",  # Stark Industries
    "AS206898", # Serverius
    "AS48693",  # Rices Privately owned enterprise
    "AS9009",   # M247
    "AS16276",  # OVH (partial, high abuse)
    "AS14061",  # DigitalOcean (partial, high abuse)
]

# Well-known certificate authorities (for CT log checking)
COMMON_CAS = [
    "Let's Encrypt", "DigiCert", "Sectigo", "GlobalSign", "Comodo",
    "GoDaddy", "Amazon", "Google Trust Services", "Entrust",
    "Certum", "SSL.com", "ZeroSSL", "Buypass", "IdenTrust",
    "Starfield", "QuoVadis", "SwissSign", "HARICA",
]
