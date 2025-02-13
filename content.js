// Initialize custom cursor
const cursor = document.createElement('div');
cursor.id = 'custom-cursor';
cursor.classList.add('custom-cursor');
document.body.appendChild(cursor);

// Initialize cursor trail
const cursorTrail = [];
const maxTrailPoints = 20;

// Initialize mouse tracking
document.addEventListener('mousemove', (e) => {
  cursor.style.left = `${e.clientX}px`;
  cursor.style.top = `${e.clientY}px`;
  
  // Update trail
  cursorTrail.push({ x: e.clientX, y: e.clientY });
  if (cursorTrail.length > maxTrailPoints) {
    cursorTrail.shift();
  }
  updateTrail();
});

// 音声認識の初期化と制御のための変数
let recognition = null;
let isListening = false;

// 方向のキーワードを定義
const DIRECTION_KEYWORDS = {
  right: ['右', '右側', 'みぎ', 'ミギ', 'らいと', 'ライト'],
  left: ['左', '左側', 'ひだり', 'ヒダリ', 'レフト'],
  up: ['上', '上側', 'うえ', 'ウエ', 'アップ', '上の方'],
  down: ['下', '下側', 'した', 'シタ', 'ダウン', '下の方']
};

// デバウンス処理用のタイマー
let recognitionDebounceTimer = null;

// ヒートマップ用のデータ構造
let heatmapData = [];
let isRecording = false;
let recordingStartTime = null;

// 視線追跡用の変数
let webgazer = null;
let isEyeTracking = false;
let eyeTrackingData = [];

// 視線位置インジケーターを作成
const gazeIndicator = document.createElement('div');
gazeIndicator.id = 'gaze-indicator';
Object.assign(gazeIndicator.style, {
  position: 'fixed',
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  backgroundColor: 'rgba(0, 0, 255, 0.5)',
  border: '2px solid rgba(0, 0, 255, 0.8)',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
  zIndex: '2147483647',
  display: 'none',
  transition: 'all 0.1s ease'
});
document.body.appendChild(gazeIndicator);

// カーソルの移動処理を更新
document.addEventListener('mousemove', (e) => {
  cursor.style.left = `${e.clientX}px`;
  cursor.style.top = `${e.clientY}px`;
  
  // 軌跡を追加
  cursorTrail.push({ x: e.clientX, y: e.clientY });
  if (cursorTrail.length > maxTrailPoints) {
    cursorTrail.shift();
  }
  
  // 軌跡を描画
  updateTrail();
});

// クリックアニメーションを更新
document.addEventListener("click", () => {
  cursor.animate(
    [
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      { transform: "translate(-50%, -50%) scale(2)", opacity: 0.8 }, // スケールを大きくして視認性向上
      { transform: "translate(-50%, -50%) scale(1)" , opacity: 1 },
    ],
    { duration: 400, easing: "ease-out" } // アニメーション時間を長くする
  );
});

// Initialize control buttons
const voiceControlButton = document.createElement('button');
voiceControlButton.id = 'voice-control-button';
voiceControlButton.innerHTML = '🎤 音声認識開始';
voiceControlButton.classList.add('control-button');
document.body.appendChild(voiceControlButton);

const recordButton = document.createElement('button');
recordButton.id = 'record-button';
recordButton.innerHTML = '🔴 記録開始';
recordButton.classList.add('control-button');
document.body.appendChild(recordButton);

const eyeTrackButton = document.createElement('button');
eyeTrackButton.id = 'eye-track-button';
eyeTrackButton.innerHTML = '👁 視線追跡開始';
eyeTrackButton.classList.add('control-button');
document.body.appendChild(eyeTrackButton);

// Create container for footer buttons
const footerContainer = document.createElement('div');
footerContainer.id = 'footer-controls';
Object.assign(footerContainer.style, {
  position: 'fixed',
  bottom: '20px',
  right: '20px',
  zIndex: '1000',
  display: 'flex',
  gap: '10px'
});
document.body.appendChild(footerContainer);

// Move buttons to footer container
footerContainer.appendChild(voiceControlButton);
footerContainer.appendChild(recordButton);
footerContainer.appendChild(eyeTrackButton);

// ボタンクリックで音声認識の開始/停止を切り替え
voiceControlButton.addEventListener('click', async () => {
  try {
    // マイクの権限を明示的に要求
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: true,
      video: false
    });
    
    // 使用後すぐにストリームを停止
    stream.getTracks().forEach(track => track.stop());
    
    if (!recognition) {
      console.log('音声認識を初期化します...');
      initializeSpeechRecognition();
    }

    if (isListening) {
      console.log('音声認識を停止します...');
      recognition.stop();
    } else {
      console.log('音声認識を開始します...');
      recognition.start();
    }
  } catch (error) {
    console.error('マイクの権限エラー:', error);
    alert('マイクの使用を許可してください。\nエラー: ' + error.message);
  }
});

// 音声認識の初期化関数を更新
function initializeSpeechRecognition() {
  try {
    if (!('webkitSpeechRecognition' in window)) {
      throw new Error('このブラウザは音声認識をサポートしていません。');
    }

    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'ja-JP';
    recognition.interimResults = true;
    recognition.maxAlternatives = 5; // 複数の認識結果を取得

    recognition.onstart = () => {
      console.log('音声認識が開始されました');
      isListening = true;
      voiceControlButton.innerHTML = '🎤 音声認識停止';
      voiceControlButton.style.backgroundColor = '#ff4444';
      addButtonHoverEffects(voiceControlButton, '#ff4444');
    };

    recognition.onend = () => {
      console.log('音声認識が終了しました');
      if (isListening) {
        console.log('音声認識を再開します...');
        recognition.start();
      }
      isListening = false;
      voiceControlButton.innerHTML = '🎤 音声認識開始';
      voiceControlButton.style.backgroundColor = '#4CAF50';
      addButtonHoverEffects(voiceControlButton, '#4CAF50');
    };

    recognition.onerror = (event) => {
      console.error('音声認識エラー:', event.error);
      console.error('エラーの詳細:', event);
      isListening = false;
      voiceControlButton.innerHTML = '🎤 音声認識開始';
      voiceControlButton.style.backgroundColor = '#4CAF50';
      addButtonHoverEffects(voiceControlButton, '#4CAF50');
      alert(`音声認識エラー: ${event.error}`);
    };

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      
      // デバウンス処理
      if (recognitionDebounceTimer) {
        clearTimeout(recognitionDebounceTimer);
      }
      
      recognitionDebounceTimer = setTimeout(() => {
        // 認識された全ての候補を処理
        for (let i = 0; i < result.length; i++) {
          const text = result[i].transcript.toLowerCase();
          console.log(`認識されたテキスト (候補${i + 1}):`, text);
          
          // 文章を単語に分割して処理
          const words = text.split(/[\s,。、]+/);
          
          words.forEach(word => {
            // 各方向のキーワードをチェック
            Object.entries(DIRECTION_KEYWORDS).forEach(([direction, keywords]) => {
              if (keywords.some(keyword => word.includes(keyword.toLowerCase()))) {
                console.log(`${direction}向きを検知しました (キーワード: ${word})`);
                highlightDirection(direction);
              }
            });
          });
        }
      }, 200); // 200ミリ秒のデバウンス
    };
  } catch (error) {
    console.error('音声認識の初期化エラー:', error);
    alert('音声認識の初期化に失敗しました。\nエラー: ' + error.message);
  }
}

// ボタンのホバーエフェクトを設定する関数
function addButtonHoverEffects(button, defaultColor) {
  button.style.transition = 'all 0.3s ease';
  
  // ホバー時のスタイル
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
    // 元の色を少し明るくする
    button.style.backgroundColor = lightenColor(defaultColor, 20);
  });
  
  // ホバーが外れたときのスタイル
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = 'none';
    button.style.backgroundColor = defaultColor;
  });
}

// 色を明るくする関数
function lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    G = (num >> 8 & 0x00FF) + amt,
    B = (num & 0x0000FF) + amt;
  return '#' + (
    0x1000000 +
    (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)
  ).toString(16).slice(1);
}

// 各ボタンの基本スタイルを設定
const buttonBaseStyles = {
  padding: '10px 20px',
  border: 'none',
  borderRadius: '5px',
  color: 'white',
  cursor: 'pointer',
  fontSize: '16px',
  zIndex: '2147483647'
};

// 音声認識ボタンのスタイル更新
Object.assign(voiceControlButton.style, buttonBaseStyles);
voiceControlButton.style.backgroundColor = '#4CAF50';
addButtonHoverEffects(voiceControlButton, '#4CAF50');

// Create overlay container
function createOverlayContainer() {
  const container = document.createElement('div');
  container.id = 'custom-cursor-overlay-container';
  
  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '3000'
  });
  
  document.body.appendChild(container);
  return container;
}

// 初期化時にオーバーレイコンテナを作成
const overlayContainer = createOverlayContainer();

// 方向を示すハイライトを表示（更新版）
function highlightDirection(direction) {
  const existingHighlight = overlayContainer.querySelector(`.direction-highlight.${direction}`);
  if (existingHighlight) {
    // 既存のハイライトがある場合は、アニメーションをリセット
    existingHighlight.style.animation = 'none';
    existingHighlight.offsetHeight; // リフロー
    existingHighlight.style.animation = null;
    return;
  }

  const highlight = document.createElement('div');
  highlight.className = `direction-highlight ${direction}`;
  
  // インライン・スタイルで確実に表示されるようにする
  Object.assign(highlight.style, {
    position: 'fixed',
    background: 'rgba(255, 255, 0, 0.2)',
    pointerEvents: 'none',
    zIndex: '2147483646'
  });

  // 方向に応じたスタイルを設定
  switch (direction) {
    case 'right':
      Object.assign(highlight.style, {
        right: '0',
        top: '0',
        width: '30%',
        height: '100%'
      });
      break;
    case 'left':
      Object.assign(highlight.style, {
        left: '0',
        top: '0',
        width: '30%',
        height: '100%'
      });
      break;
    case 'up':
      Object.assign(highlight.style, {
        left: '0',
        top: '0',
        width: '100%',
        height: '30%'
      });
      break;
    case 'down':
      Object.assign(highlight.style, {
        left: '0',
        bottom: '0',
        width: '100%',
        height: '30%'
      });
      break;
  }

  // アニメーションをインラインで定義
  highlight.style.animation = 'customFadeOut 1s ease-out';
  
  overlayContainer.appendChild(highlight);
  
  setTimeout(() => {
    highlight.remove();
  }, 1000);
}

// カーソルの軌跡を更新（更新版）
function updateTrail() {
  const trailElements = overlayContainer.querySelectorAll('.cursor-trail');
  trailElements.forEach(el => el.remove());
  
  cursorTrail.forEach((point, index) => {
    const trail = document.createElement('div');
    trail.className = 'cursor-trail';
    
    // インライン・スタイルで確実に表示されるようにする
    Object.assign(trail.style, {
      position: 'fixed',
      width: '8px',
      height: '8px',
      background: 'rgba(255, 0, 0, 0.3)',
      borderRadius: '50%',
      pointerEvents: 'none',
      transform: 'translate(-50%, -50%)',
      left: `${point.x}px`,
      top: `${point.y}px`,
      opacity: index / maxTrailPoints,
      zIndex: '2147483645'
    });
    
    overlayContainer.appendChild(trail);
  });
}

// カスタムカーソルのz-indexも更新
cursor.style.zIndex = '2147483647';



// ヒートマップキャンバスを作成（スタイルを修正）
const heatmapCanvas = document.createElement('canvas');
heatmapCanvas.id = 'heatmap-canvas';
Object.assign(heatmapCanvas.style, {
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  zIndex: '2147483646',
  opacity: '0.7',
  display: 'none'
});

overlayContainer.appendChild(heatmapCanvas);

// マウスの動きを記録（スクロール位置を考慮）
function recordMouseMovement(e) {
  if (!isRecording) return;
  
  const timestamp = Date.now() - recordingStartTime;
  heatmapData.push({
    x: e.clientX + window.scrollX,  // スクロール位置を加算
    y: e.clientY + window.scrollY,  // スクロール位置を加算
    timestamp,
    metadata: {
      tagName: e.target.tagName,
      text: e.target.textContent?.slice(0, 100),
      href: e.target.href,  // リンク先
      src: e.target.src,    // 画像などのソース
      rect: e.target.getBoundingClientRect()  // 要素の位置とサイズ
    }
  });
}

// ヒートマップを描画（視線追跡データを含む改善版）
function drawHeatmap() {
  const canvas = heatmapCanvas;
  const ctx = canvas.getContext('2d');
  
  // ドキュメント全体のサイズを取得
  const docWidth = Math.max(
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
    document.body.scrollWidth
  );
  const docHeight = Math.max(
    document.documentElement.scrollHeight,
    document.documentElement.clientHeight,
    document.body.scrollHeight
  );
  
  // キャンバスのサイズをドキュメント全体に合わせる
  canvas.width = docWidth;
  canvas.height = docHeight;
  
  // コンテナのサイズも更新
  overlayContainer.style.width = `${docWidth}px`;
  overlayContainer.style.height = `${docHeight}px`;
  
  // キャンバスをクリア
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // マウスと視線のデータを統合
  const allPoints = [
    ...heatmapData.map(data => ({
      ...data,
      type: 'mouse',
      weight: 1
    })),
    ...eyeTrackingData.map(data => ({
      x: data.x,
      y: data.y,
      type: 'gaze',
      weight: data.confidence // 視線の信頼度を重みとして使用
    }))
  ];

  // 各ポイントの密度を計算
  const densityMap = new Map();
  const gridSize = 20;

  allPoints.forEach(point => {
    const gridX = Math.floor(point.x / gridSize);
    const gridY = Math.floor(point.y / gridSize);
    const key = `${gridX},${gridY},${point.type}`;
    const value = densityMap.get(key) || { count: 0, weight: 0 };
    value.count++;
    value.weight += point.weight;
    densityMap.set(key, value);
  });

  // 最大密度を見つける（マウスと視線で別々に）
  const maxDensity = {
    mouse: Math.max(...Array.from(densityMap.entries())
      .filter(([key]) => key.includes('mouse'))
      .map(([, value]) => value.weight)),
    gaze: Math.max(...Array.from(densityMap.entries())
      .filter(([key]) => key.includes('gaze'))
      .map(([, value]) => value.weight))
  };

  // ヒートマップを描画
  allPoints.forEach(point => {
    const gridX = Math.floor(point.x / gridSize);
    const gridY = Math.floor(point.y / gridSize);
    const key = `${gridX},${gridY},${point.type}`;
    const density = densityMap.get(key).weight / maxDensity[point.type];
    
    const radius = 30 + (density * 20);
    const gradient = ctx.createRadialGradient(
      point.x, point.y, 0,
      point.x, point.y, radius
    );
    
    const alpha = Math.min(0.3 + (density * 0.5), 0.8);
    
    // マウスと視線で異なる色を使用
    if (point.type === 'mouse') {
      gradient.addColorStop(0, `rgba(255, 0, 0, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(255, 100, 0, ${alpha * 0.5})`);
      gradient.addColorStop(1, 'rgba(255, 200, 0, 0)');
    } else {
      gradient.addColorStop(0, `rgba(0, 0, 255, ${alpha})`);
      gradient.addColorStop(1, 'rgba(0, 0, 255, 0)');
    }
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // ブラー効果を適用
  ctx.filter = 'blur(10px)';
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(tempCanvas, 0, 0);

  // 凡例を追加
  addLegend(ctx);
}

// ヒートマップの凡例を追加
function addLegend(ctx) {
  const legendWidth = 200;
  const legendHeight = 60;
  const padding = 10;

  // 凡例の背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(padding, padding, legendWidth, legendHeight);

  // マウス移動の説明
  ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
  ctx.beginPath();
  ctx.arc(padding + 15, padding + 15, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = '14px Arial';
  ctx.fillText('マウスの移動', padding + 30, padding + 20);

  // 視線の説明
  ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
  ctx.beginPath();
  ctx.arc(padding + 15, padding + 40, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.fillText('視線の動き', padding + 30, padding + 45);
}

// キャプチャボタンを作成
const captureButton = document.createElement('button');
captureButton.id = 'capture-button';
captureButton.innerHTML = '📸 キャプチャ';
captureButton.style.position = 'fixed';
captureButton.style.bottom = '20px';
captureButton.style.right = '340px'; // 他のボタンの左側に配置

// キャプチャボタンのスタイル
Object.assign(captureButton.style, buttonBaseStyles);
captureButton.style.backgroundColor = '#9c27b0';
addButtonHoverEffects(captureButton, '#9c27b0');

document.body.appendChild(captureButton);

// ヒートマップのキャプチャ機能を改善（全画面キャプチャ対応版）
async function captureHeatmap() {
  try {
    if (typeof html2canvas === 'undefined') {
      throw new Error('html2canvasライブラリが読み込まれていません');
    }

    // 現在のスクロール位置を保存
    const originalScrollPos = {
      x: window.scrollX,
      y: window.scrollY
    };

    // ページ全体のサイズを取得
    const docWidth = Math.max(
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
      document.body.scrollWidth
    );
    const docHeight = Math.max(
      document.documentElement.scrollHeight,
      document.documentElement.clientHeight,
      document.body.scrollHeight
    );

    // キャプチャ中はヒートマップを一時的に非表示
    const heatmapDisplay = heatmapCanvas.style.display;
    heatmapCanvas.style.display = 'none';

    try {
      // ページ全体をキャプチャ
      const pageImage = await html2canvas(document.documentElement, {
        width: docWidth,
        height: docHeight,
        windowWidth: docWidth,
        windowHeight: docHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        logging: false,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        scale: 1,
        onclone: (clonedDoc) => {
          // クローンされたドキュメントのスタイルを調整
          const clonedBody = clonedDoc.body;
          clonedBody.style.width = `${docWidth}px`;
          clonedBody.style.height = `${docHeight}px`;
          clonedBody.style.overflow = 'hidden';
          clonedBody.style.transform = 'none';
        }
      });

      // 結果を描画するキャンバスを作成
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = docWidth;
      fullCanvas.height = docHeight;
      const ctx = fullCanvas.getContext('2d');

      // ページのスクリーンショットを描画
      ctx.drawImage(pageImage, 0, 0);

      // ヒートマップデータを描画
      const heatmapLayer = document.createElement('canvas');
      heatmapLayer.width = docWidth;
      heatmapLayer.height = docHeight;
      const heatmapCtx = heatmapLayer.getContext('2d');

      // マウスの動きを描画（赤系統）
      heatmapData.forEach(point => {
        const gradient = heatmapCtx.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, 30
        );
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        heatmapCtx.fillStyle = gradient;
        heatmapCtx.beginPath();
        heatmapCtx.arc(point.x, point.y, 30, 0, Math.PI * 2);
        heatmapCtx.fill();
      });

      // 視線データを描画（青系統）
      eyeTrackingData.forEach(point => {
        const gradient = heatmapCtx.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, 30
        );
        gradient.addColorStop(0, 'rgba(0, 0, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 255, 0)');
        heatmapCtx.fillStyle = gradient;
        heatmapCtx.beginPath();
        heatmapCtx.arc(point.x, point.y, 30, 0, Math.PI * 2);
        heatmapCtx.fill();
      });

      // ヒートマップを合成
      ctx.globalAlpha = 0.7;
      ctx.drawImage(heatmapLayer, 0, 0);
      ctx.globalAlpha = 1.0;

      // 凡例を追加
      const legendHeight = 80;
      const padding = 20;
      
      // 凡例の背景
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(padding, padding, 300, legendHeight);

      // 凡例のテキスト
      ctx.font = '14px Arial';
      
      // マウスの動きの説明
      ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.beginPath();
      ctx.arc(padding + 15, padding + 20, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.fillText('マウスの移動', padding + 35, padding + 25);

      // 視線の動きの説明
      ctx.fillStyle = 'rgba(0, 0, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(padding + 15, padding + 45, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.fillText('視線の動き', padding + 35, padding + 50);

      // タイムスタンプを追加
      const timestamp = new Date().toLocaleString('ja-JP');
      ctx.fillStyle = 'white';
      ctx.fillText(`キャプチャ日時: ${timestamp}`, padding + 35, padding + 70);

      // 画像としてダウンロード
      const link = document.createElement('a');
      link.download = `heatmap_${Date.now()}.png`;
      link.href = fullCanvas.toDataURL('image/png');
      link.click();

      return true;
    } finally {
      // ヒートマップの表示状態を元に戻す
      heatmapCanvas.style.display = heatmapDisplay;
      // スクロール位置を元に戻す
      window.scrollTo(originalScrollPos.x, originalScrollPos.y);
    }
  } catch (error) {
    console.error('キャプチャ中にエラーが発生しました:', error);
    alert('キャプチャに失敗しました: ' + error.message);
    return false;
  }
}

// キャプチャボタンのスタイルを更新（ローディング表示を追加）
function updateCaptureButtonState(isCapturing = false) {
  if (isCapturing) {
    captureButton.innerHTML = '📸 キャプチャ中...';
    captureButton.style.backgroundColor = '#7B1FA2';
    captureButton.disabled = true;
  } else {
    captureButton.innerHTML = '📸 キャプチャ';
    captureButton.style.backgroundColor = '#9c27b0';
    captureButton.disabled = false;
  }
}

// キャプチャボタンのクリックイベントを更新
captureButton.addEventListener('click', async () => {
  if (captureButton.disabled) return; // 既に処理中の場合は何もしない
  
  updateCaptureButtonState(true);
  try {
    const success = await captureHeatmap();
    if (!success) {
      alert('キャプチャに失敗しました。もう一度お試しください。');
    }
  } finally {
    updateCaptureButtonState(false);
  }
});

// ヒートマップデータの保存と読み込み機能を追加
function saveHeatmapData() {
  const data = {
    timestamp: Date.now(),
    url: window.location.href,
    title: document.title,
    mouseData: heatmapData,
    gazeData: eyeTrackingData,
    dimensions: {
      width: Math.max(
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
        document.body.scrollWidth
      ),
      height: Math.max(
        document.documentElement.scrollHeight,
        document.documentElement.clientHeight,
        document.body.scrollHeight
      )
    }
  };

  // JSONとしてデータを保存
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `heatmap_data_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// データ保存ボタンを作成
const saveDataButton = document.createElement('button');
saveDataButton.id = 'save-data-button';
saveDataButton.innerHTML = '💾 データ保存';
saveDataButton.style.position = 'fixed';
saveDataButton.style.bottom = '20px';
saveDataButton.style.right = '660px'; // 他のボタンの左側に配置

// データ保存ボタンのスタイル
Object.assign(saveDataButton.style, buttonBaseStyles);
saveDataButton.style.backgroundColor = '#2196F3';
addButtonHoverEffects(saveDataButton, '#2196F3');

document.body.appendChild(saveDataButton);

// データ保存ボタンのクリックイベント
saveDataButton.addEventListener('click', saveHeatmapData);

// 記録の開始/停止を切り替える部分を更新
recordButton.addEventListener('click', () => {
  if (isRecording) {
    // 記録を停止
    isRecording = false;
    recordButton.innerHTML = '👁 ヒートマップ表示';
    recordButton.style.backgroundColor = '#2196F3';
    addButtonHoverEffects(recordButton, '#2196F3');
    captureButton.style.display = 'none';
    saveDataButton.style.display = 'block'; // データ保存ボタンを表示
    
    // 分析結果を表示
    showAnalysis();
  } else if (heatmapData.length > 0) {
    // ヒートマップの表示/非表示を切り替え
    if (heatmapCanvas.style.display === 'none') {
      heatmapCanvas.style.display = 'block';
      captureButton.style.display = 'block';
      saveDataButton.style.display = 'block'; // データ保存ボタンを表示
      drawHeatmap();
      recordButton.innerHTML = '🔴 記録開始';
      recordButton.style.backgroundColor = '#4CAF50';
      addButtonHoverEffects(recordButton, '#4CAF50');
    } else {
      heatmapCanvas.style.display = 'none';
      captureButton.style.display = 'none';
      saveDataButton.style.display = 'none'; // データ保存ボタンを非表示
      recordButton.innerHTML = '👁 ヒートマップ表示';
      recordButton.style.backgroundColor = '#f44336';
      addButtonHoverEffects(recordButton, '#f44336');
    }
  } else {
    // 新しい記録を開始
    isRecording = true;
    recordingStartTime = Date.now();
    heatmapData = [];
    recordButton.innerHTML = '⏹ 記録停止';
    recordButton.style.backgroundColor = '#f44336';
    addButtonHoverEffects(recordButton, '#f44336');
    captureButton.style.display = 'none';
    saveDataButton.style.display = 'none'; // データ保存ボタンを非表示
  }
});

// 分析結果を表示（視線追跡データを含む改善版）
function showAnalysis() {
  // 視線追跡データとマウス追跡データを統合
  const allTrackingData = [
    ...heatmapData.map(data => ({
      ...data,
      type: 'mouse'
    })),
    ...eyeTrackingData.map(data => ({
      x: data.x,
      y: data.y,
      timestamp: data.timestamp,
      confidence: data.confidence,
      type: 'gaze',
      metadata: {
        // 視線位置の要素を取得
        ...getElementAtPoint(data.x, data.y)
      }
    }))
  ];

  // 要素の情報を取得する補助関数
  function getElementAtPoint(x, y) {
    const element = document.elementFromPoint(
      x - window.scrollX,
      y - window.scrollY
    );
    if (!element) return {};
    
    return {
      tagName: element.tagName,
      text: element.textContent?.slice(0, 100),
      href: element.href,
      src: element.src
    };
  }

  // 最も注目された要素を見つける
  const elementFrequency = {};
  allTrackingData.forEach(point => {
    if (!point.metadata) return;
    
    const key = JSON.stringify({
      tagName: point.metadata.tagName,
      text: point.metadata.text,
      href: point.metadata.href,
      src: point.metadata.src,
      type: point.type
    });
    elementFrequency[key] = (elementFrequency[key] || 0) + 1;
  });

  // 結果をソートして上位5つを取得
  const topElements = Object.entries(elementFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([key, count]) => {
      const metadata = JSON.parse(key);
      return {
        ...metadata,
        count
      };
    });

  // 分析結果パネルを作成
  const panel = document.createElement('div');
  panel.id = 'analysis-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '20px',
    background: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    borderRadius: '10px',
    maxWidth: '300px',
    zIndex: '2147483647',
    fontSize: '14px',
    boxShadow: '0 0 10px rgba(0,0,0,0.5)'
  });

  // 統計情報を計算
  const totalPoints = allTrackingData.length;
  const gazePoints = allTrackingData.filter(d => d.type === 'gaze').length;
  const mousePoints = allTrackingData.filter(d => d.type === 'mouse').length;

  // パネルの内容を作成（より詳細な情報を表示）
  panel.innerHTML = `
    <h3 style="margin: 0 0 10px 0; color: #fff;">閲覧分析結果</h3>
    <div style="margin-bottom: 15px; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px;">
      <div>総データポイント: ${totalPoints}</div>
      <div>視線データ: ${gazePoints}</div>
      <div>マウスデータ: ${mousePoints}</div>
    </div>
    <div style="max-height: 300px; overflow-y: auto;">
      ${topElements.map((el, i) => `
        <div style="margin-bottom: 10px; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px;">
          <div style="color: #ff9800; font-weight: bold;">
            ${i + 1}. ${el.tagName} 
            <span style="color: ${el.type === 'gaze' ? '#4CAF50' : '#2196F3'}">
              (${el.type === 'gaze' ? '視線' : 'マウス'})
            </span>
          </div>
          ${el.text ? `<div style="font-size: 12px; color: #ccc; margin: 4px 0;">内容: ${el.text}</div>` : ''}
          ${el.href ? `<div style="color: #4CAF50">リンク先: ${el.href}</div>` : ''}
          ${el.src ? `<div style="color: #2196F3">画像/メディア: ${el.src}</div>` : ''}
          <div style="color: #ff5722; margin-top: 4px;">閲覧回数: ${el.count}回</div>
        </div>
      `).join('')}
    </div>
    <button onclick="this.parentElement.remove()" style="
      margin-top: 10px;
      padding: 5px 10px;
      background: #f44336;
      border: none;
      color: white;
      border-radius: 3px;
      cursor: pointer;
    ">閉じる</button>
  `;

  document.body.appendChild(panel);
}

// スクロール時にヒートマップを更新
window.addEventListener('scroll', () => {
  if (heatmapCanvas.style.display !== 'none') {
    drawHeatmap();
  }
});

// マウスの動きを記録するイベントリスナーを追加
document.addEventListener('mousemove', recordMouseMovement);

// ウィンドウサイズが変更されたときもヒートマップを更新
window.addEventListener('resize', () => {
  if (heatmapCanvas.style.display !== 'none') {
    drawHeatmap();
  }
});

// リアルタイムヒートマップ用のキャンバスを作成
const realtimeHeatmap = document.createElement('canvas');
realtimeHeatmap.id = 'realtime-heatmap';
Object.assign(realtimeHeatmap.style, {
  position: 'fixed',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  zIndex: '2147483646',
  opacity: '0.6',
  display: 'none'
});
document.body.appendChild(realtimeHeatmap);

// リアルタイムヒートマップを更新する関数
function updateRealtimeHeatmap(x, y, confidence) {
  const ctx = realtimeHeatmap.getContext('2d');
  
  // キャンバスのサイズをウィンドウに合わせる
  realtimeHeatmap.width = window.innerWidth;
  realtimeHeatmap.height = window.innerHeight;
  
  // 古いヒートマップを少し薄くする（残像効果）
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(0, 0, realtimeHeatmap.width, realtimeHeatmap.height);

  // 視線位置にグラデーションを描画
  const radius = 50; // 視線の影響範囲
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  
  // 信頼度に基づいて色の濃さを調整
  const alpha = Math.min(0.8, confidence);
  gradient.addColorStop(0, `rgba(0, 128, 255, ${alpha})`);
  gradient.addColorStop(0.6, `rgba(0, 128, 255, ${alpha * 0.5})`);
  gradient.addColorStop(1, 'rgba(0, 128, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// WebGazerの初期化と視線追跡の開始関数を更新
async function initializeEyeTracking() {
  try {
    console.log('視線追跡を初期化中...');

    // Check if face-api.js is loaded and wait for it to be ready
    let retries = 0;
    while (typeof faceapi === 'undefined' && retries < 5) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    if (typeof faceapi === 'undefined') {
      throw new Error('face-api.jsが読み込まれていません');
    }

    // Load face-api.js models first
    console.log('顔認識モデルを読み込んでいます...');
    const modelPath = chrome.runtime.getURL('models');
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelPath)
      ]);
      console.log('顔認識モデルの読み込みが完了しました');
    } catch (modelError) {
      console.error('モデル読み込みエラー:', modelError);
      throw new Error('顔認識モデルの読み込みに失敗しました: ' + modelError.message);
    }

    // Initialize WebGazer with retries
    retries = 0;
    while ((!window.webgazer || !window.initWebGazer) && retries < 10) {
      console.log('WebGazerの読み込みを待機中...', retries + 1);
      await new Promise(resolve => setTimeout(resolve, 200));
      retries++;
    }
    if (!window.webgazer || !window.initWebGazer) {
      throw new Error('WebGazerが正しく読み込まれていません');
    }
    
    try {
      console.log('WebGazerを初期化中...');
      webgazer = await window.initWebGazer();
      if (!webgazer) {
        throw new Error('WebGazerの初期化に失敗しました');
      }
      console.log('WebGazer初期化成功');
    } catch (error) {
      console.error('WebGazer初期化エラー:', error);
      throw new Error('WebGazerの初期化に失敗しました: ' + error.message);
    }

    // Initialize eye tracking
    await webgazer.initialize();
    webgazer.setGazeListener((data, timestamp) => {
      if (data && isEyeTracking) {
        eyeTrackingData.push({
          x: data.x,
          y: data.y,
          timestamp: timestamp,
          confidence: data.confidence
        });
        
        // 視線インジケーターを更新
        if (gazeIndicator) {
          gazeIndicator.style.display = 'block';
          gazeIndicator.style.left = `${data.x}px`;
          gazeIndicator.style.top = `${data.y}px`;
        }

        // リアルタイムヒートマップを更新
        if (realtimeHeatmap) {
          realtimeHeatmap.style.display = 'block';
          updateRealtimeHeatmap(data.x, data.y, data.confidence);
        }
      }
    });

    console.log('視線追跡の初期化が完了しました');
    startEyeTracking();
    return true;
  } catch (error) {
    console.error('視線追跡の初期化エラー:', error);
    if (error.name === 'NotAllowedError') {
      alert('カメラの使用を許可してください。視線追跡には必要です。');
    } else {
      alert('視線追跡の初期化に失敗しました: ' + error.message);
    }
    return false;
  }
}

// 視線追跡の開始
async function startEyeTracking() {
  try {
    if (!webgazer) {
      webgazer = await window.initWebGazer();
      
      // Create coordinate display
      const coordDisplay = document.createElement('div');
      coordDisplay.id = 'gaze-coord-display';
      Object.assign(coordDisplay.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        padding: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        borderRadius: '5px',
        fontSize: '14px',
        fontFamily: 'monospace',
        zIndex: '4000'
      });
      document.body.appendChild(coordDisplay);
      
      // Add gaze listener for real-time coordinates
      webgazer.setGazeListener((data, timestamp) => {
        if (!data) return;
        
        const coords = {
          x: Math.round(data.x),
          y: Math.round(data.y),
          confidence: data.confidence.toFixed(2)
        };
        
        // Update coordinate display
        coordDisplay.innerHTML = `
          視線座標:<br>
          X: ${coords.x}px<br>
          Y: ${coords.y}px<br>
          信頼度: ${coords.confidence}
        `;
        
        // Update gaze indicator
        gazeIndicator.style.display = 'block';
        gazeIndicator.style.left = `${data.x}px`;
        gazeIndicator.style.top = `${data.y}px`;
        
        // Update confidence indicator
        if (data.confidence > 0.8) {
          gazeIndicator.classList.add('high-confidence');
        } else {
          gazeIndicator.classList.remove('high-confidence');
        }
        
        // Store tracking data if confidence is high enough
        if (data.confidence > 0.6) {
          eyeTrackingData.push({
            ...coords,
            timestamp
          });
        }
      });
      
      // Run calibration
      await webgazer.calibrate();
    }
    
    isEyeTracking = true;
    eyeTrackButton.innerHTML = '⏹ 視線追跡停止';
    eyeTrackButton.style.backgroundColor = '#f44336';
    addButtonHoverEffects(eyeTrackButton, '#f44336');
  } catch (error) {
    console.error('視線追跡の開始エラー:', error);
    alert('視線追跡の開始に失敗しました: ' + error.message);
  }
}

// 視線追跡の停止
function stopEyeTracking() {
  try {
    isEyeTracking = false;
    
    // Update button state
    eyeTrackButton.innerHTML = '👁 視線追跡開始';
    eyeTrackButton.style.backgroundColor = '#673AB7';
    addButtonHoverEffects(eyeTrackButton, '#673AB7');
    
    // Hide UI elements
    gazeIndicator.style.display = 'none';
    const coordDisplay = document.getElementById('gaze-coord-display');
    if (coordDisplay) {
      coordDisplay.remove();
    }
    
    // Cleanup WebGazer
    if (webgazer) {
      webgazer.stopTracking();
      if (webgazer.stream) {
        webgazer.stream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      }
      webgazer = null;
    }
    
    // Store tracking data for analysis
    if (eyeTrackingData && eyeTrackingData.length > 0) {
      console.log('視線追跡データ:', eyeTrackingData);
    }
    
    // Clear tracking data
    eyeTrackingData = [];
    
    console.log('視線追跡を停止しました');
  } catch (error) {
    console.error('視線追跡の停止中にエラーが発生しました:', error);
    alert('視線追跡の停止中にエラーが発生しました: ' + error.message);
  }
}



// メッセージハンドラを追加
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'checkEyeTracking') {
    if (webgazer) {
      sendResponse({ status: 'ready' });
    } else {
      sendResponse({ status: 'not_initialized' });
    }
  }
  return true;  // 非同期レスポンスのために必要
});

// 視線追跡ボタンのクリックイベント
eyeTrackButton.addEventListener('click', async () => {
  if (isEyeTracking) {
    stopEyeTracking();
  } else {
    if (!webgazer) {
      await initializeEyeTracking();
    } else {
      startEyeTracking();
    }
  }
});

class BehaviorAnalyzer {
  constructor() {
    this.gazePoints = [];
    this.voiceMarkers = [];
    this.hesitationThreshold = 2000; // 2秒以上の停滞を迷いとみなす
  }

  // 視線の停滞を検出
  detectHesitation(gazeData) {
    const recentPoints = this.gazePoints.slice(-10);
    const isStuck = recentPoints.every(point => 
      Math.abs(point.x - gazeData.x) < 30 && 
      Math.abs(point.y - gazeData.y) < 30
    );
    
    if (isStuck) {
      return {
        type: 'hesitation',
        location: { x: gazeData.x, y: gazeData.y },
        duration: this.calculateDuration(recentPoints)
      };
    }
  }

  // 音声キーワードの検出
  detectVoiceMarkers(transcript) {
    const hesitationWords = ['えーと', 'あれ', 'うーん', 'んー'];
    const matches = hesitationWords.filter(word => transcript.includes(word));
    if (matches.length > 0) {
      return {
        type: 'voice_hesitation',
        words: matches,
        timestamp: Date.now()
      };
    }
  }

  // 注目度のヒートマップ生成
  generateAttentionMap() {
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    // 視線データの密度を計算
    this.gazePoints.forEach(point => {
      const gradient = ctx.createRadialGradient(
        point.x, point.y, 0, 
        point.x, point.y, 50
      );
      gradient.addColorStop(0, 'rgba(255, 0, 0, 0.1)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    return canvas;
  }

  // 行動パターンの分析
  analyzePattern() {
    return {
      ignoredAreas: this.findIgnoredAreas(),
      highInterestAreas: this.findHighInterestAreas(),
      hesitationPoints: this.findHesitationPoints(),
      voiceCorrelations: this.correlateVoiceAndGaze()
    };
  }
}

class AnalysisDashboard {
  constructor() {
    this.container = this.createDashboard();
    this.charts = {};
  }

  createDashboard() {
    const dashboard = document.createElement('div');
    dashboard.id = 'analysis-dashboard';
    Object.assign(dashboard.style, {
      position: 'fixed',
      right: '20px',
      top: '20px',
      padding: '15px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      borderRadius: '8px',
      zIndex: '9999'
    });

    // リアルタイムメトリクス
    this.addMetricsSection(dashboard);
    // 注目エリアマップ
    this.addAttentionMap(dashboard);
    // 行動パターングラフ
    this.addBehaviorGraph(dashboard);

    return dashboard;
  }

  updateMetrics(data) {
    const { hesitations, ignoredAreas, voiceMarkers } = data;
    // メトリクスの更新処理
  }
}

class CorrelationAnalyzer {
  analyzeUserBehavior(gazeData, voiceData, interactionData) {
    return {
      // 迷いが多い領域
      troubleAreas: this.findTroubleAreas(gazeData, voiceData),
      
      // 無視されている領域
      ignoredElements: this.findIgnoredElements(gazeData),
      
      // ユーザーフロー上の障害
      flowObstacles: this.findFlowObstacles(interactionData),
      
      // 感情マーカー
      emotionalMarkers: this.analyzeEmotionalResponse(voiceData)
    };
  }
}
