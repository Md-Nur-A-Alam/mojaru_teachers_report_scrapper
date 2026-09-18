/**
 * Mojaru QC Report Table & HTML Parser
 */

const QCParser = {
  /**
   * Parse Month string from date string "01 Sep, 2026 06:45 PM - 08:00 PM"
   * @param {string} dateStr
   * @returns {string} YYYY-MM
   */
  parseMonthFromDate(dateStr) {
    if (!dateStr) return '';
    const months = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const match = dateStr.match(/\d{1,2}\s+([A-Za-z]{3}),?\s+(\d{4})/i);
    if (match) {
      const mon = match[1].toLowerCase();
      const year = match[2];
      const monthNum = months[mon] || '01';
      return `${year}-${monthNum}`;
    }
    return '';
  },

  /**
   * Standardize date into YYYY-MM-DD
   * @param {string} dateStr
   * @returns {string}
   */
  parseDateISO(dateStr) {
    if (!dateStr) return '';
    const months = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const match = dateStr.match(/(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})/i);
    if (match) {
      const day = match[1].padStart(2, '0');
      const mon = months[match[2].toLowerCase()] || '01';
      const year = match[3];
      return `${year}-${mon}-${day}`;
    }
    return '';
  },

  /**
   * Parse rows from a DOM document or fragment
   * @param {Document|Element} root
   * @param {string} [fallbackMonth]
   * @returns {Array<Object>}
   */
  parseFromDOM(root, fallbackMonth = '') {
    // Attempt to locate the month from input[type="month"] if present
    let detectedMonth = fallbackMonth;
    const monthInput = root.querySelector ? root.querySelector('input[type="month"][name="month"]') : null;
    if (monthInput && monthInput.value) {
      detectedMonth = monthInput.value;
    }

    // Locate the table
    const table = root.querySelector ? root.querySelector('table') : null;
    if (!table) return [];

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const parsedData = [];

    rows.forEach((tr, index) => {
      const cells = tr.querySelectorAll('td');
      if (cells.length < 8) return; // Skip invalid or empty rows

      // Cell 0: Index #
      const rowNumText = cells[0].textContent.trim();
      const rowNum = parseInt(rowNumText, 10) || (index + 1);

      // Cell 1: Course | Batch | Subject
      const courseBadge = cells[1].querySelector('.badge-info') || cells[1].querySelector('.badge:first-child');
      const batchBadge = cells[1].querySelector('.badge-primary');
      const subjectBadge = cells[1].querySelector('.badge-success') || cells[1].querySelector('.badge:last-child');

      const courseName = courseBadge ? courseBadge.textContent.trim() : '';
      const batchCode = batchBadge ? batchBadge.textContent.trim() : '';
      const subjectName = subjectBadge ? subjectBadge.textContent.trim() : '';

      // Fallback if badges not found
      const cell1Text = cells[1].textContent.trim().split('\n').map(s => s.trim()).filter(Boolean);
      const finalCourse = courseName || cell1Text[0] || 'Unknown Course';
      const finalBatch = batchCode || cell1Text[1] || 'Unknown Batch';
      const finalSubject = subjectName || cell1Text[2] || 'Unknown Subject';

      // Cell 2: Class Time (e.g. "01 Sep, 2026 06:45 PM - 08:00 PM")
      const classTimeRaw = cells[2].textContent.replace(/\s+/g, ' ').trim();
      const dateISO = this.parseDateISO(classTimeRaw);
      const rowMonth = this.parseMonthFromDate(classTimeRaw) || detectedMonth || '';

      // Time portion
      let timeRange = '';
      const timeMatch = classTimeRaw.match(/\d{1,2}:\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)/i);
      if (timeMatch) {
        timeRange = timeMatch[0];
      }

      // Cell 3: On time
      const onTime = parseInt(cells[3].textContent.trim(), 10) || 0;

      // Cell 4: Camera on
      const cameraOn = parseInt(cells[4].textContent.trim(), 10) || 0;

      // Cell 5: Class test
      const classTest = parseInt(cells[5].textContent.trim(), 10) || 0;

      // Cell 6: Attendances
      const attendances = parseInt(cells[6].textContent.trim(), 10) || 0;

      // Cell 7: Total
      const totalScore = parseInt(cells[7].textContent.trim(), 10) || (onTime + cameraOn + classTest + attendances);

      // Cell 8: Bonus (e.g. "0 Tk", "160 tk", "200 tk")
      const bonusCell = cells[8] ? cells[8].textContent.trim() : '0 Tk';
      const portalBonus = bonusCell.replace(/\s+/g, ' ');

      // Evaluate business rules
      const evalResult = (typeof QCRules !== 'undefined')
        ? QCRules.evaluateRow({
            on_time: onTime,
            camera_on: cameraOn,
            class_test: classTest,
            attendances: attendances,
            portal_bonus: portalBonus
          })
        : {
            expectedBonus: (onTime === 1 && totalScore >= 3) ? totalScore * 40 : 0,
            hasDiscrepancy: false,
            discrepancyNote: ''
          };

      const recordId = `qc_${rowMonth}_${finalBatch}_${dateISO}_${index + 1}`.replace(/[^a-zA-Z0-9_-]/g, '_');

      parsedData.push({
        id: recordId,
        month: rowMonth,
        row_num: rowNum,
        course_name: finalCourse,
        batch_code: finalBatch,
        subject_name: finalSubject,
        class_time_raw: classTimeRaw,
        class_date: dateISO,
        time_range: timeRange,
        on_time: onTime,
        camera_on: cameraOn,
        class_test: classTest,
        attendances: attendances,
        total_score: totalScore,
        portal_bonus: portalBonus,
        calculated_bonus: evalResult.expectedBonus,
        has_discrepancy: evalResult.hasDiscrepancy,
        discrepancy_note: evalResult.discrepancyNote,
        is_edited: false,
        is_manual: false,
        edited_at: null,
        created_at: new Date().toISOString()
      });
    });

    return parsedData;
  },

  /**
   * Parse raw HTML string
   * @param {string} htmlString
   * @param {string} [fallbackMonth]
   * @returns {Array<Object>}
   */
  parseHTML(htmlString, fallbackMonth = '') {
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      return this.parseFromDOM(doc, fallbackMonth);
    }
    return [];
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QCParser;
}
if (typeof window !== 'undefined') {
  window.QCParser = QCParser;
}
