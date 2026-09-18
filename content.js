/**
 * Content script for teacher.mojaru.com
 * Automates real page-by-page browser navigation:
 * selects month -> clicks Search -> extracts table -> advances to next month -> opens Dashboard!
 */

(function () {
  const SESSION_KEY = 'mojaru_nav_scrape';
  let isScrapingInProgress = false;

  // Check if navigation scrape is in progress on page load
  window.addEventListener('DOMContentLoaded', () => {
    checkAndResumeNavigationScrape();
  });
  // Also check immediately in case DOM is already loaded
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    checkAndResumeNavigationScrape();
  }

  // Dual Storage Helper: Syncs session in chrome.storage.local and sessionStorage
  async function getScrapeSession() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const res = await new Promise(r => chrome.storage.local.get(SESSION_KEY, r));
        if (res && res[SESSION_KEY] && res[SESSION_KEY].active) {
          return res[SESSION_KEY];
        }
      } catch (e) {}
    }
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.active) return parsed;
      }
    } catch (e) {}
    return null;
  }

  async function saveScrapeSession(session) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await new Promise(r => chrome.storage.local.set({ [SESSION_KEY]: session }, r));
      } catch (e) {}
    }
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {}
  }

  async function clearScrapeSession() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await new Promise(r => chrome.storage.local.remove(SESSION_KEY, r));
      } catch (e) {}
    }
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  // Create floating button if on Mojaru portal
  if (!document.getElementById('mojaru-qc-floating-btn')) {
    const floatBtn = document.createElement('div');
    floatBtn.id = 'mojaru-qc-floating-btn';
    floatBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
      </svg>
      <span>QC Scraper</span>
    `;
    document.body.appendChild(floatBtn);

    let panel = null;
    floatBtn.addEventListener('click', () => {
      if (panel) {
        panel.remove();
        panel = null;
        return;
      }
      panel = openPanel();
    });
  }

  // Listen for message from Extension Popup to trigger page navigation scraper
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'START_PAGE_SCRAPE' && Array.isArray(msg.months)) {
        startNavigationScrape(msg.months);
        sendResponse({ success: true });
      }
    });
  }

  function generateMonthsRange(startYearMonth, endYearMonth) {
    const [startYear, startMonth] = startYearMonth.split('-').map(Number);
    const [endYear, endMonth] = endYearMonth.split('-').map(Number);

    const months = [];
    let curYear = startYear;
    let curMonth = startMonth;

    while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
      const mStr = String(curMonth).padStart(2, '0');
      months.push(`${curYear}-${mStr}`);
      curMonth++;
      if (curMonth > 12) {
        curMonth = 1;
        curYear++;
      }
    }
    return months;
  }

  function getPastMonths(n) {
    const result = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      result.push(`${yr}-${mo}`);
    }
    return result;
  }

  function showTopBanner(text, showSpinner = true) {
    let banner = document.getElementById('mojaru-qc-top-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'mojaru-qc-top-banner';
      document.body.appendChild(banner);
    }
    banner.innerHTML = `
      <div class="mojaru-banner-left">
        ${showSpinner ? '<div class="mojaru-spinner"></div>' : '<span>✔</span>'}
        <span>${text}</span>
      </div>
      <div style="font-size: 11px; opacity: 0.8;">Automated Mojaru QC Scraper</div>
    `;
  }

  function removeTopBanner() {
    const banner = document.getElementById('mojaru-qc-top-banner');
    if (banner) banner.remove();
  }

  /**
   * Resume scraping session across page reloads
   */
  async function checkAndResumeNavigationScrape() {
    if (isScrapingInProgress) return;

    const session = await getScrapeSession();
    if (!session || !session.active || !Array.isArray(session.months)) {
      return;
    }

    isScrapingInProgress = true;

    try {
      const { months, currentIndex } = session;
      if (currentIndex >= months.length) {
        // Completed all months in range
        await finishScrapingSession(session);
        return;
      }

      const currentTargetMonth = months[currentIndex];

      // Check current URL to ensure the page has finished loading the target month
      const urlParams = new URLSearchParams(window.location.search);
      const currentUrlMonth = urlParams.get('month');

      if (currentUrlMonth && currentUrlMonth !== currentTargetMonth) {
        showTopBanner(`⚡ Redirecting to month: ${currentTargetMonth} (${currentIndex + 1}/${months.length})...`, true);
        navigateMonthSearch(currentTargetMonth);
        return;
      }

      showTopBanner(`⚡ Scraping Month: ${currentTargetMonth} (${currentIndex + 1}/${months.length}). Extracting classes...`, true);

      // Wait for table to render rows
      let tableRows = document.querySelectorAll('table tbody tr');
      let waitAttempts = 0;
      while (tableRows.length === 0 && waitAttempts < 8) {
        await new Promise(r => setTimeout(r, 200));
        tableRows = document.querySelectorAll('table tbody tr');
        waitAttempts++;
      }

      // Parse records from the current DOM table
      const records = (typeof QCParser !== 'undefined' && QCParser.parseFromDOM)
        ? QCParser.parseFromDOM(document, currentTargetMonth)
        : [];

      session.collectedRecords.push(...records);
      session.currentIndex++;

      showTopBanner(`✔ Month ${currentTargetMonth}: Collected ${records.length} classes. Total so far: ${session.collectedRecords.length}`, true);

      if (session.currentIndex < months.length) {
        const nextMonth = months[session.currentIndex];
        await saveScrapeSession(session);

        await new Promise(r => setTimeout(r, 700));
        showTopBanner(`Navigating to month ${nextMonth} (${session.currentIndex + 1}/${months.length})...`, true);

        // Real URL navigation to the next month
        navigateMonthSearch(nextMonth);
      } else {
        // Completed all months!
        await finishScrapingSession(session);
      }
    } finally {
      isScrapingInProgress = false;
    }
  }

  /**
   * Set month input and navigate to exact month URL
   */
  function navigateMonthSearch(monthStr) {
    const monthInput = document.querySelector('input[type="month"][name="month"]');
    if (monthInput) {
      monthInput.value = monthStr;
      monthInput.dispatchEvent(new Event('input', { bubbles: true }));
      monthInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Direct URL navigation: Mojaru server loads the exact month via GET query
    window.location.href = `https://teacher.mojaru.com/teacher/qc-report?month=${monthStr}`;
  }

  /**
   * Finish scraping session, save records, and open dashboard
   */
  async function finishScrapingSession(session) {
    await clearScrapeSession();
    showTopBanner(`🎉 Done! Collected ${session.collectedRecords.length} classes across ${session.months.length} months. Opening Dashboard...`, false);

    // Save records to storage
    if (typeof QCStorage !== 'undefined') {
      await QCStorage.saveRecords(session.collectedRecords);
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise(resolve => {
        chrome.storage.local.set({ mojaru_qc_records: session.collectedRecords }, resolve);
      });
    }

    setTimeout(() => {
      removeTopBanner();
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
      } else {
        window.open(chrome.runtime.getURL('dashboard.html'), '_blank');
      }
    }, 1600);
  }

  /**
   * Start a brand new scraping session
   */
  async function startNavigationScrape(monthsList) {
    if (!monthsList || monthsList.length === 0) return;

    // Requirement: In every search, the overall data should be clear first
    if (typeof QCStorage !== 'undefined') {
      await QCStorage.clearAll();
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise(r => chrome.storage.local.set({ mojaru_qc_records: [] }, r));
    }

    const firstMonth = monthsList[0];
    const session = {
      active: true,
      months: monthsList,
      currentIndex: 0,
      collectedRecords: []
    };

    await saveScrapeSession(session);

    // Check if current page is already qc-report with firstMonth
    const urlParams = new URLSearchParams(window.location.search);
    const currentUrlMonth = urlParams.get('month');

    if (currentUrlMonth === firstMonth && window.location.pathname.includes('qc-report')) {
      // Immediately process current month
      checkAndResumeNavigationScrape();
    } else {
      showTopBanner(`Navigating to first month ${firstMonth}...`, true);
      navigateMonthSearch(firstMonth);
    }
  }

  function openPanel() {
    const panel = document.createElement('div');
    panel.id = 'mojaru-qc-panel';

    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const pageMonthInput = document.querySelector('input[type="month"][name="month"]');
    const selectedMonth = pageMonthInput ? pageMonthInput.value : currentYM;

    panel.innerHTML = `
      <div class="mojaru-panel-header">
        <div class="mojaru-panel-title">
          <span>🚀 Mojaru QC Scraper</span>
        </div>
        <button class="mojaru-panel-close" id="mojaru-close-btn">&times;</button>
      </div>
      <div class="mojaru-panel-body">
        <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
          Automatically changes month &rarr; clicks Search &rarr; collects classes &rarr; repeats!
        </div>

        <div style="margin-bottom: 12px;">
          <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; color:#475569; margin-bottom:4px;">Quick Range</label>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="mojaru-btn mojaru-btn-secondary" style="flex:1; padding:6px; font-size:11px;" id="btn-quick-1">This Month</button>
            <button type="button" class="mojaru-btn mojaru-btn-secondary" style="flex:1; padding:6px; font-size:11px;" id="btn-quick-3">Past 3 Mos</button>
            <button type="button" class="mojaru-btn mojaru-btn-secondary" style="flex:1; padding:6px; font-size:11px;" id="btn-quick-6">Past 6 Mos</button>
          </div>
        </div>

        <div style="margin-bottom: 12px; display:flex; gap:8px;">
          <div style="flex:1;">
            <label style="display:block; font-size:11px; font-weight:700; color:#475569; margin-bottom:2px;">From</label>
            <input type="month" id="mojaru-start-month" value="${selectedMonth}" style="width:100%; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">
          </div>
          <div style="flex:1;">
            <label style="display:block; font-size:11px; font-weight:700; color:#475569; margin-bottom:2px;">To</label>
            <input type="month" id="mojaru-end-month" value="${selectedMonth}" style="width:100%; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">
          </div>
        </div>

        <div class="mojaru-btn-group">
          <button type="button" class="mojaru-btn mojaru-btn-primary" id="mojaru-start-scrape-btn">
            ▶ Start Scraping Range
          </button>
          <button type="button" class="mojaru-btn mojaru-btn-secondary" id="mojaru-open-dash-btn">
            📊 Open Analytics Dashboard
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    document.getElementById('mojaru-close-btn').addEventListener('click', () => {
      panel.remove();
    });

    document.getElementById('mojaru-open-dash-btn').addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
      } else {
        window.open(chrome.runtime.getURL('dashboard.html'), '_blank');
      }
    });

    document.getElementById('btn-quick-1').addEventListener('click', () => {
      document.getElementById('mojaru-start-month').value = currentYM;
      document.getElementById('mojaru-end-month').value = currentYM;
    });

    document.getElementById('btn-quick-3').addEventListener('click', () => {
      const mos = getPastMonths(3);
      document.getElementById('mojaru-start-month').value = mos[0];
      document.getElementById('mojaru-end-month').value = mos[mos.length - 1];
    });

    document.getElementById('btn-quick-6').addEventListener('click', () => {
      const mos = getPastMonths(6);
      document.getElementById('mojaru-start-month').value = mos[0];
      document.getElementById('mojaru-end-month').value = mos[mos.length - 1];
    });

    document.getElementById('mojaru-start-scrape-btn').addEventListener('click', async () => {
      const startM = document.getElementById('mojaru-start-month').value;
      const endM = document.getElementById('mojaru-end-month').value;

      if (!startM || !endM) {
        alert('Please select both start and end months.');
        return;
      }

      const months = startM <= endM
        ? generateMonthsRange(startM, endM)
        : generateMonthsRange(endM, startM);

      panel.remove();
      startNavigationScrape(months);
    });

    return panel;
  }
})();
