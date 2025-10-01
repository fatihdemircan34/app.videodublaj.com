/**
 * Basitleştirilmiş Instagram Video Downloader
 * Sadece blob extraction
 */

export function getSimpleInjectionScript() {
  return `
(function() {
  console.log('🚀 Simple Script IIFE Started');

  try {
    console.log('🚀 Simple Script Try Block Entered');

    if (typeof window.ReactNativeWebView === 'undefined') {
      console.error('❌ ReactNativeWebView is undefined!');
      return;
    }

    console.log('✅ ReactNativeWebView found');

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

        // Method 1: Blob URL'den direkt fetch (daha hızlı ve güvenilir)
        if (src && src.startsWith('blob:')) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: '🎬 Blob video bulundu, fetch ile alınıyor...'
          }));

          try {
            // Blob URL'den direkt fetch et
            fetch(src)
              .then(response => response.blob())
              .then(blob => {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '✅ Video fetch edildi: ' + (blob.size / 1024 / 1024).toFixed(2) + ' MB'
                }));

                // Base64'e çevir
                const reader = new FileReader();
                reader.onloadend = function() {
                  videoExtracted = true;

                  const base64Data = reader.result;
                  const chunkSize = 2000000; // 2MB chunks
                  const totalChunks = Math.ceil(base64Data.length / chunkSize);

                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'DEBUG',
                    message: '📤 Video ' + totalChunks + ' parçada gönderiliyor...'
                  }));

                  // BLOB_START mesajı
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'BLOB_START',
                    totalChunks: totalChunks,
                    size: blob.size,
                    mimeType: blob.type || 'video/webm',
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

                  // BLOB_END mesajı
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
              })
              .catch(err => {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '⚠️ Fetch hatası: ' + err.message + ', MediaRecorder deneniyor...'
                }));

                // Fetch başarısız olursa MediaRecorder'a düş
                tryMediaRecorder();
              });

            return;

          } catch (err) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '⚠️ Blob fetch hatası: ' + err.message
            }));
            // Hata olursa MediaRecorder dene
            tryMediaRecorder();
          }

          return;
        }

        // Method 2: MediaRecorder ile video yakalama (fallback)
        function tryMediaRecorder() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: '🎬 MediaRecorder ile yakalanıyor...'
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
            let chunkCount = 0;
            mediaRecorder.ondataavailable = function(e) {
              if (e.data && e.data.size > 0) {
                chunks.push(e.data);
                totalRecorded += e.data.size;
                chunkCount++;

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '📦 Chunk #' + chunkCount + ': ' + (e.data.size / 1024).toFixed(1) + ' KB (Toplam: ' + (totalRecorded / 1024 / 1024).toFixed(2) + ' MB)'
                }));
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
                const chunkSize = 2000000; // 2MB parçalar halinde gönder (daha hızlı)
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

            // Kayda başla - Her 1 saniyede data iste
            mediaRecorder.start(1000);
            recordingStarted = true;

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '🔴 Kayıt başladı! Video sonuna kadar oynatılıyor...'
            }));

            // Video'nun süresini al
            const videoDuration = video.duration || 15; // Default 15 saniye
            const recordTime = Math.min(videoDuration + 2, 30); // Maksimum 30 saniye (daha hızlı test)

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '⏱️ Video süresi: ' + videoDuration.toFixed(1) + 's, ' + recordTime.toFixed(0) + ' saniye kaydedilecek'
            }));

            // Video'yu baştan başlat ve agresif oynat
            video.currentTime = 0;
            video.loop = false;
            video.muted = true;
            video.volume = 0;

            // Play'i birden fazla kere dene
            const forcePlay = function() {
              video.play().then(function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '▶️ Video oynatıldı! currentTime: ' + video.currentTime.toFixed(1) + ', paused: ' + video.paused
                }));
              }).catch(function(err) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '⚠️ Video play hatası: ' + err.message
                }));
              });
            };

            forcePlay();
            setTimeout(forcePlay, 500);
            setTimeout(forcePlay, 1000);

            // Her 3 saniyede bir kontrol et ve video duruyorsa tekrar oynat
            const checkInterval = setInterval(function() {
              if (mediaRecorder.state === 'recording') {
                const isPaused = video.paused;
                const currentTime = video.currentTime;

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '⏰ Kayıt: ' + currentTime.toFixed(1) + 's / ' + videoDuration.toFixed(1) + 's | Paused: ' + isPaused + ' | State: ' + video.readyState
                }));

                // Video durmuşsa tekrar oynat
                if (isPaused || currentTime === 0) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'DEBUG',
                    message: '🔄 Video durmuş, yeniden oynatılıyor...'
                  }));
                  video.play();
                }
              }
            }, 3000);

            // Video süresi + 2 saniye sonra durdur
            setTimeout(function() {
              clearInterval(checkInterval);
              if (!videoExtracted && mediaRecorder.state === 'recording') {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '✅ Kayıt tamamlandı (' + recordTime.toFixed(0) + 's), işleniyor...'
                }));
                mediaRecorder.stop();
              } else if (videoExtracted) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '⚠️ Video zaten çıkarıldı, timeout atlandı'
                }));
              } else {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '⚠️ MediaRecorder state: ' + mediaRecorder.state
                }));
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

        // Method 3: Direkt .mp4 URL varsa kullan
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

    // Daha agresif kontrol - her 500ms
    let attempts = 0;
    const maxAttempts = 30; // 15 saniye boyunca dene

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'DEBUG',
      message: '🔄 Video arama başladı (her 500ms)'
    }));

    const interval = setInterval(function() {
      attempts++;

      if (videoExtracted || recordingStarted) {
        // Video kaydı başladı, interval'i durdur
        clearInterval(interval);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG',
          message: '✅ Video bulundu, arama durduruldu'
        }));
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ERROR',
          message: 'Video bulunamadı (' + maxAttempts + ' deneme)'
        }));
      } else {
        extractVideo();
      }
    }, 500);

    // İlk deneme hemen
    setTimeout(extractVideo, 100);

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
