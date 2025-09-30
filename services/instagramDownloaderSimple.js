/**
 * Basitleştirilmiş Instagram Video Downloader
 * Sadece blob extraction
 */

export function getSimpleInjectionScript() {
  return `
(function() {
  try {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'DEBUG',
      message: '🚀 Simple Script Started'
    }));

    let videoExtracted = false;
    let recordingStarted = false;

    // Video elementini bul ve blob'u çıkar
    async function extractVideo() {
      try {
        if (videoExtracted || recordingStarted) return;

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG',
          message: '🔍 Video aranıyor...'
        }));

        const videos = document.querySelectorAll('video');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG',
          message: '📹 ' + videos.length + ' video bulundu'
        }));

        if (videos.length === 0) return;

        // Tüm videoları detaylı incele
        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          const src = video.src || '';
          const currentSrc = video.currentSrc || '';

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: 'Video[' + i + ']: src=' + src.substring(0, 50) + ', currentSrc=' + currentSrc.substring(0, 50) + ', readyState=' + video.readyState
          }));

          // Source elementlerini kontrol et
          const sources = video.querySelectorAll('source');
          if (sources.length > 0) {
            sources.forEach((source, j) => {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: '  Source[' + j + ']: ' + (source.src || 'none').substring(0, 60)
              }));
            });
          }
        }

        const video = videos[0];
        const src = video.src || video.currentSrc || '';

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG',
          message: '🎯 Seçilen video src: ' + src.substring(0, 80)
        }));

        // Video'yu oynat
        video.muted = true;
        video.play().catch(() => {});

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG',
          message: '▶️ Video oynatılıyor'
        }));

        // Method 1: MediaRecorder ile video yakalama (blob için en iyi yöntem)
        if (src && src.startsWith('blob:')) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: '🎬 Blob video bulundu, MediaRecorder ile yakalanıyor...'
          }));

          try {
            // Video stream'i al
            const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();

            if (!stream) {
              throw new Error('captureStream desteklenmiyor');
            }

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '📹 Video stream alındı, kayıt başlatılıyor...'
            }));

            const chunks = [];
            const mediaRecorder = new MediaRecorder(stream, {
              mimeType: 'video/webm;codecs=vp8',
              videoBitsPerSecond: 2500000
            });

            let totalRecorded = 0;
            mediaRecorder.ondataavailable = function(e) {
              if (e.data && e.data.size > 0) {
                chunks.push(e.data);
                totalRecorded += e.data.size;
                // Her 500KB'da bir log bas (çok fazla log olmasın)
                if (totalRecorded % (500 * 1024) < 100 * 1024) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'DEBUG',
                    message: '📦 Kaydediliyor: ' + (totalRecorded / 1024 / 1024).toFixed(2) + ' MB'
                  }));
                }
              }
            };

            mediaRecorder.onstop = function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: '✅ Kayıt durduruldu, işleniyor... (' + chunks.length + ' chunk)'
              }));

              if (chunks.length === 0) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ERROR',
                  message: 'Hiç chunk yakalanmadı!'
                }));
                return;
              }

              const blob = new Blob(chunks, { type: 'video/webm' });

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: '📦 Video birleştirildi: ' + (blob.size / 1024 / 1024).toFixed(2) + ' MB'
              }));

              const reader = new FileReader();
              reader.onloadend = function() {
                videoExtracted = true;

                const base64Data = reader.result;
                const chunkSize = 500000; // 500KB parçalar halinde gönder
                const totalChunks = Math.ceil(base64Data.length / chunkSize);

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '📤 Video ' + totalChunks + ' parçada gönderiliyor...'
                }));

                // İlk mesaj: Video bilgisi
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'BLOB_START',
                  totalChunks: totalChunks,
                  size: blob.size,
                  mimeType: 'video/webm',
                  resolution: video.videoWidth + 'x' + video.videoHeight
                }));

                // Base64'ü parçalara böl ve gönder
                for (let i = 0; i < totalChunks; i++) {
                  const chunk = base64Data.substring(i * chunkSize, (i + 1) * chunkSize);

                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'BLOB_CHUNK',
                    chunkIndex: i,
                    totalChunks: totalChunks,
                    data: chunk
                  }));
                }

                // Son mesaj: Tamamlandı
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'BLOB_END',
                  totalChunks: totalChunks
                }));

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '✅ ' + totalChunks + ' parça gönderildi!'
                }));
              };
              reader.readAsDataURL(blob);
            };

            // Video tam oynatılınca durdur (ama Instagram loop yapıyor olabilir)
            video.onended = function() {
              if (mediaRecorder.state === 'recording') {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '⏹️ Video bitti, kayıt durduruluyor...'
                }));
                mediaRecorder.stop();
              }
            };

            // Kayda başla
            mediaRecorder.start(100); // Her 100ms'de chunk kaydet
            recordingStarted = true;

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '🔴 Kayıt başladı! Video sonuna kadar oynatılıyor...'
            }));

            // Video'nun süresini al
            const videoDuration = video.duration || 15; // Default 15 saniye
            const recordTime = Math.min(videoDuration + 1, 60); // Maksimum 60 saniye

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '⏱️ Video süresi: ' + videoDuration.toFixed(1) + 's, ' + recordTime.toFixed(0) + ' saniye kaydedilecek'
            }));

            // Video'yu baştan başlat
            video.currentTime = 0;
            video.loop = false; // Loop'u kapat
            video.play();

            // Video süresi + 1 saniye sonra durdur
            setTimeout(function() {
              if (!videoExtracted && mediaRecorder.state === 'recording') {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '✅ Kayıt tamamlandı (' + recordTime.toFixed(0) + 's), işleniyor...'
                }));
                mediaRecorder.stop();
              }
            }, recordTime * 1000);

            return;

          } catch (err) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '⚠️ MediaRecorder hatası: ' + err.message + ', alternatif yöntem deneniyor...'
            }));
          }
        }

        // Method 2: Direkt .mp4 URL varsa kullan
        if (src && src.includes('.mp4')) {
          videoExtracted = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'VIDEO_FOUND',
            url: src,
            method: 'direct_mp4'
          }));
          return;
        }

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG',
          message: '⚠️ No usable video source'
        }));

      } catch (error) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ERROR',
          message: 'Extract error: ' + error.message
        }));
      }
    }

    // Her 2 saniyede bir dene (sadece kayıt başlayana kadar)
    let attempts = 0;
    const maxAttempts = 15;

    const interval = setInterval(function() {
      attempts++;

      if (videoExtracted || recordingStarted) {
        // Video kaydı başladı, interval'i durdur
        clearInterval(interval);
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ERROR',
          message: 'Video bulunamadı (15 deneme)'
        }));
      } else {
        extractVideo();
      }
    }, 2000);

    // İlk deneme
    setTimeout(extractVideo, 2000);

  } catch (err) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'ERROR',
      message: 'Script error: ' + err.message
    }));
  }
})();
true;
`;
}
