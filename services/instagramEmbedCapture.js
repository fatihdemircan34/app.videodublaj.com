/**
 * Instagram Embed Page Video Capture
 * Embed sayfasında video URL'ini script tag'lerden çıkar
 */

export function getInstagramEmbedCaptureScript() {
  return `
(function() {
  console.log('🔍 Instagram Embed Capture Started');

  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'DEBUG',
    message: '🔍 Embed capture script loaded'
  }));

  let captured = false;

  // Embed sayfasında video <video> tag'i ile direkt yükleniyor
  function extractVideoFromPage() {
    try {
      // Video elementini bul
      const videos = document.querySelectorAll('video');

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DEBUG',
        message: '📹 ' + videos.length + ' video element bulundu'
      }));

      if (videos.length > 0) {
        const video = videos[0];
        const src = video.src || video.currentSrc;

        if (src && src.startsWith('blob:')) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: '🎬 Blob video bulundu: ' + src.substring(0, 50)
          }));

          // Blob URL'den fetch et
          fetch(src)
            .then(response => response.blob())
            .then(blob => {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: '✅ Video blob alındı: ' + (blob.size / 1024 / 1024).toFixed(2) + ' MB'
              }));

              const reader = new FileReader();
              reader.onloadend = function() {
                captured = true;
                const base64Data = reader.result;
                const chunkSize = 2000000; // 2MB chunks
                const totalChunks = Math.ceil(base64Data.length / chunkSize);

                // BLOB_START
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'BLOB_START',
                  totalChunks: totalChunks,
                  size: blob.size,
                  mimeType: blob.type || 'video/mp4',
                  resolution: video.videoWidth + 'x' + video.videoHeight
                }));

                // Chunk'ları gönder
                for (let i = 0; i < totalChunks; i++) {
                  const chunk = base64Data.substring(i * chunkSize, (i + 1) * chunkSize);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'BLOB_CHUNK',
                    chunkIndex: i,
                    totalChunks: totalChunks,
                    data: chunk
                  }));
                }

                // BLOB_END
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'BLOB_END',
                  totalChunks: totalChunks
                }));
              };
              reader.readAsDataURL(blob);
            })
            .catch(err => {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: '⚠️ Blob fetch hatası: ' + err.message
              }));
            });
        } else if (src && src.includes('.mp4')) {
          // Direkt MP4 URL
          captured = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'VIDEO_URL_FOUND',
            url: src,
            width: video.videoWidth,
            height: video.videoHeight,
            method: 'embed_direct'
          }));
        }
      }

      // Script tag'lerden de çıkarmayı dene
      if (!captured) {
        const scripts = document.querySelectorAll('script:not([src])');

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG',
          message: '📜 ' + scripts.length + ' script tag bulundu'
        }));

        for (let i = 0; i < scripts.length; i++) {
          const content = scripts[i].textContent || scripts[i].innerHTML;

          // video_url ara
          if (content.includes('video_url')) {
            const urlMatch = content.match(/"video_url"\\s*:\\s*"([^"]+)"/);
            if (urlMatch && urlMatch[1]) {
              const videoUrl = urlMatch[1].replace(/\\\\u0026/g, '&').replace(/\\\\/g, '');

              captured = true;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'VIDEO_URL_FOUND',
                url: videoUrl,
                width: 0,
                height: 0,
                method: 'embed_script'
              }));
              break;
            }
          }

          // DASH manifest ara
          if (content.includes('video_dash_manifest')) {
            const dashMatch = content.match(/"video_dash_manifest"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"/);
            if (dashMatch && dashMatch[1]) {
              let manifestXml = dashMatch[1];
              manifestXml = manifestXml.replace(/\\\\u003C/g, '<');
              manifestXml = manifestXml.replace(/\\\\u003E/g, '>');
              manifestXml = manifestXml.replace(/\\\\"/g, '"');
              manifestXml = manifestXml.replace(/\\\\\\\\/g, '/');

              // BaseURL çıkar
              const baseUrlPattern = /<BaseURL>([^<]+)<\\/BaseURL>/g;
              const match = baseUrlPattern.exec(manifestXml);

              if (match && match[1]) {
                captured = true;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'VIDEO_URL_FOUND',
                  url: match[1],
                  width: 0,
                  height: 0,
                  method: 'embed_dash'
                }));
                break;
              }
            }
          }
        }
      }

    } catch (error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'ERROR',
        message: 'Embed extract error: ' + error.message
      }));
    }
  }

  // Sayfanın tam yüklenmesini bekle
  if (document.readyState === 'complete') {
    setTimeout(extractVideoFromPage, 1000);
  } else {
    window.addEventListener('load', function() {
      setTimeout(extractVideoFromPage, 1000);
    });
  }

  // Video elementi dinamik yüklenebilir - periyodik kontrol
  let attempts = 0;
  const checkInterval = setInterval(function() {
    if (captured || attempts >= 20) {
      clearInterval(checkInterval);
      return;
    }
    attempts++;
    extractVideoFromPage();
  }, 1000);

})();
true;
`;
}
