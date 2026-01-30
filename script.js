document.addEventListener('DOMContentLoaded', () => {
    const stockGrid = document.getElementById('stock-grid');
    const searchInput = document.getElementById('search-input');
    const updateTimeEl = document.getElementById('update-time');
    const totalScannedEl = document.getElementById('total-scanned');
    const marketSummaryEl = document.getElementById('market-summary');

    let allStocks = [];

    async function fetchStocks() {
        try {
            const response = await fetch('./nepse_data.json');
            if (!response.ok) throw new Error('Failed to fetch data');
            
            allStocks = await response.json();
            renderStocks(allStocks);
            updateMetadata(allStocks);
        } catch (error) {
            console.error('Error:', error);
            stockGrid.innerHTML = `
                <div class="status-item" style="color: var(--danger); grid-column: 1/-1;">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    Failed to load market data. Please try again later.
                </div>
            `;
        }
    }

    function updateMetadata(stocks) {
        if (stocks.length === 0) return;

        // Update time from the first item
        const lastUpdated = new Date(stocks[0].last_updated);
        updateTimeEl.textContent = `Live as of ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        
        totalScannedEl.textContent = `${stocks.length} Companies Tracked`;

        const gainers = stocks.filter(s => s.change > 0).length;
        const losers = stocks.filter(s => s.change < 0).length;
        marketSummaryEl.textContent = `${gainers} Gainers / ${losers} Losers`;
    }

    function renderStocks(stocks) {
        stockGrid.innerHTML = '';
        
        if (stocks.length === 0) {
            stockGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 3rem;">No stocks found matching your search.</p>';
            return;
        }

        stocks.forEach(stock => {
            const isUp = stock.change >= 0;
            const card = document.createElement('div');
            card.className = 'stock-card';
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="symbol-info">
                        <div class="symbol-name">${stock.symbol}</div>
                        <div class="detail-label">LTP</div>
                        <div class="ltp-value ${isUp ? 'up' : 'down'}">Rs. ${stock.ltp.toLocaleString()}</div>
                    </div>
                    <div class="change-indicators">
                        <div class="percent-badge ${isUp ? 'up' : 'down'}">
                            ${isUp ? '+' : ''}${stock.percent_change.toFixed(2)}%
                        </div>
                        <div class="change-val ${isUp ? 'up' : 'down'}" style="font-size: 0.9rem; font-weight: 500;">
                            ${isUp ? '▲' : '▼'} ${stock.change.toFixed(2)}
                        </div>
                    </div>
                </div>
                <div class="card-details">
                    <div class="detail-item">
                        <span class="detail-label">Prev Close</span>
                        <span class="detail-val">${stock.previous_close.toLocaleString()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Volume</span>
                        <span class="detail-val" style="color: var(--accent-primary)">${Math.floor(stock.volume).toLocaleString()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">High</span>
                        <span class="detail-val" style="color: var(--success)">${stock.high.toLocaleString()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Low</span>
                        <span class="detail-val" style="color: var(--danger)">${stock.low.toLocaleString()}</span>
                    </div>
                </div>
            `;
            stockGrid.appendChild(card);
        });
    }

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toUpperCase();
        const filtered = allStocks.filter(stock => 
            stock.symbol.toUpperCase().includes(term)
        );
        renderStocks(filtered);
    });

    fetchStocks();
});
