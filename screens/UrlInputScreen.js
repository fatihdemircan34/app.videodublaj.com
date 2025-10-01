import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import instagramDownloader from '../services/instagramDownloader';
import { getSimpleInjectionScript } from '../services/instagramDownloaderSimple';
import { getMediaSourceCaptureScript } from '../services/instagramMediaSourceCapture';
import { getInstagramGraphQLCaptureScript } from '../services/instagramGraphQLCapture';
import { getInstagramEmbedCaptureScript } from '../services/instagramEmbedCapture';

export default function UrlInputScreen({ onVideoDownloaded, onBack }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ stage: '', message: '', progress: 0 });
  const [loadWebView, setLoadWebView] = useState(false);
  const [webViewProgress, setWebViewProgress] = useState(0);
  const [videoQuality, setVideoQuality] = useState('720p'); // 720p, 1080p, original
  const [capturedVideoData, setCapturedVideoData] = useState(null);
  const webViewRef = useRef(null);
  const blobChunksRef = useRef([]);
  const blobMetadataRef = useRef(null);
  const scriptsInjectedRef = useRef(false);
  const videoProcessingRef = useRef(false);

  const handleDownload = async () => {
    if (!url.trim()) {
      Alert.alert('Hata', 'Lütfen bir Instagram URL\'si girin');
      return;
    }

    if (!instagramDownloader.isInstagramUrl(url)) {
      Alert.alert('Hata', 'Geçerli bir Instagram URL\'si girin\n\nÖrnekler:\n- instagram.com/reel/...\n- instagram.com/p/...\n- instagram.com/username');
      return;
    }

    const urlType = instagramDownloader.getUrlType(url);

    // Profil fotoğrafı için direkt indirme
    if (urlType === 'profile') {
      setLoading(true);
      setProgress({ stage: 'loading', message: 'Profil fotoğrafı indiriliyor...', progress: 0 });

      try {
        const result = await instagramDownloader.downloadProfilePhoto(url, (progressData) => {
          setProgress(progressData);
        });

        setLoading(false);
        Alert.alert('Başarılı', `Profil fotoğrafı indirildi!\n\nKullanıcı: @${result.username}`, [
          {
            text: 'Tamam',
            onPress: () => onVideoDownloaded(result.uri),
          },
        ]);
      } catch (error) {
        setLoading(false);
        Alert.alert('Hata', 'Profil fotoğrafı indirilemedi. Hesap özel olabilir.');
      }
      return;
    }

    // Video için - Önce direkt fetch ile dene
    setLoading(true);
    setProgress({ stage: 'loading', message: 'Video bilgisi alınıyor...', progress: 0 });

    try {
      // Shortcode çıkar
      const shortcodeMatch = url.match(/\/(reel|p|tv)\/([^/?]+)/);
      const shortcode = shortcodeMatch ? shortcodeMatch[2] : null;

      if (!shortcode) {
        throw new Error('Video ID bulunamadı');
      }

      console.log('🎯 Fetching video for shortcode:', shortcode);

      // Instagram oembed API - login gerektirmiyor!
      const oembedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;

      console.log('📡 Fetching oembed:', oembedUrl);
      console.log('📡 Shortcode:', shortcode);

      const response = await fetch(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.log('❌ Direct fetch failed, falling back to WebView');
        throw new Error('API failed');
      }

      const data = await response.json();
      console.log('📦 Got JSON data');

      // Video URL'ini bul
      let videoUrl = null;
      let resolution = 'unknown';

      // GraphQL structure
      if (data.graphql?.shortcode_media?.video_url) {
        videoUrl = data.graphql.shortcode_media.video_url;
        resolution = `${data.graphql.shortcode_media.dimensions?.width || 0}x${data.graphql.shortcode_media.dimensions?.height || 0}`;
      }
      // items structure
      else if (data.items?.[0]?.video_versions?.[0]?.url) {
        videoUrl = data.items[0].video_versions[0].url;
        const v = data.items[0].video_versions[0];
        resolution = `${v.width || 0}x${v.height || 0}`;
      }

      if (!videoUrl) {
        console.log('❌ Video URL not found in JSON, falling back to WebView');
        throw new Error('Video URL not found');
      }

      console.log('✅ Found video URL:', videoUrl.substring(0, 80));
      console.log('📐 Resolution:', resolution);

      // Video indir
      setProgress({ stage: 'downloading', message: 'Video indiriliyor...', progress: 10 });

      const videoResponse = await fetch(videoUrl);
      const blob = await videoResponse.blob();

      console.log('✅ Video fetched:', (blob.size / 1024 / 1024).toFixed(2), 'MB');

      setProgress({ stage: 'converting', message: 'Video işleniyor...', progress: 70 });

      // Blob'u base64'e çevir
      const reader = new FileReader();
      reader.onloadend = async function() {
        const base64Data = reader.result;

        setProgress({ stage: 'saving', message: 'Video kaydediliyor...', progress: 90 });

        // Kaydet
        await saveVideoToFile({
          data: base64Data,
          size: blob.size,
          resolution: resolution,
          type: blob.type || 'video/mp4'
        });
      };
      reader.readAsDataURL(blob);

    } catch (error) {
      console.log('⚠️ Direct fetch failed, trying WebView method:', error.message);

      // WebView fallback
      setLoadWebView(true);

      // Ref'leri sıfırla
      scriptsInjectedRef.current = false;
      videoProcessingRef.current = false;
      blobChunksRef.current = [];
      blobMetadataRef.current = null;

      setProgress({ stage: 'loading', message: 'Video yükleniyor (WebView)...', progress: 0 });
    }
  };

  const handleWebViewMessage = async (event) => {
    try {
      console.log('📨 WebView message received:', event.nativeEvent.data);
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'DEBUG') {
        console.log('🔍 DEBUG:', data.message);
        // DEBUG mesajlarını UI'da göster
        setProgress({ stage: 'loading', message: data.message, progress: 0 });
        return;
      }

      // Birden fazla video bulundu - en yüksek kaliteyi otomatik seç
      if (data.type === 'MULTIPLE_VIDEOS_FOUND') {
        console.log('🎬 Multiple videos found:', data.count);

        // En yüksek çözünürlüğü seç (zaten sıralı geliyor)
        const bestVideo = data.videos[0];

        console.log('🎯 Auto-selecting best quality:', bestVideo.width + 'x' + bestVideo.height);

        // WebView'ı kapat
        setLoadWebView(false);
        setLoading(true);
        setProgress({ stage: 'downloading', message: 'Video indiriliyor...', progress: 10 });

        try {
          console.log('📥 Fetching video from URL...');
          const response = await fetch(bestVideo.url);
          const blob = await response.blob();

          console.log('✅ Video fetched:', (blob.size / 1024 / 1024).toFixed(2), 'MB');

          setProgress({ stage: 'converting', message: 'Video işleniyor...', progress: 70 });

          // Blob'u base64'e çevir
          const reader = new FileReader();
          reader.onloadend = async function() {
            const base64Data = reader.result;

            setProgress({ stage: 'saving', message: 'Video kaydediliyor...', progress: 90 });

            // Kaydet
            await saveVideoToFile({
              data: base64Data,
              size: blob.size,
              resolution: bestVideo.width + 'x' + bestVideo.height,
              type: blob.type || 'video/mp4'
            });
          };
          reader.readAsDataURL(blob);

        } catch (error) {
          console.error('❌ GraphQL download error:', error);
          setLoading(false);
          setLoadWebView(false);
          Alert.alert('Hata', 'Video indirilemedi: ' + error.message);
        }

        return;
      }

      // GraphQL Capture - Direkt video URL bulundu!
      if (data.type === 'VIDEO_URL_FOUND') {
        console.log('🎯 GraphQL Video URL found:', data.url.substring(0, 100));
        console.log('📐 Resolution:', data.width + 'x' + data.height);
        console.log('🔧 Method:', data.method);

        // WebView'ı kapat
        setLoadWebView(false);
        setLoading(true);
        setProgress({ stage: 'downloading', message: 'Video indiriliyor...', progress: 10 });

        try {
          // Direkt URL'den fetch ile indir
          console.log('📥 Fetching video from URL...');
          const response = await fetch(data.url);
          const blob = await response.blob();

          console.log('✅ Video fetched:', (blob.size / 1024 / 1024).toFixed(2), 'MB');

          setProgress({ stage: 'converting', message: 'Video işleniyor...', progress: 70 });

          // Blob'u base64'e çevir
          const reader = new FileReader();
          reader.onloadend = async function() {
            const base64Data = reader.result;

            setProgress({ stage: 'saving', message: 'Video kaydediliyor...', progress: 90 });

            // Kaydet
            await saveVideoToFile({
              data: base64Data,
              size: blob.size,
              resolution: data.width + 'x' + data.height,
              type: blob.type || 'video/mp4'
            });
          };
          reader.readAsDataURL(blob);

        } catch (error) {
          console.error('❌ GraphQL download error:', error);
          setLoading(false);
          setLoadWebView(false);
          Alert.alert('Hata', 'Video indirilemedi: ' + error.message);
        }

        return;
      }

      if (data.type === 'VIDEO_FOUND') {
        console.log('✅ Video URL found via', data.method + ':', data.url);

        // WebView'ı gizle
        setLoadWebView(false);
        setProgress({ stage: 'downloading', message: 'Video indiriliyor...', progress: 0 });

        // Video URL'i ile indirmeye devam et
        const result = await instagramDownloader.downloadVideo(url, data.url, (progressData) => {
          setProgress(progressData);
        });

        setLoading(false);

        Alert.alert('Başarılı', 'Video indirildi!', [
          {
            text: 'Tamam',
            onPress: () => onVideoDownloaded(result.uri),
          },
        ]);

      } else if (data.type === 'BLOB_START') {
        console.log('📦 Video parçaları geliyor:', data.totalChunks, 'parça');
        blobChunksRef.current = [];
        blobMetadataRef.current = {
          totalChunks: data.totalChunks,
          size: data.size,
          mimeType: data.mimeType,
          resolution: data.resolution
        };

        // WebView'ı kapat ve loading göster
        setLoadWebView(false);
        setLoading(true);

        setProgress({
          stage: 'downloading',
          message: `Video alınıyor... (0/${data.totalChunks})`,
          progress: 10
        });

      } else if (data.type === 'BLOB_CHUNK') {
        blobChunksRef.current[data.chunkIndex] = data.data;
        const progressPercent = Math.round(((data.chunkIndex + 1) / data.totalChunks) * 100);

        console.log(`📥 Parça ${data.chunkIndex + 1}/${data.totalChunks} alındı`);

        setLoading(true);
        setProgress({
          stage: 'downloading',
          message: `Video alınıyor... (${data.chunkIndex + 1}/${data.totalChunks})`,
          progress: progressPercent
        });

      } else if (data.type === 'BLOB_END') {
        console.log('✅ Tüm parçalar alındı, birleştiriliyor...');

        // Tüm chunk'ları birleştir
        const fullBase64 = blobChunksRef.current.join('');
        const metadata = blobMetadataRef.current;

        console.log('✅ Video yakalandı:', (metadata.size / 1024 / 1024).toFixed(2), 'MB, çözünürlük:', metadata.resolution);

        setLoading(true);
        setProgress({
          stage: 'saving',
          message: 'Video dosyaya kaydediliyor...',
          progress: 98
        });

        // Otomatik kaydet
        await saveVideoToFile({
          data: fullBase64,
          size: metadata.size,
          resolution: metadata.resolution,
          type: metadata.mimeType
        });

        // Temizle
        blobChunksRef.current = [];
        blobMetadataRef.current = null;

      } else if (data.type === 'BLOB_DATA') {
        // Eski tek mesaj yöntemi (geriye dönük uyumluluk)
        const detectedRes = data.resolution || 'unknown';
        console.log('✅ Video yakalandı:', (data.size / 1024 / 1024).toFixed(2), 'MB, çözünürlük:', detectedRes);

        setProgress({
          stage: 'saving',
          message: 'Video kaydediliyor...',
          progress: 95
        });

        // Otomatik kaydet
        await saveVideoToFile({
          data: data.data,
          size: data.size,
          resolution: detectedRes,
          type: data.type
        });

      } else if (data.type === 'ERROR') {
        console.error('❌ WebView error:', data.message);
        throw new Error(data.message);
      }

    } catch (error) {
      setLoadWebView(false);
      setLoading(false);
      Alert.alert('Hata', error.message);
      console.error('❌ WebView error:', error);
    }
  };

  const handleWebViewError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('❌ WebView loading error:', nativeEvent);

    // Instagram deep link/app store redirect'lerini ignore et
    if (nativeEvent.description &&
        (nativeEvent.description.includes('ERR_UNKNOWN_URL_SCHEME') ||
         nativeEvent.description.includes('itms-apps'))) {
      console.log('⚠️ Ignoring app redirect, continuing...');
      return;
    }

    // Diğer hatalar için WebView'ı kapat
    setLoadWebView(false);
    setLoading(false);
    Alert.alert('Hata', 'Instagram sayfası yüklenemedi. Lütfen tekrar deneyin.');
  };

  const handleWebViewConsole = (event) => {
    console.log('🌐 WebView console:', event.nativeEvent.message);
  };

  const handleWebViewLoad = () => {
    console.log('📄 WebView page loaded');

    // Sadece bir kez script inject et
    if (scriptsInjectedRef.current) {
      console.log('⚠️ Scripts already injected, skipping...');
      return;
    }

    scriptsInjectedRef.current = true;
    console.log('✅ First load, injecting scripts...');

    if (webViewRef.current) {
      // ÖNCELİKLE GraphQL Capture - Instagram'ın API çağrılarını yakala
      console.log('🎯 Injecting GraphQL capture script...');
      const graphqlScript = getInstagramGraphQLCaptureScript();
      webViewRef.current.injectJavaScript(graphqlScript);
      console.log('✅ GraphQL capture script injected');

      // Test mesajı - script çalışıyor mu?
      const testScript = `
        (function() {
          console.log('🧪 TEST: JavaScript çalışıyor!');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: '🧪 TEST: React Native bridge çalışıyor!'
          }));
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(testScript);
      console.log('🧪 Test script injected');

      // Fallback script'leri devre dışı bırakıldı - GraphQL capture yeterli
      console.log('ℹ️ Fallback scripts disabled - using GraphQL only');

      /*
      console.log('💉 Injecting fallback script...');

      // Önce script'in geldiğini kontrol et
      const script = getSimpleInjectionScript();
      console.log('📏 Script length:', script.length);

      // Basit inline script dene
      const inlineScript_DISABLED = `
        (function() {
          console.log('📍 INLINE SCRIPT WORKING!');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: '📍 INLINE: Video aranıyor...'
          }));

          let recordingStarted = false;
          let processingStarted = false;

          // Video ara
          const checkInterval = setInterval(function() {
            if (processingStarted) {
              clearInterval(checkInterval);
              return;
            }

            const videos = document.querySelectorAll('video');
            if (videos.length > 0) {
              const video = videos[0];
              const src = video.src || video.currentSrc || '';

              // Blob video bulundu mu?
              if (src.startsWith('blob:') && !processingStarted && !recordingStarted) {
                processingStarted = true;
                clearInterval(checkInterval);

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '🎬 Blob bulundu! İşleniyor... (processingStarted=true)'
                }));

                // Video'yu zorla oynat - agresif mod
                video.muted = true;
                video.volume = 0;
                video.loop = false;
                video.autoplay = true;

                // Play'i agresif şekilde zorla
                const forcePlay = function() {
                  if (video.paused) {
                    video.play().catch(function(e) {
                      console.log('Play error:', e.message);
                    });
                  }
                };

                // Sürekli play dene
                forcePlay();
                const playInterval = setInterval(forcePlay, 100);

                // 2 saniye sonra play interval'i durdur ve kayda başla
                setTimeout(function() {
                  clearInterval(playInterval);

                  if (video.paused) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'ERROR',
                      message: 'Video hala duruyor! Paused: ' + video.paused
                    }));
                    return;
                  }

                  // Sadece bir kez kayıt başlat
                  if (recordingStarted) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'DEBUG',
                      message: '⚠️ Kayıt zaten başlatılmış, atlandı'
                    }));
                    return;
                  }
                  recordingStarted = true;

                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'DEBUG',
                    message: '⏮️ Video başa sarılıyor...'
                  }));

                  // Video'yu durdur ve başa sar
                  video.pause();
                  video.currentTime = 0;

                  // Kısa bekle, sonra kayda başla
                  setTimeout(function() {
                    try {
                      // MediaRecorder ile kaydet
                      const stream = video.captureStream();
                      const chunks = [];
                      const recorder = new MediaRecorder(stream, {
                        mimeType: 'video/webm;codecs=vp8',
                        videoBitsPerSecond: 2500000
                      });

                      recorder.ondataavailable = function(e) {
                        if (e.data && e.data.size > 0) {
                          chunks.push(e.data);
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'DEBUG',
                            message: '📦 Chunk alındı: ' + (e.data.size / 1024).toFixed(1) + ' KB (Toplam: ' + chunks.length + ')'
                          }));
                        }
                      };

                      recorder.onstop = function() {
                        const blob = new Blob(chunks, { type: 'video/webm' });
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'DEBUG',
                          message: '✅ Kayıt tamamlandı: ' + (blob.size / 1024 / 1024).toFixed(2) + ' MB (' + chunks.length + ' chunk)'
                        }));

                        if (blob.size === 0) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'ERROR',
                            message: 'Video boş! Hiç chunk kaydedilemedi.'
                          }));
                          return;
                        }

                        const reader = new FileReader();
                        reader.onloadend = function() {
                          const base64 = reader.result;
                          const chunkSize = 10000000; // 10MB chunks - çok hızlı
                          const totalChunks = Math.ceil(base64.length / chunkSize);

                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'BLOB_START',
                            totalChunks: totalChunks,
                            size: blob.size,
                            mimeType: 'video/webm',
                            resolution: video.videoWidth + 'x' + video.videoHeight
                          }));

                          for (let i = 0; i < totalChunks; i++) {
                            const chunk = base64.substring(i * chunkSize, (i + 1) * chunkSize);
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                              type: 'BLOB_CHUNK',
                              chunkIndex: i,
                              totalChunks: totalChunks,
                              data: chunk
                            }));
                          }

                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'BLOB_END',
                            totalChunks: totalChunks
                          }));
                        };
                        reader.readAsDataURL(blob);
                      };

                      // Kayda başla
                      recorder.start(1000);

                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'DEBUG',
                        message: '🔴 Kayıt başladı! Video baştan oynatılıyor...'
                      }));

                      // Video'yu tekrar oynat (baştan)
                      video.play().then(function() {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'DEBUG',
                          message: '▶️ Video baştan oynatılıyor! CurrentTime: ' + video.currentTime.toFixed(1)
                        }));
                      }).catch(function(e) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'ERROR',
                          message: 'Video play hatası: ' + e.message
                        }));
                      });

                      // 15 saniye sonra durdur
                      setTimeout(function() {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'DEBUG',
                          message: '⏹️ Kayıt durduruluyor... Son pozisyon: ' + video.currentTime.toFixed(1) + 's'
                        }));
                        recorder.stop();
                        video.pause();
                      }, 15000);

                    } catch (err) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'ERROR',
                        message: 'MediaRecorder hatası: ' + err.message
                      }));
                    }
                  }, 300);
                }, 2000);
              }
            }
          }, 500);
        })();
        true;
      `;

      // webViewRef.current.injectJavaScript(inlineScript_DISABLED);
      // console.log('✅ Inline script injected');
      */

      // Popup temizleme script'i - bu aktif kalabilir
      const cleanupScript = `
        (function() {
          console.log('🧹 Cleaning up popups...');

          // Her 1 saniyede popup temizle (agresif)
          const cleanupInterval = setInterval(function() {
            // Login popup close butonları
            const closeButtons = document.querySelectorAll('svg[aria-label="Close"], button[aria-label="Close"], [aria-label="Kapat"]');
            if (closeButtons.length > 0) {
              console.log('❌ ' + closeButtons.length + ' close butonu bulundu, tıklanıyor...');
              closeButtons.forEach(btn => {
                const parent = btn.closest('button') || btn.parentElement;
                if (parent) parent.click();
              });
            }

            // Modal ve overlay'leri gizle
            const modals = document.querySelectorAll('[role="dialog"], [role="presentation"]');
            if (modals.length > 0) {
              console.log('🗑️ ' + modals.length + ' modal gizleniyor...');
              modals.forEach(m => {
                m.style.display = 'none';
                m.remove();
              });
            }

            // "Not Now" butonları
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => {
              const text = (btn.textContent || btn.innerText || '').trim();
              if (text === 'Not Now' || text === 'Şimdi Değil') {
                console.log('❌ "' + text + '" butonu tıklanıyor...');
                btn.click();
              }
            });
          }, 1000);

          // 30 saniye sonra temizliği durdur
          setTimeout(function() {
            clearInterval(cleanupInterval);
            console.log('✅ Popup temizleme durduruldu');
          }, 30000);
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(cleanupScript);
      console.log('✅ Cleanup script injected');

      // Otomatik play - önce video'ya tıkla, sonra play butonu
      const attemptAutoPlay = (attempt = 1) => {
        const autoPlayScript = `
          (function() {
            try {
              console.log('🎬 Auto-play attempt #' + ${attempt});

              let played = false;

              // Önce: Login popup'ı ve overlay'leri kapat
              console.log('🚫 Login popup ve overlay\'ler kapatılıyor...');

              // Login popup close butonunu bul
              const closeButtons = document.querySelectorAll('svg[aria-label="Close"], button[aria-label="Close"], [aria-label="Kapat"]');
              closeButtons.forEach(btn => {
                console.log('❌ Close butonu tıklanıyor...');
                const parent = btn.closest('button') || btn.parentElement;
                if (parent) parent.click();
              });

              // Overlay ve modal'ları gizle
              const overlays = document.querySelectorAll('[role="dialog"], [role="presentation"], [class*="modal"], [class*="Modal"], [class*="overlay"], [class*="Overlay"]');
              overlays.forEach(o => {
                console.log('🗑️ Overlay gizleniyor:', o.className);
                o.style.display = 'none';
                o.style.visibility = 'hidden';
                o.style.opacity = '0';
                o.style.pointerEvents = 'none';
              });

              // "Not Now" butonlarını tıkla
              const notNowButtons = document.querySelectorAll('button');
              notNowButtons.forEach(btn => {
                const text = btn.textContent || btn.innerText;
                if (text && (text.includes('Not Now') || text.includes('Şimdi Değil') || text.includes('Sonra'))) {
                  console.log('❌ "Not Now" butonu tıklanıyor...');
                  btn.click();
                }
              });

              console.log('✅ Popup\'lar temizlendi');

              // Strateji 1: Video elementine tıkla (focus için)
              const videos = document.querySelectorAll('video');
              console.log('📹 Bulunan video sayısı:', videos.length);

              if (videos.length > 0) {
                const video = videos[0];

                // Video elementine tıkla
                console.log('🎯 Video elementine tıklanıyor...');

                // Click event
                video.click();

                // MouseDown/Up event simülasyonu
                const mouseDownEvent = new MouseEvent('mousedown', {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  clientX: 100,
                  clientY: 100
                });
                video.dispatchEvent(mouseDownEvent);

                const mouseUpEvent = new MouseEvent('mouseup', {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  clientX: 100,
                  clientY: 100
                });
                video.dispatchEvent(mouseUpEvent);

                // Touch events
                const touchStartEvent = new TouchEvent('touchstart', {
                  bubbles: true,
                  cancelable: true,
                  touches: [new Touch({
                    identifier: 0,
                    target: video,
                    clientX: 100,
                    clientY: 100
                  })]
                });
                video.dispatchEvent(touchStartEvent);

                const touchEndEvent = new TouchEvent('touchend', {
                  bubbles: true,
                  cancelable: true
                });
                video.dispatchEvent(touchEndEvent);

                console.log('✅ Video elementine tıklandı');

                // 500ms bekle, sonra play butonu ara
                setTimeout(function() {
                  // Strateji 2: Play butonunu bul ve tıkla
                  const allButtons = document.querySelectorAll('button, [role="button"], div[tabindex="0"]');
                  console.log('🔘 Toplam buton sayısı:', allButtons.length);

                  for (let i = 0; i < allButtons.length; i++) {
                    const btn = allButtons[i];

                    // Play butonunu tespit et
                    const hasPlayIcon = btn.querySelector('svg path[d*="M"], svg polygon') ||
                                       btn.innerHTML.includes('Play') ||
                                       btn.innerHTML.includes('Oynat') ||
                                       btn.getAttribute('aria-label')?.includes('Play') ||
                                       btn.getAttribute('aria-label')?.includes('Oynat') ||
                                       btn.getAttribute('aria-label')?.includes('play');

                    if (hasPlayIcon && btn.offsetParent !== null) {
                      console.log('🎯 Play butonu bulundu (index ' + i + '), tıklanıyor...');

                      // Click
                      btn.click();

                      // MouseEvent
                      const clickEvent = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                      });
                      btn.dispatchEvent(clickEvent);

                      // Touch
                      const touchEvent = new TouchEvent('touchstart', {
                        bubbles: true,
                        cancelable: true
                      });
                      btn.dispatchEvent(touchEvent);

                      played = true;
                      console.log('✅ Play butonuna tıklandı');

                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'DEBUG',
                        message: '✅ Video + Play butonu tıklandı (attempt #${attempt})'
                      }));

                      break;
                    }
                  }

                  // Play butonu yoksa direkt video.play()
                  if (!played) {
                    console.log('🎯 Play butonu bulunamadı, direkt video.play() deneniyor...');
                    video.muted = true;
                    video.play().then(() => {
                      console.log('✅ Video direkt oynatıldı');
                      played = true;
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'DEBUG',
                        message: '✅ Video direkt oynatıldı (attempt #${attempt})'
                      }));
                    }).catch(e => {
                      console.log('❌ Video play hatası:', e.message);
                    });
                  }
                }, 500);
              }

            } catch(e) {
              console.log('❌ Auto play error:', e.message);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: '❌ Auto-play hatası: ' + e.message
              }));
            }
          })();
          true;
        `;

        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(autoPlayScript);
        }
      };

      // İlk deneme: 2 saniye sonra
      setTimeout(() => attemptAutoPlay(1), 2000);
      // İkinci deneme: 5 saniye sonra
      setTimeout(() => attemptAutoPlay(2), 5000);
      // Üçüncü deneme: 8 saniye sonra
      setTimeout(() => attemptAutoPlay(3), 8000);

      console.log('✅ Auto-play scripts scheduled');
    }
  };

  const saveVideoToFile = async (videoData) => {
    try {
      // Post ID'yi URL'den çıkar
      const postId = url.match(/\/(reel|p|tv)\/([^/?]+)/)?.[2] || 'unknown';

      // Video tipi WebM ise .webm, değilse .mp4
      const ext = videoData.type && videoData.type.includes('webm') ? 'webm' : 'mp4';
      const fileName = `instagram_${postId}_${videoData.resolution}_${Date.now()}.${ext}`;

      console.log('💾 Saving video:', fileName);
      console.log('🆔 Post ID from URL:', postId);

      // data:video/webm;base64,... formatından base64 kısmını çıkar
      const base64Data = videoData.data.includes(',')
        ? videoData.data.split(',')[1]
        : videoData.data;

      // YENİ EXPO FILESYSTEM API - File class kullan
      // İki parametre: directory (Paths.document) ve filename
      const file = new File(Paths.document, fileName);

      console.log('📝 Creating file:', fileName);

      // Dosyayı oluştur (overwrite: true = varsa üzerine yaz)
      file.create({ overwrite: true });

      console.log('📝 Writing binary data...');

      // Base64 string'i Uint8Array'e çevir
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Binary data'yı yaz
      file.write(bytes);

      console.log('✅ File saved successfully');

      // Dosya boyutunu kontrol et (property, method değil)
      const fileSizeBytes = file.size;

      setLoading(false);
      setLoadWebView(false);
      setProgress({ stage: 'completed', message: 'Video kaydedildi!', progress: 100 });

      const format = ext.toUpperCase();

      console.log('📂 Video konumu:', file.uri);
      console.log('📦 Video boyutu:', (fileSizeBytes / 1024 / 1024).toFixed(2), 'MB');

      // Otomatik olarak paylaşma menüsünü aç
      try {
        const Sharing = await import('expo-sharing');

        if (await Sharing.isAvailableAsync()) {
          Alert.alert(
            'Başarılı',
            `Video indirildi!\n\nVideo ID: ${postId}\nKalite: ${videoData.resolution}\nBoyut: ${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB\nFormat: ${format}\n\n"Dosyalara Kaydet" seçeneğini kullanarak cihazınıza kaydedebilirsiniz.`,
            [
              {
                text: 'Paylaş / Kaydet',
                onPress: async () => {
                  try {
                    await Sharing.shareAsync(file.uri, {
                      dialogTitle: 'Videoyu Kaydet',
                      mimeType: videoData.type || 'video/mp4',
                    });
                    console.log('✅ Video paylaşıldı');
                  } catch (err) {
                    console.error('Paylaşma hatası:', err);
                  }
                  onVideoDownloaded(file.uri);
                },
              },
              {
                text: 'Kapat',
                onPress: () => onVideoDownloaded(file.uri),
                style: 'cancel',
              },
            ]
          );
        } else {
          Alert.alert(
            'Başarılı',
            `Video kaydedildi!\n\nKalite: ${videoData.resolution}\nBoyut: ${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB\n\nKonum: ${file.uri}`,
            [
              {
                text: 'Tamam',
                onPress: () => onVideoDownloaded(file.uri),
              },
            ]
          );
        }
      } catch (err) {
        console.error('Sharing import hatası:', err);
        Alert.alert('Başarılı', 'Video kaydedildi!', [
          { text: 'Tamam', onPress: () => onVideoDownloaded(file.uri) }
        ]);
      }
    } catch (saveError) {
      console.error('❌ Save error:', saveError);
      setLoading(false);
      Alert.alert('Hata', 'Video kaydedilemedi: ' + saveError.message);
    }
  };

  const handlePaste = async () => {
    // Clipboard'dan yapıştırma özelliği için expo-clipboard eklenebilir
    // Şimdilik manuel giriş
  };

  return (
    <View style={styles.container}>
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Geri</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.title}>Instagram İçerik İndirici</Text>
      <Text style={styles.subtitle}>
        Video, Reel ve Profil Fotoğrafı İndirme
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="https://www.instagram.com/reel/..."
          placeholderTextColor="#999"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!loading}
        />
      </View>

      {/* Kalite Seçimi */}
      <View style={styles.qualityContainer}>
        <Text style={styles.qualityLabel}>Video Kalitesi:</Text>
        <View style={styles.qualityButtons}>
          <TouchableOpacity
            style={[styles.qualityButton, videoQuality === '720p' && styles.qualityButtonActive]}
            onPress={() => setVideoQuality('720p')}
          >
            <Text style={[styles.qualityButtonText, videoQuality === '720p' && styles.qualityButtonTextActive]}>
              720p
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.qualityButton, videoQuality === '1080p' && styles.qualityButtonActive]}
            onPress={() => setVideoQuality('1080p')}
          >
            <Text style={[styles.qualityButtonText, videoQuality === '1080p' && styles.qualityButtonTextActive]}>
              1080p
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.qualityButton, videoQuality === 'original' && styles.qualityButtonActive]}
            onPress={() => setVideoQuality('original')}
          >
            <Text style={[styles.qualityButtonText, videoQuality === 'original' && styles.qualityButtonTextActive]}>
              Orijinal
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.qualityHint}>
          {videoQuality === '720p' && '• Orta boyut, iyi kalite (Önerilen)'}
          {videoQuality === '1080p' && '• Büyük boyut, yüksek kalite'}
          {videoQuality === 'original' && '• Instagram\'ın sunduğu en yüksek kalite'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E1306C" />
          <Text style={styles.loadingText}>{progress.message}</Text>
          {(progress.stage === 'downloading' || progress.stage === 'saving') && progress.progress > 0 && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${progress.progress}%` }]} />
            </View>
          )}
          {progress.progress > 0 && (
            <Text style={styles.progressText}>{progress.progress}%</Text>
          )}
        </View>
      ) : (
        <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
          <Text style={styles.downloadButtonText}>İndir</Text>
        </TouchableOpacity>
      )}

      <View style={styles.examplesContainer}>
        <Text style={styles.examplesTitle}>Desteklenen Linkler:</Text>
        <Text style={styles.exampleText}>• instagram.com/reel/ABC123... (Reels)</Text>
        <Text style={styles.exampleText}>• instagram.com/p/ABC123... (Posts)</Text>
        <Text style={styles.exampleText}>• instagram.com/tv/ABC123... (IGTV)</Text>
        <Text style={styles.exampleText}>• instagram.com/username (Profil Fotoğrafı)</Text>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>💡 Nasıl Kullanılır?</Text>
        <Text style={styles.infoText}>
          📹 Video/Reel için:{'\n'}
          1. Instagram'da içeriği açın{'\n'}
          2. Paylaş → Linki Kopyala{'\n'}
          3. Buraya yapıştırın ve İndir{'\n\n'}
          📸 Profil Fotoğrafı için:{'\n'}
          1. Profil sayfasına gidin{'\n'}
          2. URL'yi kopyalayın{'\n'}
          3. Buraya yapıştırın ve İndir
        </Text>
      </View>

      <View style={styles.warningContainer}>
        <Text style={styles.warningTitle}>⚠️ Önemli Not</Text>
        <Text style={styles.warningText}>
          • Sadece public Instagram içerikleri indirilebilir{'\n'}
          • Instagram'ın bot koruması nedeniyle bazen çalışmayabilir{'\n'}
          • İndirme başarısız olursa alternatif yöntem kullanın
        </Text>
      </View>

      <View style={styles.alternativeContainer}>
        <Text style={styles.alternativeTitle}>✅ Önerilen Yöntem</Text>
        <Text style={styles.alternativeText}>
          Instagram videoları için en güvenilir yöntem:{'\n\n'}
          1. 📱 Instagram'da videoyu açın → Paylaş → Linki Kopyala{'\n'}
          2. 🌐 SaveFrom.net, SnapInsta veya InstaDownloader sitelerinden birini açın{'\n'}
          3. 📥 Linki yapıştırın ve videoyu indirin{'\n'}
          4. 📂 Bu uygulamada "Video Seç ve İşle" ile yükleyin{'\n'}
          5. ⚙️ Altyazı ayarlarını yapın ve işleyin
        </Text>
        <TouchableOpacity
          style={styles.backToMainButton}
          onPress={onBack}
        >
          <Text style={styles.backToMainButtonText}>← Ana Ekrana Dön</Text>
        </TouchableOpacity>
      </View>

      {/* Mini WebView - Video oynatma için küçük görünür alan */}
      {loadWebView && (
        <View style={styles.miniWebViewContainer}>
          <View style={styles.miniHeader}>
            <Text style={styles.miniTitle}>📥 {progress.message || 'İndiriliyor...'}</Text>
            {progress.progress > 0 && (
              <Text style={styles.miniProgress}>{progress.progress}%</Text>
            )}
          </View>
          <WebView
            ref={webViewRef}
            source={{ uri: url.replace(/\/(reel|p|tv)\/([^/?]+)/, '/p/$2/embed/captioned/') }}
            style={styles.miniWebView}
            injectedJavaScriptBeforeContentLoaded={getInstagramEmbedCaptureScript()}
            onMessage={handleWebViewMessage}
            onLoad={handleWebViewLoad}
            onLoadProgress={({ nativeEvent }) => setWebViewProgress(nativeEvent.progress * 100)}
            onError={handleWebViewError}
            onHttpError={handleWebViewError}
            onConsoleMessage={(event) => {
              const msg = event.nativeEvent.message;
              console.log('🌐 WebView Console:', msg);

              // Console'dan gelen önemli mesajları React Native tarafına da aktar
              if (msg.includes('Video') || msg.includes('Blob') || msg.includes('Error')) {
                console.log('⚠️ Important:', msg);
              }
            }}
            onNavigationStateChange={(navState) => {
              // URL değişikliklerini logla - yönlendirmeleri yakalayalım
              console.log('🧭 Navigation:', navState.url);
              console.log('🎯 Original URL:', url);

              // Trailing slash farklarını görmezden gel
              const normalizeUrl = (u) => u.replace(/\/$/, '');

              if (normalizeUrl(navState.url) !== normalizeUrl(url)) {
                console.log('⚠️ URL CHANGED! Original:', url);
                console.log('⚠️ URL CHANGED! Current:', navState.url);

                // Post ID'leri çıkar ve karşılaştır
                const originalId = url.match(/\/(reel|p|tv)\/([^/?]+)/)?.[2];
                const currentId = navState.url.match(/\/(reel|p|tv)\/([^/?]+)/)?.[2];

                console.log('📍 Original Post ID:', originalId);
                console.log('📍 Current Post ID:', currentId);

                if (originalId && currentId && originalId !== currentId) {
                  Alert.alert(
                    '⚠️ Farklı Video!',
                    `Girilen video ID: ${originalId}\n\nYüklenen video ID: ${currentId}\n\n❌ Instagram farklı bir içeriğe yönlendirdi!`,
                    [
                      { text: 'İptal Et', onPress: () => { setLoadWebView(false); setLoading(false); } },
                      { text: 'Devam Et', style: 'cancel' }
                    ]
                  );
                }
              }
            }}
            onShouldStartLoadWithRequest={(request) => {
              console.log('📍 Loading:', request.url.substring(0, 80));

              // Instagram deep link ve app store yönlendirmelerini engelle
              if (request.url.startsWith('instagram://') ||
                  request.url.startsWith('itms-appss://') ||
                  request.url.includes('apps.apple.com') ||
                  request.url.includes('play.google.com')) {
                console.log('🚫 Blocked redirect:', request.url.substring(0, 50));
                return false;
              }
              return true;
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            mixedContentMode="always"
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            cacheEnabled={true}
            incognito={false}
            setSupportMultipleWindows={false}
            userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            originWhitelist={['*']}
            allowsFullscreenVideo={true}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  backButton: {
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#E1306C',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E1306C',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  qualityContainer: {
    marginBottom: 20,
  },
  qualityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  qualityButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  qualityButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  qualityButtonActive: {
    borderColor: '#E1306C',
    backgroundColor: '#FFE5EE',
  },
  qualityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  qualityButtonTextActive: {
    color: '#E1306C',
  },
  qualityHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  downloadButton: {
    backgroundColor: '#E1306C',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginTop: 15,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#E1306C',
    borderRadius: 4,
  },
  progressText: {
    marginTop: 10,
    fontSize: 14,
    color: '#E1306C',
    fontWeight: 'bold',
  },
  examplesContainer: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  exampleText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  infoContainer: {
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#2E7D32',
    lineHeight: 22,
  },
  warningContainer: {
    backgroundColor: '#FFF3CD',
    padding: 15,
    borderRadius: 12,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F57C00',
    marginBottom: 10,
  },
  warningText: {
    fontSize: 13,
    color: '#E65100',
    lineHeight: 20,
  },
  alternativeContainer: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 12,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  alternativeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 10,
  },
  alternativeText: {
    fontSize: 14,
    color: '#0D47A1',
    lineHeight: 22,
    marginBottom: 15,
  },
  backToMainButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  backToMainButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  webViewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 1000,
  },
  webViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingVertical: 25,
    backgroundColor: '#E1306C',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    minHeight: 100,
  },
  webViewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
  },
  instructionContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  instructionSubtext: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 10,
  },
  captureDownloadButton: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  captureDownloadButtonText: {
    color: '#E1306C',
    fontSize: 16,
    fontWeight: '700',
  },
  webViewCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webViewCloseText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  webView: {
    flex: 1,
  },
  webViewFooter: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  webViewHint: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  webViewProgressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  webViewProgressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  miniWebViewContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 200,
    height: 150,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  miniHeader: {
    backgroundColor: '#E1306C',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniTitle: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  miniProgress: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  miniWebView: {
    flex: 1,
    backgroundColor: '#000',
  },
});