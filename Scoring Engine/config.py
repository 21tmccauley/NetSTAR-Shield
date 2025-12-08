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
    'Connection_Security': 20,
    'Certificate_Health': 18,
    'DNS_Record_Health': 17,
    'Domain_Reputation': 25,    
    'WHOIS_Pattern': 0, #unused currently
    'IP Reputation': 0, #unused currently
    'Credential Safety': 20
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

