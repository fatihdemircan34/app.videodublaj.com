/**
 * MediaSource capture - Instagram'ın MSE kullanarak video yüklemesini yakala
 */

export function getMediaSourceCaptureScript() {
  return `
(function() {
  try {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'DEBUG',
      message: '🎬 MediaSource Capture Started'
    }));

    let capturedChunks = [];
    let totalSize = 0;
    let sourceBuffer = null;
    let videoDetected = false;

    // Video elementlerini izle
    function checkVideoElements() {
      const videos = document.querySelectorAll('video');
      if (videos.length > 0) {
        if (!videoDetected) {
          videoDetected = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: '📺 ' + videos.length + ' video element bulundu'
          }));

          videos.forEach((video, index) => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: 'Video ' + (index+1) + ': src=' + (video.src ? video.src.substring(0, 50) : 'blob/empty')
            }));
          });
        }
      }
    }

    // Her 2 saniyede bir video kontrol et
    setInterval(checkVideoElements, 2000);
    setTimeout(checkVideoElements, 500);

    // MediaSource.addSourceBuffer'ı intercept et
    if (window.MediaSource) {
      const originalAddSourceBuffer = MediaSource.prototype.addSourceBuffer;

      MediaSource.prototype.addSourceBuffer = function(mimeType) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG',
          message: '📺 MediaSource.addSourceBuffer çağrıldı: ' + mimeType
        }));

        // Codec bilgisini parse et (720p, 1080p tespiti için)
        let resolution = 'unknown';
        if (mimeType.includes('avc1.640028') || mimeType.includes('avc1.64002A')) {
          resolution = '1080p';
        } else if (mimeType.includes('avc1.64001F') || mimeType.includes('avc1.640020')) {
          resolution = '720p';
        } else if (mimeType.includes('avc1.640015') || mimeType.includes('avc1.640016')) {
          resolution = '480p';
        }

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG',
          message: '🎬 Tespit edilen çözünürlük: ' + resolution
        }));

        const buffer = originalAddSourceBuffer.call(this, mimeType);
        sourceBuffer = buffer;

        // appendBuffer'ı intercept et
        const originalAppendBuffer = buffer.appendBuffer;
        buffer.appendBuffer = function(data) {
          try {
            // Video chunk'ları yakalanan kısım
            if (data && data.byteLength > 0) {
              totalSize += data.byteLength;

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: '📦 Chunk: ' + (data.byteLength / 1024).toFixed(1) + ' KB (Toplam: ' + (totalSize / 1024 / 1024).toFixed(2) + ' MB)'
              }));

              // Chunk'ı sakla
              capturedChunks.push(new Uint8Array(data));

              // 2MB üzerindeyse gönder (düşük eşik, kısa videolar için)
              if (totalSize > 2 * 1024 * 1024 && capturedChunks.length > 5) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '✅ ' + (totalSize / 1024 / 1024).toFixed(2) + ' MB yakalandı, birleştiriliyor...'
                }));

                // Tüm chunk'ları birleştir
                const totalLength = capturedChunks.reduce((acc, chunk) => acc + chunk.length, 0);
                const combined = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of capturedChunks) {
                  combined.set(chunk, offset);
                  offset += chunk.length;
                }

                // Blob oluştur
                const blob = new Blob([combined], { type: mimeType });

                // Base64'e çevir
                const reader = new FileReader();
                reader.onloadend = function() {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'DEBUG',
                    message: '📤 React Native\'e gönderiliyor: ' + (blob.size / 1024 / 1024).toFixed(2) + ' MB'
                  }));

                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'BLOB_DATA',
                    data: reader.result,
                    size: blob.size,
                    type: mimeType,
                    resolution: resolution
                  }));
                };
                reader.readAsDataURL(blob);

                // Chunk'ları temizle
                capturedChunks = [];
                totalSize = 0;
              }
            }
          } catch (err) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '⚠️ Chunk yakalama hatası: ' + err.message
            }));
          }

          return originalAppendBuffer.call(this, data);
        };

        return buffer;
      };

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DEBUG',
        message: '✅ MediaSource interceptor kuruldu'
      }));
    } else {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'ERROR',
        message: 'MediaSource desteklenmiyor'
      }));
    }

    // Fetch ve XHR'ı da izle (debugging için)
    const originalFetch = window.fetch;
    window.fetch = function() {
      const url = arguments[0];
      if (typeof url === 'string' && (url.includes('.mp4') || url.includes('video'))) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG',
          message: '🌐 Fetch yapıldı: ' + url.substring(0, 60)
        }));
      }
      return originalFetch.apply(this, arguments);
    };

  } catch (err) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'ERROR',
      message: 'MSE Capture hatası: ' + err.message
    }));
  }
})();
true;
`;
}
