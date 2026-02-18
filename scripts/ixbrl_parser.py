import os
import requests
import json
import argparse
import sys
from bs4 import BeautifulSoup
import re
from requests.auth import HTTPBasicAuth
from datetime import datetime

# --- CONFIGURATION ---
API_KEY = os.environ.get("COMPANIES_HOUSE_API_KEY")
BASE_URL = "https://api.company-information.service.gov.uk"
DOC_API_URL = "https://document-api.company-information.service.gov.uk"

# Global debug log
debug_logs = []

def log(msg):
    debug_logs.append(msg)
    # Also print to stderr just in case
    print(msg, file=sys.stderr)

def get_latest_accounts(company_number):
    """Fetch filing history and find latest accounts."""
    endpoint = f"{BASE_URL}/company/{company_number}/filing-history"
    params = {"category": "accounts", "items_per_page": 5}
    
    try:
        response = requests.get(endpoint, auth=HTTPBasicAuth(API_KEY, ''), params=params)
        response.raise_for_status()
        items = response.json().get('items', [])
        
        if not items:
            return None
            
        for item in items:
            if 'links' in item and 'document_metadata' in item['links']:
                return item
        return None
    except Exception as e:
        log(f"Error fetching filing history: {e}")
        return None

def fetch_document_content(document_metadata_url):
    try:
        # 1. Get Metadata
        headers = {"Accept": "application/json"}
        
        # Check metadata URL
        log(f"Fetching metadata from: {document_metadata_url}")
        
        meta_response = requests.get(document_metadata_url, auth=HTTPBasicAuth(API_KEY, ''), headers=headers)
        meta_response.raise_for_status()
        metadata = meta_response.json()
        
        resources = metadata.get('resources', {})
        
        log(f"Metadata Resources keys: {list(resources.keys())}")
        # DEBUG: Print first resource content
        if resources:
            first_key = list(resources.keys())[0]
            log(f"Sample Resource ({first_key}): {resources[first_key]}")

        content_url = None
        content_type = None
        
        prospects = ['application/xhtml+xml', 'text/html']
        
        for p in prospects:
            if p in resources:
                # Some endpoints return content_url, some might be different.
                res_obj = resources[p]
                if isinstance(res_obj, dict):
                     content_url = res_obj.get('content_url')
                     # Check other common keys if content_url missing?
                     if not content_url:
                         log(f"Resource {p} found but no content_url. Keys: {list(res_obj.keys())}")
                else:
                     log(f"Resource {p} is not dict: {type(res_obj)}")

                if content_url:
                    content_type = p
                    break
        
        if not content_url:
            # Fallback: Try appending /content to document_metadata_url
            # This is common pattern if resources don't have explicit URLs
            log("No explicit content_url in resources. Trying fallback: /content")
            content_url = document_metadata_url + "/content"
            # Default to xhtml (or try both?)
            # We'll just set content_type to first prospect (xhtml) for Accept header
            content_type = prospects[0]
            
        log(f"Content URL: {content_url}")
        
        # 2. Fetch Content
        doc_headers = {"Accept": content_type}
        
        auth = None
        if "s3" not in content_url and "amazon" not in content_url and "Signature" not in content_url:
             auth = HTTPBasicAuth(API_KEY, '')
        else:
             log("URL appears to be S3 signed, skipping Auth")

        doc_response = requests.get(content_url, auth=auth, headers=doc_headers)
        
        if doc_response.status_code != 200:
             log(f"Fetch failed {doc_response.status_code}: {doc_response.text[:200]}")
             
        doc_response.raise_for_status()
        
        return doc_response.content, content_type

    except Exception as e:
        log(f"Error fetching document: {e}")
        return None, str(e)

def extract_financials(html_content):
    """Parse iXBRL/HTML for specific tags."""
    try:
        soup = BeautifulSoup(html_content, 'lxml')
        
        
        # DEBUG: Dump all ix:nonNumeric and ix:numeric tags to see what we have
        all_tags = soup.find_all(lambda tag: tag.name in ['ix:nonnumeric', 'ix:numeric'])
        log(f"DEBUG: Found {len(all_tags)} XBRL tags.")
        unique_names = set()
        for t in all_tags:
             if t.has_attr('name'):
                 unique_names.add(t['name'])
        log(f"DEBUG: Unique Tag Names: {sorted(list(unique_names))}")

        metrics = {
            "netAssets": None,
            "cash": None,
            "creditors": None,
            "shareholderFunds": None,
            "currency": "GBP"
        }
        
        # Mapping mapping standard tags to our metrics
        # Tags usually look like <ix:nonNumeric name="uk-gaap:NetAssetsLiabilities" ...>
        # or <ix:numeric name="uk-gaap:NetAssetsLiabilities" ...>value</ix:numeric>
        
        def find_value(names):
            # Try to find the most recent context (often hard to determine without parsing contexts)
            # Strategy: Collect all values, pick the one with "Current" context or largest/latest date match
            # Simplistic approach: Finding the first matching tag that often correspond to current period in typical templates
            
            # Refined strategy: Look for tags with 'contextRef'. 
            # Parse contexts? Too complex for MVP.
            # Better MVP: Find all, try to check if contextRef contains "Current" or "End". 
            # Or just grab the first one (often current).
            
            found_tags = []
            for name in names:
                tags = soup.find_all(attrs={"name": name}) # logic for name attribute
                # BS4 searching for name attribute specifically? 
                # name="uk-gaap:..."
                # soup.find_all(name="ix:nonNumeric", attrs={"name": ...})
                
                # Using lambda to finding tags with name attribute ignoring namespace prefix in tag name
                tags = soup.find_all(lambda tag: tag.has_attr('name') and tag['name'] == name)
                found_tags.extend(tags)
            
            # Clean values
            values = []
            for t in found_tags:
                text = t.get_text().strip().replace(',', '').replace('(', '-').replace(')', '')
                # Handle sign attribute
                sign = t.get('sign', '')
                try:
                    val = float(text)
                    if sign == '-': val = -val
                    # Filter out zero placeholders if suspicious? No, 0 is valid.
                    values.append(val)
                except:
                    pass
            
            # Heuristic: If 2 values, usually [Current, Previous]. Return first.
            if values:
                return values[0]
            return None

        # Net Assets
        metrics["netAssets"] = find_value([
            "uk-gaap:NetAssetsLiabilities", 
            "uk-gaap:NetAssetsLiabilitiesIncludingPensionAssetLiability",
            "core:Equity"
        ])
        
        # Cash
        metrics["cash"] = find_value([
            "uk-gaap:CashBankOnHand",
            "uk-gaap:CashBankInHand"
        ])
        
        # Creditors (Short Term)
        metrics["creditors"] = find_value([
            "uk-gaap:CreditorsDueWithinOneYear"
        ])
        
        # Shareholder Funds
        metrics["shareholderFunds"] = find_value([
            "uk-gaap:ShareholderFunds"
        ])
        
        return metrics

    except Exception as e:
        print(f"Error parsing iXBRL: {e}", file=sys.stderr)
        return {}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("company_number", type=str)
    args = parser.parse_args()
    
    if not API_KEY:
        print(json.dumps({"error": "No API Key"}))
        return

    company_number = args.company_number.strip().zfill(8) # ensure 8 digits
    
    # 1. Get Filing
    filing = get_latest_accounts(company_number)
    if not filing:
        print(json.dumps({"error": "No accounts found"}))
        return
        
    doc_url = filing['links']['document_metadata']
    doc_date = filing.get('date')
    
    # 2. Get Content
    content, content_type = fetch_document_content(doc_url)
    if not content:
        print(json.dumps({"error": "Could not retrieve document content", "details": content_type}))
        return
        
    # 3. Parse
    metrics = extract_financials(content)
    metrics["filingDate"] = doc_date
    metrics["docType"] = content_type
    metrics["logs"] = debug_logs
    
    # 4. Calculate Ratios
    # Crisis Ratio = Cash / Creditors
    if metrics.get("cash") is not None and metrics.get("creditors") and metrics["creditors"] > 0:
        metrics["crisisRatio"] = round(metrics["cash"] / metrics["creditors"], 2)
    else:
        metrics["crisisRatio"] = None

    print(json.dumps(metrics))

if __name__ == "__main__":
    main()
