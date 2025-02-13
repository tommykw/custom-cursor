/*!
 * WebGazer.js Simulator with Data Display
 */

class WebGazer {
  constructor() {
    this.isTracking = false;
    this.gazeListener = null;
    this.videoElement = null;
    this.stream = null;
    this.dataDisplay = this.createDataDisplay();
    this.lastGaze = null;
  }

  createDataDisplay() {
    const display = document.createElement('div');
    display.id = 'gaze-data-display';
    Object.assign(display.style, {
      position: 'fixed',
      top: '10px',
      right: '10px',
      padding: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: '2147483647',
      display: 'none'
    });
    document.body.appendChild(display);
    return display;
  }

  async begin() {
    try {
      // カメラアクセスの前にユーザーに説明
      console.log('視線追跡のためにカメラを使用します');
      
      // カメラアクセスをより安全に要求
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false  // 明示的にオーディオを無効化
      });

      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.style.display = 'none';
      document.body.appendChild(this.videoElement);
      await this.videoElement.play();

      // 視線追跡のシミュレーションを開始
      this.startTracking();
      return this;
    } catch (error) {
      console.error('カメラアクセスエラー:', error);
      if (error.name === 'NotAllowedError') {
        throw new Error('カメラの使用が許可されませんでした。視線追跡には必要です。');
      }
      throw error;
    }
  }

  setGazeListener(callback) {
    this.gazeListener = callback;
    return this;
  }

  setRegression(type) {
    return this;
  }

  setTracker(type) {
    return this;
  }

  startTracking() {
    this.isTracking = true;
    this.dataDisplay.style.display = 'block';
    this.track();
  }

  stopTracking() {
    this.isTracking = false;
    this.dataDisplay.style.display = 'none';
    
    // イベントリスナーのクリーンアップ
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }
    
    // インターバルのクリーンアップ
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // カメラストリームのクリーンアップ
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      this.stream = null;
    }
    
    // ビデオ要素のクリーンアップ
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement.remove();
      this.videoElement = null;
    }
  }

  updateDataDisplay(gazeData) {
    const fps = Math.round(1000 / (Date.now() - (this.lastUpdate || Date.now())));
    this.lastUpdate = Date.now();

    this.dataDisplay.innerHTML = `
      <div>視線データ:</div>
      <div>X: ${Math.round(gazeData.x)}px</div>
      <div>Y: ${Math.round(gazeData.y)}px</div>
      <div>信頼度: ${(gazeData.confidence * 100).toFixed(1)}%</div>
      <div>FPS: ${fps}</div>
      <div>移動距離: ${this.lastGaze ? Math.round(this.calculateDistance(this.lastGaze, gazeData)) : 0}px</div>
    `;

    // 視線データをリスナーに送信
    if (this.gazeListener) {
      this.gazeListener(gazeData, Date.now());
    }
  }

  calculateDistance(point1, point2) {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2)
    );
  }

  track() {
    if (!this.isTracking) return;

    // 既存のイベントリスナーを削除
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler);
    }

    // 新しいイベントハンドラを作成
    this.mouseMoveHandler = (e) => {
      if (this.isTracking) {
        // マウス位置に少しランダムな揺らぎを加えて視線っぽく
        const noise = 20;
        const gazeData = {
          x: e.clientX + (Math.random() - 0.5) * noise,
          y: e.clientY + (Math.random() - 0.5) * noise,
          confidence: 0.5 + Math.random() * 0.5
        };

        this.lastGaze = gazeData;
        this.updateDataDisplay(gazeData);
      }
    };

    // 定期的にデータを更新（マウスが動いていなくても）
    this.updateInterval = setInterval(() => {
      if (this.lastGaze && this.isTracking) {
        const gazeData = {
          x: this.lastGaze.x + (Math.random() - 0.5) * 5,
          y: this.lastGaze.y + (Math.random() - 0.5) * 5,
          confidence: 0.5 + Math.random() * 0.5
        };
        this.updateDataDisplay(gazeData);
      }
    }, 100);

    // イベントリスナーを登録
    document.addEventListener('mousemove', this.mouseMoveHandler);
  }
}

// グローバルオブジェクトとして公開
window.webgazer = new WebGazer();

// WebGazerの初期化を行う関数をエクスポート
window.initWebGazer = async function() {
  try {
    return window.webgazer;
  } catch (error) {
    console.error('WebGazer初期化エラー:', error);
    throw error;
  }
};

console.log('webgazer.js loaded and ready'); 