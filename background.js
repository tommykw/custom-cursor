// AWS Rekognition APIを直接呼び出す
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ANALYZE_FACE') {
    handleAnalyzeFace(request, sendResponse);
    return true; // 非同期レスポンスのために必要
  }
});

async function handleAnalyzeFace(request, sendResponse) {
  try {
    console.log('Analyzing face in background...');
    
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = timestamp.slice(0, 8);
    const region = request.region;
    const service = 'rekognition';
    
    // リクエストボディの準備
    const requestBody = JSON.stringify({
      Image: {
        Bytes: request.imageData
      },
      Attributes: ['ALL']
    });

    // 認証ヘッダーの生成
    const canonicalHeaders = {
      'content-type': 'application/x-amz-json-1.1',
      'host': `rekognition.${region}.amazonaws.com`,
      'x-amz-date': timestamp,
      'x-amz-target': 'RekognitionService.DetectFaces'
    };

    const signedHeaders = Object.keys(canonicalHeaders)
      .sort()
      .join(';');

    const canonicalRequest = [
      'POST',
      '/',
      '',
      ...Object.keys(canonicalHeaders)
        .sort()
        .map(key => `${key}:${canonicalHeaders[key]}`),
      '',
      signedHeaders,
      await sha256(requestBody)
    ].join('\n');

    const credentialScope = `${date}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      timestamp,
      credentialScope,
      await sha256(canonicalRequest)
    ].join('\n');

    // 署名キーの生成
    const kDate = await hmac('AWS4' + request.secretAccessKey, date);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, service);
    const kSigning = await hmac(kService, 'aws4_request');
    const signature = await hmac(kSigning, stringToSign);

    // 認証ヘッダーの組み立て
    const authorizationHeader = [
      `AWS4-HMAC-SHA256 Credential=${request.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`
    ].join(', ');

    // APIリクエストの実行
    const response = await fetch(`https://rekognition.${region}.amazonaws.com/`, {
      method: 'POST',
      headers: {
        ...canonicalHeaders,
        'Authorization': authorizationHeader
      },
      body: requestBody
    });

    const data = await response.json();
    console.log('Rekognition response:', data);
    sendResponse({ success: true, data });

  } catch (error) {
    console.error('Rekognition error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// HMAC-SHA256の計算
async function hmac(key, message) {
  const keyBuffer = typeof key === 'string' ? 
    new TextEncoder().encode(key) :
    key;
  
  const messageBuffer = new TextEncoder().encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    messageBuffer
  );
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// SHA256ハッシュの計算
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
} 