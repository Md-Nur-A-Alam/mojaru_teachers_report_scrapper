/**
 * Mojaru QC Report Business Logic & Bonus Calculation Rules
 */

const QCRules = {
  // Bonus per earned point in BDT
  BONUS_PER_POINT: 40,

  // Minimum required total score to qualify for bonus
  MIN_QUALIFYING_POINTS: 3,

  /**
   * Calculate total points from sub-metrics
   * @param {Object} row
   * @returns {number}
   */
  calculateTotal(row) {
    const onTime = Number(row.on_time) || 0;
    const cameraOn = Number(row.camera_on) || 0;
    const classTest = Number(row.class_test) || 0;
    const attendances = Number(row.attendances) || 0;
    return onTime + cameraOn + classTest + attendances;
  },

  /**
   * Calculate expected bonus based on Mojaru QC policy
   * Rule 1: On-time is strictly required (if on_time == 0 -> 0 Tk bonus)
   * Rule 2: Total points must be at least 3 (if total < 3 -> 0 Tk bonus)
   * Rule 3: 40 Tk per point
   * @param {Object} row
   * @returns {number} bonus in Tk
   */
  calculateBonus(row) {
    const onTime = Number(row.on_time) || 0;
    const total = this.calculateTotal(row);

    // Rule 1: Teacher must be on time
    if (onTime === 0) {
      return 0;
    }

    // Rule 2: Total points must be at least 3
    if (total < this.MIN_QUALIFYING_POINTS) {
      return 0;
    }

    // Rule 3: 40 Tk per point
    return total * this.BONUS_PER_POINT;
  },

  /**
   * Parse numeric value from portal bonus text, e.g. "160 tk", "0 Tk" -> 160
   * @param {string|number} rawBonus
   * @returns {number}
   */
  parseBonusAmount(rawBonus) {
    if (typeof rawBonus === 'number') return rawBonus;
    if (!rawBonus) return 0;
    const clean = String(rawBonus).replace(/[^0-9.]/g, '').trim();
    return clean ? parseFloat(clean) : 0;
  },

  /**
   * Evaluate a row for compliance, penalties, and discrepancies
   * @param {Object} row
   * @returns {Object} evaluation details
   */
  evaluateRow(row) {
    const total = this.calculateTotal(row);
    const expectedBonus = this.calculateBonus(row);
    const portalBonusNum = this.parseBonusAmount(row.portal_bonus ?? row.bonus);
    const onTime = Number(row.on_time) || 0;

    const reasons = [];
    if (onTime === 0) {
      reasons.push('Late arrival / Not on time (Bonus disqualified)');
    }
    if (total < this.MIN_QUALIFYING_POINTS) {
      reasons.push(`Total points (${total}) is below minimum requirement (${this.MIN_QUALIFYING_POINTS})`);
    }

    const hasDiscrepancy = portalBonusNum !== expectedBonus;
    let discrepancyNote = '';
    if (hasDiscrepancy) {
      if (portalBonusNum > expectedBonus) {
        discrepancyNote = `Portal granted ${portalBonusNum} Tk but standard rule calculates ${expectedBonus} Tk (${reasons.join(', ') || 'Rule check'}).`;
      } else {
        discrepancyNote = `Portal gave ${portalBonusNum} Tk instead of expected ${expectedBonus} Tk.`;
      }
    }

    return {
      total,
      expectedBonus,
      portalBonusNum,
      isQualified: expectedBonus > 0,
      reasons,
      hasDiscrepancy,
      discrepancyNote
    };
  }
};

// Export for ES modules, CommonJS, and browser global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QCRules;
}
if (typeof window !== 'undefined') {
  window.QCRules = QCRules;
}
