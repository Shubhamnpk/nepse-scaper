import sys
import os
import json
import argparse
import subprocess
from datetime import datetime, timedelta

# Add the current directory to path to find official_api
sys.path.append(os.path.dirname(__file__))

from official_api import NepseScraper

def get_file_last_commit_date(filepath):
    """Get the datetime of the last git commit for a specific file."""
    try:
        # Use git log to get the Unix timestamp of the last commit for the file
        result = subprocess.run(
            ['git', 'log', '-1', '--format=%ct', filepath],
            capture_output=True,
            text=True,
            check=False
        )
        if result.returncode == 0 and result.stdout.strip():
            return datetime.fromtimestamp(int(result.stdout.strip()))
    except Exception:
        pass
    return None

def load_json_list(filepath):
    """Load a JSON file and return a list, defaulting to an empty list."""
    if not os.path.exists(filepath):
        return []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []

def merge_records_by_id(existing_records, incoming_records):
    """
    Merge two record lists using `id` as the primary key.
    - Existing records are preserved.
    - Incoming records update matching IDs.
    - Incoming records with new IDs are appended.
    """
    merged_by_id = {}
    order = []
    fallback_counter = 0

    def record_key(record):
        nonlocal fallback_counter
        if isinstance(record, dict) and record.get('id') is not None:
            return f"id:{record.get('id')}"
        fallback_counter += 1
        return f"fallback:{fallback_counter}"

    for record in existing_records:
        key = record_key(record)
        if key not in merged_by_id:
            order.append(key)
            merged_by_id[key] = record

    for record in incoming_records:
        key = record_key(record)
        if key in merged_by_id and isinstance(merged_by_id[key], dict) and isinstance(record, dict):
            merged_by_id[key] = {**merged_by_id[key], **record}
        else:
            merged_by_id[key] = record
            if key not in order:
                order.append(key)

    return [merged_by_id[key] for key in order]

def _normalize_text(value):
    """Normalize text for safe duplicate comparisons."""
    return ' '.join(str(value or '').split()).strip().lower()

def filter_general_notices(general_notices, exchange_messages):
    """
    Remove exchange-message entries from general notices.
    Matching strategy:
    1) Same numeric/string id
    2) Same normalized title + body
    """
    notices = general_notices if isinstance(general_notices, list) else []
    exchanges = exchange_messages if isinstance(exchange_messages, list) else []

    exchange_ids = {
        str(item.get('id'))
        for item in exchanges
        if isinstance(item, dict) and item.get('id') is not None
    }
    exchange_title_body = {
        (
            _normalize_text(item.get('messageTitle')),
            _normalize_text(item.get('messageBody'))
        )
        for item in exchanges
        if isinstance(item, dict)
    }

    filtered = []
    removed_count = 0
    for notice in notices:
        if not isinstance(notice, dict):
            filtered.append(notice)
            continue

        notice_id = notice.get('id')
        notice_key = (
            _normalize_text(notice.get('noticeHeading')),
            _normalize_text(notice.get('noticeBody'))
        )

        is_exchange_duplicate = (
            (notice_id is not None and str(notice_id) in exchange_ids)
            or notice_key in exchange_title_body
        )

        if is_exchange_duplicate:
            removed_count += 1
            continue

        filtered.append(notice)

    if removed_count:
        print(f"Filtered out {removed_count} exchange-derived records from notices.")
    return filtered

def scrape_all_official_data(include_brokers=False, include_securities=False):
    print(f"Starting Comprehensive Official NEPSE Scraper at {datetime.now().isoformat()}...")
    
    try:
        # 1. Initialize Scraper
        scraper = NepseScraper(verify_ssl=False)
        
        # Data directory
        # Use absolute path of this file to find the data directory
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        data_dir = os.path.join(base_dir, 'data')
        os.makedirs(data_dir, exist_ok=True)
        
        # 2. Market Status
        print("Checking market status...")
        is_open = scraper.is_market_open()
        market_status = {
            "is_open": is_open,
            "last_checked": datetime.now().isoformat()
        }
        with open(os.path.join(data_dir, 'market_status.json'), 'w') as f:
            json.dump(market_status, f, indent=4)
        
        # 3. Today's Prices
        print("Fetching today's prices...")
        raw_prices = scraper.get_today_price()
        
        mapped_prices = []
        for item in raw_prices:
            symbol = item.get('symbol')
            ltp = item.get('lastUpdatedPrice', 0)
            prev_close = item.get('previousDayClosePrice', 0)
            change = round(ltp - prev_close, 2) if ltp and prev_close else 0
            p_change = round((change / prev_close) * 100, 2) if prev_close != 0 else 0
            
            mapped_prices.append({
                "symbol": symbol,
                "name": item.get('securityName'),
                "ltp": ltp,
                "previous_close": prev_close,
                "change": change,
                "percent_change": p_change,
                "high": item.get('highPrice'),
                "low": item.get('lowPrice'),
                "volume": item.get('totalTradedQuantity'),
                "turnover": item.get('totalTradedValue'),
                "trades": item.get('totalTrades'),
                "last_updated": item.get('lastUpdatedTime'),
                "market_cap": item.get('marketCapitalization')
            })
            
        with open(os.path.join(data_dir, 'nepse_data.json'), 'w') as f:
            json.dump(mapped_prices, f, indent=4)
        
        # 3b. Detailed Securities (Optional)
        if include_securities:
            print("Fetching all securities details...")
            all_securities = scraper.get_all_securities() # Get more details like ISIN
            with open(os.path.join(data_dir, 'all_securities.json'), 'w') as f:
                json.dump(all_securities, f, indent=4)
        else:
            print("Skipping detailed securities (recently updated).")

        # 4. Indices (Live & All Sectoral)
        print("Fetching indices...")
        indices = scraper.get_nepse_index()
        sector_indices = scraper.get_sector_indices()
        with open(os.path.join(data_dir, 'indices.json'), 'w') as f:
            json.dump(indices, f, indent=4)
        with open(os.path.join(data_dir, 'sector_indices.json'), 'w') as f:
            json.dump(sector_indices, f, indent=4)

        # 5. Top Stocks (Full Categories)
        print("Fetching top gainers, losers, turnover, trades, and transactions...")
        categories = ['top_gainer', 'top_loser', 'top_turnover', 'top_trade', 'top_transaction']
        top_stocks = {}
        for cat in categories:
            try:
                top_stocks[cat] = scraper.get_top_stocks(cat, show_all=True)
            except:
                top_stocks[cat] = []
        with open(os.path.join(data_dir, 'top_stocks.json'), 'w') as f:
            json.dump(top_stocks, f, indent=4)

        # 6. Market Summary & History
        print("Fetching market summaries...")
        summary = scraper.get_market_summary()
        summary_history = scraper.get_market_summary_history()
        with open(os.path.join(data_dir, 'market_summary.json'), 'w') as f:
            json.dump(summary, f, indent=4)
        with open(os.path.join(data_dir, 'market_summary_history.json'), 'w') as f:
            json.dump(summary_history, f, indent=4)

        # 7. Notices & News (Restored Disclosures)
        print("Fetching company disclosures...")
        disclosure_data = scraper.get_company_disclosures()
        company_disclosures = disclosure_data.get('companyNews', [])
        exchange_messages = disclosure_data.get('exchangeMessages', [])

        disclosures_path = os.path.join(data_dir, 'disclosures.json')
        exchange_messages_path = os.path.join(data_dir, 'exchange_messages.json')

        existing_company_disclosures = load_json_list(disclosures_path)
        existing_exchange_messages = load_json_list(exchange_messages_path)

        merged_company_disclosures = merge_records_by_id(
            existing_company_disclosures,
            company_disclosures if isinstance(company_disclosures, list) else []
        )
        merged_exchange_messages = merge_records_by_id(
            existing_exchange_messages,
            exchange_messages if isinstance(exchange_messages, list) else []
        )
        
        with open(disclosures_path, 'w', encoding='utf-8') as f:
            json.dump(merged_company_disclosures, f, indent=4)
        
        with open(exchange_messages_path, 'w', encoding='utf-8') as f:
            json.dump(merged_exchange_messages, f, indent=4)

        print("Fetching notices...")
        general_notices = scraper.get_notices()
        filtered_general_notices = filter_general_notices(general_notices, merged_exchange_messages)
        notices_path = os.path.join(data_dir, 'notices.json')

        existing_notices = {}
        if os.path.exists(notices_path):
            try:
                with open(notices_path, 'r', encoding='utf-8') as f:
                    loaded_notices = json.load(f)
                if isinstance(loaded_notices, dict):
                    existing_notices = loaded_notices
            except Exception:
                existing_notices = {}

        existing_general_notices = existing_notices.get('general', [])
        merged_general_notices = merge_records_by_id(
            existing_general_notices if isinstance(existing_general_notices, list) else [],
            filtered_general_notices if isinstance(filtered_general_notices, list) else []
        )

        with open(os.path.join(data_dir, 'notices.json'), 'w') as f:
            # Keep notices file dedicated to general notices only.
            json.dump({
                "general": merged_general_notices,
                "last_updated": datetime.now().isoformat()
            }, f, indent=4)

        # 8. Brokers
        if include_brokers:
            print("Fetching broker list...")
            brokers = scraper.get_brokers()
            with open(os.path.join(data_dir, 'brokers.json'), 'w') as f:
                json.dump(brokers, f, indent=4)
        else:
            print("Skipping broker list (not requested or recently updated).")

        # 9. Supply & Demand (Disabled)
        print("Fetching supply and demand...")
        supply_demand = scraper.get_supply_demand(show_all=True)
        with open(os.path.join(data_dir, 'supply_demand.json'), 'w') as f:
            json.dump(supply_demand, f, indent=4)

        # 10. Live Trades (Only if market open)
        if is_open:
            print("Fetching live trades...")
            live_trades = scraper.get_live_trades()
            with open(os.path.join(data_dir, 'live_trades.json'), 'w') as f:
                json.dump(live_trades, f, indent=4)

        print(f"Successfully completed comprehensive official scraping.")
        return True

    except Exception as e:
        print(f"Error in comprehensive official scraping: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='NEPSE Official Data Scraper')
    parser.add_argument('--brokers', action='store_true', help='Force update broker list')
    parser.add_argument('--securities', action='store_true', help='Force update detailed securities list')
    args = parser.parse_args()
    
    # Use absolute path of this file to find the data directory
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    data_dir = os.path.join(base_dir, 'data')
    
    # helper for age check
    def should_update(filename, force_flag):
        if force_flag:
            return True
        filepath = os.path.join(data_dir, filename)
        if not os.path.exists(filepath):
            print(f"{filename} not found, performing initial fetch...")
            return True
        
        file_time = get_file_last_commit_date(filepath)
        if not file_time:
            file_time = datetime.fromtimestamp(os.path.getmtime(filepath))
        
        age = datetime.now() - file_time
        if age > timedelta(days=60):
            print(f"{filename} is {age.days} days old, updating...")
            return True
        print(f"{filename} is {age.days} days old (limit 60). Skipping update.")
        return False

    include_brokers = should_update('brokers.json', args.brokers)
    include_securities = should_update('all_securities.json', args.securities)
            
    scrape_all_official_data(include_brokers=include_brokers, include_securities=include_securities)
