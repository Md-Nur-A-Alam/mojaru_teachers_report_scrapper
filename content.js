/**
 * Content script for teacher.mojaru.com
 * Injects floating helper and handles month-range scraping inside the active teacher session
 */

(function () {
  // Prevent duplicate injection
  if (document.getElementById('mojaru-qc-floating-btn')) return;

  // Create floating button
  const floatBtn = document.createElement('div');
  floatBtn.id = 'mojaru-qc-floating-btn';
  floatBtn.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
    </svg>
    <span>QC Scraper</span>
  `;
  document.body.appendChild(floatBtn);

  // Panel
  let panel = null;

  floatBtn.addEventListener('click', () => {
    if (panel) {
      panel.remove();
      panel = null;
      return;
    }
    openPanel();
  });

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

  function openPanel() {
    panel = document.createElement('div');
    panel.id = 'mojaru-qc-panel';

    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Try to get month from page if on qc-report
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
          Active session detected! Scrape single or multiple months directly.
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

        <div class="mojaru-progress-box" id="mojaru-progress-box" style="display: none;">
          <div id="mojaru-progress-status" style="font-size: 11px; font-weight: 600; color: #0f766e;">Starting scraper...</div>
          <div class="mojaru-progress-bar">
            <div class="mojaru-progress-fill" id="mojaru-progress-fill"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    document.getElementById('mojaru-close-btn').addEventListener('click', () => {
      panel.remove();
      panel = null;
    });

    document.getElementById('mojaru-open-dash-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
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

      await runScrape(months);
    });
  }

  async function runScrape(monthsList) {
    const progressBox = document.getElementById('mojaru-progress-box');
    const statusText = document.getElementById('mojaru-progress-status');
    const fill = document.getElementById('mojaru-progress-fill');
    const scrapeBtn = document.getElementById('mojaru-start-scrape-btn');

    progressBox.style.display = 'block';
    scrapeBtn.disabled = true;
    scrapeBtn.style.opacity = '0.6';

    // Requirement: In every search, overall data should be clear first
    if (typeof QCStorage !== 'undefined') {
      await QCStorage.clearAll();
    } else if (chrome.storage && chrome.storage.local) {
      await new Promise(r => chrome.storage.local.set({ mojaru_qc_records: [] }, r));
    }

    const allScraped = [];

    for (let i = 0; i < monthsList.length; i++) {
      const m = monthsList[i];
      const pct = Math.round(((i) / monthsList.length) * 100);
      fill.style.width = `${pct}%`;
      statusText.textContent = `Scraping month ${m} (${i + 1}/${monthsList.length})...`;

      try {
        // If current page is already the target month, parse directly from current DOM
        const pageMonthInput = document.querySelector('input[type="month"][name="month"]');
        let records = [];

        if (pageMonthInput && pageMonthInput.value === m && window.location.pathname.includes('qc-report')) {
          records = QCParser.parseFromDOM(document, m);
        } else {
          // Fetch via active session
          const resp = await fetch(`https://teacher.mojaru.com/teacher/qc-report?month=${m}`, {
            credentials: 'include'
          });
          const html = await resp.text();
          records = QCParser.parseHTML(html, m);
        }

        allScraped.push(...records);
        statusText.textContent = `Month ${m}: Scraped ${records.length} classes`;
        // Subtle delay to be gentle on server
        await new Promise(r => setTimeout(r, 600));
      } catch (err) {
        console.error(`Failed scraping month ${m}:`, err);
        statusText.textContent = `Error scraping month ${m}: ${err.message}`;
      }
    }

    fill.style.width = '100%';
    statusText.textContent = `Done! Scraped ${allScraped.length} total classes. Saving...`;

    // Save to storage
    if (typeof QCStorage !== 'undefined') {
      await QCStorage.saveRecords(allScraped);
      statusText.textContent = `Success! Saved ${allScraped.length} fresh classes.`;
    } else if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ mojaru_qc_records: allScraped }, () => {
        statusText.textContent = `Saved ${allScraped.length} fresh classes to extension storage!`;
      });
    }

    scrapeBtn.disabled = false;
    scrapeBtn.style.opacity = '1';
    scrapeBtn.textContent = '✔ Scraping Complete!';

    setTimeout(() => {
      scrapeBtn.textContent = '▶ Start Scraping Range';
    }, 4000);
  }
})();
