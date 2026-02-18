import os
import requests
import pandas as pd
import time
from requests.auth import HTTPBasicAuth
from datetime import datetime
import argparse
import json
import sys

# --- CONFIGURATION ---
API_KEY = os.environ.get("COMPANIES_HOUSE_API_KEY")
BASE_URL = "https://api.company-information.service.gov.uk"

# Target high-interest lenders to flag (extended list from previous context)
BLACK_LIST_LENDERS = [
    "IWOCA", "YOULEND", "LIBERIS", "CAPIFY", 
    "TOGETHER COMMERCIAL", "TOGETHER MONEY", 
    "MOMENTA", "NUCLEUS", "FLEXIMIZE", 
    "MARKET FINANCIAL SOLUTIONS", "MFS", 
    "GLENHAWK", "ROMA FINANCE", "OCTOPUS REAL ESTATE",
    "365 BUSINESS FINANCE", "365 FINANCE"
]

def search_prospects(location="M3", sic_codes="", inc_from="2015-01-01", inc_to="2023-01-01"):
    """
    Stage 1: Advanced Search for companies by region and age.
    """
    if not API_KEY:
        print("ERROR: COMPANIES_HOUSE_API_KEY environment variable not set.")
        return []

    print(f"Searching Companies House [Location: {location}, Inc: {inc_from} to {inc_to}]...")
    endpoint = f"{BASE_URL}/advanced-search/companies"
    params = {
        "location": location,
        "incorporated_from": inc_from,
        "incorporated_to": inc_to,
        "company_status": "active",
        "size": 50  # Results per page
    }
    
    if sic_codes:
        params["sic_codes"] = sic_codes
    
    try:
        response = requests.get(endpoint, auth=HTTPBasicAuth(API_KEY, ''), params=params)
        response.raise_for_status()
        return response.json().get('items', [])
    except Exception as e:
        print(f"Search failed: {e}")
        return []

def check_high_interest_debt(company_number):
    """
    Stage 2: Check charges for high-interest debt markers.
    """
    endpoint = f"{BASE_URL}/company/{company_number}/charges"
    try:
        response = requests.get(endpoint, auth=HTTPBasicAuth(API_KEY, ''))
        
        if response.status_code == 404:
            return None # No charges
        
        if response.status_code != 200:
            return None
        
        charges = response.json().get('items', [])
        high_rate_found = []
        
        for charge in charges:
            # Only look at outstanding debt
            if charge.get('status') == 'outstanding':
                persons = charge.get('persons_entitled', [])
                for p in persons:
                    lender_name = p.get('name', '').upper()
                    
                    # Check against blacklist
                    for blacklisted in BLACK_LIST_LENDERS:
                        if blacklisted in lender_name:
                            high_rate_found.append({
                                "Lender": lender_name,
                                "Created": charge.get('created_on'),
                                "Status": charge.get('status'),
                                "Blacklist_Match": blacklisted
                            })
                            break # Found a match for this person, move to next
        return high_rate_found
        
    except Exception as e:
        print(f"Charge check failed for {company_number}: {e}")
        return None

import json
import sys

# ... imports ...

# ... existing code ...

# --- EXECUTION ---
# --- EXECUTION ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--location", type=str, default="Manchester")
    parser.add_argument("--sic_codes", type=str, default="")
    parser.add_argument("--inc_from", type=str, default="2015-01-01")
    parser.add_argument("--inc_to", type=str, default="2023-01-01")
    
    args = parser.parse_args()
    
    global json_mode
    json_mode = args.json
    
    if not API_KEY:
        if json_mode:
            print("[]")
        else:
            print("Please set COMPANIES_HOUSE_API_KEY environment variable.", file=sys.stderr)
        exit(1)

    if not json_mode:
        print(f"Searching Companies House [Location: {args.location}, SIC: {args.sic_codes}, Inc: {args.inc_from} to {args.inc_to}]...")

    # 1. Broad Search
    raw_companies = search_prospects(
        location=args.location,
        sic_codes=args.sic_codes,
        inc_from=args.inc_from,
        inc_to=args.inc_to
    )
    
    if not json_mode:
        print(f"Found {len(raw_companies)} candidates. Checking for debt markers...")

    prospect_list = []

    # 2. Deep Dive
    for co in raw_companies:
        co_num = co.get('company_number')
        co_name = co.get('company_name')
        
        # Rate limiting (600/5min = 2/sec, so 0.5s sleep is safe)
        time.sleep(0.5) 
        
        debt_markers = check_high_interest_debt(co_num)
        
        if debt_markers or json_mode:
            if not json_mode and debt_markers:
                print(f"🚨 MATCH FOUND: {co_name} ({co_num})")
            
            prospect_list.append({
                "companyName": co_name,
                "companyNumber": co_num,
                "sicCodes": co.get('sic_codes', []),
                "incorporationDate": co.get('date_of_creation'),
                "debtMarkers": debt_markers or []
            })

    # 3. Export / Output
    if json_mode:
        print(json.dumps(prospect_list))
    else:
        if prospect_list:
            df = pd.DataFrame(prospect_list)
            filename = f"high_priority_refi_leads_{datetime.now().strftime('%Y%m%d')}.csv"
            df.to_csv(filename, index=False)
            print(f"\n✅ Workflow Complete. {len(prospect_list)} high-priority leads exported to {filename}.")
        else:
            print("\nℹ️ No high-interest debt markers found in this batch.")
