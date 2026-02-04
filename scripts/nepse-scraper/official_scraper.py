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
        
        with open(os.path.join(data_dir, 'disclosures.json'), 'w') as f:
            json.dump(company_disclosures, f, indent=4)
        
        with open(os.path.join(data_dir, 'exchange_messages.json'), 'w') as f:
            json.dump(exchange_messages, f, indent=4)

        print("Fetching notices...")
        general_notices = scraper.get_notices()
        with open(os.path.join(data_dir, 'notices.json'), 'w') as f:
            # Save as a structured dictionary for better organization
            json.dump({
                "general": general_notices,
                "company": company_disclosures,
                "exchange": exchange_messages,
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
