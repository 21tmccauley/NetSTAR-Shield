import sys
import argparse
import time
from datetime import datetime
from typing import Dict

# 1. Import everything needed from the new files
from config import DEFAULT_URL, WEIGHTS
from data_fetch import fetch_scan_data_concurrent
from scoring_logic import calculate_security_score

# --- Test Data ---
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

    # ----------------------------------------------------
    # START TIMER 
    start_time = time.time()
    # ----------------------------------------------------

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
        # *** CHANGED TO THE CONCURRENT FETCH FUNCTION ***
        all_scans = fetch_scan_data_concurrent(args.target)
    
    # 3. Check if we have data, then calculate and print scores
    if not all_scans:
        print("No scan data was retrieved. Exiting.")
        sys.exit(1)

    final_scores = calculate_security_score(all_scans, scan_date)
    
    # ----------------------------------------------------
    # END TIMER AND CALCULATE 
    end_time = time.time()
    elapsed_time = end_time - start_time
    # ----------------------------------------------------

    print("\n--- Individual Scan Scores (Max 100) ---")
    for key, value in final_scores.items():
        if key != 'Aggregated_Score':
            print(f"{key:<15}: {value}")
            
    print("\n-------------------------------------------")
    print(f"AGGREGATED SECURITY SCORE: {final_scores.get('Aggregated_Score')}")
    print("-------------------------------------------")

    # ----------------------------------------------------
    # PRINT THE ELAPSED TIME 
    print(f"Total execution time: {elapsed_time:.2f} seconds")
    print("-------------------------------------------")

