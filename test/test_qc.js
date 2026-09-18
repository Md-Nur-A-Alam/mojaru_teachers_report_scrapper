/**
 * Automated Verification Test Suite for Mojaru QC Scraper & Rules Engine
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Load Modules
const QCRules = require('../js/rules.js');
const SEED_QC_REPORTS = require('../js/seedData.js');
const QCStorage = require('../js/storage.js');

console.log('----------------------------------------------------');
console.log('🧪 Starting Mojaru QC Test Suite');
console.log('----------------------------------------------------');

// Test 1: Business Logic & Rules
console.log('\n[Test 1] Testing Business Logic & Bonus Calculation Rules...');

// Rule 1: Late arrival (on_time = 0) -> 0 Tk bonus even with high points
const lateRow = { on_time: 0, camera_on: 1, class_test: 1, attendances: 2 };
const lateEval = QCRules.evaluateRow(lateRow);
assert.strictEqual(lateEval.total, 4, 'Total should be 4');
assert.strictEqual(lateEval.expectedBonus, 0, 'Late arrival must yield 0 Tk bonus');
assert.strictEqual(lateEval.isQualified, false, 'Late arrival should not qualify');
console.log('  ✔ Rule 1 Passed: On-time = 0 disqualifies bonus (yields 0 Tk).');

// Rule 2: Total points < 3 -> 0 Tk bonus even if on time
const lowPointRow = { on_time: 1, camera_on: 1, class_test: 0, attendances: 0 };
const lowEval = QCRules.evaluateRow(lowPointRow);
assert.strictEqual(lowEval.total, 2, 'Total should be 2');
assert.strictEqual(lowEval.expectedBonus, 0, 'Total < 3 must yield 0 Tk bonus');
console.log('  ✔ Rule 2 Passed: Total score < 3 disqualifies bonus (yields 0 Tk).');

// Rule 3: Qualified cases (on_time = 1 and total >= 3)
const qualifiedRow3 = { on_time: 1, camera_on: 1, class_test: 1, attendances: 0 }; // total 3
assert.strictEqual(QCRules.calculateBonus(qualifiedRow3), 120, '3 pts * 40 = 120 Tk');

const qualifiedRow4 = { on_time: 1, camera_on: 1, class_test: 0, attendances: 2 }; // total 4
assert.strictEqual(QCRules.calculateBonus(qualifiedRow4), 160, '4 pts * 40 = 160 Tk');

const qualifiedRow5 = { on_time: 1, camera_on: 1, class_test: 1, attendances: 2 }; // total 5
assert.strictEqual(QCRules.calculateBonus(qualifiedRow5), 200, '5 pts * 40 = 200 Tk');
console.log('  ✔ Rule 3 Passed: 40 Tk per point calculated correctly (120 Tk, 160 Tk, 200 Tk).');

// Rule 4: Discrepancy detection
const discRow = { on_time: 0, camera_on: 1, class_test: 1, attendances: 2, portal_bonus: '160 tk' };
const discEval = QCRules.evaluateRow(discRow);
assert.strictEqual(discEval.hasDiscrepancy, true, 'Discrepancy should be detected');
assert.ok(discEval.discrepancyNote.includes('Portal granted 160'), 'Note should describe anomaly');
console.log('  ✔ Rule 4 Passed: Discrepancy detected when portal granted bonus despite late arrival.');

// Test 2: Seed Data Integrity
console.log('\n[Test 2] Testing Seed Data...');
assert.strictEqual(SEED_QC_REPORTS.length, 22, 'Should contain 22 seed classes from prompt');
console.log(`  ✔ Seed data has exactly ${SEED_QC_REPORTS.length} classes from September 2026.`);

// Test 3: Storage CRUD & Warning Flags
console.log('\n[Test 3] Testing Storage CRUD & Warning Flags...');
(async () => {
  // Reset
  await QCStorage.resetToSeed();
  let records = await QCStorage.getRecords();
  assert.strictEqual(records.length, 22, 'Initial records count should be 22');

  // Edit record #1
  const rec1 = records[0];
  const updatedRec = await QCStorage.saveRecord({
    ...rec1,
    on_time: 1, // Change late to on-time
    notes: 'Teacher appealed and approved on-time'
  });

  assert.strictEqual(updatedRec.is_edited, true, 'is_edited must be true');
  assert.ok(updatedRec.edited_at, 'edited_at timestamp must exist');
  assert.ok(updatedRec.original_backup, 'original_backup must be stored');
  assert.strictEqual(updatedRec.calculated_bonus, 200, 'New bonus should be 200 Tk (5 pts * 40)');

  records = await QCStorage.getRecords();
  assert.strictEqual(records[0].is_edited, true, 'Saved record in list must have is_edited = true');
  console.log('  ✔ Edit operation sets is_edited = true, stores backup, and updates calculated bonus.');

  // Create manual record
  const newManual = await QCStorage.saveRecord({
    month: '2026-09',
    batch_code: 'MOPP 99',
    course_name: 'ম্যাথ অলিম্পিয়াড (প্রাইমারি)',
    subject_name: 'Math Olympiad Advanced',
    class_time_raw: '18 Sep, 2026 06:45 PM - 08:00 PM',
    on_time: 1,
    camera_on: 1,
    class_test: 1,
    attendances: 2
  });

  assert.strictEqual(newManual.is_manual, true, 'is_manual must be true');
  assert.strictEqual(newManual.is_edited, true, 'is_edited must be true for warning styling');
  assert.strictEqual(newManual.calculated_bonus, 200, 'Bonus should be 200 Tk');

  records = await QCStorage.getRecords();
  assert.strictEqual(records.length, 23, 'Records count should be 23');
  console.log('  ✔ Create operation sets is_manual = true and is_edited = true for warning color.');

  // Revert / Restore record #1
  const restored = await QCStorage.restoreOriginal(rec1.id);
  assert.strictEqual(restored.is_edited, false, 'Restored record should have is_edited = false');
  assert.strictEqual(restored.on_time, 0, 'Restored record should have original on_time = 0');
  console.log('  ✔ Revert operation clears warning state and restores original scraped values.');

  // Delete manual record
  await QCStorage.deleteRecord(newManual.id);
  records = await QCStorage.getRecords();
  assert.strictEqual(records.length, 22, 'Records count should be back to 22');
  console.log('  ✔ Delete operation removes the record successfully.');

  // Test 4: Manifest & Extension Files
  console.log('\n[Test 4] Checking Manifest & Extension Package...');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
  assert.strictEqual(manifest.manifest_version, 3, 'Manifest must be version 3');
  assert.ok(manifest.permissions.includes('storage'), 'Must have storage permission');
  assert.ok(fs.existsSync(path.join(__dirname, '../icons/icon16.png')), 'icon16.png must exist');
  assert.ok(fs.existsSync(path.join(__dirname, '../icons/icon48.png')), 'icon48.png must exist');
  assert.ok(fs.existsSync(path.join(__dirname, '../icons/icon128.png')), 'icon128.png must exist');
  assert.ok(fs.existsSync(path.join(__dirname, '../dashboard.html')), 'dashboard.html must exist');
  assert.ok(fs.existsSync(path.join(__dirname, '../popup.html')), 'popup.html must exist');
  assert.ok(fs.existsSync(path.join(__dirname, '../content.js')), 'content.js must exist');
  assert.ok(fs.existsSync(path.join(__dirname, '../background.js')), 'background.js must exist');
  console.log('  ✔ Manifest V3 and all required Chrome Extension assets verified.');

  console.log('\n====================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY (100%)');
  console.log('====================================================\n');
})();
