/**
 * Storage Abstraction for Mojaru QC Reports
 * Works seamlessly with chrome.storage.local (extension) and localStorage (web fallback)
 */

const QCStorage = {
  STORAGE_KEY: 'mojaru_qc_records',
  SETTINGS_KEY: 'mojaru_qc_settings',

  /**
   * Check if running inside Chrome Extension with storage permissions
   */
  hasChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  },

  /**
   * Safe getter for seed data
   */
  getInitialSeed() {
    if (typeof SEED_QC_REPORTS !== 'undefined' && Array.isArray(SEED_QC_REPORTS)) {
      return [...SEED_QC_REPORTS];
    }
    if (typeof window !== 'undefined' && window.SEED_QC_REPORTS) {
      return [...window.SEED_QC_REPORTS];
    }
    if (typeof global !== 'undefined' && global.SEED_QC_REPORTS) {
      return [...global.SEED_QC_REPORTS];
    }
    if (typeof require !== 'undefined') {
      try {
        const seed = require('./seedData.js');
        if (Array.isArray(seed)) return [...seed];
      } catch (e) {}
    }
    return [];
  },

  /**
   * Get all records
   * @returns {Promise<Array<Object>>}
   */
  async getRecords() {
    if (this.hasChromeStorage()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([this.STORAGE_KEY], (res) => {
          const records = res[this.STORAGE_KEY];
          if (records && Array.isArray(records) && records.length > 0) {
            resolve(records);
          } else {
            // Seed if empty
            const initial = this.getInitialSeed();
            chrome.storage.local.set({ [this.STORAGE_KEY]: initial });
            resolve(initial);
          }
        });
      });
    }

    // LocalStorage Fallback
    if (typeof localStorage !== 'undefined') {
      try {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (data) {
          return JSON.parse(data);
        }
      } catch (e) {
        console.error('Failed reading localStorage:', e);
      }
    } else if (this._memoryStore) {
      return [...this._memoryStore];
    }

    const initial = this.getInitialSeed();
    await this.saveRecords(initial);
    return initial;
  },

  /**
   * Save array of records
   * @param {Array<Object>} records
   * @returns {Promise<void>}
   */
  async saveRecords(records) {
    if (this.hasChromeStorage()) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [this.STORAGE_KEY]: records }, resolve);
      });
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
      } catch (e) {
        console.error('Failed writing localStorage:', e);
      }
    } else {
      this._memoryStore = [...records];
    }
  },

  /**
   * Upsert a single record (Add or Update)
   * If updated, automatically flags `is_edited = true`, `edited_at = now`
   * If newly created, flags `is_manual = true`
   * @param {Object} recordData
   * @returns {Promise<Object>} saved record
   */
  async saveRecord(recordData) {
    const records = await this.getRecords();
    const now = new Date().toISOString();

    // Recalculate rules
    const onTime = Number(recordData.on_time) || 0;
    const cameraOn = Number(recordData.camera_on) || 0;
    const classTest = Number(recordData.class_test) || 0;
    const attendances = Number(recordData.attendances) || 0;
    const totalScore = onTime + cameraOn + classTest + attendances;

    const evalResult = (typeof QCRules !== 'undefined')
      ? QCRules.evaluateRow({
          on_time: onTime,
          camera_on: cameraOn,
          class_test: classTest,
          attendances: attendances,
          portal_bonus: recordData.portal_bonus
        })
      : {
          expectedBonus: (onTime === 1 && totalScore >= 3) ? totalScore * 40 : 0,
          hasDiscrepancy: false,
          discrepancyNote: ''
        };

    const finalRecord = {
      ...recordData,
      on_time: onTime,
      camera_on: cameraOn,
      class_test: classTest,
      attendances: attendances,
      total_score: totalScore,
      calculated_bonus: evalResult.expectedBonus,
      has_discrepancy: evalResult.hasDiscrepancy,
      discrepancy_note: evalResult.discrepancyNote
    };

    const existingIndex = records.findIndex(r => r.id === finalRecord.id);

    if (existingIndex >= 0) {
      // It's an EDIT operation!
      const original = records[existingIndex];
      finalRecord.is_edited = true;
      finalRecord.edited_at = now;
      // Preserve original values for comparison if not already saved
      if (!original.original_backup) {
        finalRecord.original_backup = { ...original };
        delete finalRecord.original_backup.original_backup;
      } else {
        finalRecord.original_backup = original.original_backup;
      }
      // Keep is_manual if it was already manual
      finalRecord.is_manual = original.is_manual || false;
      records[existingIndex] = finalRecord;
    } else {
      // It's a CREATE operation!
      if (!finalRecord.id) {
        finalRecord.id = 'manual_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      }
      finalRecord.is_manual = true;
      finalRecord.is_edited = true; // Newly created rows also get the warning highlight per requirement
      finalRecord.created_at = now;
      finalRecord.edited_at = now;
      records.unshift(finalRecord);
    }

    await this.saveRecords(records);
    return finalRecord;
  },

  /**
   * Delete a record by ID
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteRecord(id) {
    const records = await this.getRecords();
    const filtered = records.filter(r => r.id !== id);
    if (filtered.length !== records.length) {
      await this.saveRecords(filtered);
      return true;
    }
    return false;
  },

  /**
   * Restore an edited record to its original scraped state
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async restoreOriginal(id) {
    const records = await this.getRecords();
    const index = records.findIndex(r => r.id === id);
    if (index >= 0 && records[index].original_backup) {
      const restored = { ...records[index].original_backup, is_edited: false, edited_at: null };
      delete restored.original_backup;
      records[index] = restored;
      await this.saveRecords(records);
      return restored;
    }
    return null;
  },

  /**
   * Merge newly scraped records
   * Respects existing user edits so a resync won't wipe manual corrections!
   * @param {Array<Object>} newRecords
   * @returns {Promise<{added: number, updated: number, preservedEdits: number}>}
   */
  async mergeScrapedRecords(newRecords) {
    const current = await this.getRecords();
    const map = new Map();
    current.forEach(r => map.set(r.id, r));

    let added = 0;
    let updated = 0;
    let preservedEdits = 0;

    newRecords.forEach(scraped => {
      const existing = map.get(scraped.id);
      if (existing) {
        if (existing.is_edited || existing.is_manual) {
          // Keep user's edited version, but update the original_backup
          existing.original_backup = { ...scraped, is_edited: false };
          map.set(scraped.id, existing);
          preservedEdits++;
        } else {
          // Overwrite clean scraped record with fresh data
          map.set(scraped.id, { ...scraped, is_edited: false });
          updated++;
        }
      } else {
        map.set(scraped.id, scraped);
        added++;
      }
    });

    const merged = Array.from(map.values());
    // Sort by class_date desc
    merged.sort((a, b) => (b.class_date || '').localeCompare(a.class_date || '') || (b.row_num || 0) - (a.row_num || 0));
    await this.saveRecords(merged);

    return { added, updated, preservedEdits, total: merged.length };
  },

  /**
   * Reset all data back to initial seed data
   */
  async resetToSeed() {
    const initial = this.getInitialSeed();
    await this.saveRecords(initial);
    return initial;
  },

  /**
   * Clear all records
   */
  async clearAll() {
    await this.saveRecords([]);
    return [];
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QCStorage;
}
if (typeof window !== 'undefined') {
  window.QCStorage = QCStorage;
}
