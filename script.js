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
            // Fetch statically from data/ folder or root as fallback
            const [stocksRes, sectorsRes, ipoRes] = await Promise.all([
                fetch('data/nepse_data.json'),
                fetch('data/nepse_sector_wise_codes.json'),
                fetch('data/upcoming_ipo.json')
            ]);

            // Handle Stocks
            if (stocksRes.ok) {
                allStocks = await stocksRes.json();
                renderStocks(allStocks);
                updateMetadata(allStocks);
            } else {
                console.warn('Failed to fetch stock data, checking backup location...');
                // Fallback attempt for root (in case structure differs in dev) without data/ prefix
                // This is just a safety measure
                const backupStocks = await fetch('nepse_data.json');
                if (backupStocks.ok) {
                    allStocks = await backupStocks.json();
                    renderStocks(allStocks);
                    updateMetadata(allStocks);
                } else {
                    throw new Error('Failed to fetch stock data');
                }
            }

            // Handle Sectors
            if (sectorsRes.ok) {
                const sectors = await sectorsRes.json();
                Object.entries(sectors).forEach(([sector, symbols]) => {
                    uniqueSectors.add(sector);
                    symbols.forEach(symbol => {
                        sectorMap[symbol] = sector;
                    });
                });
                populateSectorDropdown();
            }

            // Handle IPOs
            if (ipoRes.ok) {
                const ipos = await ipoRes.json();
                renderIPOs(ipos);
            } else {
                // Fallback
                const backupIpo = await fetch('upcoming_ipo.json');
                if (backupIpo.ok) {
                    renderIPOs(await backupIpo.json());
                }
            }

        } catch (error) {
            console.error('Error:', error);
            stockGrid.innerHTML = `
                <div class="status-item" style="color: var(--danger); grid-column: 1/-1;">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    Failed to load market data.
                </div>
            `;
        }
    }

    function renderIPOs(ipos) {
        const ipoSection = document.getElementById('ipo-section');
        const ipoGrid = document.getElementById('ipo-grid');

        if (!ipos || ipos.length === 0) return;

        ipoSection.style.display = 'block';
        ipoGrid.innerHTML = '';

        ipos.forEach(ipo => {
            const card = document.createElement('div');
            card.className = 'stock-card'; // Reuse stock card styling
            card.style.borderLeft = '4px solid var(--accent-primary)';

            card.innerHTML = `
                <div class="card-header" style="margin-bottom: 1rem;">
                    <div class="symbol-info" style="width: 100%;">
                        <div class="symbol-name" style="font-size: 1.1rem; white-space: normal; line-height: 1.4;">${ipo.company}</div>
                        <div class="detail-label" style="margin-top: 0.25rem;"><i class="fa-regular fa-calendar"></i> Announced: ${ipo.announcement_date}</div>
                    </div>
                </div>
                <div class="card-details" style="grid-template-columns: 1fr 1fr;">
                    <div class="detail-item">
                        <span class="detail-label">Units</span>
                        <span class="detail-val" style="color: var(--success)">${ipo.units}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Date Range</span>
                        <span class="detail-val" style="font-size: 0.9rem;">${ipo.date_range}</span>
                    </div>
                </div>
                <div style="margin-top: 1rem; text-align: right;">
                    <a href="${ipo.url}" target="_blank" style="color: var(--accent-primary); text-decoration: none; font-size: 0.9rem;">View Details &rarr;</a>
                </div>
            `;
            ipoGrid.appendChild(card);
        });
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
