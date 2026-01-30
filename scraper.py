import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime

def scrape_nepse():
    url = "https://www.sharesansar.com/today-price"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        table = soup.find('table', {'id': 'head-obj'})
        
        if not table:
            print("Table not found!")
            return None
            
        rows = table.find_all('tr')
        data = []
        
        # Headers are usually in the first row
        for row in rows[1:]: # Skip the header row
            cols = row.find_all('td')
            if len(cols) > 0:
                symbol = cols[1].text.strip()
                ltp = cols[6].text.strip().replace(',', '')
                prev_close = cols[5].text.strip().replace(',', '')
                
                data.append({
                    "symbol": symbol,
                    "ltp": float(ltp) if ltp else 0.0,
                    "previous_close": float(prev_close) if prev_close else 0.0,
                    "last_updated": datetime.now().isoformat()
                })
        
        return data

    except Exception as e:
        print(f"Error occurred: {e}")
        return None

def save_data(data):
    if data:
        with open('nepse_data.json', 'w') as f:
            json.dump(data, f, indent=4)
        print(f"Successfully saved {len(data)} items to nepse_data.json")
    else:
        print("No data to save")

if __name__ == "__main__":
    print("Starting NEPSE Scraper...")
    scraped_data = scrape_nepse()
    save_data(scraped_data)
