
import requests
from bs4 import BeautifulSoup
import re
import json

def get_sector_wise_codes():
    url = "https://merolagani.com/CompanyList.aspx"
    try:
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # The structure is likely an accordion.
        # Based on markdown view: links to #collapse_X are headers.
        # The content is in the element with id collapse_X.
        
        sectors = {}
        
        # Find all elements that link to a collapse section
        # Trying a generic approach: look for 'a' tags with href starting with #collapse or matching pattern
        accordion_toggles = soup.find_all('a', href=re.compile(r'#collapse_\d+'))
        
        print(f"Found {len(accordion_toggles)} sector groupings.")
        
        for toggle in accordion_toggles:
            sector_name = toggle.get_text(strip=True)
            target_id = toggle['href'].replace('#', '')
            
            # Find the content div
            content_div = soup.find(id=target_id)
            
            if content_div:
                # Find all company links inside
                company_links = content_div.find_all('a', href=re.compile(r'CompanyDetail\.aspx\?symbol='))
                
                symbols = []
                for link in company_links:
                    # Extract symbol from href or text
                    href = link['href']
                    # href might be "CompanyDetail.aspx?symbol=ADBL"
                    # extraction
                    match = re.search(r'symbol=([a-zA-Z0-9]+)', href, re.IGNORECASE)
                    if match:
                        symbol = match.group(1)
                        symbols.append(symbol)
                    else:
                        # Fallback to text
                        symbols.append(link.get_text(strip=True))
                
                # Check if sector already exists (sometimes multiple toggles might point to same or duplicate names?)
                # Usually distinct.
                if sector_name in sectors:
                    print(f"Warning: Duplicate sector name {sector_name}")
                
                sectors[sector_name] = symbols
                print(f"Sector: {sector_name}, Count: {len(symbols)}")
                
        return sectors

    except Exception as e:
        print(f"Error fetching data: {e}")
        return None

if __name__ == "__main__":
    data = get_sector_wise_codes()
    if data:
        # Assuming script runs from root or adjusts path
        output_file = "data/nepse_sector_wise_codes.json"
        with open(output_file, "w") as f:
            json.dump(data, f, indent=4)
        print(f"Successfully saved sector-wise codes to {output_file}")
