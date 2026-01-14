import json
import math
import subprocess
import sys
import argparse
from typing import Optional, List
from datetime import datetime

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
    'HVAL_Score': 25,
    'Cert_Score': 23,
    'DNS_Score': 20,
    'Method_Score': 12,
    'Mail_Score': 10,
    'RDAP_Score': 10,
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

# --- Data Fetching Function (Using 'curl' subprocess) ---

def execute_curl_command(command: List[str]) -> Optional[str]:
    """
    Executes a shell command (cURL) and returns the standard output.
    Handles potential errors during execution.
    """
    print(f"Executing command: {' '.join(command)}")
    try:
        # Run the command, capture stdout, and decode as text
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
            timeout=15  # Increased timeout slightly for external API calls
        )

        if result.returncode != 0:
            # Report the error code and stderr if the command failed
            print(f"Error executing command. Return code: {result.returncode}")
            print(f"Standard Error:\n{result.stderr.strip()}")
            return None

        # The output is returned as a string (JSON)
        return result.stdout.strip()

    except FileNotFoundError:
        print("Error: The 'curl' command was not found. Make sure it is installed and in your system PATH.")
        return None
    except subprocess.TimeoutExpired:
        print("Error: Command execution timed out.")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during execution: {e}")
        return None

def fetch_scan_data(host: str) -> dict:
    """
    Fetches scan data using subprocess.run to execute cURL commands against 
    the NetStar API endpoints.
    """
    all_scans = {}
    print(f"\n--- Fetching live data for {host} from NetStar API (via cURL) ---")

    for endpoint in API_ENDPOINTS:
        # Construct the full URL for the API call
        # The 'dns' scan requires query parameters for full data
        query = ''
        if endpoint == 'dns':
            query = '?A&AAAA&CNAME&DNS&MX&TXT'
        
        full_url = f"{BASE_URL}{endpoint}/{host}{query}"
        
        # Define the cURL command
        CURL_COMMAND = [
            'curl',
            '-s', 
            full_url
        ]

        # Map endpoint to the key used in scoring functions (e.g., 'cert' -> 'cert_scan')
        scan_key = f"{endpoint}_scan" if endpoint != 'title' else None
        if not scan_key: continue

        print(f"\n[Processing Endpoint: {endpoint.upper()}]")

        # Execute the command
        output = execute_curl_command(CURL_COMMAND)

        if output is None:
            print(f"--> Endpoint {endpoint.upper()} failed execution. Skipping.")
            continue
        
        # Parse the JSON output
        try:
            data = json.loads(output)
            all_scans[scan_key] = data
        except json.JSONDecodeError:
            print(f"--> Endpoint {endpoint.upper()} returned invalid JSON. Skipping.")
        except Exception as e:
            print(f"--> An error occurred processing {endpoint.upper()}: {e}")

    print("\n--- Data fetching complete ---")
    return all_scans

# --- Scoring Functions ---

def score_cert_scan(data: dict, scan_date: datetime) -> int:
    """Calculates the score for the Certificate Scan (Max Score: 100).
    Focuses on validity and time to expiration.
    """
    score = 100
    try:
        # Get the list of certs from the "data" key
        cert_list = data.get("data")

        # Check if the list exists and is not empty
        if not cert_list or not isinstance(cert_list, list) or len(cert_list) == 0:
            print("Cert Score: CRITICAL - 'data' key is missing or no certificates found in response.")
            return 1
        
        # Use the first certificate in the list for scoring
        cert_object = cert_list[0]

        # Get the date strings first
        not_after_str = cert_object.get("not_after")
        not_before_str = cert_object.get("not_before")

        # Check if they are None or empty before trying to split
        if not not_after_str or not not_before_str:
            print("Cert Score: CRITICAL - Certificate date fields missing or invalid.")
            return 1

        not_after = datetime.fromisoformat(not_after_str.split('.')[0])
        not_before = datetime.fromisoformat(not_before_str.split('.')[0])
    except (ValueError, TypeError):
        # We no longer expect AttributeError, but keep ValueError/TypeError for fromisoformat
        print("Cert Score: CRITICAL - Certificate date fields are malformed.")
        return 1

    # 1. Validity Check (Major Deductions)
    if scan_date > not_after:
        # Expired
        print("Cert Score: CRITICAL - Certificate has expired.")
        return 1
    if scan_date < not_before:
        # Not yet valid
        print("Cert Score: CRITICAL - Certificate not yet valid.")
        score -= 50
        # return 1 # Note: You had this commented out, keeping it that way.

    # 2. Expiration Time Check (Gradient and Buckets)
    days_until_expiration = (not_after - scan_date).days

    if days_until_expiration > 30:
        # 31+ days: Standard Warning Window (Neutral/Minor Risk)
        score += 0 
        print(f"Cert Score: Standard Warning - Expires in {days_until_expiration} days.")
    else: # 1 <= days_until_expiration <= 30
        # High-Risk Gradient: Deduction scales from 0 at 30 days to 30 at 0 days.
        # This hits the user's requested deduction of -15 at 15 days.
        MAX_GRADIENT_DEDUCTION = 30
        days_past_30 = 30 - days_until_expiration
        
        # Calculate linear deduction
        deduction = int(MAX_GRADIENT_DEDUCTION * (days_past_30 / 30))
        
        score -= deduction
        print(f"Cert Score: High Risk Gradient - Expires in {days_until_expiration} days. Deduction: -{deduction}")

    # 3. Assume good crypto (since the JSON is incomplete, we adjust based on assumption)
    # If the provided cert is known to be secure (e.g., modern CA like Google Trust Services), keep score high.

    return max(1, min(100, score))

def score_dns_scan(data: dict) -> int:
    """Calculates the score for the DNS Scan (Max Score: 100).
    Focuses on record coverage (rcode) and redundancy (A/AAAA counts).
    """
    score = 100
    rcode = data.get("rcode", 0)
    # Handle None values gracefully
    if rcode is None:
        rcode = 0
    a_records = data.get("a", [])
    aaaa_records = data.get("aaaa", [])
    a_count = len(a_records) if a_records is not None else 0
    aaaa_count = len(aaaa_records) if aaaa_records is not None else 0

    # --- 2. RCODE Completeness Check (New Banded Scoring) ---
    # Goal: Ensure a wide set of requested record types are returned.
    
    if rcode >= 31:
        # Optimal completeness (includes A, AAAA, CNAME, NS, MX, and/or TXT)
        pass # score += 0 (Neutral)
    elif rcode >= 8: # 8 <= rcode <= 30
        # Missing several key types (e.g., TXT/MX if NS is present)
        score -= 10
        print(f"DNS Score: Minor Deduction - rcode {rcode} is incomplete (Missing advanced types).")
    elif rcode >= 1: # 1 <= rcode <= 7
        # Missing foundational types (e.g., NS)
        score -= 15
        print(f"DNS Score: Significant Deduction - rcode {rcode} is low (Missing foundational types).")

    
    # 2. Redundancy Check
    # Redundancy
    if a_count < 2:
        score -= 10
        print("DNS Score: Minor Deduction - Only one IPv4 address (SPOF).")

    # IPv6 Redundancy
    if aaaa_count == 0:
        score -= 5
        print("DNS Score: Minor Deduction - No IPv6 support.")
    elif aaaa_count < 2:
        score -= 5
        print("DNS Score: Minor Deduction - Only one IPv6 address (SPOF).")

# ADD: functionality to check CNAME redirects

    return max(1, min(100, score))

def score_hval_scan(data: dict) -> int:
    """Calculates the score for the HVAL Scan (Max Score: 100).
    Focuses on HTTPS enforcement, TLS, and security headers (security flag).
    """
    score = 100
    security_flag = data.get("security", 0)
    head_chain = data.get("head", [])

    # 1. HTTPS Enforcement Check (Major Deductions)
    final_status = head_chain[-1].get("status") if head_chain else None
    final_url = head_chain[-1].get("url", "") if head_chain else ""
    tls_cipher = head_chain[-1].get("tls", "NONE") if head_chain and head_chain[-1].get("tls") else "NONE"

    # CHECK - correct functionality for desired outcome?
    if final_status != 200 or not final_url.startswith("https"):
        # Fails to load or loads over HTTP
        print("HVAL Score: CRITICAL - Final connection not 200 HTTPS.")
        score -= 45
        # return 1

    # 2. TLS Strength Check
    if "TLS_AES" in tls_cipher or "TLS_CHACHA20" in tls_cipher:
        pass # Strong cipher, no deduction
    elif "TLS_ECDHE-RSA" in tls_cipher:
        score -= 10
        print(f"HVAL Score: Minor Deduction - Moderate cipher used: {tls_cipher}.")
    else:
        score -= 45
        print(f"HVAL Score: Significant Deduction - Weak/no cipher used: {tls_cipher}.")

    # 3. Security Header Check (Bitwise Flag Analysis)
    #TODO: Create functionality if security flag is missing (skip this step?)
    # The required headers are HSTS (1), CSP (2), XCTO (4). Total = 7.
    REQUIRED_FLAGS = SECURITY_FLAGS['HSTS'] | SECURITY_FLAGS['CSP'] | SECURITY_FLAGS['XCTO']
    
    # Count how many of the three required flags are missing
    missing_flags_mask = REQUIRED_FLAGS & ~security_flag
    
    # Check if HSTS (1) is missing
    is_hsts_missing = bool(missing_flags_mask & SECURITY_FLAGS['HSTS'])
    # Check if CSP (2) is missing
    is_csp_missing = bool(missing_flags_mask & SECURITY_FLAGS['CSP'])
    # Check if XCTO (4) is missing
    is_xcto_missing = bool(missing_flags_mask & SECURITY_FLAGS['XCTO'])
    
    missing_count = is_hsts_missing + is_csp_missing + is_xcto_missing
    
    if missing_count == 0:
        # HSTS, CSP, and XCTO present: +0 (or a small bonus)
        print("HVAL Score: HSTS, CSP, XCTO all present.")
    elif missing_count == 1:
        # Missing one of the three: -20
        score -= 20
        print(f"HVAL Score: Deduction - Missing 1 critical header (HSTS/CSP/XCTO). -20 pts.")
    elif missing_count >= 2:
        # Missing two or more of the three: -40
        score -= 40
        print(f"HVAL Score: Major Deduction - Missing {missing_count} critical headers. -40 pts.")

    # Check Dangerous/Advanced Headers (Minor Deductions)
    advanced_flags = SECURITY_FLAGS['COOP'] | SECURITY_FLAGS['CORP'] | SECURITY_FLAGS['COEP']
    if (security_flag & advanced_flags) != advanced_flags:
        score -= 5 # Minor deduction for incomplete advanced security.
        print("HVAL Score: Minor Deduction - Missing one or more advanced security headers (COOP/CORP/COEP).")

    return max(1, min(100, score))

def score_mail_scan(data: dict) -> int:
    """Calculates the score for the Mail Scan (Max Score: 100).
    Focuses on DMARC/SPF enforcement and MX redundancy.
    """
    score = 100

    # 1. MX Redundancy
    mx_count = len(data.get("mx", []))
    if mx_count == 0:
        score -= 40
        print("Mail Score: CRITICAL - No MX records (cannot receive mail).")
    elif mx_count < 2:
        score -= 10
        print("Mail Score: Significant Deduction - Only one MX record (SPOF).")
    else:
        print("Mail Score: MX redundancy is good.")

    # 2. DMARC Policy (Highest Impact)
    dmarc_data = data.get("dmarc", [])
    if not dmarc_data:
        score -= 45
        print("Mail Score: Major Deduction - DMARC record is missing (high spoofing risk).")
    else:
        # Parse the DMARC string (e.g., "v=DMARC1; p=reject;...")
        dmarc_policy = next((part.split('=')[1] for part in dmarc_data[0].split(';') if part.strip().startswith('p=')), 'none')
        
        if dmarc_policy.strip() != 'reject' and dmarc_policy.strip() != 'quarantine':
            score -= 15 # Optimal is reject or quarantine
            print(f"Mail Score: Significant Deduction - DMARC policy is '{dmarc_policy}' (no active enforcement).")
        
        # Check Subdomain policy (sp=)
        sp_policy = next((part.split('=')[1] for part in dmarc_data[0].split(';') if part.strip().startswith('sp=')), dmarc_policy)
        if sp_policy.strip() != 'reject' and sp_policy.strip() != 'quarantine':
            score -= 5 # Optimal is reject or quarantine
            print(f"Mail Score: Minor Deduction - DMARC subdomain policy is '{sp_policy}' (no active enforcement).")

    # 3. SPF Policy
    spf_data = data.get("spf", [])
    if not spf_data or not any("v=spf1" in s for s in spf_data):
        score -= 20
        print("Mail Score: Major Deduction - SPF record is missing.")
    else:
        # Extract the SPF mechanism (e.g., "~all" or "-all")
        spf_string = next(s for s in spf_data if "v=spf1" in s)
        if "-all" in spf_string:
            pass # HardFail - Good
        elif "~all" in spf_string:
            score -= 10 # SoftFail (like medium.com)
            print("Mail Score: Minor Deduction - SPF policy is '~all' (SoftFail).")
        elif "?all" in spf_string or "+all" in spf_string:
            score -= 25
            print(f"Mail Score: Deduction - SPF policy is too permissive ('{spf_string[-4:]}').")

    return max(1, min(100, score))

def score_method_scan(data: dict) -> int:
    """Calculates the score for the Method Scan (Max Score: 100).
    Focuses on restricting dangerous HTTP methods.
    """
    score = 100
    flag = data.get("flag", 0)
    
    # 1. Check for Dangerous Methods (Major Deductions)
    
    # CONNECT AND PATCH (128, 16) - Tunneling/Modification Risk
    if flag & (METHOD_FLAGS['CONNECT'] | METHOD_FLAGS['PATCH']):
        score -= 15
        print("Method Score: Deduction - possible modification/tunneling risk (CONNECT and/or PATCH).")

    # PUT, DELETE, and TRACE (8, 32, 64) - Editing Risk
    if flag & (METHOD_FLAGS['TRACE'] | METHOD_FLAGS['DELETE'] | METHOD_FLAGS['PUT']):
        score -= 40
        print("Method Score: Major Deduction - DELETE, TRACE, and/or PUT methods enabled.")

    # 2. Optimal Check (Positive Bonus)
    # Optimal for a public web page is usually only HEAD (1) and GET (2), resulting in flag 3.
    if flag == 3:
        print("Method Score: Optimal - Only HEAD and GET methods enabled.")
    elif flag == 7:
        print("Method Score: Acceptable - HEAD, GET, and POST methods enabled.")

    return max(1, min(100, score))

def score_rdap_scan(data: dict) -> int:
    """Calculates the score for the RDAP Scan (Max Score: 100).
    Focuses on nameserver redundancy and vendor diversity.
    """
    score = 100
    nameservers = data.get("nameserver", [])
    
    # 1. Redundancy (Major Deduction)
    if len(nameservers) < 2:
        score -= 30
        print("RDAP Score: CRITICAL - Less than 2 nameservers (SPOF).")
    elif len(nameservers) == 2:
        score -= 5
        print("RDAP Score: Deduction - Only 2 nameservers (limited redundancy).")
    elif len(nameservers) >= 3:
        pass # Good redundancy, no deduction

    # 2. Diversity (Minor Deduction)
    # Check if all nameservers belong to the same domain (e.g., cloudflare.com)
    # Handle potential errors if ns is not a string
    providers = set()
    for ns in nameservers:
        if isinstance(ns, str) and len(ns.split('.')) >= 2:
            providers.add(ns.split('.')[-2])
    
    if len(providers) == 1 and len(nameservers) >= 2:
        # Example: both are *.cloudflare.com
        score -= 5
        print(f"RDAP Score: Minor Deduction - All nameservers on the same vendor ({list(providers)[0]}).")
    elif len(providers) > 1:
        pass # Good diversity, no deduction

    # 3. Reputation (Assume reputable if 2+ nameservers are present)
    # No further deductions without a reputation database check.
    #TODO: functionality to check reputation if database available
    
    return max(1, min(100, score))

def calculate_final_score(weights, scores):
    """
    Calculates the final score using the Weighted Harmonic Mean formula:
    Final Score = (Sum of Weights) / (Sum of (Weight / Score))
    """
    
    # 1. Calculate the numerator: Sum of all weights (∑Wi)
    sum_of_weights = 0
    
    # 2. Calculate the denominator: Sum of the ratio of (Weight / Score) (∑i Wi/Scorei)
    # This also handles checking for missing scores or zero scores to prevent DivisionByZeroError.
    sum_of_ratios = 0.0
    
    print("\n--- Individual Component Ratios (Wi / Scorei) ---")
    
    # We only include components in the calculation *if* we have a score for them.
    for tool_name, score in scores.items():
        if tool_name in weights:
            weight = weights[tool_name]
            sum_of_weights += weight
            
            if score <= 0:
                # If any score is zero or negative, the Harmonic Mean approaches zero.
                # We return 1 immediately as a zero score on a critical factor indicates failure.
                print(f"CRITICAL ERROR: {tool_name} score is 0 or less. Returning Final Score of 1.")
                return 1

            # Calculate the ratio Wi / Scorei
            ratio = weight / score
            sum_of_ratios += ratio
            
            # Display the components for clarity
            print(f"  {tool_name:15}: {weight} / {score:.2f} = {ratio:.4f}")

    print("--------------------------------------------------")
    print(f"Sum of Weights (Numerator): {sum_of_weights}")
    print(f"Sum of Ratios (Denominator): {sum_of_ratios:.4f}")
    
    # 3. Calculate the Final Score
    if sum_of_ratios == 0:
        # This happens if no scores were provided.
        print("No valid scores found. Cannot calculate score.")
        return 0.0
        
    final_score = sum_of_weights / sum_of_ratios
    return final_score

# --- Main Scoring Orchestrator ---

def calculate_security_score(all_scans: dict, scan_date: datetime) -> dict:
    """Runs all scoring functions and calculates the average security score."""
    results = {}
    
    print(f"\n--- Calculating Scores (Reference Date: {scan_date.strftime('%Y-%m-%d')}) ---")
    
    if 'cert_scan' in all_scans:
        results['Cert_Score'] = score_cert_scan(all_scans['cert_scan'], scan_date)
        
    if 'dns_scan' in all_scans:
        results['DNS_Score'] = score_dns_scan(all_scans['dns_scan'])
        
    if 'hval_scan' in all_scans:
        results['HVAL_Score'] = score_hval_scan(all_scans['hval_scan'])
        
    if 'mail_scan' in all_scans:
        results['Mail_Score'] = score_mail_scan(all_scans['mail_scan'])

    if 'method_scan' in all_scans:
        results['Method_Score'] = score_method_scan(all_scans['method_scan'])

    if 'rdap_scan' in all_scans:
        results['RDAP_Score'] = score_rdap_scan(all_scans['rdap_scan'])

    if results:
        average_score = calculate_final_score(WEIGHTS, results)
        results['Aggregated_Score'] = round(average_score, 2)
        
    return results

# --- Test Data (Using Samples from the Conversation) ---
test_scans = {
    # Cert Scan Sample (Healthy, 61 days to expiration from 2025-10-15)
    'cert_scan': {
        "not_after":"2025-12-15T20:07:01.252",
        "not_before":"2025-09-16T20:11:24"
    },
    # DNS Scan Sample (Optimal: A, AAAA, Redundancy, rcode 3 implies A+AAAA)
    'dns_scan': {
        "rcode": 3,
        "a":["162.159.153.4","162.159.152.4"],
        "aaaa":["2606:4700:7::a29f:9804","2606:4700:7::a29f:9904"]
    },
    # HVAL Scan Sample (Strong: HTTPS enforced, modern TLS, HSTS+CSP+XCTO=7)
    'hval_scan': {
        "head":[
            {"status":301, "url":"http://medium.com"},
            {"status":200, "url":"https://medium.com/", "tls":"TLS_AES_128_GCM_SHA256"}
        ],
        "n":2,
        "security":7
    },
    # Mail Scan Sample (Excellent: p=reject DMARC, multiple MX, but SPF is ~all)
    'mail_scan': {
        "mx":["aspmx.l.google.com", "alt2.aspmx.l.google.com", "alt1.aspmx.l.google.com", "aspmx2.googlemail.com", "aspmx3.googlemail.com"],
        "spf":["v=spf1 include:amazonses.com ... ~all"],
        "dmarc":["v=DMARC1; p=reject; sp=reject; pct=100;fo=1; ri=3600;  rua=mailto:dmarc.rua@medium.com; ruf=mailto:dmarc.rua@medium.com,mailto:ruf@dmarc.medium.com"]
    },
    # Method Scan Sample (Optimal: Only HEAD (1) + GET (2) allowed)
    'method_scan': {
        "flag":3
    },
    # RDAP Scan Sample (Good: 2 servers, but same vendor)
    'rdap_scan': {
        "nameserver":["alina.ns.cloudflare.com", "kip.ns.cloudflare.com"]
    }
}

# --- Main execution block ---
if __name__ == '__main__':
    
    # 1. Setup argument parser
    parser = argparse.ArgumentParser(
        description="Get a security and infrastructure score for a target domain."
    )
    parser.add_argument(
        '-t', '--target',
        type=str,
        default=DEFAULT_URL,
        help=f"The target hostname to scan (e.g., {DEFAULT_URL})"
    )
    parser.add_argument(
        '--use-test-data',
        action='store_true',
        help="Run the script using the internal test_scans data instead of live API calls."
    )
    
    args = parser.parse_args()
    
    all_scans = {}
    scan_date = None

    # 2. Decide whether to use test data or fetch live data
    if args.use_test_data:
        print(f"--- Running analysis on TEST DATA ---")
        all_scans = test_scans
        # For reproducible results, we'll set a fixed date for the expiration checks.
        # Cert Sample Expiration: 2025-12-15.
        scan_date = datetime(2025, 10, 15)
    else:
        print(f"--- Running analysis on LIVE DATA for {args.target} ---")
        # For live data, use the real date!
        scan_date = datetime.now()
        all_scans = fetch_scan_data(args.target)
    
    # 3. Check if we have data, then calculate and print scores
    if not all_scans:
        print("No scan data was retrieved. Exiting.")
        sys.exit(1)

    final_scores = calculate_security_score(all_scans, scan_date)
    
    print("\n--- Individual Scan Scores (Max 100) ---")
    for key, value in final_scores.items():
        if key != 'Aggregated_Score':
            print(f"{key:<15}: {value}")
            
    print("\n-------------------------------------------")
    print(f"AGGREGATED SECURITY SCORE: {final_scores.get('Aggregated_Score')}")
    print("-------------------------------------------")