// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('拡張機能がインストールされました');
});

// Handle camera permission request
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'requestCamera') {
    chrome.permissions.request({
      permissions: ['camera']
    }, (granted) => {
      if (granted) {
        console.log('カメラの使用が許可されました');
      } else {
        console.log('カメラの使用が拒否されました');
      }
      sendResponse({ granted });
    });
    return true; // Keep message channel open for async response
  }
});
