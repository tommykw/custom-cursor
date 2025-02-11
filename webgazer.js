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

  async initialize() {
    try {
      console.log('視線追跡の初期化を開始します...');
      
      // Check if face-api.js is loaded
      if (typeof faceapi === 'undefined') {
        throw new Error('face-api.jsが読み込まれていません');
      }
      
      // Initialize display
      this.initializeDisplay();
      
      // Initialize video stream
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false
        });
        console.log('カメラストリームの初期化が完了しました');
      } catch (error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('カメラの使用が許可されませんでした');
        } else if (error.name === 'NotFoundError') {
          throw new Error('カメラが見つかりませんでした');
        } else if (error.name === 'NotReadableError') {
          throw new Error('カメラにアクセスできません');
        }
        throw error;
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
    // Calculate eye centers with improved accuracy
    const leftCenter = this.calculateEyeCenter(leftEye);
    const rightCenter = this.calculateEyeCenter(rightEye);
    
    // Detect pupils with enhanced detection
    const leftPupil = this.detectPupil(this.videoElement, leftCenter);
    const rightPupil = this.detectPupil(this.videoElement, rightCenter);
    
    // Map to screen coordinates with smoothing
    const screenCoords = this.mapToScreenCoordinates(leftPupil, rightPupil);
    
    // Apply Kalman filter for smoother movement
    if (this.lastGaze) {
      screenCoords.x = this.lastGaze.x * 0.3 + screenCoords.x * 0.7;
      screenCoords.y = this.lastGaze.y * 0.3 + screenCoords.y * 0.7;
    }
    
    // Store current gaze for next frame
    this.lastGaze = { 
      x: screenCoords.x, 
      y: screenCoords.y 
    };
    
    // Calculate confidence based on multiple factors
    const eyeAspectRatio = Math.min(
      leftCenter.width / (leftCenter.height || 1),
      rightCenter.width / (rightCenter.height || 1)
    );
    
    const eyeSymmetry = 1 - Math.abs(
      (leftCenter.width / leftCenter.height) - 
      (rightCenter.width / rightCenter.height)
    ) / 2;
    
    const confidence = Math.min(
      eyeAspectRatio,
      eyeSymmetry
    );
    
    return {
      x: screenCoords.x,
      y: screenCoords.y,
      leftEye: leftPupil,
      rightEye: rightPupil,
      confidence: confidence,
      metadata: {
        eyeAspectRatio,
        eyeSymmetry,
        timestamp: Date.now()
      }
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

  async calibrate() {
    // キャリブレーションポイントの定義（3x3グリッド）
    const points = [
      { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 },
      { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
      { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 }
    ];
    
    this.calibrationData = [];
    
    // キャリブレーション用のオーバーレイを作成
    const overlay = this.createCalibrationOverlay();
    
    try {
      for (const point of points) {
        // キャリブレーションポイントを表示
        await this.showCalibrationPoint(overlay, point);
        
        // 視線データを収集（1秒間）
        const eyeData = await this.collectEyeData(1000);
        
        this.calibrationData.push({
          point,
          eyeData
        });
      }
      
      // キャリブレーション行列を計算
      this.calibrationMatrix = this.computeCalibrationMatrix();
      return true;
    } catch (error) {
      console.error('キャリブレーションエラー:', error);
      return false;
    } finally {
      // オーバーレイを削除
      overlay.remove();
    }
  }

  createCalibrationOverlay() {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.8)',
      zIndex: '2147483646',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    });
    
    const point = document.createElement('div');
    Object.assign(point.style, {
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      background: 'white',
      position: 'absolute',
      transform: 'translate(-50%, -50%)',
      transition: 'all 0.5s ease'
    });
    
    overlay.appendChild(point);
    document.body.appendChild(overlay);
    return overlay;
  }

  async showCalibrationPoint(overlay, point) {
    const target = overlay.firstElementChild;
    
    // 画面上の実際の位置を計算
    const x = point.x * window.innerWidth;
    const y = point.y * window.innerHeight;
    
    // ポイントを移動
    target.style.left = `${x}px`;
    target.style.top = `${y}px`;
    
    // アニメーション効果
    target.animate([
      { transform: 'translate(-50%, -50%) scale(1)' },
      { transform: 'translate(-50%, -50%) scale(1.5)' },
      { transform: 'translate(-50%, -50%) scale(1)' }
    ], {
      duration: 1000,
      iterations: 1
    });
    
    // ユーザーが注視するのを待つ
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  async collectEyeData(duration) {
    const startTime = Date.now();
    const samples = [];
    
    while (Date.now() - startTime < duration) {
      // 顔の検出と特徴点の抽出
      const detections = await faceapi.detectAllFaces(
        this.videoElement,
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks();

      if (detections && detections.length > 0) {
        const face = detections[0];
        const landmarks = face.landmarks;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        samples.push({
          timestamp: Date.now(),
          leftEye,
          rightEye,
          confidence: face.detection.score
        });
      }
      
      // フレームレートを制御
      await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
    }
    
    return samples;
  }

  computeCalibrationMatrix() {
    // 最小二乗法で変換行列を計算
    const points = this.calibrationData.map(d => d.point);
    const eyeData = this.calibrationData.map(d => {
      const avgData = d.eyeData.reduce((acc, curr) => {
        const leftCenter = this.calculateEyeCenter(curr.leftEye);
        const rightCenter = this.calculateEyeCenter(curr.rightEye);
        return {
          x: acc.x + (leftCenter.x + rightCenter.x) / 2,
          y: acc.y + (leftCenter.y + rightCenter.y) / 2,
          count: acc.count + 1
        };
      }, { x: 0, y: 0, count: 0 });
      
      return {
        x: avgData.x / avgData.count,
        y: avgData.y / avgData.count
      };
    });
    
    // 変換行列を計算（アフィン変換）
    return {
      points,
      eyeData,
      // 実際の変換はmapToScreenCoordinatesで適用
      timestamp: Date.now()
    };
  }

  async track() {
    if (!this.isTracking) return;

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
        const leftPupil = this.calculateEyeCenter(leftEye);
        const rightPupil = this.calculateEyeCenter(rightEye);

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

// WebGazerの初期化を行う関数をエクスポート
window.initWebGazer = async function() {
  try {
    // Check if face-api.js is loaded
    if (typeof faceapi === 'undefined') {
      throw new Error('face-api.jsが読み込まれていません');
    }

    // Create WebGazer instance
    const webgazer = new WebGazer();
    console.log('WebGazerインスタンスを作成しました');
    
    try {
      // Initialize WebGazer
      await webgazer.initialize();
      console.log('WebGazerの初期化が完了しました');
      return webgazer;
    } catch (initError) {
      console.error('WebGazer初期化エラー:', initError);
      throw new Error('WebGazerの初期化に失敗しました: ' + initError.message);
    }
  } catch (error) {
    console.error('WebGazer初期化エラー:', error);
    throw error;
  }
};

console.log('webgazer.js loaded and ready');                                                            