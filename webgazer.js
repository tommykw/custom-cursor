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
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.eyeTrackingData = [];  // 目の追跡データを保存
    this.isAnalyzing = false;
    
    // AWS認証情報の設定を環境変数から取得
    this.awsConfig = null;
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
      this.videoElement.style.position = 'fixed';
      this.videoElement.style.top = '10px';
      this.videoElement.style.right = '10px';
      this.videoElement.style.width = '160px';
      this.videoElement.style.height = '120px';
      this.videoElement.style.zIndex = '2147483646';
      document.body.appendChild(this.videoElement);
      await this.videoElement.play();

      // MediaRecorderの初期化
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'video/webm'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.downloadRecording();
      };

      // 録画を開始
      this.startRecording();
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

  startRecording() {
    this.recordedChunks = [];
    this.isRecording = true;
    this.mediaRecorder.start();
    console.log('録画開始');
  }

  stopRecording() {
    if (this.isRecording) {
      this.isRecording = false;
      this.mediaRecorder.stop();
      console.log('録画停止');
    }
  }

  downloadRecording() {
    const blob = new Blob(this.recordedChunks, {
      type: 'video/webm'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `eye-tracking-${new Date().toISOString()}.webm`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  }

  stopTracking() {
    this.stopRecording();
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

  async analyzeVideo(videoBlob, progressCallback) {
    this.isAnalyzing = true;
    this.eyeTrackingData = [];
    
    try {
      console.log('動画解析開始');
      const videoURL = URL.createObjectURL(videoBlob);
      const analysisVideo = document.createElement('video');
      
      // 動画の読み込みを確実に待つ
      await new Promise((resolve, reject) => {
        analysisVideo.onloadeddata = resolve;
        analysisVideo.onerror = reject;
        analysisVideo.src = videoURL;
      });

      console.log('動画読み込み完了');
      console.log(`動画の長さ: ${analysisVideo.duration}秒`);
      
      // キャンバスの準備
      const canvas = document.createElement('canvas');
      canvas.width = analysisVideo.videoWidth;
      canvas.height = analysisVideo.videoHeight;
      const ctx = canvas.getContext('2d');
      
      // フレーム間隔の設定
      const frameInterval = 1000 / 30; // 30fps
      const totalFrames = Math.floor(analysisVideo.duration * 30); // 総フレーム数
      let processedFrames = 0;

      // フレームごとの処理
      for (let frameIndex = 0; frameIndex < totalFrames && this.isAnalyzing; frameIndex++) {
        const currentTime = frameIndex / 30;
        
        // 現在の時間に設定
        analysisVideo.currentTime = currentTime;
        
        // フレームの描画完了を待つ
        await new Promise(resolve => {
          analysisVideo.onseeked = () => {
            // フレームをキャンバスに描画
            ctx.drawImage(analysisVideo, 0, 0);
            resolve();
          };
        });

        // 目の位置を検出
        const eyePosition = await this.detectEyePosition(canvas);
        if (eyePosition) {
          this.eyeTrackingData.push({
            timestamp: currentTime * 1000,
            ...eyePosition
          });
        }

        // 進捗を更新
        processedFrames++;
        const progress = (processedFrames / totalFrames) * 100;
        console.log(`解析進捗: ${Math.round(progress)}%`);
        if (progressCallback) {
          progressCallback(progress);
        }

        // 少し待機して CPU 負荷を軽減
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      console.log('動画解析完了');
      
      // クリーンアップ
      URL.revokeObjectURL(videoURL);
      analysisVideo.remove();
      
      // 解析データをダウンロード
      this.downloadTrackingData();
      
    } catch (error) {
      console.error('動画解析エラー:', error);
      throw error;
    } finally {
      this.isAnalyzing = false;
    }
  }

  async detectEyePosition(canvas) {
    try {
      // Canvas から画像データを取得
      const imageData = canvas.getContext('2d').getImageData(
        0, 0, canvas.width, canvas.height
      ).data;
      
      // 目の領域を検出
      const eyeRegions = this.detectEyeRegions(canvas.width, canvas.height, imageData);
      
      // 瞳の位置を検出
      const leftPupil = this.detectPupil(imageData, eyeRegions.left, canvas.width);
      const rightPupil = this.detectPupil(imageData, eyeRegions.right, canvas.width);
      
      // 画面上の視線位置を計算
      const screenPosition = this.calculateScreenPosition(leftPupil, rightPupil, canvas.width, canvas.height);
      
      return {
        leftEye: leftPupil,
        rightEye: rightPupil,
        screenX: screenPosition.x,
        screenY: screenPosition.y,
        confidence: screenPosition.confidence
      };
    } catch (error) {
      console.error('目の位置検出エラー:', error);
      return null;
    }
  }

  downloadTrackingData() {
    const jsonData = JSON.stringify(this.eyeTrackingData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `eye-tracking-data-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  }

  stopAnalysis() {
    this.isAnalyzing = false;
  }

  // 目の領域を検出する関数
  detectEyeRegions(width, height, imageData) {
    // 顔の上部1/3を目の探索領域とする
    const eyeRegionHeight = Math.floor(height / 3);
    
    return {
      left: {
        x: 0,
        y: 0,
        width: Math.floor(width / 2),
        height: eyeRegionHeight,
        data: imageData
      },
      right: {
        x: Math.floor(width / 2),
        y: 0,
        width: Math.floor(width / 2),
        height: eyeRegionHeight,
        data: imageData
      }
    };
  }

  // 瞳の位置を検出する関数
  detectPupil(imageData, region, frameWidth) {
    try {
      let darkestPoint = { x: region.x, y: region.y, value: 255 };
      
      // 領域内で最も暗い点を探す（瞳の候補）
      for (let y = region.y; y < region.y + region.height; y++) {
        for (let x = region.x; x < region.x + region.width; x++) {
          const i = (y * frameWidth + x) * 4;
          const brightness = (
            imageData[i] +     // R
            imageData[i + 1] + // G
            imageData[i + 2]   // B
          ) / 3;
          
          if (brightness < darkestPoint.value) {
            darkestPoint = { x, y, value: brightness };
          }
        }
      }
      
      return darkestPoint;
    } catch (error) {
      console.error('瞳検出エラー:', error);
      return null;
    }
  }

  // 画面上の視線位置を計算する関数
  calculateScreenPosition(leftPupil, rightPupil, frameWidth, frameHeight) {
    if (!leftPupil || !rightPupil) {
      return {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        confidence: 0.1
      };
    }

    // 両目の中心点を計算
    const centerX = (leftPupil.x + rightPupil.x) / 2;
    const centerY = (leftPupil.y + rightPupil.y) / 2;
    
    // フレームの中心からの相対位置を計算
    const relativeX = (centerX - frameWidth / 2) / (frameWidth / 2);
    const relativeY = (centerY - frameHeight / 2) / (frameHeight / 2);
    
    // 画面上の位置に変換
    const screenX = window.innerWidth * (0.5 + relativeX * 0.5);
    const screenY = window.innerHeight * (0.5 - relativeY * 0.5); // Y軸は反転
    
    // 信頼度を計算（両目の距離などから）
    const eyeDistance = Math.sqrt(
      Math.pow(rightPupil.x - leftPupil.x, 2) +
      Math.pow(rightPupil.y - leftPupil.y, 2)
    );
    const confidence = Math.min(
      1.0,
      eyeDistance / (frameWidth * 0.2) // 目の距離が画面幅の20%程度を想定
    );

    return {
      x: Math.max(0, Math.min(screenX, window.innerWidth)),
      y: Math.max(0, Math.min(screenY, window.innerHeight)),
      confidence: confidence
    };
  }

  async initAWSConfig() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get('awsSettings', (data) => {
        if (data.awsSettings) {
          this.awsConfig = {
            region: data.awsSettings.region,
            credentials: {
              accessKeyId: data.awsSettings.accessKeyId,
              secretAccessKey: data.awsSettings.secretAccessKey
            }
          };
          resolve();
        } else {
          reject(new Error('AWS設定が見つかりません。拡張機能の設定から AWS 認証情報を設定してください。'));
        }
      });
    });
  }

  async analyzeVideoWithRekognition(videoBlob, progressCallback) {
    try {
      await this.initAWSConfig();
      
      console.log('Rekognitionによる動画解析開始');
      
      // 動画をフレームに分割（最初の3秒間のみ）
      const maxDuration = 3; // 解析する秒数
      const fps = 5; // 1秒あたりのフレーム数を減らす
      const frames = await this.extractFramesFromVideo(videoBlob, maxDuration, fps);
      const totalFrames = frames.length;
      
      console.log(`解析フレーム数: ${totalFrames} (${maxDuration}秒間, ${fps}fps)`);
      let processedFrames = 0;
      
      const analysisResults = [];
      for (const frame of frames) {
        const base64Frame = await this.canvasToBase64(frame);
        const faceAnalysis = await this.analyzeFaceWithRekognition(base64Frame);
        
        if (faceAnalysis.FaceDetails && faceAnalysis.FaceDetails.length > 0) {
          const face = faceAnalysis.FaceDetails[0];
          analysisResults.push({
            timestamp: (processedFrames / fps) * 1000,
            eyeDirection: face.EyeDirection,
            confidence: face.Confidence,
            pose: face.Pose
          });
        }
        
        processedFrames++;
        const progress = (processedFrames / totalFrames) * 100;
        if (progressCallback) {
          progressCallback(progress);
        }
      }
      
      this.saveAnalysisResults(analysisResults);
      
    } catch (error) {
      console.error('Rekognition解析エラー:', error);
      throw error;
    }
  }

  async analyzeFaceWithRekognition(base64Image) {
    try {
      // 1. AWS設定のチェック
      if (!this.awsConfig) {
        throw new Error('AWS設定が初期化されていません');
      }
      console.log('AWS Config:', {
        region: this.awsConfig.region,
        hasAccessKey: !!this.awsConfig.credentials.accessKeyId,
        hasSecretKey: !!this.awsConfig.credentials.secretAccessKey
      });

      // 2. 入力画像データのチェック
      if (!base64Image || !base64Image.startsWith('data:image')) {
        throw new Error('無効な画像データです');
      }

      // 3. Base64デコードとバイナリデータの準備
      const base64Data = base64Image.split(',')[1];
      const binaryData = atob(base64Data);
      const byteArray = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        byteArray[i] = binaryData.charCodeAt(i);
      }

      // 4. バックグラウンドスクリプトに解析を依頼
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'ANALYZE_FACE',
          region: this.awsConfig.region,
          accessKeyId: this.awsConfig.credentials.accessKeyId,
          secretAccessKey: this.awsConfig.credentials.secretAccessKey,
          imageData: Array.from(byteArray) // 配列として送信
        }, response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response ? response.error : 'Unknown error'));
          }
        });
      });

      console.log('Rekognition response:', response);
      return response;

    } catch (error) {
      console.error('Rekognition API error:', error);
      throw error;
    }
  }

  async extractFramesFromVideo(videoBlob, maxDuration = 3, fps = 5) {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    await new Promise((resolve) => {
      video.onloadeddata = resolve;
      video.src = URL.createObjectURL(videoBlob);
    });
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const frames = [];
    const frameInterval = 1000 / fps; // フレーム間隔（ミリ秒）
    const maxTime = maxDuration * 1000; // 最大時間（ミリ秒）
    
    for (let time = 0; time < Math.min(video.duration * 1000, maxTime); time += frameInterval) {
      video.currentTime = time / 1000;
      await new Promise(resolve => video.onseeked = resolve);
      
      ctx.drawImage(video, 0, 0);
      frames.push(canvas.toDataURL('image/jpeg', 0.7));
    }
    
    return frames;
  }

  canvasToBase64(dataUrl) {
    return dataUrl;
  }

  saveAnalysisResults(results) {
    const jsonData = JSON.stringify(results, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eye-tracking-rekognition-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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