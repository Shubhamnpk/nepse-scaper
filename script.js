document.addEventListener('DOMContentLoaded', () => {
    const stockGrid = document.getElementById('stock-grid');
    const searchInput = document.getElementById('search-input');
    const updateTimeEl = document.getElementById('update-time');
    const totalScannedEl = document.getElementById('total-scanned');
    const marketSummaryEl = document.getElementById('market-summary');

    // Custom Dropdown Logic
    const dropdownTrigger = document.getElementById('dropdown-trigger');
    const dropdownOptions = document.getElementById('dropdown-options');
    const selectedSectorText = document.getElementById('selected-sector');
    const customDropdown = document.querySelector('.custom-dropdown');

    let currentSelectedSector = 'all';

    // Toggle Dropdown
    dropdownTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        customDropdown.classList.toggle('open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        customDropdown.classList.remove('open');
    });

    // Handle Option Selection (Delegation)
    dropdownOptions.addEventListener('click', (e) => {
        if (e.target.classList.contains('option-item')) {
            const value = e.target.getAttribute('data-value');
            const text = e.target.textContent;

            currentSelectedSector = value;
            selectedSectorText.textContent = text;

            // Update selected visual state
            document.querySelectorAll('.option-item').forEach(item => {
                item.classList.remove('selected');
            });
            e.target.classList.add('selected');

            applyFilters();
        }
    });

    let allStocks = [];
    let sectorMap = {};
    let uniqueSectors = new Set();

    async function fetchStocks() {
        try {
            const [stocksRes, sectorsRes] = await Promise.all([
                fetch('./nepse_data.json'),
                fetch('./nepse_sector_wise_codes.json')
            ]);

            if (!stocksRes.ok) throw new Error('Failed to fetch stock data');

            allStocks = await stocksRes.json();

            if (sectorsRes.ok) {
                const sectors = await sectorsRes.json();
                // Invert the map for easier lookup: symbol -> sector
                Object.entries(sectors).forEach(([sector, symbols]) => {
                    uniqueSectors.add(sector);
                    symbols.forEach(symbol => {
                        sectorMap[symbol] = sector;
                    });
                });
                populateSectorDropdown();
            }

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

    function populateSectorDropdown() {
        const sortedSectors = Array.from(uniqueSectors).sort();

        // Add default "all" selection state
        const allOption = dropdownOptions.querySelector('[data-value="all"]');
        if (allOption) allOption.classList.add('selected');

        sortedSectors.forEach(sector => {
            const option = document.createElement('div');
            option.className = 'option-item';
            option.setAttribute('data-value', sector);
            option.textContent = sector;
            dropdownOptions.appendChild(option);
        });
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
            stockGrid.innerHTML = '<p style="text-align: center; padding: 3rem; color: var(--text-secondary);">No stocks found matching your search.</p>';
            return;
        }

        const selectedSector = currentSelectedSector;

        // Group stocks by sector
        const grouped = {};
        const uncategorized = [];

        stocks.forEach(stock => {
            const sector = sectorMap[stock.symbol];

            // Filter logic
            if (selectedSector !== 'all') {
                if (sector && sector !== selectedSector) return;
                if (!sector && selectedSector !== 'Others') return;
            }

            if (sector) {
                if (!grouped[sector]) grouped[sector] = [];
                grouped[sector].push(stock);
            } else {
                uncategorized.push(stock);
            }
        });

        // Loop through sorted sector names
        const sortedSectors = Object.keys(grouped).sort();

        if (uncategorized.length > 0 && (selectedSector === 'all' || selectedSector === 'Others')) {
            sortedSectors.push('Others');
            grouped['Others'] = uncategorized;
        }

        // Empty state for specific sector filter
        if (selectedSector !== 'all' && selectedSector !== 'Others' && !grouped[selectedSector]) {
            stockGrid.innerHTML = '<p style="text-align: center; padding: 3rem; color: var(--text-secondary);">No stocks found in the selected sector matching your search.</p>';
            return;
        }
        if (selectedSector === 'Others' && uncategorized.length === 0) {
            stockGrid.innerHTML = '<p style="text-align: center; padding: 3rem; color: var(--text-secondary);">No uncategorized stocks found matching your search.</p>';
            return;
        }

        sortedSectors.forEach(sector => {
            // Only render selected sector
            if (selectedSector !== 'all' && sector !== selectedSector && !(selectedSector === 'Others' && sector === 'Others')) {
                return;
            }

            const sectorStocks = grouped[sector];
            if (!sectorStocks || sectorStocks.length === 0) return;

            // Create Sector Header
            const sectorTitle = document.createElement('h2');
            sectorTitle.className = 'sector-title';
            sectorTitle.textContent = sector;
            stockGrid.appendChild(sectorTitle);

            // Create Grid for this sector
            const sectorGrid = document.createElement('div');
            sectorGrid.className = 'sector-grid';

            sectorStocks.forEach(stock => {
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
                sectorGrid.appendChild(card);
            });

            stockGrid.appendChild(sectorGrid);
        });
    }

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        applyFilters();
    });

    function applyFilters() {
        const term = searchInput.value.toUpperCase();
        const filtered = allStocks.filter(stock =>
            stock.symbol.toUpperCase().includes(term) ||
            (stock.name && stock.name.toUpperCase().includes(term))
        );
        renderStocks(filtered);
    }

    fetchStocks();
});
