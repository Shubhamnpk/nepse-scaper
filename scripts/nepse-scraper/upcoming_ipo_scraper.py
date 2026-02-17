import requests
from bs4 import BeautifulSoup
import json
import re
from datetime import datetime

def scrape_upcoming_ipo():
    url = "https://merolagani.com/Ipo.aspx?type=upcoming"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        print(f"Fetching {url}...")
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        announcements_div = soup.find('div', class_='announcement-list')
        if not announcements_div:
            print("No announcement list found.")
            return []
            
        items = announcements_div.find_all('div', class_='media')
        print(f"Found {len(items)} announcements.")
        
        data = []
        
        for item in items:
            try:
                # Extract Announcement Date
                date_elem = item.find('small', class_='text-muted')
                announcement_date = date_elem.get_text(strip=True) if date_elem else ""
                
                # Extract Body Text and Link
                body_div = item.find('div', class_='media-body')
                if not body_div:
                    continue
                    
                link_elem = body_div.find('a')
                if not link_elem:
                    continue
                    
                full_text = link_elem.get_text(strip=True)
                link = link_elem['href']
                if not link.startswith('http'):
                    link = "https://merolagani.com" + link
                
                # Parse text
                # Format: "Company Name is going to issue its X units of IPO shares to the general public starting from DateRange"
                
                company = "Unknown"
                units = "Unknown"
                date_range = "Unknown"
                
                # Split by " is going to issue its "
                parts1 = re.split(r'\s+is\s+going\s+to\s+issue\s+its\s+', full_text, flags=re.IGNORECASE)
                if len(parts1) > 1:
                    company = parts1[0].strip()
                    remainder = parts1[1]
                    
                    # Split by " units of IPO shares "
                    # Note: text says " units of IPO shares to the general public starting from "
                    parts2 = re.split(r'\s+units\s+of\s+IPO\s+shares\s+to\s+the\s+general\s+public\s+starting\s+from\s+', remainder, flags=re.IGNORECASE)
                    
                    if len(parts2) > 1:
                        units = parts2[0].strip()
                        date_range = parts2[1].strip()
                    else:
                        # Try simpler split if phrasing varies
                        parts2 = re.split(r'\s+units\s+', remainder, flags=re.IGNORECASE)
                        if len(parts2) > 1:
                            units = parts2[0].strip()
                            # Try to find "starting from"
                            start_match = re.search(r'starting\s+from\s+(.*)', parts2[1], re.IGNORECASE)
                            if start_match:
                                date_range = start_match.group(1).strip()

                entry = {
                    "company": company,
                    "units": units,
                    "date_range": date_range,
                    "announcement_date": announcement_date,
                    "full_text": full_text,
                    "url": link,
                    "scraped_at": datetime.now().isoformat()
                }
                data.append(entry)
                
            except Exception as e:
                print(f"Error parsing item: {e}")
                continue
                
        return data

    except Exception as e:
        print(f"Error occurred: {e}")
        return None

if __name__ == "__main__":
    from datetime import timedelta
    import os

    new_data = scrape_upcoming_ipo()
    output_file = "data/upcoming_ipo.json"
    history_file = "data/ipo.json"
    os.makedirs("data", exist_ok=True)

    # 1. Load existing data
    existing_items = {}
    history_items = {}
    try:
        if os.path.exists(output_file):
            with open(output_file, "r", encoding='utf-8') as f:
                old_data = json.load(f)
                # Map by URL for easy lookup
                existing_items = {item.get('url'): item for item in old_data if item.get('url')}
    except Exception as e:
        print(f"Error loading existing data: {e}")

    try:
        if os.path.exists(history_file):
            with open(history_file, "r", encoding='utf-8') as f:
                old_history = json.load(f)
                history_items = {item.get('url'): item for item in old_history if item.get('url')}
    except Exception as e:
        print(f"Error loading IPO history data: {e}")

    # 2. Add/Update with new data
    if new_data:
        for item in new_data:
            url = item.get('url')
            if url:
                # Update existing or add new
                existing_items[url] = item

    # 3. Split items:
    # - Keep recent items in upcoming_ipo.json (within last 10 days by scraped_at)
    # - Move older items into data/ipo.json history archive
    now = datetime.now()
    cutoff_date = now - timedelta(days=10)
    
    final_data = []
    archived_data = []
    for item in existing_items.values():
        try:
            scraped_at = item.get('scraped_at')
            if scraped_at:
                item_date = datetime.fromisoformat(scraped_at)
                if item_date > cutoff_date:
                    final_data.append(item)
                else:
                    archived_data.append(item)
            else:
                # If no timestamp, keep it for now but add one
                item['scraped_at'] = now.isoformat()
                final_data.append(item)
        except (ValueError, TypeError):
            # If date parsing fails, keep it
            final_data.append(item)

    # Merge archived entries into history (dedupe by URL)
    for item in archived_data:
        url = item.get('url')
        if url:
            history_items[url] = item

    history_list = list(history_items.values())
    history_list.sort(key=lambda x: x.get('scraped_at', ''), reverse=True)

    # 4. Save results
    if final_data:
        # Sort by scraped_at descending so newest are first
        final_data.sort(key=lambda x: x.get('scraped_at', ''), reverse=True)
        
        with open(output_file, "w", encoding='utf-8') as f:
            json.dump(final_data, f, indent=4, ensure_ascii=False)
        print(f"Successfully processed {len(final_data)} upcoming items (New: {len(new_data) if new_data else 0}). Saved to {output_file}")
    else:
        print("No data to save.")

    with open(history_file, "w", encoding='utf-8') as f:
        json.dump(history_list, f, indent=4, ensure_ascii=False)
    print(f"Archived IPO history count: {len(history_list)}. Saved to {history_file}")
