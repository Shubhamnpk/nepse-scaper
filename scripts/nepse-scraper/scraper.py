import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime

def scrape_nepse():
    # Using live-trading URL as it's active and contains the same data
    url = "https://www.sharesansar.com/live-trading"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        # Based on inspection, the table ID is 'headFixed'
        table = soup.find('table', {'id': 'headFixed'})
        
        if not table:
            # Fallback if ID changed but it's the only dataTable
            table = soup.find('table', {'class': 'dataTable'})
            
        if not table:
            print("Table not found!")
            return None
            
        rows = table.find('tbody').find_all('tr') if table.find('tbody') else table.find_all('tr')[1:]
        data = []
        
        for row in rows:
            cols = row.find_all('td')
            if len(cols) >= 10:
                symbol = cols[1].text.strip()
                ltp = cols[2].text.strip().replace(',', '')
                prev_close = cols[9].text.strip().replace(',', '')
                change = cols[3].text.strip().replace(',', '')
                p_change = cols[4].text.strip().replace(',', '').replace('%', '')
                high = cols[6].text.strip().replace(',', '')
                low = cols[7].text.strip().replace(',', '')
                volume = cols[8].text.strip().replace(',', '')
                
                try:
                    data.append({
                        "symbol": symbol,
                        "ltp": float(ltp) if ltp and ltp != '-' else 0.0,
                        "previous_close": float(prev_close) if prev_close and prev_close != '-' else 0.0,
                        "change": float(change) if change and change != '-' else 0.0,
                        "percent_change": float(p_change) if p_change and p_change != '-' else 0.0,
                        "high": float(high) if high and high != '-' else 0.0,
                        "low": float(low) if low and low != '-' else 0.0,
                        "volume": float(volume) if volume and volume != '-' else 0.0,
                        "last_updated": datetime.now().isoformat()
                    })
                except ValueError as e:
                    print(f"Skipping row for {symbol} due to parsing error: {e}")
                    continue
        
        return data

    except Exception as e:
        print(f"Error occurred: {e}")
        return None

def save_data(data):
    if data:
        with open('data/nepse_data.json', 'w') as f:
            json.dump(data, f, indent=4)
        print(f"Successfully saved {len(data)} items to data/nepse_data.json")
    else:
        print("No data to save")

if __name__ == "__main__":
    print("Starting NEPSE Scraper...")
    scraped_data = scrape_nepse()
    save_data(scraped_data)
