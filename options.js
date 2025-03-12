document.getElementById('save').addEventListener('click', () => {
  const settings = {
    region: document.getElementById('region').value,
    accessKeyId: document.getElementById('accessKeyId').value,
    secretAccessKey: document.getElementById('secretAccessKey').value
  };

  chrome.storage.sync.set({ awsSettings: settings }, () => {
    alert('Settings saved!');
  });
});

// 保存された設定を読み込む
chrome.storage.sync.get('awsSettings', (data) => {
  if (data.awsSettings) {
    document.getElementById('region').value = data.awsSettings.region;
    document.getElementById('accessKeyId').value = data.awsSettings.accessKeyId;
    document.getElementById('secretAccessKey').value = data.awsSettings.secretAccessKey;
  }
}); 