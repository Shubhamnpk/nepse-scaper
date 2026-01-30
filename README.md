# YONEPSE - Real-time Stock Dashboard

![YONEPSE](https://img.shields.io/badge/Status-Active-success)
![License](https://img.shields.io/badge/License-MIT-blue)

A modern, elegant, and responsive dashboard for tracking live stock prices from the Nepal Stock Exchange (NEPSE). This project uses GitHub Actions to automatically scrape data and updates a beautiful static site.

---

## 🚀 Features

- **Live Market Data**: Automatically updated every 30 minutes during market hours.
- **Modern UI**: Glassmorphism design, dark mode, and responsive layout.
- **Sector Filtering**: Filter stocks by sectors (Hydro, Banking, etc.) using a custom dropdown.
- **Instant Search**: Real-time search by stock symbol or company name.
- **Automated Scraping**: Zero-maintenance data updates via GitHub Actions.

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla CSS (Glassmorphism), Vanilla JavaScript.
- **Backend/Scraper**: Python (BeautifulSoup, Requests).
- **Automation**: GitHub Actions (Scheduled Cron Jobs).
- **Data Source**: [Merolagani](https://merolagani.com).

## 📦 Installation & Usage

### 1. Fork & Setup
1. Fork this repository.
2. Enable **GitHub Actions** in the 'Actions' tab.
3. Enable **GitHub Pages** from Settings > Pages (Deploy from `main` branch).

### 2. Run Locally
To view the dashboard on your local machine:

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/nepse-scraper.git
   cd nepse-scraper
   ```

2. Start the local server (Windows):
   Double-click the **`start_server.bat`** file.
   
   *Or run manually via terminal:*
   ```bash
   python -m http.server 8000
   ```
   
3. Open `http://localhost:8000` in your browser.

### 3. Updating Data Manually
To force a data update locally:
```bash
cd scripts/nepse-scraper
pip install -r requirements.txt
python scraper.py
```

## 🤝 Credits

- **Developers**: [My Wallet Team] & [Yoguru Team] & @Shubhamnpk
- **Data Source**: Data is scraped from [Merolagani](https://merolagani.com) for educational purposes.

## 📄 License

This project is open-source and available under the MIT License.
