import json
import subprocess
from typing import Optional, List, Tuple, Dict
from concurrent.futures import ThreadPoolExecutor
from config import BASE_URL, API_ENDPOINTS

# --- Data Fetching Function (Using 'curl' subprocess) ---

def execute_curl_command(command: List[str]) -> Optional[str]: #KEEP
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

def process_single_endpoint(host: str, endpoint: str) -> tuple[str | None, dict | None]:
    """
    (Formerly fetch_scan_data's loop content) Fetches, parses, and returns 
    the data for a single endpoint using cURL subprocess.
    Returns (scan_key, data) on success or (None, None) on failure.
    """
    # 1. Key Generation
    # Map endpoint to the key used in scoring functions (e.g., 'cert' -> 'cert_scan')
    scan_key = f"{endpoint}_scan" if endpoint != 'title' else None
    if not scan_key: 
        return (None, None)

    # 2. URL Construction
    query = ''
    if endpoint == 'dns':
        query = '?A&AAAA&CNAME&DNS&MX&TXT'
    full_url = f"{BASE_URL}{endpoint}/{host}{query}"
    
    # 3. Define the cURL command
    CURL_COMMAND = ['curl', '-s', full_url]

    print(f"\n[Processing Endpoint: {endpoint.upper()}]")

    # 4. Execute the command
    output = execute_curl_command(CURL_COMMAND)
    
    if output is None:
        print(f"--> Endpoint {endpoint.upper()} failed execution. Skipping.")
        return (None, None)
    
    # 5. Parse the JSON output
    try:
        data = json.loads(output)
        # Note: Printing final success message after command execution for clarity
        return (scan_key, data)
    except json.JSONDecodeError:
        print(f"--> Endpoint {endpoint.upper()} returned invalid JSON. Skipping.")
        return (None, None)
    except Exception as e:
        print(f"--> An error occurred processing {endpoint.upper()}: {e}")
        return (None, None)

def fetch_scan_data_concurrent(host: str) -> dict: 
    """
    Coordinates concurrent fetching of scan data from all API endpoints 
    using a ThreadPoolExecutor.
    """
    all_scans = {}
    print(f"\n--- Fetching live data for {host} from NetStar API (via concurrent cURL) ---")

    # Use ThreadPoolExecutor to run tasks in parallel
    # The number of workers is set to the number of endpoints to run all simultaneously
    with ThreadPoolExecutor(max_workers=len(API_ENDPOINTS)) as executor:
        
        # 'executor.map' schedules 'process_single_endpoint' for all items in API_ENDPOINTS.
        # It requires that 'host' is repeated for each call.
        future_results = executor.map(
            process_single_endpoint, 
            [host] * len(API_ENDPOINTS), # host repeated for each worker
            API_ENDPOINTS               # endpoint is iterated over
        )
        
        # Aggregate the results as they complete
        for scan_key, data in future_results:
            if scan_key and data:
                all_scans[scan_key] = data

    print("\n--- Data fetching complete ---")
    return all_scans
