import sys
import os
import json
import urllib.parse
import re

# Add the current directory to path to find official_api
sys.path.append(os.path.dirname(__file__))

from official_api import NepseScraper

def clean_html(raw_html):
    """Remove HTML tags and extra whitespace."""
    if not raw_html:
        return ""
    # Remove HTML tags
    cleanr = re.compile('<.*?>')
    cleantext = re.sub(cleanr, '', raw_html)
    # Replace common HTML entities
    cleantext = cleantext.replace('&nbsp;', ' ').replace('&quot;', '"').replace('&amp;', '&')
    # Remove extra spaces
    return ' '.join(cleantext.split())

def get_attachment_url(file_path):
    """Constructs the full, valid download URL for a given attachment file path."""
    if not file_path:
        return None
    # Base URL for fetching NEPSE files
    base_url = "https://www.nepalstock.com.np/api/nots/security/fetchFiles?fileLocation="
    # URL encode the file path (converts spaces to %20)
    encoded_path = urllib.parse.quote(file_path)
    return base_url + encoded_path

def extract_symbol(title):
    """Attempt to extract the company symbol from the title text."""
    if not title:
        return ""
    # Matches [SYMBOL] (Company news format)
    match = re.search(r'\[([A-Za-z0-9]+)\]', title)
    if match:
        return match.group(1).upper()
    # Matches (SYMBOL) (Exchange message format)
    match = re.search(r'\(([A-Za-z0-9]+)\)', title)
    if match:
        return match.group(1).upper()
    return ""

def scrape_and_format_disclosures():
    print("Initializing NEPSE Scraper...")
    scraper = NepseScraper(verify_ssl=False)
    
    print("Fetching Corporate Disclosures from NEPSE API...")
    data = scraper.get_company_disclosures()
    
    clean_disclosures = []
    
    # 1. Process Company News (General Corporate Disclosures)
    for news in data.get('companyNews', []):
        title = clean_html(news.get("newsHeadline", ""))
        symbol = extract_symbol(title)
        
        entry = {
            "type": "Company News",
            "symbol": symbol,
            "title": title,
            "body": clean_html(news.get("newsBody", "")),
            "date": news.get("addedDate", ""),
            "source": news.get("newsSource", ""),
            "attachment_urls": []
        }
        
        # Extract attachments for company news
        for doc in news.get("applicationDocumentDetailsList", []):
            file_path = doc.get("filePath")
            url = get_attachment_url(file_path)
            if url:
                entry["attachment_urls"].append(url)
        
        clean_disclosures.append(entry)
        
    # 2. Process Exchange Messages (Often IPOs, Bonus Shares listings)
    for msg in data.get('exchangeMessages', []):
        title = clean_html(msg.get("messageTitle", ""))
        symbol = extract_symbol(title)
        
        entry = {
            "type": "Exchange Message",
            "symbol": symbol,
            "title": title,
            "body": clean_html(msg.get("messageBody", "")),
            "date": msg.get("addedDate", ""),
            "source": "NEPSE Exchange Message",
            "attachment_urls": []
        }
        
        file_path = msg.get("filePath")
        url = get_attachment_url(file_path)
        if url:
            entry["attachment_urls"].append(url)
            
        clean_disclosures.append(entry)
        
    # Sort disclosures so newest are first
    clean_disclosures.sort(key=lambda x: x['date'], reverse=True)
        
    # Paths for output
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    data_dir = os.path.join(base_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    output_path = os.path.join(data_dir, "corporate_disclosures_cleaned.json")
    
    # Save the formatted payload
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(clean_disclosures, f, indent=4, ensure_ascii=False)
        
    print(f"Successfully formatted and saved {len(clean_disclosures)} disclosures to:")
    print(f"-> {output_path}")

if __name__ == "__main__":
    scrape_and_format_disclosures()
