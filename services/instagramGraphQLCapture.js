/**
 * Instagram GraphQL API Capture
 * Instagram'ın kendi GraphQL çağrılarını yakalayıp video URL'sini direkt alıyoruz
 * yt-dlp mantığından esinlenildi
 */

export function getInstagramGraphQLCaptureScript() {
  return `
(function() {
  console.log('🔍 Instagram GraphQL Capture Started');

  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'DEBUG',
    message: '🔍 GraphQL capture script loaded'
  }));

  let captured = false;

  // XMLHttpRequest ve fetch'i intercept et
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  // Fetch intercept (Instagram'ın yeni API'si)
  window.fetch = function(...args) {
    const url = args[0];

    // GraphQL veya API çağrılarını yakala
    if (url && (url.includes('graphql') || url.includes('/api/') || url.includes('query'))) {
      console.log('🎯 Fetch intercepted:', url.substring(0, 80));

      return originalFetch.apply(this, args).then(response => {
        // Response'u clone et (orijinali bozmamak için)
        const clonedResponse = response.clone();

        clonedResponse.json().then(data => {
          console.log('📦 GraphQL Response:', JSON.stringify(data).substring(0, 200));

          // Video URL'lerini bul
          const videoUrls = findVideoUrls(data);

          if (videoUrls.length > 0 && !captured) {
            captured = true;

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '✅ Video URL bulundu: ' + videoUrls.length + ' adet'
            }));

            // En yüksek kaliteyi seç
            const bestVideo = videoUrls[0];

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'VIDEO_URL_FOUND',
              url: bestVideo.url,
              width: bestVideo.width,
              height: bestVideo.height,
              method: 'graphql_intercept'
            }));
          }
        }).catch(err => {
          console.log('⚠️ JSON parse error:', err.message);
        });

        return response;
      });
    }

    return originalFetch.apply(this, args);
  };

  // XMLHttpRequest intercept (eski API)
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;

    if (url && (url.includes('graphql') || url.includes('/api/'))) {
      console.log('🎯 XHR intercepted:', url.substring(0, 80));
    }

    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    if (this._url && (this._url.includes('graphql') || this._url.includes('/api/'))) {
      this.addEventListener('load', function() {
        try {
          const data = JSON.parse(this.responseText);
          console.log('📦 XHR Response:', JSON.stringify(data).substring(0, 200));

          const videoUrls = findVideoUrls(data);

          if (videoUrls.length > 0 && !captured) {
            captured = true;

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'VIDEO_URL_FOUND',
              url: videoUrls[0].url,
              width: videoUrls[0].width,
              height: videoUrls[0].height,
              method: 'xhr_intercept'
            }));
          }
        } catch (err) {
          console.log('⚠️ XHR parse error:', err.message);
        }
      });
    }

    return originalXHRSend.apply(this, args);
  };

  // JSON objesinde video URL'lerini bul (recursive)
  function findVideoUrls(obj, results = []) {
    if (!obj || typeof obj !== 'object') return results;

    // video_url alanını ara
    if (obj.video_url && typeof obj.video_url === 'string') {
      results.push({
        url: obj.video_url,
        width: obj.video_width || obj.dimensions?.width || 0,
        height: obj.video_height || obj.dimensions?.height || 0
      });
    }

    // video_versions array'ini ara (Instagram yeni API)
    if (Array.isArray(obj.video_versions)) {
      obj.video_versions.forEach(v => {
        if (v.url) {
          results.push({
            url: v.url,
            width: v.width || 0,
            height: v.height || 0
          });
        }
      });
    }

    // Nested objelerde ara
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        findVideoUrls(obj[key], results);
      }
    }

    // En yüksek çözünürlüğe göre sırala
    results.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    return results;
  }

  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'DEBUG',
    message: '✅ Fetch/XHR intercepted, waiting for GraphQL calls...'
  }));

})();
true;
`;
}
