// メモリ内のAWS設定を保持するクラス
class AwsCredentialsManager {
  static instance = null;
  #credentials = null;

  static getInstance() {
    if (!AwsCredentialsManager.instance) {
      AwsCredentialsManager.instance = new AwsCredentialsManager();
    }
    return AwsCredentialsManager.instance;
  }

  setCredentials(credentials) {
    this.#credentials = credentials;
  }

  getCredentials() {
    return this.#credentials;
  }

  clearCredentials() {
    this.#credentials = null;
  }
}

// グローバルに公開（他のスクリプトからアクセスできるように）
window.AwsCredentialsManager = AwsCredentialsManager;

// 設定の保存
document.getElementById('save').addEventListener('click', () => {
  const settings = {
    region: document.getElementById('region').value,
    accessKeyId: document.getElementById('accessKeyId').value,
    secretAccessKey: document.getElementById('secretAccessKey').value
  };

  // メモリ内に保存
  AwsCredentialsManager.getInstance().setCredentials(settings);

  const status = document.getElementById('status');
  status.textContent = '設定が保存されました';
  status.style.color = '#4CAF50';

  // フォームをクリア
  document.getElementById('accessKeyId').value = '';
  document.getElementById('secretAccessKey').value = '';
});

// ページを閉じる際に認証情報をクリア
window.addEventListener('unload', () => {
  AwsCredentialsManager.getInstance().clearCredentials();
});

// 保存された設定を読み込む
chrome.storage.sync.get('awsSettings', (data) => {
  if (data.awsSettings) {
    document.getElementById('region').value = data.awsSettings.region;
    document.getElementById('accessKeyId').value = data.awsSettings.accessKeyId;
    document.getElementById('secretAccessKey').value = data.awsSettings.secretAccessKey;
  }
}); 