// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Handle camera permission request
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'requestCamera') {
    chrome.permissions.request({
      permissions: ['camera']
    }, (granted) => {
      sendResponse({ granted });
    });
    return true; // Keep message channel open for async response
  }
});
