import math
from datetime import datetime
from typing import Dict
from config import WEIGHTS, SECURITY_FLAGS, METHOD_FLAGS

# --- Scoring Functions ---

def score_cert_health(data: dict, scan_date: datetime, scores: dict): 
    """Calculates the score for the Certificate Scan (Max Score: 100).
    Focuses on validity and time to expiration.
    
    The 'data' parameter is now the certificate list itself,
    where the first element (position 0) is the leaf certificate.
    """
    try:
        # --- MODIFIED: The certificate chain is the 'data' parameter itself (a list) ---
        connection_data = data.get("connection", {})
        verification_data = data.get("verification", {})
        cert_list = data.get("certs", [])

        # Check if the list exists and is not empty
        if not cert_list or not isinstance(cert_list, list) or len(cert_list) == 0:
            print("Cert Score: CRITICAL - No certificates found in response. (CERT_HEALTH)")
            # Note: Deducting from Certificate_Health initialized at 100
            scores['Certificate_Health'] -= 50
            return # Exit the function if no certs are found
        
        # Use the first certificate in the list for scoring (the leaf/server cert)
        cert_object = cert_list[0]

        # Get the date strings first
        # These keys are present directly in the cert_object
        not_after_str = cert_object.get("not_after")
        not_before_str = cert_object.get("not_before")

        # Check if they are None or empty
        if not not_after_str or not not_before_str:
            print("Cert Score: CRITICAL - Certificate date fields missing or invalid. (CERT_HEALTH)")
            scores['Certificate_Health'] -= 9
            return

        # --- MODIFIED: Remove .split('.') since the new format ends in 'Z' (e.g., 2024-11-20T14:00:00Z) ---
        # The 'Z' indicates UTC and is handled directly by fromisoformat.
        not_after = datetime.fromisoformat(not_after_str.replace('Z', '+00:00'))
        not_before = datetime.fromisoformat(not_before_str.replace('Z', '+00:00'))
        
    except (ValueError, TypeError) as e:
        # Handles errors from fromisoformat if the string is malformed
        print(f"Cert Score: CRITICAL - Certificate date fields are malformed or missing (Error: {e}). (CERT_HEALTH)")
        scores['Certificate_Health'] -= 8
        return

    # 1. Validity Check (Major Deductions)
    if scan_date.replace(tzinfo=not_after.tzinfo) > not_after:
        # Expired
        print("Cert Score: CRITICAL - Certificate has expired. (CERT_HEALTH)")
        scores['Certificate_Health'] -= 50
    if scan_date.replace(tzinfo=not_before.tzinfo) < not_before:
        # Not yet valid
        print("Cert Score: CRITICAL - Certificate not yet valid. (CERT_HEALTH)")
        scores['Certificate_Health'] -= 50
    
    # 2. Expiration Time Check (Gradient and Buckets)
    # Ensure both datetimes are timezone-aware or naive before subtraction.
    # By default, scan_date is naive (datetime.now()), so we ensure consistency.
    days_until_expiration = (not_after.replace(tzinfo=None) - scan_date.replace(tzinfo=None)).days

    if days_until_expiration > 30:
        # No deduction for >30 days
        print(f"Cert Score: Standard Warning - Expires in {days_until_expiration} days.")
    else: # 1 <= days_until_expiration <= 30
        # High-Risk Gradient: Deduction scales from 0 at 30 days to 30 at 0 days.
        MAX_GRADIENT_DEDUCTION = 30
        days_past_30 = 30 - days_until_expiration
        
        # Calculate linear deduction
        deduction = int(MAX_GRADIENT_DEDUCTION * (days_past_30 / 30))
        
        scores['Certificate_Health'] -= deduction
        print(f"Cert Score: High Risk Gradient - Expires in {days_until_expiration} days. Deduction: -{deduction} (CERT_HEALTH)")

    # 3. Check Verification Status
    hostname_matches = verification_data.get("hostname_matches", False)
    chain_verified = verification_data.get("chain_verified", False)
    
    if not hostname_matches:
        scores['Certificate_Health'] -= 10
        print("Cert Score: Significant Deduction - Hostname does not match certificate. (CERT_HEALTH)")
    if not chain_verified:
        scores['Certificate_Health'] -= 10
        print("Cert Score: Significant Deduction - Certificate chain not verified. (CERT_HEALTH)")

def score_dns_rec_health(dns_data: dict, rdap_scan:dict, scores: dict): 
    """Calculates the score for the DNS Scan (Max Score: 100).
    Focuses on record coverage (rcode) and redundancy (A/AAAA counts).
    """
    rcode = dns_data.get("rcode", 0)
    a_count = len(dns_data.get("a", []))
    aaaa_count = len(dns_data.get("aaaa", []))
    cname = dns_data.get("cname", [])

    # --- 2. RCODE Completeness Check (New Banded Scoring) ---
    # Goal: Ensure a wide set of requested record types are returned.
    
    if rcode >= 31:
        # Optimal completeness (includes A, AAAA, CNAME, NS, MX, and/or TXT)
        pass # score += 0 (Neutral)
    elif rcode >= 8: # 8 <= rcode <= 30
        # Missing several key types (e.g., TXT/MX if NS is present)
        scores['DNS_Record_Health'] -= 10
        print(f"DNS Score: Minor Deduction - rcode {rcode} is incomplete (Missing advanced types). (DNS_REC_HEALTH)")
    elif rcode >= 1: # 1 <= rcode <= 7
        # Missing foundational types (e.g., NS)
        scores['DNS_Record_Health'] -= 15
        print(f"DNS Score: Significant Deduction - rcode {rcode} is low (Missing foundational types). (DNS_REC_HEALTH)")

    
    # 2. Redundancy Check
    # Redundancy
    if a_count < 2:
        scores['DNS_Record_Health'] -= 10
        print("DNS Score: Minor Deduction - Only one IPv4 address (SPOF). (DNS_REC_HEALTH)")

    # IPv6 Redundancy
    if aaaa_count == 0:
        scores['DNS_Record_Health'] -= 5
        print("DNS Score: Minor Deduction - No IPv6 support. (DNS_REC_HEALTH)")
    elif aaaa_count < 2:
        scores['DNS_Record_Health'] -= 5
        print("DNS Score: Minor Deduction - Only one IPv6 address (SPOF). (DNS_REC_HEALTH)")

    # TODO: look into how to check CNAME and nameserver info

def score_conn_sec(hval_data: dict, cert_data: dict, scores: dict): 
    """Calculates the score for the HVAL Scan (Max Score: 100).
    Focuses on HTTPS enforcement, TLS, and security headers (security flag).
    """
    security_flag = hval_data.get("security", 0)
    head_chain = hval_data.get("head", [])
    tls_version = cert_data.get('connection', {}).get('tls_version')
    cipher_suite = cert_data.get('connection', {}).get('cipher_suite')

    # 1. HTTPS Enforcement Check (Major Deductions)
    final_status = head_chain[-1].get("status") if head_chain else None
    final_url = head_chain[-1].get("url", "") if head_chain else ""
    tls_cipher = head_chain[-1].get("tls", "NONE") if head_chain and head_chain[-1].get("tls") else "NONE"

    # CHECK - correct functionality for desired outcome?
    if final_status == 403:
        print("HVAL Notice: Final connection returned 403 Forbidden. Skipping HTTPS enforcement check. (CONN_SEC)")
        pass
    elif final_status != 200 or not final_url.startswith("https"):
        # Fails to load or loads over HTTP
        print("HVAL Score: CRITICAL - Final connection not 200 HTTPS. (CONN_SEC)")
        scores['Connection_Security'] -= 45
        # return 1

    # 2. TLS Strength Check
    if "TLS_AES" in tls_cipher or "TLS_CHACHA20" in tls_cipher:
        pass # Strong cipher, no deduction
    elif "TLS_ECDHE-RSA" in tls_cipher:
        scores['Connection_Security'] -= 10
        print(f"HVAL Score: Minor Deduction - Moderate cipher used: {tls_cipher}. (CONN_SEC)")
    else:
        scores['Connection_Security'] -= 45
        print(f"HVAL Score: Significant Deduction - Weak/no cipher used: {tls_cipher}. (CONN_SEC)")

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
        scores['Connection_Security'] -= 20
        print(f"HVAL Score: Deduction - Missing 1 critical header (HSTS/CSP/XCTO). -20 pts. (CONN_SEC)")
    elif missing_count >= 2:
        # Missing two or more of the three: -40
        scores['Connection_Security'] -= 40
        print(f"HVAL Score: Major Deduction - Missing {missing_count} critical headers. -40 pts. (CONN_SEC)")

    # Check Dangerous/Advanced Headers (Minor Deductions)
    advanced_flags = SECURITY_FLAGS['COOP'] | SECURITY_FLAGS['CORP'] | SECURITY_FLAGS['COEP']
    if (security_flag & advanced_flags) != advanced_flags:
        scores['Connection_Security'] -= 5 # Minor deduction for incomplete advanced security.
        print("HVAL Score: Minor Deduction - Missing one or more advanced security headers (COOP/CORP/COEP). (CONN_SEC)")

    if tls_version not in ['TLS 1.2', 'TLS 1.3']:
        scores['Connection_Security'] -= 20
        print(f"HVAL Score: Significant Deduction - Outdated TLS version: {tls_version}. (CONN_SEC)")

def score_dom_rep(mail_data: dict, method_data: dict, rdap_data: dict, scores: dict): #NEW FUNCTION
    """Unifies Domain Reputation scoring from Mail, Method, and RDAP scans."""

# --- Mail Scan ---
    # 1. MX Redundancy 
    mx_count = len(mail_data.get("mx", []))
    if mx_count == 0:
        scores['Domain_Reputation'] -= 20
        print("Mail Score: CRITICAL - No MX records (cannot receive mail). (DOM_REP)")
    elif mx_count < 2:
        scores['Domain_Reputation'] -= 5
        print("Mail Score: Significant Deduction - Only one MX record (SPOF). (DOM_REP)")
    else:
        print("Mail Score: MX redundancy is good.")

    # 2. DMARC Policy (Highest Impact)
    dmarc_data = mail_data.get("dmarc", [])
    if not dmarc_data:
        scores['Domain_Reputation'] -= 22
        print("Mail Score: Major Deduction - DMARC record is missing (high spoofing risk). (DOM_REP)")
    else:
        # Parse the DMARC string (e.g., "v=DMARC1; p=reject;...")
        dmarc_policy = next((part.split('=')[1] for part in dmarc_data[0].split(';') if part.strip().startswith('p=')), 'none')
        
        if dmarc_policy.strip() != 'reject' and dmarc_policy.strip() != 'quarantine':
            scores['Domain_Reputation'] -= 7 # Optimal is reject or quarantine
            print(f"Mail Score: Significant Deduction - DMARC policy is '{dmarc_policy}' (no active enforcement). (DOM_REP)")
        
        # Check Subdomain policy (sp=)
        sp_policy = next((part.split('=')[1] for part in dmarc_data[0].split(';') if part.strip().startswith('sp=')), dmarc_policy)
        if sp_policy.strip() != 'reject' and sp_policy.strip() != 'quarantine':
            scores['Domain_Reputation'] -= 2 # Optimal is reject or quarantine
            print(f"Mail Score: Minor Deduction - DMARC subdomain policy is '{sp_policy}' (no active enforcement). (DOM_REP)")

    # 3. SPF Policy
    spf_data = mail_data.get("spf", [])
    if not spf_data or not any("v=spf1" in s for s in spf_data):
        scores['Domain_Reputation'] -= 10
        print("Mail Score: Major Deduction - SPF record is missing. (DOM_REP)")
    else:
        # Extract the SPF mechanism (e.g., "~all" or "-all")
        spf_string = next(s for s in spf_data if "v=spf1" in s)
        if "-all" in spf_string:
            pass # HardFail - Good
        elif "~all" in spf_string:
            scores['Domain_Reputation'] -= 5 # SoftFail (like medium.com)
            print("Mail Score: Minor Deduction - SPF policy is '~all' (SoftFail). (DOM_REP)")
        elif "?all" in spf_string or "+all" in spf_string:
            scores['Domain_Reputation'] -= 12
            print(f"Mail Score: Deduction - SPF policy is too permissive ('{spf_string[-4:]}'). (DOM_REP)")

    # --- Method Scan ---
    # 1. Check for Dangerous Methods (Major Deductions)
    flag = method_data.get("flag", 0)

    # CONNECT AND PATCH (128, 16) - Tunneling/Modification Risk
    if flag & (METHOD_FLAGS['CONNECT'] | METHOD_FLAGS['PATCH']):
        scores['Domain_Reputation'] -= 7
        print("Method Score: Deduction - possible modification/tunneling risk (CONNECT and/or PATCH). (DOM_REP)")

    # PUT, DELETE, and TRACE (8, 32, 64) - Editing Risk
    if flag & (METHOD_FLAGS['TRACE'] | METHOD_FLAGS['DELETE'] | METHOD_FLAGS['PUT']):
        scores['Domain_Reputation'] -= 20
        print("Method Score: Major Deduction - DELETE, TRACE, and/or PUT methods enabled. (DOM_REP)")

    # 2. Optimal Check (Positive Bonus)
    # Optimal for a public web page is usually only HEAD (1) and GET (2), resulting in flag 3.
    if flag == 3:
        print("Method Score: Optimal - Only HEAD and GET methods enabled. (DOM_REP)")
    elif flag == 7:
        print("Method Score: Acceptable - HEAD, GET, and POST methods enabled. (DOM_REP)")

    # --- RDAP Scan ---
    nameservers = rdap_data.get("nameserver", [])

    # 1. Redundancy (Major Deduction)
    if len(nameservers) < 2:
        scores['Domain_Reputation'] -= 15
        print("RDAP Score: CRITICAL - Less than 2 nameservers (SPOF). (DOM_REP)")
    elif len(nameservers) == 2:
        scores['Domain_Reputation'] -= 2
        print("RDAP Score: Deduction - Only 2 nameservers (limited redundancy). (DOM_REP)")
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
        scores['Domain_Reputation'] -= 2
        print(f"RDAP Score: Minor Deduction - All nameservers on the same vendor ({list(providers)[0]}). (DOM_REP)")
    elif len(providers) > 1:
        pass # Good diversity, no deduction

    # 3. Reputation (Assume reputable if 2+ nameservers are present)
    # No further deductions without a reputation database check.
    #TODO: functionality to check reputation if database available

def score_cred_safety(cert_data:dict, hval_data:dict, scores:dict): #TODO: IMPLEMENT
    """Initial function for Credential Safety scoring function.
    Currently limited, but can be flushed out further.
    """
    tls_version = cert_data.get('connection', {}).get('tls_version')
    sec_flag = hval_data.get("security", 0)

    if tls_version not in ['TLS 1.2', 'TLS 1.3']:
        scores['Credential_Safety'] -= 50
        print(f"Cred Safety Score: CRITICAL - Outdated TLS version: {tls_version}. (CRED_SAFETY)")

    if (sec_flag & SECURITY_FLAGS['HSTS']) == 0:
        scores['Credential_Safety'] -= 20
        print("Cred Safety Score: Significant Deduction - HSTS header missing. (CRED_SAFETY)")

def score_ip_rep(dns_data:dict, hval_data:dict, scores:dict): #PAUSED: Further investigation needed to determine if helpful
    """Placeholder for IP Reputation scoring function.
    Currently unused, but can be implemented in the future.
    """

    pass

def score_whois_pattern(rdap_data:dict, scores:dict): #TODO: IMPLEMENT
    """Placeholder for WHOIS Pattern scoring function.
    Currently unused, but can be implemented in the future.
    """
    host = rdap_data.get("host","")
    nameservers = rdap_data.get("nameserver", [])
    pass

def calculate_final_score(weights, scores): #CHANGE
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

def calculate_security_score(all_scans: dict, scan_date: datetime) -> dict: #CHANGE
    """Runs all scoring functions and calculates the average security score."""
    
    scores = {
        'Connection_Security': 100,
        'Certificate_Health': 100,
        'DNS_Record_Health': 100,
        'Domain_Reputation': 100,
        'WHOIS_Pattern': 100,
        'IP_Reputation': 100,
        'Credential_Safety': 100    
    }
    
    print(f"\n--- Calculating Scores (Reference Date: {scan_date.strftime('%Y-%m-%d')}) ---")
    
    # 2. Run each scan function, which will modify the scores dictionary
    # TODO: Simplify? All scans should always exist (remove if statements)
    score_cert_health(all_scans['cert_scan'], scan_date, scores)
        
    score_dns_rec_health(all_scans['dns_scan'], all_scans['rdap_scan'], scores)
        
    score_conn_sec(all_scans['hval_scan'], all_scans['cert_scan'], scores)
        
    score_dom_rep(all_scans['mail_scan'], all_scans['method_scan'], all_scans['rdap_scan'], scores)

    score_cred_safety(all_scans['cert_scan'], all_scans['hval_scan'], scores)

    # 3. Clamp scores between 1 and 100 after all deductions
    for key in scores:
        scores[key] = max(1, min(100, scores[key]))

    # 4. Calculate the final aggregated score
    if scores:
        # Note: calculate_final_score will ignore unused components with weight 0
        average_score = calculate_final_score(WEIGHTS, scores)
        scores['Aggregated_Score'] = round(average_score, 2)
        
    return scores

