/**
 * Extension Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const pillCount = document.getElementById('pill-count');
  const earnedBonusEl = document.getElementById('popup-earned-bonus');
  const lostBonusEl = document.getElementById('popup-lost-bonus');
  const startMonthInput = document.getElementById('start-month');
  const endMonthInput = document.getElementById('end-month');
  const btnScrape = document.getElementById('btn-scrape');
  const scrapeLabel = document.getElementById('scrape-label');
  const btnDashboard = document.getElementById('btn-dashboard');
  const progressBox = document.getElementById('progress-box');
  const progressStatus = document.getElementById('progress-status');
  const progressFill = document.getElementById('progress-fill');
  const linkClear = document.getElementById('link-clear');

  const chipCurrent = document.getElementById('chip-current');
  const chip3mos = document.getElementById('chip-3mos');
  const chip6mos = document.getElementById('chip-6mos');

  // Format YYYY-MM
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  function getPastMonths(n) {
    const result = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      result.push(`${yr}-${mo}`);
    }
    return result;
  }

  function generateMonthsRange(startYm, endYm) {
    const [startYear, startMonth] = startYm.split('-').map(Number);
    const [endYear, endMonth] = endYm.split('-').map(Number);

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

  // Set default months
  startMonthInput.value = '2026-09';
  endMonthInput.value = '2026-09';

  // Load and refresh stats
  async function refreshStats() {
    const records = await QCStorage.getRecords();
    pillCount.textContent = records.length;

    let earned = 0;
    let lost = 0;

    records.forEach(r => {
      const calcBonus = Number(r.calculated_bonus) || 0;
      earned += calcBonus;

      // Lost bonus: if points were earned (total_score * 40) but disqualified due to late (on_time == 0) or total < 3
      const totalScore = Number(r.total_score) || (Number(r.on_time) + Number(r.camera_on) + Number(r.class_test) + Number(r.attendances));
      const potential = totalScore * 40;
      if (calcBonus === 0 && potential > 0) {
        lost += potential;
      }
    });

    earnedBonusEl.textContent = `${earned.toLocaleString()} Tk`;
    lostBonusEl.textContent = `${lost.toLocaleString()} Tk`;

    // Try detecting current tab month
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].url && tabs[0].url.includes('mojaru.com')) {
          const urlMatch = tabs[0].url.match(/month=(\d{4}-\d{2})/);
          if (urlMatch) {
            startMonthInput.value = urlMatch[1];
            endMonthInput.value = urlMatch[1];
          }
        }
      });
    }
  }

  await refreshStats();

  // Preset chips
  chipCurrent.addEventListener('click', () => {
    startMonthInput.value = currentYM;
    endMonthInput.value = currentYM;
    highlightChip(chipCurrent);
  });

  chip3mos.addEventListener('click', () => {
    const mos = getPastMonths(3);
    startMonthInput.value = mos[0];
    endMonthInput.value = mos[mos.length - 1];
    highlightChip(chip3mos);
  });

  chip6mos.addEventListener('click', () => {
    const mos = getPastMonths(6);
    startMonthInput.value = mos[0];
    endMonthInput.value = mos[mos.length - 1];
    highlightChip(chip6mos);
  });

  function highlightChip(activeBtn) {
    [chipCurrent, chip3mos, chip6mos].forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
  }

  // Open Dashboard
  btnDashboard.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    } else {
      window.open('dashboard.html', '_blank');
    }
  });

  // Reset seed
  linkClear.addEventListener('click', async (e) => {
    e.preventDefault();
    if (confirm('Reset data back to initial 22 classes from September 2026?')) {
      await QCStorage.resetToSeed();
      await refreshStats();
      alert('Data reset successfully.');
    }
  });

  // Start Scraping
  btnScrape.addEventListener('click', async () => {
    const startM = startMonthInput.value;
    const endM = endMonthInput.value;

    if (!startM || !endM) {
      alert('Please choose both start and end months.');
      return;
    }

    const months = startM <= endM
      ? generateMonthsRange(startM, endM)
      : generateMonthsRange(endM, startM);

    progressBox.style.display = 'block';
    btnScrape.disabled = true;
    btnScrape.style.opacity = '0.6';
    scrapeLabel.textContent = 'Scraping...';

    const allScraped = [];

    for (let i = 0; i < months.length; i++) {
      const m = months[i];
      const pct = Math.round(((i) / months.length) * 100);
      progressFill.style.width = `${pct}%`;
      progressStatus.textContent = `Fetching month ${m} (${i + 1}/${months.length})...`;

      try {
        const resp = await fetch(`https://teacher.mojaru.com/teacher/qc-report?month=${m}`, {
          credentials: 'include'
        });

        if (resp.ok) {
          const html = await resp.text();
          const records = QCParser.parseHTML(html, m);
          allScraped.push(...records);
          progressStatus.textContent = `Month ${m}: Scraped ${records.length} classes`;
        } else {
          progressStatus.textContent = `Month ${m}: HTTP ${resp.status}`;
        }
      } catch (err) {
        console.warn(`Error fetching ${m}:`, err);
        progressStatus.textContent = `Error on ${m}: ${err.message}`;
      }

      await new Promise(r => setTimeout(r, 500));
    }

    progressFill.style.width = '100%';
    progressStatus.textContent = `Done! Merging ${allScraped.length} records...`;

    if (allScraped.length > 0) {
      const res = await QCStorage.mergeScrapedRecords(allScraped);
      progressStatus.textContent = `Success! Added: ${res.added}, Updated: ${res.updated}`;
    } else {
      progressStatus.textContent = 'No records found or session expired.';
    }

    await refreshStats();

    btnScrape.disabled = false;
    btnScrape.style.opacity = '1';
    scrapeLabel.textContent = 'Scraping Finished!';

    setTimeout(() => {
      scrapeLabel.textContent = 'Scrape Range Now';
    }, 3000);
  });
});
