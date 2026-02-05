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

# Weights for each component in the final score calculation
WEIGHTS = {
    'Connection_Security': 18,
    'Certificate_Health': 16,
    'DNS_Record_Health': 15,
    'Domain_Reputation': 23,    
    'WHOIS_Pattern': 10, #unused currently
    'IP Reputation': 0, #unused currently (probably won't be used)
    'Credential Safety': 18
}

# --- GLOBAL CONFIGURATION ---
BASE_URL = 'https://w4.netstar.dev/'
API_ENDPOINTS = [
    'cert', 
    'dns', 
    'hval', 
    'mail', 
    'method', 
    'rdap'
]

# Default target hostname used if no argument is provided
DEFAULT_URL = 'netstar.ai' 

# Verbose mode flag
VERBOSE = False