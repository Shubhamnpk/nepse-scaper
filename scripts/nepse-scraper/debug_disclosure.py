
import sys
import os
import json

# Add the current directory to path to find official_api
sys.path.append(os.path.dirname(__file__))

from official_api import NepseScraper

def debug_disclosure():
    scraper = NepseScraper(verify_ssl=False)
    
    # 1. Test existing disclosure endpoint
    print("Testing /api/nots/news/companies/disclosure...")
    endpoint = scraper.endpoints['disclosure']
    response = scraper.session.get(endpoint['api'])
    print(f"Status Code: {response.status_code}")
    try:
        data = response.json()
        print(f"Keys in JSON: {list(data.keys())}")
        if 'news' in data:
            print(f"News count: {len(data['news'])}")
        else:
            print("Full data:", json.dumps(data, indent=2))
    except:
        print("Raw response:", response.text[:500])

    # 2. Try some alternative paths if empty
    alternatives = [
        "/api/nots/disclosure",
        "/api/nots/news/disclosure",
        "/api/web/disclosure"
    ]
    
    for path in alternatives:
        print(f"\nTrying alternative: {path}...")
        try:
            resp = scraper.session.get(path)
            if resp.status_code == 200:
                print(f"[SUCCESS] {path} returned 200")
                print(f"Data snippet: {resp.text[:200]}")
            else:
                print(f"[FAILED] {path} returned {resp.status_code}")
        except Exception as e:
            print(f"[ERROR] {path}: {e}")

if __name__ == "__main__":
    debug_disclosure()
