// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('拡張機能がインストールされました');
});

// Handle camera permission request
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'requestCamera') {
    // Use navigator.mediaDevices.getUserMedia directly
    navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user"
      },
      audio: false
    })
    .then(() => {
      console.log('カメラの使用が許可されました');
      sendResponse({ granted: true });
    })
    .catch((error) => {
      console.error('カメラの初期化エラー:', error);
      let errorMessage = 'カメラの使用が拒否されました';
      if (error.name === 'NotFoundError') {
        errorMessage = 'カメラが見つかりませんでした';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'カメラにアクセスできません。他のアプリケーションがカメラを使用している可能性があります';
      }
      sendResponse({ granted: false, error: errorMessage });
    });
    return true; // Keep message channel open for async response
  }
});
