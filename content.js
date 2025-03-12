const cursor = document.createElement('div');
cursor.id = 'custom-cursor';
document.body.appendChild(cursor);

// 音声認識の初期化と制御のための変数
let recognition = null;
let isListening = false;

// カーソルの軌跡を表示するための配列
const cursorTrail = [];
const maxTrailPoints = 20;

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

// 音声認識の開始/停止を制御するボタンを作成
const voiceControlButton = document.createElement('button');
voiceControlButton.id = 'voice-control-button';
voiceControlButton.innerHTML = '🎤 音声認識開始';
voiceControlButton.style.position = 'fixed';
voiceControlButton.style.bottom = '20px';
voiceControlButton.style.right = '200px';
voiceControlButton.style.zIndex = '999999';
document.body.appendChild(voiceControlButton);

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

// ボタンの共通スタイル（一度だけ定義）
const buttonBaseStyles = {
  padding: '10px 20px',
  border: 'none',
  borderRadius: '5px',
  color: 'white',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 'bold',
  transition: 'all 0.3s ease',
  zIndex: '2147483647'
};

// 色を調整するヘルパー関数（一度だけ定義）
function addButtonHoverEffects(button, baseColor) {
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = adjustColor(baseColor, -20);
  });
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = baseColor;
  });
}

function adjustColor(color, amount) {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// 音声認識ボタンのスタイル更新
Object.assign(voiceControlButton.style, buttonBaseStyles);
voiceControlButton.style.backgroundColor = '#FF5722';
addButtonHoverEffects(voiceControlButton, '#FF5722');

// オーバーレイコンテナを作成する関数
function createOverlayContainer() {
  const container = document.createElement('div');
  container.id = 'custom-cursor-overlay-container';
  
  // スタイルを設定
  Object.assign(container.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '2147483647'
  });
  
  // コンテナを body の直前に挿入
  document.documentElement.insertBefore(container, document.body);
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

// ボタンの作成と配置を修正
const eyeTrackButton = document.createElement('button');
eyeTrackButton.id = 'eye-track-button';
eyeTrackButton.innerHTML = '👁 視線追跡開始';
eyeTrackButton.style.position = 'fixed';
eyeTrackButton.style.bottom = '120px';  // 最上段
eyeTrackButton.style.right = '20px';

const recordButton = document.createElement('button');
recordButton.id = 'record-button';
recordButton.innerHTML = '⏺️ 録画開始';
recordButton.style.position = 'fixed';
recordButton.style.bottom = '70px';  // 中段
recordButton.style.right = '20px';

const analyzeButton = document.createElement('button');
analyzeButton.id = 'analyze-video-button';
analyzeButton.innerHTML = '🔍 録画解析';
analyzeButton.style.position = 'fixed';
analyzeButton.style.bottom = '20px';  // 最下段
analyzeButton.style.right = '20px';

// 音声認識ボタンの位置を調整
voiceControlButton.style.bottom = '20px';  // 最下段
voiceControlButton.style.right = '200px';

// ボタンのスタイルを適用
[eyeTrackButton, recordButton, analyzeButton].forEach(button => {
  Object.assign(button.style, buttonBaseStyles);
});

// ボタンの色を設定
eyeTrackButton.style.backgroundColor = '#673AB7';    // 紫
recordButton.style.backgroundColor = '#4CAF50';      // 緑
analyzeButton.style.backgroundColor = '#9C27B0';     // 濃い紫

// ホバーエフェクトを追加
addButtonHoverEffects(eyeTrackButton, '#673AB7');
addButtonHoverEffects(recordButton, '#4CAF50');
addButtonHoverEffects(analyzeButton, '#9C27B0');

// ボタンをページに追加
document.body.appendChild(eyeTrackButton);
document.body.appendChild(recordButton);
document.body.appendChild(analyzeButton);

// 視線追跡ボタンのイベントリスナー
eyeTrackButton.addEventListener('click', async () => {
  if (!isEyeTracking) {
    try {
      webgazer = await initWebGazer();
      await webgazer.begin();
      startEyeTracking();
    } catch (error) {
      console.error('視線追跡の初期化エラー:', error);
      alert(error.message);
    }
  } else {
    stopEyeTracking();
  }
});

// 録画ボタンのイベントリスナー
recordButton.addEventListener('click', () => {
  if (!webgazer) {
    alert('視線追跡を開始してください');
    return;
  }
  
  if (!webgazer.isRecording) {
    webgazer.startRecording();
    recordButton.innerHTML = '⏹ 録画停止';
    recordButton.style.backgroundColor = '#f44336';
    addButtonHoverEffects(recordButton, '#f44336');
  } else {
    webgazer.stopRecording();
    recordButton.innerHTML = '⏺️ 録画開始';
    recordButton.style.backgroundColor = '#4CAF50';
    addButtonHoverEffects(recordButton, '#4CAF50');
  }
});

// 解析ボタンのイベントリスナーを修正
analyzeButton.addEventListener('click', async () => {
  try {
    // AWS設定の確認
    const awsSettings = await new Promise((resolve) => {
      chrome.storage.sync.get('awsSettings', (data) => resolve(data.awsSettings));
    });

    if (!awsSettings || !awsSettings.accessKeyId || !awsSettings.secretAccessKey) {
      alert(`AWS認証情報が設定されていません。
1. Chromeの拡張機能ページを開く（chrome://extensions/）
2. 「Custom Cursor for Screen Share」の「詳細」をクリック
3. 「拡張機能のオプション」をクリック
4. AWS認証情報を入力して保存してください`);
      return;
    }

    // 以降の既存のコード...
    if (webgazer) {
      fileInput.click();
    } else {
      alert('WebGazerが初期化されていません');
    }
  } catch (error) {
    console.error('解析エラー:', error);
    alert('解析中にエラーが発生しました: ' + error.message);
  }
});

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

    if (!window.webgazer || !window.initWebGazer) {
      throw new Error('WebGazerが正しく読み込まれていません');
    }
    
    webgazer = await window.initWebGazer();
    if (!webgazer) {
      throw new Error('WebGazerの初期化に失敗しました');
    }
    console.log('WebGazer初期化成功');

    await webgazer.begin();
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
function startEyeTracking() {
  isEyeTracking = true;
  recordButton.innerHTML = '⏹ 記録停止';
  recordButton.style.backgroundColor = '#f44336';
  addButtonHoverEffects(recordButton, '#f44336');
}

// 視線追跡の停止
function stopEyeTracking() {
  isEyeTracking = false;
  gazeIndicator.style.display = 'none';
  realtimeHeatmap.style.display = 'none'; // リアルタイムヒートマップを非表示
  recordButton.innerHTML = '👁 記録開始';
  recordButton.style.backgroundColor = '#2196F3';
  addButtonHoverEffects(recordButton, '#2196F3');
  showAnalysis();
}

// ファイル選択用の input 要素
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'video/webm';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

// プログレスバーを作成
const progressContainer = document.createElement('div');
progressContainer.style.display = 'none';
progressContainer.style.position = 'fixed';
progressContainer.style.bottom = '120px'; // ボタンの上に配置
progressContainer.style.right = '20px';
progressContainer.style.width = '300px';
progressContainer.style.backgroundColor = '#f0f0f0';
progressContainer.style.padding = '10px';
progressContainer.style.borderRadius = '5px';
progressContainer.style.zIndex = '2147483647';

const progressBar = document.createElement('div');
progressBar.style.width = '100%';
progressBar.style.height = '20px';
progressBar.style.backgroundColor = '#ddd';
progressBar.style.borderRadius = '10px';
progressBar.style.overflow = 'hidden';

const progressFill = document.createElement('div');
progressFill.style.width = '0%';
progressFill.style.height = '100%';
progressFill.style.backgroundColor = '#4CAF50';
progressFill.style.transition = 'width 0.3s ease';

const progressText = document.createElement('div');
progressText.style.textAlign = 'center';
progressText.style.marginTop = '5px';
progressText.style.fontSize = '12px';
progressText.textContent = '解析進捗: 0%';

progressBar.appendChild(progressFill);
progressContainer.appendChild(progressBar);
progressContainer.appendChild(progressText);
document.body.appendChild(progressContainer);

// ファイル選択時の処理を更新
fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (file) {
    analyzeButton.disabled = true;
    analyzeButton.innerHTML = '⏳ 解析中...';
    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    
    try {
      // Rekognitionを使用した解析に変更
      await webgazer.analyzeVideoWithRekognition(file, (progress) => {
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `解析進捗: ${Math.round(progress)}%`;
      });
      alert('解析が完了しました。データがダウンロードされます。');
    } catch (error) {
      console.error('解析エラー:', error);
      alert('解析中にエラーが発生しました: ' + error.message);
    } finally {
      analyzeButton.disabled = false;
      analyzeButton.innerHTML = '🔍 録画解析';
      fileInput.value = '';
      progressContainer.style.display = 'none';
    }
  }
});
