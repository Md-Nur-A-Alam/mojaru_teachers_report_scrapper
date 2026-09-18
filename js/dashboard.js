/**
 * Mojaru Teacher QC Analytics Dashboard Controller
 */

(function () {
  let allRecords = [];
  let currentFiltered = [];

  // DOM Elements
  const tableBody = document.getElementById('qc-table-body');
  const visibleRowsCountEl = document.getElementById('visible-rows-count');
  const totalRowsCountEl = document.getElementById('total-rows-count');
  const editedRowsCountEl = document.getElementById('edited-rows-count');

  // KPI Elements
  const statEarnedBonus = document.getElementById('stat-earned-bonus');
  const statTotalClasses = document.getElementById('stat-total-classes');
  const statLostBonus = document.getElementById('stat-lost-bonus');
  const statDisqualifiedClasses = document.getElementById('stat-disqualified-classes');
  const statOntimeRate = document.getElementById('stat-ontime-rate');
  const statOntimeCount = document.getElementById('stat-ontime-count');
  const statCameraRate = document.getElementById('stat-camera-rate');
  const statCameraCount = document.getElementById('stat-camera-count');
  const statHighAttendanceRate = document.getElementById('stat-high-attendance-rate');
  const statAttendance2pt = document.getElementById('stat-attendance-2pt');

  // Filter Elements
  const filterSearch = document.getElementById('filter-search');
  const filterMonth = document.getElementById('filter-month');
  const filterDateFrom = document.getElementById('filter-date-from');
  const filterDateTo = document.getElementById('filter-date-to');
  const filterBatch = document.getElementById('filter-batch');
  const filterCourse = document.getElementById('filter-course');
  const filterBonusStatus = document.getElementById('filter-bonus-status');
  const filterModStatus = document.getElementById('filter-mod-status');
  const filterEditedBadge = document.getElementById('filter-edited-badge');
  const btnResetFilters = document.getElementById('btn-reset-filters');

  // Sorting State: 3 states ('original' -> 'asc' -> 'desc' -> 'original')
  let currentSortColumn = 'original';
  let currentSortDirection = 'original';

  // Scraper Ribbon Elements
  const dashScrapeStart = document.getElementById('dash-scrape-start');
  const dashScrapeEnd = document.getElementById('dash-scrape-end');
  const dashBtnRunScrape = document.getElementById('dash-btn-run-scrape');
  const dashBtnQuick3 = document.getElementById('dash-btn-quick-3');
  const dashBtnQuick6 = document.getElementById('dash-btn-quick-6');
  const dashScraperProgress = document.getElementById('dash-scraper-progress');
  const dashProgressStatus = document.getElementById('dash-progress-status');
  const dashProgressPercent = document.getElementById('dash-progress-percent');
  const dashProgressFill = document.getElementById('dash-progress-fill');

  // Modal Elements: Record Form
  const recordModal = document.getElementById('record-modal');
  const recordModalTitle = document.getElementById('record-modal-title');
  const recordModalClose = document.getElementById('record-modal-close');
  const recordModalCancel = document.getElementById('record-modal-cancel');
  const recordForm = document.getElementById('record-form');
  const modalRecordId = document.getElementById('modal-record-id');
  const formMonth = document.getElementById('form-month');
  const formBatch = document.getElementById('form-batch');
  const formCourse = document.getElementById('form-course');
  const formSubject = document.getElementById('form-subject');
  const formClassTime = document.getElementById('form-class-time');
  const formOntime = document.getElementById('form-ontime');
  const formCamera = document.getElementById('form-camera');
  const formClasstest = document.getElementById('form-classtest');
  const formAttendances = document.getElementById('form-attendances');
  const formLiveTotal = document.getElementById('form-live-total');
  const formLiveBonus = document.getElementById('form-live-bonus');
  const formRuleExplanation = document.getElementById('form-rule-explanation');
  const formNotes = document.getElementById('form-notes');
  const btnAddRecord = document.getElementById('btn-add-record');

  // Modal Elements: Import HTML
  const importModal = document.getElementById('import-modal');
  const btnOpenImport = document.getElementById('btn-open-import');
  const importModalClose = document.getElementById('import-modal-close');
  const importModalCancel = document.getElementById('import-modal-cancel');
  const btnRunImport = document.getElementById('btn-run-import');
  const importHtmlTextarea = document.getElementById('import-html-textarea');
  const importMonthHint = document.getElementById('import-month-hint');

  // Export Button
  const btnExportCsv = document.getElementById('btn-export-csv');

  // Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');

  // Toast Container
  const toastContainer = document.getElementById('toast-container');

  function showToast(message, type = 'teal') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Initialize
  async function init() {
    setupTheme();
    bindEvents();
    await loadData();
  }

  // Theme setup
  function setupTheme() {
    const savedTheme = localStorage.getItem('mojaru_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('mojaru_theme', next);
    });
  }

  // Load Data from Storage
  async function loadData() {
    allRecords = await QCStorage.getRecords();
    populateFilterOptions();
    applyFilters();
  }

  // Populate dynamic options
  function populateFilterOptions() {
    const months = new Set();
    const batches = new Set();
    const courses = new Set();

    allRecords.forEach(r => {
      if (r.month) months.add(r.month);
      if (r.batch_code) batches.add(r.batch_code);
      if (r.course_name) courses.add(r.course_name);
    });

    // Populate Months
    const selectedMonth = filterMonth.value;
    filterMonth.innerHTML = '<option value="">All Months</option>';
    Array.from(months).sort().reverse().forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = formatMonthName(m);
      if (m === selectedMonth) opt.selected = true;
      filterMonth.appendChild(opt);
    });

    // Populate Batches
    const selectedBatch = filterBatch.value;
    filterBatch.innerHTML = '<option value="">All Batches</option>';
    Array.from(batches).sort().forEach(b => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      if (b === selectedBatch) opt.selected = true;
      filterBatch.appendChild(opt);
    });

    // Populate Courses
    const selectedCourse = filterCourse.value;
    filterCourse.innerHTML = '<option value="">All Courses</option>';
    Array.from(courses).sort().forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === selectedCourse) opt.selected = true;
      filterCourse.appendChild(opt);
    });
  }

  function formatMonthName(ym) {
    if (!ym) return '';
    const [year, month] = ym.split('-');
    const date = new Date(year, parseInt(month, 10) - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' }) + ` (${ym})`;
  }

  // Apply filters and render
  function applyFilters() {
    const search = filterSearch.value.trim().toLowerCase();
    const selMonth = filterMonth.value;
    const selBatch = filterBatch.value;
    const selCourse = filterCourse.value;
    const selBonusStatus = filterBonusStatus.value;
    const selModStatus = filterModStatus.value;

    const dateFrom = filterDateFrom ? filterDateFrom.value : '';
    const dateTo = filterDateTo ? filterDateTo.value : '';

    currentFiltered = allRecords.filter(r => {
      // Specific Date Range Filter
      if (dateFrom && r.class_date && r.class_date < dateFrom) return false;
      if (dateTo && r.class_date && r.class_date > dateTo) return false;

      // Month
      if (selMonth && r.month !== selMonth) return false;

      // Batch
      if (selBatch && r.batch_code !== selBatch) return false;

      // Course
      if (selCourse && r.course_name !== selCourse) return false;

      // Bonus status
      if (selBonusStatus === 'paid') {
        if ((r.calculated_bonus || 0) <= 0) return false;
      } else if (selBonusStatus === 'zero') {
        if ((r.calculated_bonus || 0) > 0) return false;
      } else if (selBonusStatus === 'discrepancy') {
        if (!r.has_discrepancy) return false;
      }

      // Modification status
      if (selModStatus === 'edited_only') {
        if (!r.is_edited) return false;
      } else if (selModStatus === 'manual_only') {
        if (!r.is_manual) return false;
      } else if (selModStatus === 'scraped_only') {
        if (r.is_edited || r.is_manual) return false;
      }

      // Search keyword
      if (search) {
        const textToSearch = [
          r.batch_code,
          r.course_name,
          r.subject_name,
          r.class_time_raw,
          r.class_date,
          r.notes,
          r.portal_bonus
        ].filter(Boolean).join(' ').toLowerCase();

        if (!textToSearch.includes(search)) return false;
      }

      return true;
    });

    // 3-State Column Sorting ('original' -> 'asc' -> 'desc' -> 'original')
    if (currentSortDirection === 'original') {
      currentFiltered.sort((a, b) => (a.original_index || a.row_num || 0) - (b.original_index || b.row_num || 0));
    } else {
      const dir = currentSortDirection === 'asc' ? 1 : -1;
      currentFiltered.sort((a, b) => {
        let valA = a[currentSortColumn];
        let valB = b[currentSortColumn];

        if (currentSortColumn === 'course_batch_subject') {
          valA = `${a.course_name || ''} ${a.batch_code || ''} ${a.subject_name || ''}`;
          valB = `${b.course_name || ''} ${b.batch_code || ''} ${b.subject_name || ''}`;
        } else if (currentSortColumn === 'calculated_bonus') {
          valA = Number(a.calculated_bonus) || 0;
          valB = Number(b.calculated_bonus) || 0;
        }

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'number' && typeof valB === 'number') {
          return (valA - valB) * dir;
        }
        return String(valA).localeCompare(String(valB), undefined, { numeric: true }) * dir;
      });
    }

    renderTable();
    updateKPIs();
  }

  // 3-State Column Sort Handler ('original' -> 'asc' -> 'desc' -> 'original')
  function handleColumnSort(colKey) {
    if (currentSortColumn === colKey) {
      if (currentSortDirection === 'original') {
        currentSortDirection = 'asc';
      } else if (currentSortDirection === 'asc') {
        currentSortDirection = 'desc';
      } else {
        currentSortDirection = 'original';
      }
    } else {
      currentSortColumn = colKey;
      currentSortDirection = 'asc';
    }

    updateSortHeaders();
    applyFilters();
  }

  function updateSortHeaders() {
    document.querySelectorAll('.sortable-th').forEach(th => {
      const colKey = th.getAttribute('data-sort');
      const icon = th.querySelector('.sort-icon');
      if (colKey === currentSortColumn && currentSortDirection !== 'original') {
        th.classList.add('sort-active');
        if (icon) {
          icon.textContent = currentSortDirection === 'asc' ? '↑' : '↓';
        }
      } else {
        th.classList.remove('sort-active');
        if (icon) {
          icon.textContent = '⇅';
        }
      }
    });
  }

  // Render Table Rows
  function renderTable() {
    tableBody.innerHTML = '';

    visibleRowsCountEl.textContent = currentFiltered.length;
    totalRowsCountEl.textContent = allRecords.length;

    const editedCount = allRecords.filter(r => r.is_edited || r.is_manual).length;
    editedRowsCountEl.textContent = editedCount;

    if (currentFiltered.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <div style="font-size: 28px; margin-bottom: 8px;">📋</div>
          <div style="font-weight: 700; font-size: 15px;">No class records match your filter</div>
          <p style="font-size: 12px; margin-top: 4px;">Try clearing filters or running the scraper for other months.</p>
        </td>
      `;
      tableBody.appendChild(emptyRow);
      return;
    }

    currentFiltered.forEach((r, idx) => {
      const tr = document.createElement('tr');

      // CRITICAL WARNING HIGHLIGHTING
      const isEditedOrManual = r.is_edited || r.is_manual;
      if (isEditedOrManual) {
        tr.classList.add(r.is_manual ? 'row-manual' : 'row-edited');
      }

      // Format Bonus
      const calcBonus = Number(r.calculated_bonus) || 0;
      const portalBonus = r.portal_bonus || `${calcBonus} tk`;
      const isPaid = calcBonus > 0;

      // Status Badges
      let statusBadge = '';
      if (r.is_manual) {
        statusBadge = `<span class="status-pill-warning" title="Manually created class record on ${r.created_at || 'unknown'}">MANUAL</span>`;
      } else if (r.is_edited) {
        statusBadge = `<span class="status-pill-warning" title="Record was edited. Original values preserved.">EDITED</span>`;
      }

      // Discrepancy indicator
      let discrepancyHtml = '';
      if (r.has_discrepancy) {
        discrepancyHtml = `
          <div class="discrepancy-flag" title="${r.discrepancy_note || 'Portal bonus differs from standard rule'}">
            ⚠️ <span>Portal: ${portalBonus}</span>
          </div>
        `;
      }

      tr.innerHTML = `
        <td>
          <span class="row-num-badge">${r.row_num || (idx + 1)}</span>
          ${statusBadge ? `<br>${statusBadge}` : ''}
        </td>
        <td>
          <span class="badge-tag badge-course">${escapeHTML(r.course_name || 'Course')}</span><br>
          <span class="badge-tag badge-batch">${escapeHTML(r.batch_code || 'Batch')}</span><br>
          <span class="badge-tag badge-subject">${escapeHTML(r.subject_name || 'Subject')}</span>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${escapeHTML(r.class_date || '')}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${escapeHTML(r.time_range || r.class_time_raw || '')}</div>
        </td>
        <td>
          <span class="score-chip val-${r.on_time || 0}">${r.on_time || 0}</span>
        </td>
        <td>
          <span class="score-chip val-${r.camera_on || 0}">${r.camera_on || 0}</span>
        </td>
        <td>
          <span class="score-chip val-${r.class_test || 0}">${r.class_test || 0}</span>
        </td>
        <td>
          <span class="score-chip val-${r.attendances || 0}">${r.attendances || 0}</span>
        </td>
        <td>
          <span class="score-total-chip">${r.total_score || 0}</span>
        </td>
        <td>
          <div class="bonus-text ${isPaid ? 'bonus-paid' : 'bonus-zero'}">
            ${calcBonus.toLocaleString()} Tk
          </div>
          ${discrepancyHtml}
        </td>
        <td style="text-align: right;">
          <div class="row-actions" style="justify-content: flex-end;">
            <button class="action-btn edit-btn" title="Edit this record" data-id="${r.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            ${r.is_edited && r.original_backup ? `
              <button class="action-btn restore-btn" title="Revert to original scraped values" data-id="${r.id}" style="color: #f59e0b;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
              </button>
            ` : ''}
            <button class="action-btn delete-btn" title="Delete record" data-id="${r.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // Bind action buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.getAttribute('data-id')));
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => confirmDelete(btn.getAttribute('data-id')));
    });

    document.querySelectorAll('.restore-btn').forEach(btn => {
      btn.addEventListener('click', () => restoreOriginalRecord(btn.getAttribute('data-id')));
    });
  }

  // Update Summary KPI Metrics
  function updateKPIs() {
    const list = currentFiltered;
    const totalCount = list.length;
    statTotalClasses.textContent = totalCount;

    let earned = 0;
    let lost = 0;
    let ontimeCount = 0;
    let cameraCount = 0;
    let attendance2Count = 0;
    let disqualifiedCount = 0;

    list.forEach(r => {
      const calcBonus = Number(r.calculated_bonus) || 0;
      earned += calcBonus;

      const total = Number(r.total_score) || (Number(r.on_time) + Number(r.camera_on) + Number(r.class_test) + Number(r.attendances));
      const potential = total * 40;

      if (calcBonus === 0 && potential > 0) {
        lost += potential;
        disqualifiedCount++;
      }

      if (Number(r.on_time) === 1) ontimeCount++;
      if (Number(r.camera_on) === 1) cameraCount++;
      if (Number(r.attendances) === 2) attendance2Count++;
    });

    statEarnedBonus.textContent = `${earned.toLocaleString()} Tk`;
    statLostBonus.textContent = `${lost.toLocaleString()} Tk`;
    statDisqualifiedClasses.textContent = `${disqualifiedCount} classes`;

    statOntimeRate.textContent = totalCount ? `${Math.round((ontimeCount / totalCount) * 100)}%` : '0%';
    statOntimeCount.textContent = ontimeCount;

    statCameraRate.textContent = totalCount ? `${Math.round((cameraCount / totalCount) * 100)}%` : '0%';
    statCameraCount.textContent = cameraCount;

    statHighAttendanceRate.textContent = totalCount ? `${Math.round((attendance2Count / totalCount) * 100)}%` : '0%';
    statAttendance2pt.textContent = attendance2Count;
  }

  // Bind All Events
  function bindEvents() {

    // Search & Filters
    filterSearch.addEventListener('input', applyFilters);
    filterMonth.addEventListener('change', applyFilters);
    if (filterDateFrom) filterDateFrom.addEventListener('change', applyFilters);
    if (filterDateTo) filterDateTo.addEventListener('change', applyFilters);
    filterBatch.addEventListener('change', applyFilters);
    filterCourse.addEventListener('change', applyFilters);
    filterBonusStatus.addEventListener('change', applyFilters);
    filterModStatus.addEventListener('change', applyFilters);

    // 3-State Column Sorting clicks
    document.querySelectorAll('.sortable-th').forEach(th => {
      th.addEventListener('click', () => {
        const colKey = th.getAttribute('data-sort');
        handleColumnSort(colKey);
      });
    });

    // Warning Badge Filter Toggle
    filterEditedBadge.addEventListener('click', () => {
      if (filterModStatus.value === 'edited_only') {
        filterModStatus.value = '';
        filterEditedBadge.classList.remove('active-filter');
      } else {
        filterModStatus.value = 'edited_only';
        filterEditedBadge.classList.add('active-filter');
      }
      applyFilters();
    });

    btnResetFilters.addEventListener('click', () => {
      filterSearch.value = '';
      filterMonth.value = '';
      if (filterDateFrom) filterDateFrom.value = '';
      if (filterDateTo) filterDateTo.value = '';
      filterBatch.value = '';
      filterCourse.value = '';
      filterBonusStatus.value = '';
      filterModStatus.value = '';
      filterEditedBadge.classList.remove('active-filter');

      // Reset sort to original order
      currentSortColumn = 'original';
      currentSortDirection = 'original';
      updateSortHeaders();

      applyFilters();
      showToast('Filters and sorting reset');
    });

    // Scraper Quick Ranges
    dashBtnQuick3.addEventListener('click', () => {
      const mos = getPastMonths(3);
      dashScrapeStart.value = mos[0];
      dashScrapeEnd.value = mos[mos.length - 1];
    });

    dashBtnQuick6.addEventListener('click', () => {
      const mos = getPastMonths(6);
      dashScrapeStart.value = mos[0];
      dashScrapeEnd.value = mos[mos.length - 1];
    });

    // Run Scraper from Dashboard
    dashBtnRunScrape.addEventListener('click', async () => {
      const startM = dashScrapeStart.value;
      const endM = dashScrapeEnd.value;

      if (!startM || !endM) {
        showToast('Please select both start and end months', 'warning');
        return;
      }

      const months = startM <= endM
        ? generateMonthsRange(startM, endM)
        : generateMonthsRange(endM, startM);

      dashScraperProgress.style.display = 'block';
      dashBtnRunScrape.disabled = true;

      // Requirement: In every search, the overall data should be clear first
      await QCStorage.clearAll();

      const allScraped = [];

      for (let i = 0; i < months.length; i++) {
        const m = months[i];
        const pct = Math.round((i / months.length) * 100);
        dashProgressFill.style.width = `${pct}%`;
        dashProgressPercent.textContent = `${pct}%`;
        dashProgressStatus.textContent = `Scraping month ${m} (${i + 1}/${months.length})...`;

        try {
          const resp = await fetch(`https://teacher.mojaru.com/teacher/qc-report?month=${m}`, {
            credentials: 'include'
          });
          if (resp.ok) {
            const html = await resp.text();
            const records = QCParser.parseHTML(html, m);
            allScraped.push(...records);
            dashProgressStatus.textContent = `Month ${m}: Scraped ${records.length} classes`;
          } else {
            dashProgressStatus.textContent = `Month ${m}: HTTP ${resp.status} (Please ensure logged in)`;
          }
        } catch (e) {
          console.warn(`Scraper error on month ${m}:`, e);
          dashProgressStatus.textContent = `Failed fetching month ${m}. (Cross-origin or offline)`;
        }

        await new Promise(r => setTimeout(r, 600));
      }

      dashProgressFill.style.width = '100%';
      dashProgressPercent.textContent = '100%';

      if (allScraped.length > 0) {
        await QCStorage.saveRecords(allScraped);
        showToast(`Search completed! Saved ${allScraped.length} fresh classes.`, 'teal');
        await loadData();
      } else {
        showToast('No records fetched. Make sure you are logged into teacher.mojaru.com in this browser.', 'warning');
      }

      dashBtnRunScrape.disabled = false;
      setTimeout(() => {
        dashScraperProgress.style.display = 'none';
      }, 3500);
    });

    // Add Record Modal
    btnAddRecord.addEventListener('click', openCreateModal);
    recordModalClose.addEventListener('click', closeRecordModal);
    recordModalCancel.addEventListener('click', closeRecordModal);

    // Live points calculation in modal
    [formOntime, formCamera, formClasstest, formAttendances].forEach(input => {
      input.addEventListener('change', updateModalLiveCalculation);
    });

    // Save Record (Form Submit)
    recordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveRecord();
    });

    // Import HTML Modal
    btnOpenImport.addEventListener('click', () => {
      importHtmlTextarea.value = '';
      importModal.classList.add('open');
    });
    importModalClose.addEventListener('click', () => importModal.classList.remove('open'));
    importModalCancel.addEventListener('click', () => importModal.classList.remove('open'));

    btnRunImport.addEventListener('click', async () => {
      const html = importHtmlTextarea.value.trim();
      const monthHint = importMonthHint.value;

      if (!html) {
        showToast('Please paste the HTML snippet first.', 'warning');
        return;
      }

      const records = QCParser.parseHTML(html, monthHint);
      if (records.length === 0) {
        showToast('No class rows could be detected in the pasted HTML.', 'danger');
        return;
      }

      const res = await QCStorage.mergeScrapedRecords(records);
      importModal.classList.remove('open');
      await loadData();
      showToast(`Imported ${records.length} classes! (${res.added} new, ${res.updated} updated)`, 'teal');
    });

    // Export CSV
    btnExportCsv.addEventListener('click', exportToCSV);
  }

  // Live Score & Bonus Preview in Modal
  function updateModalLiveCalculation() {
    const onTime = parseInt(formOntime.value, 10) || 0;
    const camera = parseInt(formCamera.value, 10) || 0;
    const test = parseInt(formClasstest.value, 10) || 0;
    const attendances = parseInt(formAttendances.value, 10) || 0;

    const total = onTime + camera + test + attendances;
    formLiveTotal.textContent = `${total} pts`;

    const evalResult = QCRules.evaluateRow({
      on_time: onTime,
      camera_on: camera,
      class_test: test,
      attendances: attendances
    });

    formLiveBonus.textContent = `${evalResult.expectedBonus} Tk`;

    if (evalResult.isQualified) {
      formRuleExplanation.innerHTML = `<span style="color:#059669;">✔ Qualified for bonus: ${total} pts &times; 40 Tk = ${evalResult.expectedBonus} Tk</span>`;
    } else {
      const reasons = evalResult.reasons.join(' &bull; ');
      formRuleExplanation.innerHTML = `<span style="color:#ef4444;">✖ Disqualified: ${reasons}</span>`;
    }
  }

  // Open Create Modal
  function openCreateModal() {
    recordModalTitle.textContent = 'Add New Class Record';
    modalRecordId.value = '';
    const now = new Date();
    formMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    formBatch.value = '';
    formCourse.value = 'ম্যাথ অলিম্পিয়াড (প্রাইমারি)';
    formSubject.value = 'Math Olympiad Primary';
    formClassTime.value = `${now.getDate().toString().padStart(2, '0')} Sep, 2026 06:45 PM - 08:00 PM`;
    formOntime.value = '1';
    formCamera.value = '1';
    formClasstest.value = '1';
    formAttendances.value = '2';
    formNotes.value = '';

    updateModalLiveCalculation();
    recordModal.classList.add('open');
  }

  // Open Edit Modal
  function openEditModal(recordId) {
    const rec = allRecords.find(r => r.id === recordId);
    if (!rec) return;

    recordModalTitle.textContent = `Edit Class Record (#${rec.row_num || ''} - ${rec.batch_code || ''})`;
    modalRecordId.value = rec.id;
    formMonth.value = rec.month || '2026-09';
    formBatch.value = rec.batch_code || '';
    formCourse.value = rec.course_name || '';
    formSubject.value = rec.subject_name || '';
    formClassTime.value = rec.class_time_raw || '';
    formOntime.value = String(rec.on_time ?? 1);
    formCamera.value = String(rec.camera_on ?? 1);
    formClasstest.value = String(rec.class_test ?? 1);
    formAttendances.value = String(rec.attendances ?? 2);
    formNotes.value = rec.notes || '';

    updateModalLiveCalculation();
    recordModal.classList.add('open');
  }

  function closeRecordModal() {
    recordModal.classList.remove('open');
  }

  // Save Record (Add or Edit)
  async function handleSaveRecord() {
    const id = modalRecordId.value;
    const month = formMonth.value;
    const batch = formBatch.value.trim();
    const course = formCourse.value.trim();
    const subject = formSubject.value.trim();
    const classTimeRaw = formClassTime.value.trim();
    const onTime = parseInt(formOntime.value, 10);
    const camera = parseInt(formCamera.value, 10);
    const test = parseInt(formClasstest.value, 10);
    const attendances = parseInt(formAttendances.value, 10);
    const notes = formNotes.value.trim();

    const existing = allRecords.find(r => r.id === id);

    const recordData = {
      id: id || undefined,
      month,
      batch_code: batch,
      course_name: course,
      subject_name: subject,
      class_time_raw: classTimeRaw,
      class_date: QCParser.parseDateISO(classTimeRaw) || existing?.class_date,
      time_range: classTimeRaw.match(/\d{1,2}:\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)/i)?.[0] || existing?.time_range,
      on_time: onTime,
      camera_on: camera,
      class_test: test,
      attendances: attendances,
      notes: notes,
      row_num: existing ? existing.row_num : (allRecords.length + 1)
    };

    const saved = await QCStorage.saveRecord(recordData);
    closeRecordModal();
    await loadData();

    showToast(`Saved! Row highlighted in warning amber for identification.`, 'warning');
  }

  // Confirm Delete
  async function confirmDelete(id) {
    const rec = allRecords.find(r => r.id === id);
    if (!rec) return;

    if (confirm(`Are you sure you want to delete class record #${rec.row_num || ''} (${rec.batch_code} on ${rec.class_date})?`)) {
      await QCStorage.deleteRecord(id);
      await loadData();
      showToast('Record deleted successfully.', 'teal');
    }
  }

  // Revert / Restore to Original
  async function restoreOriginalRecord(id) {
    if (confirm('Revert this record back to its original scraped values?')) {
      const restored = await QCStorage.restoreOriginal(id);
      if (restored) {
        await loadData();
        showToast('Record restored to original values. Warning highlight cleared.', 'teal');
      }
    }
  }

  // Export to CSV
  function exportToCSV() {
    if (currentFiltered.length === 0) {
      showToast('No records to export.', 'warning');
      return;
    }

    const headers = [
      '#', 'Month', 'Course', 'Batch', 'Subject', 'Class Date', 'Time',
      'On Time', 'Camera On', 'Class Test', 'Attendances', 'Total Score',
      'Calculated Bonus (Tk)', 'Portal Bonus', 'Is Edited', 'Is Manual', 'Notes'
    ];

    const rows = currentFiltered.map((r, i) => [
      r.row_num || (i + 1),
      `"${r.month || ''}"`,
      `"${(r.course_name || '').replace(/"/g, '""')}"`,
      `"${(r.batch_code || '').replace(/"/g, '""')}"`,
      `"${(r.subject_name || '').replace(/"/g, '""')}"`,
      `"${r.class_date || ''}"`,
      `"${r.time_range || r.class_time_raw || ''}"`,
      r.on_time || 0,
      r.camera_on || 0,
      r.class_test || 0,
      r.attendances || 0,
      r.total_score || 0,
      r.calculated_bonus || 0,
      `"${r.portal_bonus || ''}"`,
      r.is_edited ? 'YES' : 'NO',
      r.is_manual ? 'YES' : 'NO',
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mojaru_QC_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported CSV file successfully!', 'teal');
  }

  // Month utilities
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

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Start app
  document.addEventListener('DOMContentLoaded', init);
})();
