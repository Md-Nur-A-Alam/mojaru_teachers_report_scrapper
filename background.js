/**
 * Background Service Worker for Mojaru QC Extension
 */

// Badge helper
function updateBadge(count) {
  if (chrome.action && chrome.action.setBadgeText) {
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#00BFA5' });
  }
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Mojaru QC Report Scraper & Analytics extension installed.');
  // Check existing records and set badge
  chrome.storage.local.get(['mojaru_qc_records'], (res) => {
    const records = res.mojaru_qc_records || [];
    updateBadge(records.length);
  });
});

// Listen for storage changes to keep badge synced
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.mojaru_qc_records) {
    const records = changes.mojaru_qc_records.newValue || [];
    updateBadge(records.length);
  }
});

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_DASHBOARD') {
    const dashboardUrl = chrome.runtime.getURL('dashboard.html');
    // Check if dashboard is already open in any tab
    chrome.tabs.query({ url: dashboardUrl }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        chrome.tabs.create({ url: dashboardUrl });
      }
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'UPDATE_BADGE') {
    updateBadge(message.count || 0);
    sendResponse({ success: true });
    return true;
  }
});
