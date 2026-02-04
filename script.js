document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration & Elements ---
    const elements = {
        views: document.querySelectorAll('.view'),
        navBtns: document.querySelectorAll('.nav-btn'),
        marketSearch: document.getElementById('market-search'),
        mainStockGrid: document.getElementById('main-stock-grid'),

        // Dropdowns
        sectorTrigger: document.getElementById('sector-trigger'),
        sectorMenu: document.getElementById('sector-menu'),
        sortTrigger: document.getElementById('sort-trigger'),
        sortMenu: document.getElementById('sort-menu'),

        // Metadata
        marketBadge: document.getElementById('market-badge'),
        updateTime: document.getElementById('update-time'),
        totalScanned: document.getElementById('total-scanned'),
        indexBar: document.getElementById('index-bar'),

        // Dash widgets
        summaryGrid: document.getElementById('market-summary-grid'),
        gainersMini: document.getElementById('gainers-mini'),
        losersMini: document.getElementById('losers-mini'),

        // Specialized view containers
        companiesTable: document.getElementById('companies-table-body'),
        brokersGrid: document.getElementById('brokers-grid'),
        noticesTimeline: document.getElementById('notices-timeline'),
        ipoSection: document.getElementById('ipo-section'),
        ipoGrid: document.getElementById('ipo-grid'),

        // Modal
        stockModal: document.getElementById('stock-modal'),
        closeModal: document.getElementById('close-modal'),
        modalContent: document.getElementById('modal-content-area')
    };

    // --- State Management ---
    const state = {
        allStocks: [],
        allCompanies: [],
        allBrokers: [],
        sectorMap: {},
        companyNameMap: {},
        uniqueSectors: new Set(),
        currentSector: 'all',
        currentSort: 'percent_change',
        searchQuery: '',
        viewLoaded: { dashboard: false, companies: false, brokers: false, notices: false },
        notices: { general: [], company: [], exchange: [] },
        currentNoticeCategory: 'general'
    };

    // --- Initialization ---
    async function init() {
        setupNavigation();
        setupDropdowns();
        setupSearch();
        setupModal();

        // Initial Fetch (Market Pulse)
        await fetchMarketPulse();
    }

    // --- Navigation Logic ---
    function setupNavigation() {
        elements.navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetView = btn.getAttribute('data-view');
                switchView(targetView);
            });
        });

        // Deep linking via hash
        window.addEventListener('hashchange', handleHash);
        handleHash();
    }

    function switchView(viewId) {
        // Update Nav UI
        elements.navBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === viewId));

        // Update View Display
        elements.views.forEach(v => v.classList.remove('active'));
        const activeView = document.getElementById(`view-${viewId}`);
        if (activeView) activeView.classList.add('active');

        // Lazy load data for the view
        loadViewData(viewId);
    }

    function loadViewData(viewId) {
        if (state.viewLoaded[viewId]) return;

        switch (viewId) {
            case 'companies': fetchAllCompanies(); break;
            case 'brokers': fetchAllBrokers(); break;
            case 'notices': fetchNotices(); break;
        }
        state.viewLoaded[viewId] = true;
    }

    function handleHash() {
        const hash = window.location.hash.substring(1).split('/')[0];
        if (['companies', 'brokers', 'notices'].includes(hash)) {
            switchView(hash);
        } else {
            switchView('dashboard');
        }
    }

    // --- API Interactions ---

    async function fetchMarketPulse() {
        try {
            // Enhanced reliability: try to fetch price data first as it's mission critical
            const priceRes = await safeFetch('data/nepse_data.json');

            if (!priceRes || priceRes.length === 0) {
                elements.mainStockGrid.innerHTML = `
                    <div class="no-results">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <h3 style="color:var(--danger)">No Market Data Available</h3>
                        <p>The market data file is empty or could not be loaded. Please run the scraper to populate data.</p>
                        <button class="nav-btn active" onclick="location.reload()" style="margin-top:1.5rem; justify-content:center">
                            <i class="fa-solid fa-sync"></i> Re-scan Node
                        </button>
                    </div>
                 `;
                return;
            }

            const [sectorsRes, summaryRes, indexRes, statusRes, topRes, ipoRes] = await Promise.all([
                safeFetch('data/nepse_sector_wise_codes.json'),
                safeFetch('data/market_summary.json'),
                safeFetch('data/indices.json'),
                safeFetch('data/market_status.json'),
                safeFetch('data/top_stocks.json'),
                safeFetch('data/upcoming_ipo.json')
            ]);

            // Process Sector Codes first for mapping
            if (sectorsRes) {
                Object.entries(sectorsRes).forEach(([sector, items]) => {
                    state.uniqueSectors.add(sector);
                    items.forEach(item => {
                        state.sectorMap[item.symbol] = sector;
                        state.companyNameMap[item.symbol] = item.name;
                    });
                });
                populateSectorMenu();
            }

            state.allStocks = priceRes;
            renderMainExplorer();
            updateMetaUI(priceRes);

            if (statusRes) updateMarketStatus(statusRes);
            if (indexRes) renderTicker(indexRes);
            if (summaryRes) renderMarketSummary(summaryRes);
            if (topRes) renderTopLeaders(topRes);
            if (ipoRes) renderIPOs(ipoRes);

            // Fetch notices for dashboard preview
            const noticesRes = await safeFetch('data/notices.json');
            if (noticesRes) {
                state.notices = noticesRes;
                renderLatestIntel();
            }

        } catch (err) {
            console.error("Critical Terminal Error:", err);
            elements.mainStockGrid.innerHTML = `<div class="no-results"><i class="fa-solid fa-circle-exclamation"></i><p>Terminal kernel error. See console for details.</p></div>`;
        }
    }

    async function fetchAllCompanies() {
        const data = await safeFetch('data/all_securities.json');
        if (data) {
            state.allCompanies = data;
            renderCompaniesTable();
        }
    }

    async function fetchAllBrokers() {
        const data = await safeFetch('data/brokers.json');
        if (data) {
            state.allBrokers = data;
            renderBrokersGrid();
        }
    }

    async function fetchNotices() {
        const data = await safeFetch('data/notices.json');
        if (data) {
            state.notices = data;
            setupNoticeTabs();
            renderNoticesTimeline();
        }
    }

    function setupNoticeTabs() {
        const tabs = document.querySelectorAll('.notice-tab');
        tabs.forEach(tab => {
            tab.onclick = () => {
                const cat = tab.getAttribute('data-category');
                state.currentNoticeCategory = cat;
                tabs.forEach(t => t.classList.toggle('active', t === tab));
                renderNoticesTimeline();
            };
        });
    }

    async function safeFetch(url) {
        try {
            let res = await fetch(url);
            // Try fallback to root if data/ prefix fails
            if (!res.ok) {
                const fallback = url.startsWith('data/') ? url.replace('data/', '') : 'data/' + url;
                res = await fetch(fallback);
            }
            return res.ok ? await res.json() : null;
        } catch { return null; }
    }

    // --- UI Renderers ---

    function renderTicker(indices) {
        if (!indices) return;
        elements.indexBar.innerHTML = '';
        // Duplicate for infinite scroll feel
        const items = [...indices, ...indices];
        items.forEach(idx => {
            const isUp = idx.change >= 0;
            const div = document.createElement('div');
            div.className = 'index-item';
            div.innerHTML = `
                <span class="index-name">${idx.index}</span>
                <span class="index-val">${idx.close.toLocaleString()}</span>
                <span class="index-change ${isUp ? 'up-text' : 'down-text'}">
                    ${isUp ? '▲' : '▼'} ${idx.perChange.toFixed(2)}%
                </span>
            `;
            elements.indexBar.appendChild(div);
        });
    }

    function updateMarketStatus(status) {
        elements.marketBadge.textContent = status.is_open ? 'Market Open' : 'Market Closed';
        elements.marketBadge.className = `badge ${status.is_open ? 'open' : 'closed'}`;
    }

    function renderMarketSummary(summary) {
        elements.summaryGrid.innerHTML = summary.map(s => `
            <div class="summary-card">
                <span class="summary-label">${s.detail}</span>
                <span class="summary-val">${typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</span>
            </div>
        `).join('');
    }

    function renderTopLeaders(top) {
        const renderList = (el, list, colorClass) => {
            el.innerHTML = list.slice(0, 5).map(s => `
                <div class="leader-card-mini" onclick="window.terminal.showModal('${s.symbol}')">
                    <div class="leader-info">
                        <strong>${s.symbol}</strong>
                        <span class="symbol-name">${state.companyNameMap[s.symbol] || ''}</span>
                    </div>
                    <div class="leader-price text-right">
                        <div class="ltp">Rs. ${s.ltp.toLocaleString()}</div>
                        <div class="change-pill ${colorClass}">${s.percent_change.toFixed(2)}%</div>
                    </div>
                </div>
            `).join('');
        };
        renderList(elements.gainersMini, top.top_gainer, 'up');
        renderList(elements.losersMini, top.top_loser, 'down');
    }

    function renderMainExplorer() {
        const filtered = applyFilters(state.allStocks);
        const term = state.searchQuery.trim();

        if (state.allStocks.length === 0) {
            elements.mainStockGrid.innerHTML = `<div class="no-results"><i class="fa-solid fa-box-open"></i><p>No market data synchronized.</p></div>`;
            return;
        }

        if (filtered.length === 0 && term) {
            elements.mainStockGrid.innerHTML = `
                <div class="no-results">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <p>No instruments found matching "<strong>${term}</strong>" in <strong>${state.currentSector === 'all' ? 'any sector' : state.currentSector}</strong>.</p>
                    <button class="view-all-small" id="clear-search-btn" style="margin-top:1.5rem; padding: 0.5rem 1rem;">Clear Search Filters</button>
                </div>
            `;
            const clearBtn = document.getElementById('clear-search-btn');
            if (clearBtn) {
                clearBtn.onclick = () => {
                    elements.marketSearch.value = '';
                    state.searchQuery = '';
                    renderMainExplorer();
                };
            }
            return;
        }

        elements.mainStockGrid.innerHTML = '';
        const grouped = {};

        filtered.forEach(s => {
            const sector = state.sectorMap[s.symbol] || 'Others';
            if (state.currentSector !== 'all' && sector !== state.currentSector) return;
            if (!grouped[sector]) grouped[sector] = [];
            grouped[sector].push(s);
        });

        const sortedSectors = Object.keys(grouped).sort();
        if (sortedSectors.length === 0) {
            elements.mainStockGrid.innerHTML = `<div class="no-results"><i class="fa-solid fa-layer-group"></i><p>No active instruments in this sector.</p></div>`;
            return;
        }

        sortedSectors.forEach(sector => {
            const items = grouped[sector];
            items.sort((a, b) => {
                if (state.currentSort === 'symbol') return a.symbol.localeCompare(b.symbol);
                return (b[state.currentSort] || 0) - (a[state.currentSort] || 0);
            });

            const header = document.createElement('div');
            header.className = 'sector-group-header';
            header.innerHTML = `<div class="sector-name">${sector}</div><div class="sector-meta">${items.length} Companies</div>`;
            elements.mainStockGrid.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'stock-grid';

            const limit = (state.currentSector === 'all' && !state.searchQuery) ? 8 : 1000;
            grid.innerHTML = items.slice(0, limit).map(createStockCard).join('');
            elements.mainStockGrid.appendChild(grid);

            if (items.length > limit) {
                const moreBtn = document.createElement('button');
                moreBtn.className = 'nav-btn';
                moreBtn.style.gridColumn = '1/-1';
                moreBtn.style.marginTop = '1.5rem';
                moreBtn.style.width = '100%';
                moreBtn.style.justifyContent = 'center';
                moreBtn.innerHTML = `Expand ${sector} View (${items.length - limit} more) <i class="fa-solid fa-chevron-right" style="margin-left:0.75rem"></i>`;
                moreBtn.onclick = () => {
                    state.currentSector = sector;
                    document.getElementById('active-sector').textContent = sector;
                    renderMainExplorer();
                    window.scrollTo({ top: header.offsetTop - 120, behavior: 'smooth' });
                };
                elements.mainStockGrid.appendChild(moreBtn);
            }
        });
    }

    function createStockCard(s) {
        const isUp = s.change >= 0;
        const sector = state.sectorMap[s.symbol] || 'Others';

        return `
            <div class="stock-card" data-symbol="${s.symbol}">
                <div class="stock-badge ${isUp ? 'badge-up' : 'badge-down'}">
                    ${isUp ? '▲' : '▼'} ${s.percent_change.toFixed(2)}%
                </div>
                
                <h3 class="stock-symbol">${s.symbol}</h3>
                <p class="stock-company-name">${state.companyNameMap[s.symbol] || s.name || ''}</p>
                
                <div class="stock-sector-tag">
                    <i class="fa-solid fa-layer-group"></i>
                    ${sector}
                </div>
                
                <div class="stock-price-row">
                    <div>
                        <span class="price-label">LTP</span>
                        <span class="price-value ${isUp ? 'up-text' : 'down-text'}">Rs. ${s.ltp.toLocaleString()}</span>
                    </div>
                    <div>
                        <span class="price-label">Change</span>
                        <span class="price-value ${isUp ? 'up-text' : 'down-text'}">${isUp ? '+' : ''}${s.change.toFixed(2)}</span>
                    </div>
                </div>
                
                <div class="stock-metrics">
                    <div class="metric-item">
                        <i class="fa-solid fa-chart-simple"></i>
                        <span>Vol: ${Math.floor(s.volume).toLocaleString()}</span>
                    </div>
                    <div class="metric-item">
                        <i class="fa-solid fa-arrow-trend-up"></i>
                        <span>H: ${s.high.toLocaleString()}</span>
                    </div>
                    <div class="metric-item">
                        <i class="fa-solid fa-arrow-trend-down"></i>
                        <span>L: ${s.low.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function renderCompaniesTable(query = '') {
        const term = query.toUpperCase();
        const filtered = state.allCompanies.filter(c => c.symbol.toUpperCase().includes(term) || c.companyName.toUpperCase().includes(term));
        elements.companiesTable.innerHTML = filtered.slice(0, 100).map(c => `
            <tr>
                <td style="font-weight:700; color:var(--accent-primary)">${c.symbol}</td>
                <td>${c.companyName}</td>
                <td>${c.sectorName}</td>
                <td><small>${c.instrumentType || 'Equity'}</small></td>
                <td><span class="badge ${c.status === 'A' ? 'open' : 'closed'}">${c.status === 'A' ? 'Active' : 'N/A'}</span></td>
            </tr>
        `).join('');
    }

    function renderBrokersGrid(query = '') {
        const term = query.toUpperCase();
        const filtered = state.allBrokers.filter(b => b.memberName.toUpperCase().includes(term) || b.memberCode.includes(term));

        if (filtered.length === 0 && term) {
            elements.brokersGrid.innerHTML = `
                <div class="no-results" style="grid-column: 1/-1;">
                    <i class="fa-solid fa-user-slash"></i>
                    <p>No brokers found matching "<strong>${query}</strong>"</p>
                </div>`;
            return;
        }

        elements.brokersGrid.className = 'broker-grid';
        elements.brokersGrid.innerHTML = filtered.map(b => `
            <div class="broker-card">
                <div class="broker-id-badge">BROKER #${b.memberCode}</div>
                <h3 class="broker-name">${b.memberName}</h3>
                
                <div class="broker-contact-row">
                    <i class="fa-solid fa-user-tie"></i>
                    <span>${b.authorizedContactPerson || 'Executive Representative'}</span>
                </div>
                
                <div class="broker-contact-row">
                    <i class="fa-solid fa-phone-volume"></i>
                    <span>${b.memberContactNumber}</span>
                </div>
                
                <div class="broker-contact-row">
                    <i class="fa-solid fa-location-crosshairs"></i>
                    <span>${b.tmsAddress}</span>
                </div>

                <a href="#" class="tms-link" onclick="event.preventDefault(); alert('Redirecting to Broker ${b.memberCode} TMS Portal...')">
                    <span>Access TMS Portal</span>
                    <i class="fa-solid fa-arrow-right-to-bracket"></i>
                </a>
            </div>
        `).join('');
    }

    function renderNoticesTimeline() {
        const category = state.currentNoticeCategory;
        const list = state.notices[category] || [];

        if (list.length === 0) {
            elements.noticesTimeline.innerHTML = `
                <div class="no-results">
                    <i class="fa-solid fa-envelope-open"></i>
                    <p>No notices found in the <strong>${category}</strong> category.</p>
                </div>
            `;
            return;
        }

        elements.noticesTimeline.innerHTML = list.slice(0, 50).map(n => {
            let title, meta1, meta2, link, tagClass;

            if (category === 'general') {
                title = n.noticeHeading;
                meta1 = `<i class="fa-solid fa-tag"></i> ${n.noticeTypeId?.noticeType || 'General'}`;
                meta2 = `<i class="fa-regular fa-calendar"></i> Expires: ${n.noticeExpiryDate}`;
                link = `https://www.nepalstock.com/api/web/notice/file/${n.noticeFilePath}`;
                tagClass = 'tag-general';
            } else if (category === 'company') {
                title = n.newsHeadline;
                meta1 = `<i class="fa-solid fa-building"></i> ${n.newsSource}`;
                meta2 = `<i class="fa-regular fa-clock"></i> ${new Date(n.addedDate).toLocaleDateString()}`;
                link = '#'; // NEPSE doesn't always provide direct PDF for news
                tagClass = 'tag-company';
            } else {
                // Exchange messages
                title = n.messageHeading || n.noticeHeading;
                meta1 = `<i class="fa-solid fa-server"></i> NEPSE Ops`;
                meta2 = `<i class="fa-regular fa-calendar"></i> ${n.postedDate || '--'}`;
                link = '#';
                tagClass = 'tag-exchange';
            }

            return `
                <div class="notice-card">
                    <div class="notice-type-tag ${tagClass}">${category}</div>
                    <div class="notice-header">
                        <div class="notice-main">
                            <h3 class="notice-title">${title}</h3>
                            <div class="notice-meta">
                                <span>${meta1}</span>
                                <span>${meta2}</span>
                            </div>
                        </div>
                        ${link !== '#' ? `
                            <a href="${link}" target="_blank" class="pdf-btn" title="View Document">
                                <i class="fa-solid fa-file-pdf"></i>
                            </a>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderIPOs(ipos) {
        if (!ipos || ipos.length === 0) return;
        elements.ipoSection.style.display = 'block';
        elements.ipoGrid.innerHTML = ipos.map(ipo => `
            <div class="summary-card" style="border-left: 4px solid var(--accent-primary)">
                <h4 style="margin-bottom: 1rem;">${ipo.company}</h4>
                <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                    <p style="margin-bottom: 0.5rem;"><span class="label">Offer Size:</span> <strong style="color: var(--success)">${ipo.units} Units</strong></p>
                    <p><span class="label">Date Range:</span> <strong>${ipo.date_range}</strong></p>
                </div>
                <a href="${ipo.url}" target="_blank" class="nav-btn active" style="width: 100%; justify-content: center;">View prospectus</a>
            </div>
        `).join('');
    }

    function renderLatestIntel() {
        const disclosuresList = document.getElementById('latest-disclosures-list');
        if (!disclosuresList) return;

        const companyNews = state.notices.company || [];
        if (companyNews.length === 0) {
            disclosuresList.innerHTML = `<p style="color: var(--text-muted)">No recent disclosures available.</p>`;
            return;
        }

        disclosuresList.innerHTML = companyNews.slice(0, 3).map(n => `
            <div class="mini-news-item">
                <span class="notice-type-tag tag-company" style="font-size: 0.6rem; padding: 0.15rem 0.4rem;">${n.newsSource}</span>
                <div class="mini-news-title">${n.newsHeadline}</div>
                <div class="mini-news-meta">
                    <span><i class="fa-regular fa-calendar"></i> ${new Date(n.addedDate).toLocaleDateString()}</span>
                    <span>${state.sectorMap[n.symbol] || 'Market'}</span>
                </div>
            </div>
        `).join('');
    }

    function setupDropdowns() {
        const toggle = (el) => el.parentElement.classList.toggle('active');
        elements.sectorTrigger.onclick = (e) => { e.stopPropagation(); toggle(elements.sectorTrigger); };
        elements.sortTrigger.onclick = (e) => { e.stopPropagation(); toggle(elements.sortTrigger); };

        elements.sectorMenu.onclick = (e) => {
            const item = e.target.closest('.menu-item');
            if (item) {
                state.currentSector = item.getAttribute('data-value');
                document.getElementById('active-sector').textContent = item.textContent;
                toggle(elements.sectorTrigger);
                renderMainExplorer();
            }
        };

        elements.sortMenu.onclick = (e) => {
            const item = e.target.closest('.menu-item');
            if (item) {
                state.currentSort = item.getAttribute('data-value');
                document.getElementById('active-sort').textContent = `Sort: ${item.textContent.split('(')[0]}`;
                toggle(elements.sortTrigger);
                renderMainExplorer();
            }
        };

        window.onclick = () => {
            elements.sectorTrigger.parentElement.classList.remove('active');
            elements.sortTrigger.parentElement.classList.remove('active');
        };
    }

    function populateSectorMenu() {
        elements.sectorMenu.innerHTML = '<div class="menu-item selected" data-value="all">All Sectors</div>';
        Array.from(state.uniqueSectors).sort().forEach(s => {
            const div = document.createElement('div');
            div.className = 'menu-item';
            div.setAttribute('data-value', s);
            div.textContent = s;
            elements.sectorMenu.appendChild(div);
        });
    }

    function setupSearch() {
        elements.marketSearch.oninput = (e) => {
            state.searchQuery = e.target.value.toUpperCase();
            renderMainExplorer();
        };

        const companySearchInput = document.getElementById('company-search-input');
        if (companySearchInput) {
            companySearchInput.oninput = (e) => renderCompaniesTable(e.target.value);
        }

        const brokerSearchInput = document.getElementById('broker-search-input');
        if (brokerSearchInput) {
            brokerSearchInput.oninput = (e) => renderBrokersGrid(e.target.value);
        }
    }

    function applyFilters(stocks) {
        if (!state.searchQuery) return stocks;
        return stocks.filter(s => s.symbol.toUpperCase().includes(state.searchQuery) || (state.companyNameMap[s.symbol] || '').toUpperCase().includes(state.searchQuery));
    }

    function updateMetaUI(stocks) {
        elements.totalScanned.textContent = `Tracking ${stocks.length} instruments`;
        elements.updateTime.textContent = new Date(stocks[0]?.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function setupModal() {
        elements.closeModal.onclick = () => elements.stockModal.classList.remove('active');
        elements.stockModal.onclick = (e) => {
            if (e.target === elements.stockModal) {
                elements.stockModal.classList.remove('active');
            }
        };

        // Delegated listener for stock cards in the main explorer
        elements.mainStockGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.stock-card');
            if (card) {
                const symbol = card.getAttribute('data-symbol');
                window.terminal.showModal(symbol);
            }
        });

        window.terminal = {
            showModal: (symbol) => {
                const stock = state.allStocks.find(s => s.symbol === symbol);
                if (stock) showStockModal(stock);
            },
            switchView: (viewId) => {
                switchView(viewId);
            }
        };
    }

    function showStockModal(s) {
        const isUp = s.change >= 0;
        elements.modalContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2.5rem; flex-wrap: wrap; gap: 1.5rem;">
                <div>
                   <h1 style="font-size: 2.5rem; letter-spacing: -1px; margin-bottom: 0.25rem;">${s.symbol}</h1>
                   <p style="color: var(--text-secondary); font-size: 1.1rem; font-weight: 500;">${state.companyNameMap[s.symbol] || s.name || ''}</p>
                   <span class="badge open" style="margin-top: 1rem; padding: 0.5rem 1rem;">${state.sectorMap[s.symbol] || 'Others'}</span>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 2.75rem; font-weight: 800; font-family: 'JetBrains Mono'; color: ${isUp ? 'var(--success)' : 'var(--danger)'}">
                        ${s.ltp.toLocaleString()}
                        <small style="font-size: 1rem; opacity: 0.6;">NPR</small>
                    </div>
                    <div style="font-weight: 800; font-size: 1.25rem; margin-top: 0.25rem; color: ${isUp ? 'var(--success)' : 'var(--danger)'}">
                        ${isUp ? '▲' : '▼'} ${Math.abs(s.change).toFixed(2)} (${s.percent_change.toFixed(2)}%)
                    </div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1.25rem; margin-bottom: 2.5rem;">
                <div class="modal-detail-item"><span class="label">Day High</span><span class="value up-text">${s.high.toLocaleString()}</span></div>
                <div class="modal-detail-item"><span class="label">Day Low</span><span class="value down-text">${s.low.toLocaleString()}</span></div>
                <div class="modal-detail-item"><span class="label">Volume</span><span class="value" style="color: var(--accent-primary)">${Math.floor(s.volume).toLocaleString()}</span></div>
                <div class="modal-detail-item"><span class="label">Prev. Close</span><span class="value">${s.previous_close.toLocaleString()}</span></div>
            </div>
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 20px; padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--text-muted);">
                <span><i class="fa-solid fa-clock-rotate-left"></i> Terminal Node Sync: ${new Date(s.last_updated).toLocaleString()}</span>
                <span style="opacity: 0.5;">#STK-${s.symbol}</span>
            </div>
        `;
        elements.stockModal.classList.add('active');
    }

    init();
});
