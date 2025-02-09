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
      console.log('視線追跡の初期化を開始します...');
      
      // face-api.jsのモデルを読み込む
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models')
        ]);
        console.log('顔認識モデルの読み込みが完了しました');
      } catch (modelError) {
        throw new Error('顔認識モデルの読み込みに失敗しました: ' + modelError.message);
      }
      
      // カメラアクセスの前にユーザーに説明
      console.log('視線追跡のためにカメラを使用します');
      
      // カメラアクセスをより安全に要求
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
          },
          audio: false  // 明示的にオーディオを無効化
        });
      } catch (cameraError) {
        if (cameraError.name === 'NotAllowedError') {
          throw new Error('カメラの使用が許可されませんでした。視線追跡には必要です。');
        } else if (cameraError.name === 'NotFoundError') {
          throw new Error('カメラが見つかりませんでした。カメラが接続されているか確認してください。');
        } else if (cameraError.name === 'NotReadableError') {
          throw new Error('カメラにアクセスできません。他のアプリケーションがカメラを使用している可能性があります。');
        }
        throw new Error('カメラの初期化に失敗しました: ' + cameraError.message);
      }

      // ビデオ要素の初期化と設定
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.style.display = 'none';
      this.videoElement.style.position = 'fixed';
      this.videoElement.style.top = '0';
      this.videoElement.style.left = '0';
      this.videoElement.style.zIndex = '-1';
      document.body.appendChild(this.videoElement);
      
      try {
        await this.videoElement.play();
        console.log('カメラの初期化が完了しました');
      } catch (playError) {
        throw new Error('ビデオストリームの開始に失敗しました: ' + playError.message);
      }

      // 視線追跡を開始
      this.startTracking();
      return this;
    } catch (error) {
      console.error('視線追跡の初期化エラー:', error);
      // エラーを上位に伝播させる前にリソースをクリーンアップ
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
      if (this.videoElement) {
        this.videoElement.remove();
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

  calculateEyeCenter(eyePoints) {
    // 目の領域の中心を計算
    const centerX = eyePoints.reduce((sum, p) => sum + p.x, 0) / eyePoints.length;
    const centerY = eyePoints.reduce((sum, p) => sum + p.y, 0) / eyePoints.length;
    
    // 目の大きさを計算
    const width = Math.max(...eyePoints.map(p => p.x)) - Math.min(...eyePoints.map(p => p.x));
    const height = Math.max(...eyePoints.map(p => p.y)) - Math.min(...eyePoints.map(p => p.y));
    
    return { x: centerX, y: centerY, width, height };
  }

  detectPupil(video, eyeCenter) {
    // 目の領域を抽出して瞳の位置を検出
    const ctx = this.getVideoContext();
    const { x, y, width, height } = eyeCenter;
    
    // 目の領域を少し広めに取る
    const margin = Math.max(width, height) * 0.2;
    const region = {
      x: Math.max(0, x - width/2 - margin),
      y: Math.max(0, y - height/2 - margin),
      width: width + margin * 2,
      height: height + margin * 2
    };
    
    // 瞳の位置を推定（目の中心から少しずれた位置）
    const pupilX = x + (width * 0.1); // 目の中心から少し内側
    const pupilY = y + (height * 0.1); // 目の中心から少し下
    
    return { x: pupilX, y: pupilY, region };
  }

  mapToScreenCoordinates(pupilLeft, pupilRight) {
    // ビデオ座標から画面座標への変換
    const videoRect = this.videoElement.getBoundingClientRect();
    const scaleX = window.innerWidth / videoRect.width;
    const scaleY = window.innerHeight / videoRect.height;
    
    // 両目の中心点を計算
    const centerX = (pupilLeft.x + pupilRight.x) / 2;
    const centerY = (pupilLeft.y + pupilRight.y) / 2;
    
    // 視線の方向を考慮した補正
    const gazeVector = {
      x: pupilRight.x - pupilLeft.x,
      y: pupilRight.y - pupilLeft.y
    };
    
    // 視線方向に基づいて画面上の位置を補正
    const screenX = (centerX + gazeVector.x * 0.5) * scaleX;
    const screenY = (centerY + gazeVector.y * 0.5) * scaleY;
    
    return { x: screenX, y: screenY };
  }

  estimateGazePoint(leftEye, rightEye) {
    // 両目の中心を計算
    const leftCenter = this.calculateEyeCenter(leftEye);
    const rightCenter = this.calculateEyeCenter(rightEye);
    
    // 瞳の位置を検出
    const leftPupil = this.detectPupil(this.videoElement, leftCenter);
    const rightPupil = this.detectPupil(this.videoElement, rightCenter);
    
    // 画面座標に変換
    const screenCoords = this.mapToScreenCoordinates(leftPupil, rightPupil);
    
    return {
      x: screenCoords.x,
      y: screenCoords.y,
      leftEye: leftPupil,
      rightEye: rightPupil,
      confidence: Math.min(
        leftCenter.width / (leftCenter.height || 1),  // アスペクト比が正常か
        rightCenter.width / (rightCenter.height || 1)
      )
    };
  }

  getVideoContext() {
    if (!this._videoContext) {
      const canvas = document.createElement('canvas');
      canvas.width = this.videoElement.videoWidth;
      canvas.height = this.videoElement.videoHeight;
      this._videoContext = canvas.getContext('2d');
    }
    return this._videoContext;
  }

  async track() {
    if (!this.isTracking) return;

    // Face-APIの読み込み
    await this.loadFaceAPI();
    
    // ビデオフレームの処理
    const processFrame = async () => {
      if (!this.isTracking || !this.videoElement) return;

      // 顔の検出
      const detections = await faceapi.detectAllFaces(this.videoElement, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks();

      if (detections && detections.length > 0) {
        const face = detections[0]; // 最も大きな顔を使用
        const landmarks = face.landmarks;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        // 瞳の中心を計算
        const leftPupil = this.calculatePupilCenter(leftEye);
        const rightPupil = this.calculatePupilCenter(rightEye);

        // 画面上の視線位置を推定
        const gazeData = this.estimateGazePoint(leftPupil, rightPupil);
        
        // 信頼度の計算（顔の検出スコアを使用）
        gazeData.confidence = face.detection.score;

        this.lastGaze = gazeData;
        this.updateDataDisplay(gazeData);
      }

      // 次のフレームを処理
      if (this.isTracking) {
        requestAnimationFrame(processFrame);
      }
    };

    // フレーム処理開始
    processFrame();
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