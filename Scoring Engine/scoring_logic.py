# from asyncio import events
# from logging import config
import math
from datetime import datetime
# from typing import Dict
import config as app_config
import sys

# --- Pre-flight Check ---

def _has_suspicious_redirects(redirect_data: dict) -> bool:
    """Walk the redirect tree and return True if any node uses js, meta, or refresh signals."""
    if not redirect_data:
        return False

    tree = redirect_data.get("tree")
    if not tree:
        return False

    SUSPICIOUS_TYPES = {"js", "meta", "refresh"}

    def _walk(node):
        if not node:
            return False
        for sig in node.get("signals", []):
            if sig.get("type", "").lower() in SUSPICIOUS_TYPES:
                return True
        for child in node.get("children", []):
            if _walk(child):
                return True
        return False

    return _walk(tree)


def check_preflight(dead_data: dict, parked_data: dict, redirect_data: dict = None) -> dict | None:
    """Check if site is dead or parked. Returns short-circuit scores dict or None.

    Dead sites always short-circuit to score=1.
    Parked sites with suspicious (js/meta/refresh) redirects are treated as
    potentially malicious and allowed through to full scoring.
    Genuinely parked sites (no suspicious redirects) short-circuit to score=1.
    """
    is_dead = dead_data.get("dead", False) if dead_data else False
    is_parked = parked_data.get("park", False) if parked_data else False

    if is_dead:
        if app_config.VERBOSE:
            print("Pre-flight: Site is dead. Short-circuiting all scores to 1.", file=sys.stderr)
        scores = {k: 1 for k in app_config.WEIGHTS}
        scores['Aggregated_Score'] = 1
        scores['preflight'] = "dead"
        return scores

    if is_parked:
        if _has_suspicious_redirects(redirect_data):
            if app_config.VERBOSE:
                print("Pre-flight: Site is parked BUT has suspicious redirects (js/meta/refresh). Running full scoring.", file=sys.stderr)
            return None  # let full scoring run — fake-parked / malicious
        if app_config.VERBOSE:
            print("Pre-flight: Site is parked. Short-circuiting all scores to 1.", file=sys.stderr)
        scores = {k: 1 for k in app_config.WEIGHTS}
        scores['Aggregated_Score'] = 1
        scores['preflight'] = "parked"
        return scores

    return None


# --- Scoring Functions ---

def score_cert_health(data: dict, scan_date: datetime, scores: dict): #TODO: Change data to cert_data and fix any waterfall affect from it
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
            if app_config.VERBOSE:
                print("Cert Score: CRITICAL - No certificates found in response. (CERT_HEALTH)", file=sys.stderr)
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
            if app_config.VERBOSE:
                print("Cert Score: CRITICAL - Certificate date fields missing or invalid. (CERT_HEALTH)", file=sys.stderr)
            scores['Certificate_Health'] -= 9
            return

        # --- MODIFIED: Remove .split('.') since the new format ends in 'Z' (e.g., 2024-11-20T14:00:00Z) ---
        # The 'Z' indicates UTC and is handled directly by fromisoformat.
        not_after = datetime.fromisoformat(not_after_str.replace('Z', '+00:00'))
        not_before = datetime.fromisoformat(not_before_str.replace('Z', '+00:00'))

    except (ValueError, TypeError) as e:
        # Handles errors from fromisoformat if the string is malformed
        if app_config.VERBOSE:
            print(f"Cert Score: CRITICAL - Certificate date fields are malformed or missing (Error: {e}). (CERT_HEALTH)", file=sys.stderr)
        scores['Certificate_Health'] -= 8
        return

    # 1. Validity Check (Major Deductions)
    if scan_date.replace(tzinfo=not_after.tzinfo) > not_after:
        # Expired
        if app_config.VERBOSE:
            print("Cert Score: CRITICAL - Certificate has expired. (CERT_HEALTH)", file=sys.stderr)
        scores['Certificate_Health'] -= 50
    if scan_date.replace(tzinfo=not_before.tzinfo) < not_before:
        # Not yet valid
        if app_config.VERBOSE:
            print("Cert Score: CRITICAL - Certificate not yet valid. (CERT_HEALTH)", file=sys.stderr)
        scores['Certificate_Health'] -= 50

    # 2. Expiration Time Check (Gradient and Buckets)
    # Ensure both datetimes are timezone-aware or naive before subtraction.
    # By default, scan_date is naive (datetime.now()), so we ensure consistency.
    days_until_expiration = (not_after.replace(tzinfo=None) - scan_date.replace(tzinfo=None)).days

    if days_until_expiration > 30:
        # No deduction for >30 days
        if app_config.VERBOSE:
            print(f"Cert Score: Standard Warning - Expires in {days_until_expiration} days.", file=sys.stderr)
    else: # 1 <= days_until_expiration <= 30
        # High-Risk Gradient: Deduction scales from 0 at 30 days to 30 at 0 days.
        MAX_GRADIENT_DEDUCTION = 30
        days_past_30 = 30 - days_until_expiration

        # Calculate linear deduction
        deduction = int(MAX_GRADIENT_DEDUCTION * (days_past_30 / 30))

        scores['Certificate_Health'] -= deduction
        if app_config.VERBOSE:
            print(f"Cert Score: High Risk Gradient - Expires in {days_until_expiration} days. Deduction: -{deduction} (CERT_HEALTH)", file=sys.stderr)

    # 3. Check Verification Status
    hostname_matches = verification_data.get("hostname_matches", False)
    chain_verified = verification_data.get("chain_verified", False)

    if not hostname_matches:
        scores['Certificate_Health'] -= 10
        if app_config.VERBOSE:
            print("Cert Score: Significant Deduction - Hostname does not match certificate. (CERT_HEALTH)", file=sys.stderr)
    if not chain_verified:
        scores['Certificate_Health'] -= 10
        if app_config.VERBOSE:
            print("Cert Score: Significant Deduction - Certificate chain not verified. (CERT_HEALTH)", file=sys.stderr)

    # 4. CRLite / Revocation checks (Phase 1f)
    revocation = verification_data.get("crlite_revoked", False)
    ocsp_status = verification_data.get("ocsp_status", "")

    if revocation:
        scores['Certificate_Health'] -= 40
        if app_config.VERBOSE:
            print("Cert Score: CRITICAL - Certificate revoked via CRLite. (CERT_HEALTH)", file=sys.stderr)
    elif ocsp_status == "revoked":
        scores['Certificate_Health'] -= 40
        if app_config.VERBOSE:
            print("Cert Score: CRITICAL - Certificate revoked via OCSP. (CERT_HEALTH)", file=sys.stderr)

    ocsp_checked = verification_data.get("ocsp_checked", False)
    ocsp_stapled = verification_data.get("ocsp_stapled", False)
    if ocsp_checked and not ocsp_stapled and ocsp_status != "revoked":
        scores['Certificate_Health'] -= 5
        if app_config.VERBOSE:
            print("Cert Score: Minor Deduction - No OCSP stapling detected. (CERT_HEALTH)", file=sys.stderr)


def score_cert_health_ct(crtsh_data: dict, scores: dict):
    """Enhance Certificate Health with CT log data from /crtsh/ (Phase 1e)."""
    if not crtsh_data:
        return

    certs = crtsh_data if isinstance(crtsh_data, list) else crtsh_data.get("certs", [])
    if not certs:
        return

    # Check number of certificates ever issued
    if len(certs) == 1:
        scores['Certificate_Health'] -= 10
        if app_config.VERBOSE:
            print("Cert Score: Deduction - Only 1 certificate ever issued for domain (no history). (CERT_HEALTH/CT)", file=sys.stderr)

    # Check if newest cert was issued very recently (< 7 days)
    try:
        newest = certs[0]
        issued_str = newest.get("not_before") or newest.get("entry_timestamp") or ""
        if issued_str:
            issued_date = datetime.fromisoformat(issued_str.replace('Z', '+00:00'))
            days_since = (datetime.now().replace(tzinfo=issued_date.tzinfo) - issued_date).days
            if days_since < 7:
                scores['Certificate_Health'] -= 20
                if app_config.VERBOSE:
                    print(f"Cert Score: Deduction - Certificate issued {days_since} days ago (brand new, phishing signal). (CERT_HEALTH/CT)", file=sys.stderr)
    except (ValueError, TypeError, KeyError):
        pass

    # Check for unusual CA
    try:
        issuer = newest.get("issuer_name") or newest.get("issuer_cn") or ""
        if issuer and not any(ca.lower() in issuer.lower() for ca in app_config.COMMON_CAS):
            scores['Certificate_Health'] -= 5
            if app_config.VERBOSE:
                print(f"Cert Score: Minor Deduction - Certificate from unusual CA: {issuer}. (CERT_HEALTH/CT)", file=sys.stderr)
    except (TypeError, AttributeError):
        pass


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
        if app_config.VERBOSE:
            print(f"DNS Score: Minor Deduction - rcode {rcode} is incomplete (Missing advanced types). (DNS_REC_HEALTH)", file=sys.stderr)
    elif rcode >= 1: # 1 <= rcode <= 7
        # Missing foundational types (e.g., NS)
        scores['DNS_Record_Health'] -= 15
        if app_config.VERBOSE:
            print(f"DNS Score: Significant Deduction - rcode {rcode} is low (Missing foundational types). (DNS_REC_HEALTH)", file=sys.stderr)


    # 2. Redundancy Check
    # Redundancy
    if a_count < 2:
        scores['DNS_Record_Health'] -= 10
        if app_config.VERBOSE:
            print("DNS Score: Minor Deduction - Only one IPv4 address (SPOF). (DNS_REC_HEALTH)", file=sys.stderr)

    # IPv6 Redundancy
    if aaaa_count == 0:
        scores['DNS_Record_Health'] -= 5
        if app_config.VERBOSE:
            print("DNS Score: Minor Deduction - No IPv6 support. (DNS_REC_HEALTH)", file=sys.stderr)
    elif aaaa_count < 2:
        scores['DNS_Record_Health'] -= 5
        if app_config.VERBOSE:
            print("DNS Score: Minor Deduction - Only one IPv6 address (SPOF). (DNS_REC_HEALTH)", file=sys.stderr)

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
    final_status = head_chain[-1].get("status") if head_chain else -1
    final_url = head_chain[-1].get("url", "") if head_chain else ""
    tls_cipher = head_chain[-1].get("tls", "NONE") if head_chain and head_chain[-1].get("tls") else "NONE"

    # CHECK - correct functionality for desired outcome?
    if final_status == 403:
        if app_config.VERBOSE:
            print("HVAL Notice: Final connection returned 403 Forbidden. Skipping HTTPS enforcement check. (CONN_SEC)", file=sys.stderr)
        pass
    elif final_status == -1:
        if app_config.VERBOSE:
            print("HVAL Score: CRITICAL - No response from server (connection failed). (CONN_SEC)", file=sys.stderr)
        scores['Connection_Security'] -= 10
        # return 1
    elif not (200 <= final_status < 207) or not final_url.startswith("https"):
        # Fails to load or loads over HTTP
        if app_config.VERBOSE:
            print("HVAL Score: CRITICAL - Final connection not 200 HTTPS. (CONN_SEC)", file=sys.stderr)
        scores['Connection_Security'] -= 45
        # return 1

    # 2. TLS Strength Check
    if "TLS_AES" in tls_cipher or "TLS_CHACHA20" in tls_cipher:
        pass # Strong cipher, no deduction
    elif "TLS_ECDHE_RSA" in tls_cipher:
        scores['Connection_Security'] -= 10
        if app_config.VERBOSE:
            print(f"HVAL Score: Minor Deduction - Moderate cipher used: {tls_cipher}. (CONN_SEC)", file=sys.stderr)
    else:
        scores['Connection_Security'] -= 45
        if app_config.VERBOSE:
            print(f"HVAL Score: Significant Deduction - Weak/no cipher used: {tls_cipher}. (CONN_SEC)", file=sys.stderr)

    # 3. Security Header Check (Bitwise Flag Analysis)
    #TODO: Create functionality if security flag is missing (skip this step?)
    # The required headers are HSTS (1), CSP (2), XCTO (4). Total = 7.
    REQUIRED_FLAGS = app_config.SECURITY_FLAGS['HSTS'] | app_config.SECURITY_FLAGS['CSP'] | app_config.SECURITY_FLAGS['XCTO']

    # Count how many of the three required flags are missing
    missing_flags_mask = REQUIRED_FLAGS & ~security_flag

    # Check if HSTS (1) is missing
    is_hsts_missing = bool(missing_flags_mask & app_config.SECURITY_FLAGS['HSTS'])
    # Check if CSP (2) is missing
    is_csp_missing = bool(missing_flags_mask & app_config.SECURITY_FLAGS['CSP'])
    # Check if XCTO (4) is missing
    is_xcto_missing = bool(missing_flags_mask & app_config.SECURITY_FLAGS['XCTO'])

    missing_count = is_hsts_missing + is_csp_missing + is_xcto_missing

    if missing_count == 0:
        # HSTS, CSP, and XCTO present: +0 (or a small bonus)
        if app_config.VERBOSE:
            print("HVAL Score: HSTS, CSP, XCTO all present.", file=sys.stderr)
    elif missing_count == 1:
        # Missing one of the three: -20
        scores['Connection_Security'] -= 20
        if app_config.VERBOSE:
            print(f"HVAL Score: Deduction - Missing 1 critical header (HSTS/CSP/XCTO). -20 pts. (CONN_SEC)", file=sys.stderr)
    elif missing_count >= 2:
        # Missing two or more of the three: -40
        scores['Connection_Security'] -= 40
        if app_config.VERBOSE:
            print(f"HVAL Score: Major Deduction - Missing {missing_count} critical headers. -40 pts. (CONN_SEC)", file=sys.stderr)
    # Check Dangerous/Advanced Headers (Minor Deductions)
    advanced_flags = app_config.SECURITY_FLAGS['COOP'] | app_config.SECURITY_FLAGS['CORP'] | app_config.SECURITY_FLAGS['COEP']
    if (security_flag & advanced_flags) != advanced_flags:
        scores['Connection_Security'] -= 5 # Minor deduction for incomplete advanced security.
        if app_config.VERBOSE:
            print("HVAL Score: Minor Deduction - Missing one or more advanced security headers (COOP/CORP/COEP). (CONN_SEC)", file=sys.stderr)

    if tls_version not in ['TLS 1.2', 'TLS 1.3']:
        scores['Connection_Security'] -= 20
        if app_config.VERBOSE:
            print(f"HVAL Score: Significant Deduction - Outdated TLS version: {tls_version}. (CONN_SEC)", file=sys.stderr)

    # Phase 1c: Full redirect chain analysis from /hval/ response
    if len(head_chain) > 1:
        input_domain = hval_data.get("item", "")

        # Check for intermediate HTTP hops
        for hop in head_chain[:-1]:
            hop_url = hop.get("url", "")
            if hop_url.startswith("http://"):
                scores['Connection_Security'] -= 10
                if app_config.VERBOSE:
                    print(f"HVAL Score: Deduction - Intermediate HTTP hop in redirect chain: {hop_url}. (CONN_SEC)", file=sys.stderr)
                break  # Only deduct once for HTTP hops

        # Check for excessive redirects
        if len(head_chain) > 3:
            scores['Connection_Security'] -= 5
            if app_config.VERBOSE:
                print(f"HVAL Score: Minor Deduction - {len(head_chain)} redirect hops (suspicious chain). (CONN_SEC)", file=sys.stderr)

        # Check if final domain differs from input domain
        if input_domain and final_url:
            try:
                # Extract domain from final URL
                from urllib.parse import urlparse
                final_domain = urlparse(final_url).hostname or ""
                # Strip www. for comparison
                clean_input = input_domain.lower().lstrip("www.")
                clean_final = final_domain.lower().lstrip("www.")
                if clean_input and clean_final and clean_input != clean_final:
                    # Check if final is a subdomain of input or vice versa
                    if not clean_final.endswith("." + clean_input) and not clean_input.endswith("." + clean_final):
                        scores['Connection_Security'] -= 15
                        if app_config.VERBOSE:
                            print(f"HVAL Score: Deduction - Final domain ({clean_final}) differs from input ({clean_input}). (CONN_SEC)", file=sys.stderr)
            except Exception:
                pass


def score_dom_rep(mail_data: dict, method_data: dict, rdap_data: dict, scores: dict): #NEW FUNCTION
    """Unifies Domain Reputation scoring from Mail, Method, and RDAP scans."""
#ADD: tld scoring (list of top 20 suspicious, add points for gov/edu?)
# --- Mail Scan ---
    # 1. MX Redundancy
    mx_count = len(mail_data.get("mx", []))
    if mx_count == 0:
        scores['Domain_Reputation'] -= 20
        if app_config.VERBOSE:
            print("Mail Score: CRITICAL - No MX records (cannot receive mail). (DOM_REP)", file=sys.stderr)
    elif mx_count < 2:
        scores['Domain_Reputation'] -= 5
        if app_config.VERBOSE:
            print("Mail Score: Significant Deduction - Only one MX record (SPOF). (DOM_REP)", file=sys.stderr)
    else:
        if app_config.VERBOSE:
            print("Mail Score: MX redundancy is good.", file=sys.stderr)

    # 2. DMARC Policy (Highest Impact)
    dmarc_data = mail_data.get("dmarc", [])
    if not dmarc_data:
        scores['Domain_Reputation'] -= 22
        if app_config.VERBOSE:
            print("Mail Score: Major Deduction - DMARC record is missing (high spoofing risk). (DOM_REP)", file=sys.stderr)
    else:
        # Parse the DMARC string (e.g., "v=DMARC1; p=reject;...")
        dmarc_policy = next((part.split('=')[1] for part in dmarc_data[0].split(';') if part.strip().startswith('p=')), 'none')

        if dmarc_policy.strip() != 'reject' and dmarc_policy.strip() != 'quarantine':
            scores['Domain_Reputation'] -= 7 # Optimal is reject or quarantine
            if app_config.VERBOSE:
                print(f"Mail Score: Significant Deduction - DMARC policy is '{dmarc_policy}' (no active enforcement). (DOM_REP)", file=sys.stderr)

        # Check Subdomain policy (sp=)
        sp_policy = next((part.split('=')[1] for part in dmarc_data[0].split(';') if part.strip().startswith('sp=')), dmarc_policy)
        if sp_policy.strip() != 'reject' and sp_policy.strip() != 'quarantine':
            scores['Domain_Reputation'] -= 2 # Optimal is reject or quarantine
            if app_config.VERBOSE:
                print(f"Mail Score: Minor Deduction - DMARC subdomain policy is '{sp_policy}' (no active enforcement). (DOM_REP)", file=sys.stderr)

    # 3. SPF Policy
    spf_data = mail_data.get("spf", [])
    if not spf_data or not any("v=spf1" in s for s in spf_data):
        scores['Domain_Reputation'] -= 10
        if app_config.VERBOSE:
            print("Mail Score: Major Deduction - SPF record is missing. (DOM_REP)", file=sys.stderr)
    else:
        # Extract the SPF mechanism (e.g., "~all" or "-all")
        spf_string = next(s for s in spf_data if "v=spf1" in s)
        if "-all" in spf_string:
            pass # HardFail - Good
        elif "~all" in spf_string:
            scores['Domain_Reputation'] -= 5 # SoftFail (like medium.com)
            if app_config.VERBOSE:
                print("Mail Score: Minor Deduction - SPF policy is '~all' (SoftFail). (DOM_REP)", file=sys.stderr)
        elif "?all" in spf_string or "+all" in spf_string:
            scores['Domain_Reputation'] -= 12
            if app_config.VERBOSE:
                print(f"Mail Score: Deduction - SPF policy is too permissive ('{spf_string[-4:]}'). (DOM_REP)", file=sys.stderr)

    # Phase 1b: DKIM from /mail/ response
    dkim_data = mail_data.get("dkim", [])
    if not dkim_data:
        scores['Domain_Reputation'] -= 15
        if app_config.VERBOSE:
            print("Mail Score: Deduction - No DKIM records found. (DOM_REP)", file=sys.stderr)
    elif len(dkim_data) == 1:
        # Check if it's just the default selector
        record = dkim_data[0].lower() if isinstance(dkim_data[0], str) else ""
        if "default" in record or not record:
            scores['Domain_Reputation'] -= 5
            if app_config.VERBOSE:
                print("Mail Score: Minor Deduction - Only default DKIM selector found. (DOM_REP)", file=sys.stderr)

    # --- Method Scan ---
    # 1. Check for Dangerous Methods (Major Deductions)
    flag = method_data.get("flag", 0)

    # CONNECT AND PATCH (128, 16) - Tunneling/Modification Risk
    if flag & (app_config.METHOD_FLAGS['CONNECT'] | app_config.METHOD_FLAGS['PATCH']):
        scores['Domain_Reputation'] -= 7
        if app_config.VERBOSE:
            print("Method Score: Deduction - possible modification/tunneling risk (CONNECT and/or PATCH). (DOM_REP)", file=sys.stderr)

    # PUT, DELETE, and TRACE (8, 32, 64) - Editing Risk
    if flag & (app_config.METHOD_FLAGS['TRACE'] | app_config.METHOD_FLAGS['DELETE'] | app_config.METHOD_FLAGS['PUT']):
        scores['Domain_Reputation'] -= 20
        if app_config.VERBOSE:
            print("Method Score: Major Deduction - DELETE, TRACE, and/or PUT methods enabled. (DOM_REP)", file=sys.stderr)

    # 2. Optimal Check (Positive Bonus)
    # Optimal for a public web page is usually only HEAD (1) and GET (2), resulting in flag 3.
    if flag == 3:
        if app_config.VERBOSE:
            print("Method Score: Optimal - Only HEAD and GET methods enabled. (DOM_REP)", file=sys.stderr)
    elif flag == 7:
        if app_config.VERBOSE:
            print("Method Score: Acceptable - HEAD, GET, and POST methods enabled. (DOM_REP)", file=sys.stderr)

    # --- RDAP Scan ---
    nameservers = rdap_data[0].get("nameserver", [])

    # 1. Redundancy (Major Deduction)
    if len(nameservers) < 2:
        scores['Domain_Reputation'] -= 15
        if app_config.VERBOSE:
            print("RDAP Score: CRITICAL - Less than 2 nameservers (SPOF). (DOM_REP)", file=sys.stderr)
    elif len(nameservers) == 2:
        scores['Domain_Reputation'] -= 2
        if app_config.VERBOSE:
            print("RDAP Score: Deduction - Only 2 nameservers (limited redundancy). (DOM_REP)", file=sys.stderr)
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
        if app_config.VERBOSE:
            print(f"RDAP Score: Minor Deduction - All nameservers on the same vendor ({list(providers)[0]}). (DOM_REP)", file=sys.stderr)
    elif len(providers) > 1:
        pass # Good diversity, no deduction

    #functionality to check tlds against malicious list
    target_tld = rdap_data[0].get("host", "").split('.')[-1]
    print(f"Target TLD: {target_tld}", file=sys.stderr)
    if target_tld in app_config.MAL_TLDS_SLIM:
        scores['Domain_Reputation'] -= 10
        if app_config.VERBOSE:
            print(f"RDAP Score: Minor Deduction - TLD '{target_tld}' is associated with malicious websites. -10 (DOM_REP)", file=sys.stderr)
    else:
        pass # No deduction for TLD reputation


def score_dom_rep_redirect(redirect_data: dict, scores: dict):
    """Enhance Domain Reputation with redirect analysis from /redirect/ tree (Phase 1g).

    Walks the redirect tree returned by the Go worker and counts signal
    types: js → JS redirect (-20), meta → meta refresh (-15),
    refresh → HTML refresh (-10).  Excessive tree depth penalised separately.
    """
    if not redirect_data:
        return

    tree = redirect_data.get("tree")
    if not tree:
        return

    # Walk the tree and collect signal type counts
    js_count = 0
    meta_count = 0
    refresh_count = 0
    node_count = 0

    def _walk(node):
        nonlocal js_count, meta_count, refresh_count, node_count
        if not node:
            return
        node_count += 1
        for sig in node.get("signals", []):
            sig_type = sig.get("type", "").lower()
            if sig_type == "js":
                js_count += 1
            elif sig_type == "meta":
                meta_count += 1
            elif sig_type == "refresh":
                refresh_count += 1
        for child in node.get("children", []):
            _walk(child)

    _walk(tree)

    if js_count > 0:
        scores['Domain_Reputation'] -= 20
        if app_config.VERBOSE:
            print(f"Redirect Score: Deduction - {js_count} JavaScript redirect(s) detected (classic phishing). (DOM_REP)", file=sys.stderr)

    if meta_count > 0:
        scores['Domain_Reputation'] -= 15
        if app_config.VERBOSE:
            print(f"Redirect Score: Deduction - {meta_count} meta redirect(s) detected. (DOM_REP)", file=sys.stderr)

    if refresh_count > 0:
        scores['Domain_Reputation'] -= 10
        if app_config.VERBOSE:
            print(f"Redirect Score: Deduction - {refresh_count} HTML refresh redirect(s) detected. (DOM_REP)", file=sys.stderr)

    # Excessive tree size (analogous to old chain > 4 check)
    visited = redirect_data.get("visited", node_count)
    if visited > 4:
        scores['Domain_Reputation'] -= 5
        if app_config.VERBOSE:
            print(f"Redirect Score: Minor Deduction - Redirect tree has {visited} nodes (> 4). (DOM_REP)", file=sys.stderr)


def score_cred_safety(cert_data:dict, hval_data:dict, scores:dict): #TODO: IMPLEMENT
    """Initial function for Credential Safety scoring function.
    Currently limited, but can be flushed out further.
    """
    tls_version = cert_data.get('connection', {}).get('tls_version')
    sec_flag = hval_data.get("security", 0)

    if tls_version not in ['TLS 1.2', 'TLS 1.3']:
        scores['Credential_Safety'] -= 50
        if app_config.VERBOSE:
            print(f"Cred Safety Score: CRITICAL - Outdated TLS version: {tls_version}. (CRED_SAFETY)", file=sys.stderr)

    if (sec_flag & app_config.SECURITY_FLAGS['HSTS']) == 0:
        scores['Credential_Safety'] -= 20 # This field also docks 20 points in conn_sec
        if app_config.VERBOSE:
            print("Cred Safety Score: Significant Deduction - HSTS header missing. (CRED_SAFETY)", file=sys.stderr)

def score_ip_rep(firewall_data: dict, ipinfo_data: dict, scores: dict):
    """IP Reputation scoring with firewall blocklist + IP geolocation data (Phase 1d)."""
    # Original blocklist check
    blocked = firewall_data.get("Block", False) if firewall_data else False
    if blocked:
        scores['IP_Reputation'] -= 100
        if app_config.VERBOSE:
            print("IP Reputation Score: CRITICAL - IP is listed on a firewall blocklist. (IP_REP)", file=sys.stderr)
        return  # Already maxed out deduction

    # IP Info enrichment (from /ip-info/ endpoint)
    if not ipinfo_data:
        if app_config.VERBOSE:
            print("IP Reputation Score: No ip-info data available. (IP_REP)", file=sys.stderr)
        return

    # Check country
    country = ipinfo_data.get("country_code", "") or ipinfo_data.get("country", "")
    if country.upper() in app_config.HIGH_RISK_COUNTRIES:
        scores['IP_Reputation'] -= 15
        if app_config.VERBOSE:
            print(f"IP Reputation Score: Deduction - Hosted in high-risk country: {country}. (IP_REP)", file=sys.stderr)

    # Check ASN for bulletproof hosting
    asn = ipinfo_data.get("asn", "") or ipinfo_data.get("as_number", "")
    asn_str = str(asn).upper()
    if not asn_str.startswith("AS"):
        asn_str = f"AS{asn_str}"
    if asn_str in app_config.BULLETPROOF_ASNS:
        scores['IP_Reputation'] -= 10
        if app_config.VERBOSE:
            print(f"IP Reputation Score: Deduction - ASN {asn_str} associated with bulletproof hosting. (IP_REP)", file=sys.stderr)

    # Check reverse DNS (PTR record)
    ptr = ipinfo_data.get("hostname", "") or ipinfo_data.get("ptr", "") or ipinfo_data.get("reverse", "")
    if not ptr:
        scores['IP_Reputation'] -= 5
        if app_config.VERBOSE:
            print("IP Reputation Score: Minor Deduction - No reverse DNS (PTR record missing). (IP_REP)", file=sys.stderr)


def score_whois_pattern(rdap_data:dict, scan_date: datetime, scores:dict): #TODO: IMPLEMENT
    """Placeholder for WHOIS Pattern scoring function.
    Currently unused, but can be implemented in the future.
    """
    domain_data = rdap_data[0].get('domain', {})
    host = rdap_data[0].get("host","")
    nameservers = rdap_data[0].get("nameserver", [])
    events = domain_data.get('events', [])
    status = domain_data.get('status', []) #place to check for "client delete prohibited",
    #        "client transfer prohibited",
    #        "client update prohibited",
    #        "server delete prohibited",
    #        "server transfer prohibited",
    #        "server update prohibited" and "add period" (means newly registered)
    client_locks = [
        "client delete prohibited",
        "client transfer prohibited",
        "client update prohibited"
    ]
    server_locks = [
        "server delete prohibited",
        "server transfer prohibited",
        "server update prohibited"
    ]

    if "add period" in status:
        scores['WHOIS_Pattern'] -= 30
        if app_config.VERBOSE:
            print("WHOIS Score: CRITICAL - Domain is newly registered (add period). (WHOIS_PATTERN)", file=sys.stderr)

    # Check for client and server locks
    for lock in client_locks:
        if lock not in status:
            scores['WHOIS_Pattern'] -= 5
            if app_config.VERBOSE:
                print(f"WHOIS Score: Minor Deduction - {lock} is not set. (WHOIS_PATTERN)", file=sys.stderr)

    for lock in server_locks:
        if lock not in status:
            scores['WHOIS_Pattern'] -= 5
            if app_config.VERBOSE:
                print(f"WHOIS Score: Minor Deduction - {lock} is not set. (WHOIS_PATTERN)", file=sys.stderr)

    # Grabs the registration_date from the events list
    registration_date = None #If new, bad. If old, good.
    for event in events:
        # Use .get() here too because eventAction or eventDate might be missing!
        if event.get('eventAction') == 'registration':
            registration_date = event.get('eventDate')
            break

    #Check registration date age for scoring
    if registration_date:
        try:
            # Standardize the RDAP 'Z' suffix to +00:00 for fromisoformat
            reg_date = datetime.fromisoformat(registration_date.replace('Z', '+00:00'))

            # Calculate age in days
            # Ensure scan_date has timezone info to match reg_date (UTC)
            days_old = (scan_date.replace(tzinfo=reg_date.tzinfo) - reg_date).days

            # 1. Age Check (New Domain Penalty)
            if days_old < 30:
                # We use max(0, days_old) to handle cases where clock skew makes age negative
                if app_config.VERBOSE:
                    print(f"WHOIS Score: WARNING - Domain is very new ({max(0, days_old)} days old). (WHO_IS)", file=sys.stderr)
                scores['WHOIS_Pattern'] -= 30
            else:
                if app_config.VERBOSE:
                    print(f"WHOIS Score: INFO - Domain age is {days_old} days. (WHO_IS)", file=sys.stderr)

        except (ValueError, TypeError) as e:
            # Handles malformed RDAP date strings
            if app_config.VERBOSE:
                print(f"WHOIS Score: ERROR - Registration date malformed: {e}. (WHO_IS)", file=sys.stderr)
            scores['WHOIS_Pattern'] -= 5
    else:
        # If no registration event was found in the RDAP data
        if app_config.VERBOSE:
            print("WHOIS Score: WARNING - No registration date found. (WHO_IS)", file=sys.stderr)
        scores['WHOIS_Pattern'] -= 10

    # 1. Access the vcard list safely
    vcard_entries = domain_data.get('entities', [{}])[0].get('vcardArray', [None, []])[1]

    registrar_name = "Unknown"
    extracted_org = "Unknown"
    extracted_fn = "Unknown"

    # 2. Iterate through the jCard entries to find the Formatted Name ('fn')
    for entry in vcard_entries:
        field_type = entry[0]
        field_value = entry[3]

        if field_type == 'org':
            extracted_org = field_value
        elif field_type == 'fn':
            extracted_fn = field_value

    # Logic: Prefer 'org' unless it's missing or generic, then use 'fn'
    if extracted_org != "Unknown":
        registrar_name = extracted_org
    elif extracted_fn != "Unknown":
        registrar_name = extracted_fn

    if app_config.VERBOSE:
        print("WHO_IS Score: Registrar name is ", registrar_name, file=sys.stderr)

    #TODO: put registrar scoring here


def score_content_safety(signals: dict, scores: dict):
    """Score based on page content analysis (live or remote) — Phase 4."""
    if not signals:
        return

    # Unicode threats
    if signals.get('invisible_chars', 0) > 0:
        scores['Content_Safety'] -= 25
        if app_config.VERBOSE:
            print(f"Content Safety: Deduction - {signals['invisible_chars']} invisible characters detected. (CONTENT_SAFETY)", file=sys.stderr)
    if signals.get('rtl_overrides', 0) > 0:
        scores['Content_Safety'] -= 20
        if app_config.VERBOSE:
            print(f"Content Safety: Deduction - {signals['rtl_overrides']} RTL override characters detected. (CONTENT_SAFETY)", file=sys.stderr)
    if signals.get('homoglyph_score', 0) > 50:
        scores['Content_Safety'] -= 15
        if app_config.VERBOSE:
            print(f"Content Safety: Deduction - Homoglyph score {signals['homoglyph_score']} (suspicious). (CONTENT_SAFETY)", file=sys.stderr)

    # Form threats
    if signals.get('form_action_external', False):
        scores['Content_Safety'] -= 20
        if app_config.VERBOSE:
            print("Content Safety: Deduction - Form submits to external domain. (CONTENT_SAFETY)", file=sys.stderr)
    if signals.get('password_fields', 0) > 0 and signals.get('autocomplete_off', False):
        scores['Content_Safety'] -= 10
        if app_config.VERBOSE:
            print("Content Safety: Deduction - Password field with autocomplete disabled. (CONTENT_SAFETY)", file=sys.stderr)

    # Script threats
    if signals.get('eval_calls', 0) > 0:
        scores['Content_Safety'] -= 15
        if app_config.VERBOSE:
            print(f"Content Safety: Deduction - {signals['eval_calls']} eval() calls detected. (CONTENT_SAFETY)", file=sys.stderr)
    if signals.get('document_write', 0) > 0:
        scores['Content_Safety'] -= 10
        if app_config.VERBOSE:
            print(f"Content Safety: Deduction - {signals['document_write']} document.write() calls detected. (CONTENT_SAFETY)", file=sys.stderr)
    if signals.get('base64_blobs', 0) > 2:
        scores['Content_Safety'] -= 15
        if app_config.VERBOSE:
            print(f"Content Safety: Deduction - {signals['base64_blobs']} base64 blobs detected. (CONTENT_SAFETY)", file=sys.stderr)
    if signals.get('obfuscation_score', 0) > 50:
        scores['Content_Safety'] -= 20
        if app_config.VERBOSE:
            print(f"Content Safety: Deduction - Obfuscation score {signals['obfuscation_score']} (suspicious). (CONTENT_SAFETY)", file=sys.stderr)

    # Hidden content
    if signals.get('hidden_iframes', 0) > 0:
        scores['Content_Safety'] -= 20
        if app_config.VERBOSE:
            print(f"Content Safety: Deduction - {signals['hidden_iframes']} hidden iframes detected. (CONTENT_SAFETY)", file=sys.stderr)
    if signals.get('zero_size_elements', 0) > 2:
        scores['Content_Safety'] -= 10
        if app_config.VERBOSE:
            print(f"Content Safety: Deduction - {signals['zero_size_elements']} zero-size elements detected. (CONTENT_SAFETY)", file=sys.stderr)

    # Link threats
    if signals.get('mismatched_links', 0) > 0:
        scores['Content_Safety'] -= 20
        if app_config.VERBOSE:
            print(f"Content Safety: Deduction - {signals['mismatched_links']} mismatched links detected. (CONTENT_SAFETY)", file=sys.stderr)
    if signals.get('data_uri_links', 0) > 0:
        scores['Content_Safety'] -= 10
        if app_config.VERBOSE:
            print(f"Content Safety: Deduction - {signals['data_uri_links']} data URI links detected. (CONTENT_SAFETY)", file=sys.stderr)


def calculate_final_score(weights, scores): #CHANGE
    """
    Calculates the final score using the Weighted Harmonic Mean formula:
    Final Score = (Sum of Weights) / (Sum of (Weight / Score))
    """

    # 1. Calculate the numerator: Sum of all weights (Sum Wi)
    sum_of_weights = 0

    # 2. Calculate the denominator: Sum of the ratio of (Weight / Score) (Sum i Wi/Scorei)
    # This also handles checking for missing scores or zero scores to prevent DivisionByZeroError.
    sum_of_ratios = 0.0

    if app_config.VERBOSE:
        print("\n--- Individual Component Ratios (Wi / Scorei) ---", file=sys.stderr)

    # We only include components in the calculation *if* we have a score for them.
    for tool_name, score in scores.items():
        if tool_name in weights:
            weight = weights[tool_name]
            sum_of_weights += weight

            if score <= 0:
                # If any score is zero or negative, the Harmonic Mean approaches zero.
                # We return 1 immediately as a zero score on a critical factor indicates failure.
                if app_config.VERBOSE:
                    print(f"CRITICAL ERROR: {tool_name} score is 0 or less. Returning Final Score of 1.", file=sys.stderr)
                return 1

            # Calculate the ratio Wi / Scorei
            ratio = weight / score
            sum_of_ratios += ratio

            # Display the components for clarity
            if app_config.VERBOSE:
                print(f"  {tool_name:15}: {weight} / {score:.2f} = {ratio:.4f}", file=sys.stderr)

    if app_config.VERBOSE:
        print("--------------------------------------------------", file=sys.stderr)
        print(f"Sum of Weights (Numerator): {sum_of_weights}", file=sys.stderr)
        print(f"Sum of Ratios (Denominator): {sum_of_ratios:.4f}", file=sys.stderr)

    # 3. Calculate the Final Score
    if sum_of_ratios == 0:
        # This happens if no scores were provided.
        if app_config.VERBOSE:
            print("No valid scores found. Cannot calculate score.", file=sys.stderr)
        return 0.0

    final_score = sum_of_weights / sum_of_ratios
    return final_score

# --- Main Scoring Orchestrator ---

def calculate_security_score(all_scans: dict, scan_date: datetime, live_signals: dict = None) -> dict: #CHANGE
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

    # Add Content_Safety if we have signals (live or remote)
    has_content_signals = live_signals or 'webpage_inspect_scan' in all_scans
    if has_content_signals:
        scores['Content_Safety'] = 100

    if app_config.VERBOSE:
        print(f"\n--- Calculating Scores (Reference Date: {scan_date.strftime('%Y-%m-%d')}) ---", file=sys.stderr)

    # 2. Run each scan function, which will modify the scores dictionary
    try:
        score_cert_health(all_scans['cert_scan'], scan_date, scores)
    except Exception as e:
        print(f"Error in cert_health scan: {e}", file=sys.stderr)

    try:
        score_dns_rec_health(all_scans['dns_scan'], all_scans['rdap_scan'], scores)
    except Exception as e:
        print(f"Error in dns_rec_health scan: {e}", file=sys.stderr)

    try:
        score_conn_sec(all_scans['hval_scan'], all_scans['cert_scan'], scores)
    except Exception as e:
        print(f"Error in conn_sec scan: {e}", file=sys.stderr)

    try:
        score_dom_rep(all_scans['mail_scan'], all_scans['method_scan'], all_scans['rdap_scan'], scores)
    except Exception as e:
        print(f"Error in dom_rep scan: {e}", file=sys.stderr)

    try:
        score_cred_safety(all_scans['cert_scan'], all_scans['hval_scan'], scores)
    except Exception as e:
        print(f"Error in cred_safety scan: {e}", file=sys.stderr)

    try:
        score_whois_pattern(all_scans['rdap_scan'], scan_date, scores)
    except Exception as e:
        print(f"Error in whois_pattern scan: {e}", file=sys.stderr)

    try:
        score_ip_rep(
            all_scans.get('firewall_scan', {}),
            all_scans.get('ipinfo_scan', {}),
            scores
        )
    except Exception as e:
        print(f"Error in ip_rep scan: {e}", file=sys.stderr)

    # Phase 1e: CT log scoring
    try:
        if 'crtsh_scan' in all_scans:
            score_cert_health_ct(all_scans['crtsh_scan'], scores)
    except Exception as e:
        print(f"Error in cert_health_ct scan: {e}", file=sys.stderr)

    # Phase 1g: Redirect analysis
    try:
        if 'redirect_scan' in all_scans:
            score_dom_rep_redirect(all_scans['redirect_scan'], scores)
    except Exception as e:
        print(f"Error in dom_rep_redirect scan: {e}", file=sys.stderr)

    # Phase 4: Content Safety scoring
    try:
        content_signals = live_signals
        if not content_signals and 'webpage_inspect_scan' in all_scans:
            inspect = all_scans['webpage_inspect_scan']
            content_signals = inspect.get('signals', inspect)
        if content_signals and 'Content_Safety' in scores:
            score_content_safety(content_signals, scores)
    except Exception as e:
        print(f"Error in content_safety scan: {e}", file=sys.stderr)

    # Fake-parked penalty: page claims to be parked but uses browser-executed
    # redirects (js/meta/refresh) — likely malvertising or malware delivery.
    try:
        parked_scan = all_scans.get('parked_scan')
        redirect_scan = all_scans.get('redirect_scan')
        is_parked = parked_scan.get("park", False) if parked_scan else False
        if is_parked and _has_suspicious_redirects(redirect_scan):
            scores['Domain_Reputation'] -= 30
            scores['Connection_Security'] -= 15
            scores['Content_Safety'] = scores.get('Content_Safety', 100) - 25
            if app_config.VERBOSE:
                print("Fake-Parked Penalty: Parked page with suspicious redirects — deception penalty applied. (DOM_REP -30, CONN_SEC -15, CONTENT -25)", file=sys.stderr)
    except Exception as e:
        print(f"Error in fake-parked penalty: {e}", file=sys.stderr)

    # 3. Clamp scores between 1 and 100 after all deductions
    for key in scores:
        if key == 'preflight':
            continue
        scores[key] = max(1, min(100, scores[key]))

    # 4. Calculate the final aggregated score
    if scores:
        # Note: calculate_final_score will ignore unused components with weight 0
        average_score = calculate_final_score(app_config.WEIGHTS, scores)
        scores['Aggregated_Score'] = round(average_score, 2)

    return scores
