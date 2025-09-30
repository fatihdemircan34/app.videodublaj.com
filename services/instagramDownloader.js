import * as FileSystem from 'expo-file-system';
import * as shaonVideosDownloader from 'shaon-videos-downloader';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Instagram video downloader service
 * shaon-videos-downloader paketi kullanarak video indirme
 */

class InstagramDownloader {
  constructor() {
    this.webViewRef = null;
    this.rapidApiKey = null;
    this.cacheKey = '@instagram_downloader_cache';
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 saat
  }

  setWebViewRef(ref) {
    this.webViewRef = ref;
  }

  setRapidApiKey(key) {
    this.rapidApiKey = key;
  }

  /**
   * shaon-videos-downloader paketi ile video URL al
   */
  async getVideoUrlWithShaon(instagramUrl, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`📦 Using shaon-videos-downloader... (Attempt ${attempt}/${retries})`);

        // shaonVideosDownloader doğrudan fonksiyon olarak çağrılabilir
        let downloadFunc = shaonVideosDownloader;

        // Eğer default export varsa onu kullan
        if (shaonVideosDownloader.default) {
          downloadFunc = shaonVideosDownloader.default;
        }

        // Eğer instagram fonksiyonu varsa onu kullan
        if (shaonVideosDownloader.instagram) {
          downloadFunc = shaonVideosDownloader.instagram;
        }

        console.log('📦 Shaon function type:', typeof downloadFunc);

        const result = await Promise.race([
          downloadFunc(instagramUrl),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout after 30s')), 30000)
          )
        ]);

        console.log('📦 Shaon result:', JSON.stringify(result).substring(0, 200));

        // Farklı response formatlarını kontrol et
        let videoUrl = null;

        if (result) {
          if (result.video && Array.isArray(result.video) && result.video.length > 0) {
            videoUrl = result.video[0].url || result.video[0];
          } else if (result.video && typeof result.video === 'string') {
            videoUrl = result.video;
          } else if (result.url) {
            videoUrl = result.url;
          } else if (result.download_url) {
            videoUrl = result.download_url;
          } else if (typeof result === 'string') {
            videoUrl = result;
          }
        }

        if (videoUrl) {
          console.log('✅ Got video URL from shaon:', videoUrl.substring(0, 80));
          return videoUrl;
        }

        throw new Error('Shaon ile video URL bulunamadı');
      } catch (error) {
        console.error(`❌ Shaon error (Attempt ${attempt}/${retries}):`, error.message);

        if (attempt === retries) {
          throw error;
        }

        // Retry için 2 saniye bekle
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * RapidAPI kullanarak video indir (Instagram Downloader API)
   */
  async downloadWithRapidAPI(instagramUrl) {
    if (!this.rapidApiKey) {
      throw new Error('RapidAPI key bulunamadı. Lütfen ayarlardan API key girin.');
    }

    try {
      console.log('🔑 Using RapidAPI to download...');

      const videoId = this.extractVideoId(instagramUrl);

      // Instagram Downloader API
      const apiUrl = `https://instagram-downloader-download-instagram-videos-stories.p.rapidapi.com/index?url=${encodeURIComponent(instagramUrl)}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'instagram-downloader-download-instagram-videos-stories.p.rapidapi.com',
        },
      });

      if (!response.ok) {
        throw new Error(`RapidAPI error: ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 RapidAPI response:', data);

      // Video URL'ini çıkar (API response formatına göre)
      let videoUrl = null;

      if (data.video_url) {
        videoUrl = data.video_url;
      } else if (data.media && data.media[0] && data.media[0].url) {
        videoUrl = data.media[0].url;
      } else if (data.result && data.result.video) {
        videoUrl = data.result.video;
      }

      if (!videoUrl) {
        throw new Error('RapidAPI\'den video URL\'si alınamadı');
      }

      console.log('✅ Got video URL from RapidAPI:', videoUrl);
      return videoUrl;

    } catch (error) {
      console.error('❌ RapidAPI error:', error);
      throw error;
    }
  }

  /**
   * Instagram URL'inden video ID'sini çıkarır
   */
  extractVideoId(url) {
    const patterns = [
      /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
      /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
      /instagram\.com\/tv\/([A-Za-z0-9_-]+)/,
      /instagram\.com\/stories\/[^/]+\/([A-Za-z0-9_-]+)/,
      /instagr\.am\/p\/([A-Za-z0-9_-]+)/,
      /instagr\.am\/reel\/([A-Za-z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    throw new Error('Geçersiz Instagram URL');
  }

  /**
   * Instagram profil URL'inden kullanıcı adını çıkarır
   */
  extractUsername(url) {
    const patterns = [
      /instagram\.com\/([a-zA-Z0-9._]+)\/?$/,
      /instagram\.com\/([a-zA-Z0-9._]+)\/$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1] && !['p', 'reel', 'tv', 'stories', 'explore'].includes(match[1])) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Instagram profil fotoğrafını indir
   */
  async downloadProfilePhoto(instagramUrl, onProgress) {
    try {
      const username = this.extractUsername(instagramUrl);

      if (!username) {
        throw new Error('Geçersiz Instagram profil URL\'si');
      }

      console.log('📸 Downloading profile photo for:', username);
      onProgress?.({ stage: 'loading', message: 'Profil fotoğrafı aranıyor...', progress: 0 });

      // Instagram public profile JSON API
      const profileUrl = `https://www.instagram.com/${username}/?__a=1&__d=dis`;

      const response = await fetch(profileUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!response.ok) {
        throw new Error('Profil bilgisi alınamadı');
      }

      const data = await response.json();

      // Profil fotoğrafı URL'sini bul
      let photoUrl = null;

      if (data.graphql?.user?.profile_pic_url_hd) {
        photoUrl = data.graphql.user.profile_pic_url_hd;
      } else if (data.user?.profile_pic_url_hd) {
        photoUrl = data.user.profile_pic_url_hd;
      } else if (data.graphql?.user?.profile_pic_url) {
        photoUrl = data.graphql.user.profile_pic_url;
      }

      if (!photoUrl) {
        throw new Error('Profil fotoğrafı bulunamadı');
      }

      console.log('✅ Found profile photo URL');
      onProgress?.({ stage: 'downloading', message: 'Profil fotoğrafı indiriliyor...', progress: 50 });

      // Fotoğrafı indir
      const fileName = `instagram_${username}_profile_${Date.now()}.jpg`;
      const fileUri = FileSystem.documentDirectory + fileName;

      const downloadResumable = FileSystem.createDownloadResumable(
        photoUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const progress = 50 + (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 50;
          onProgress?.({
            stage: 'downloading',
            message: 'Profil fotoğrafı indiriliyor...',
            progress: Math.round(progress)
          });
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (!result) {
        throw new Error('Profil fotoğrafı indirilemedi');
      }

      onProgress?.({ stage: 'completed', message: 'Profil fotoğrafı indirildi!', progress: 100 });

      return {
        uri: result.uri,
        fileName: fileName,
        username: username,
        type: 'photo',
      };

    } catch (error) {
      console.error('Profile photo download error:', error);
      throw new Error(error.message || 'Profil fotoğrafı indirilemedi');
    }
  }

  /**
   * WebView injection script - Instagram sayfasından video URL'sini çıkarır
   * Blob URL'ler yerine gerçek network isteklerini yakalar
   */
  getInjectedJavaScript() {
    return `
      (function() {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: '🚀 Instagram Video Interceptor Started'
          }));
        } catch (e) {
          console.error('Startup error:', e);
        }

        let capturedVideoUrl = null;
        let attempts = 0;
        const maxAttempts = 20;
        let videoElement = null;

        // Network request interception - TÜM istekleri logla ve video URL'lerini yakala
        (function setupInterceptors() {
          let requestCount = 0;

          // XHR interception
          const originalXhrOpen = XMLHttpRequest.prototype.open;
          const originalXhrSend = XMLHttpRequest.prototype.send;

          XMLHttpRequest.prototype.open = function(method, url) {
            this._requestUrl = url;
            this._requestMethod = method;
            return originalXhrOpen.apply(this, arguments);
          };

          XMLHttpRequest.prototype.send = function() {
            const self = this;
            const requestUrl = this._requestUrl;

            // Her isteği logla
            requestCount++;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: 'XHR #' + requestCount + ': ' + (requestUrl ? requestUrl.substring(0, 60) : 'unknown')
            }));

            this.addEventListener('readystatechange', function() {
              if (self.readyState === 4 && requestUrl) {
                const url = requestUrl.toString();

                // Instagram video URL patterns
                if ((url.includes('.mp4') || url.includes('.m3u8') ||
                     url.includes('cdninstagram') || url.includes('fbcdn') ||
                     url.includes('scontent')) &&
                    !capturedVideoUrl) {
                  capturedVideoUrl = url;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'VIDEO_FOUND',
                    url: url,
                    method: 'xhr_intercept'
                  }));
                }
              }
            });
            return originalXhrSend.apply(this, arguments);
          };

          // Fetch interception
          const originalFetch = window.fetch;
          window.fetch = function(url, options) {
            const urlStr = typeof url === 'string' ? url : (url.url || url.toString());

            // Her isteği logla
            requestCount++;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: 'FETCH #' + requestCount + ': ' + urlStr.substring(0, 60)
            }));

            // Instagram video URL patterns
            if ((urlStr.includes('.mp4') || urlStr.includes('.m3u8') ||
                 urlStr.includes('cdninstagram') || urlStr.includes('fbcdn') ||
                 urlStr.includes('scontent')) &&
                !capturedVideoUrl) {
              capturedVideoUrl = urlStr;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'VIDEO_FOUND',
                url: urlStr,
                method: 'fetch_intercept'
              }));
            }

            return originalFetch.apply(this, arguments);
          };

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: '✅ Network Interceptors Installed'
          }));
        })();

        function findAndTriggerVideo() {
          attempts++;

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: '🔍 Attempt ' + attempts + '/' + maxAttempts
          }));

          try {
            // Zaten bulunduysa dur
            if (capturedVideoUrl) {
              return true;
            }

            // Video elementini bul
            const videoElements = document.querySelectorAll('video');

            if (videoElements.length > 0) {
              videoElement = videoElements[0];

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: '📹 Video found, src: ' + (videoElement.src ? videoElement.src.substring(0, 50) : 'blob')
              }));

              // Tüm video elementlerini kontrol et
              for (let i = 0; i < videoElements.length; i++) {
                const vid = videoElements[i];

                // Mute ve autoplay
                vid.muted = true;
                vid.loop = false;
                vid.autoplay = true;
                vid.controls = false;

                // Play trigger
                vid.play().then(function() {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'DEBUG',
                    message: '▶️ Video #' + i + ' playing'
                  }));
                }).catch(function(e) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'DEBUG',
                    message: '⚠️ Play failed #' + i + ': ' + e.message
                  }));
                });

                // Video src direkt .mp4 ise (blob değilse)
                if (vid.src && !vid.src.startsWith('blob:') && (vid.src.includes('.mp4') || vid.src.includes('cdninstagram'))) {
                  capturedVideoUrl = vid.src;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'VIDEO_FOUND',
                    url: vid.src,
                    method: 'video_element_direct'
                  }));
                  return true;
                }

                // currentSrc kontrol et
                if (vid.currentSrc && !vid.currentSrc.startsWith('blob:') && (vid.currentSrc.includes('.mp4') || vid.currentSrc.includes('cdninstagram'))) {
                  capturedVideoUrl = vid.currentSrc;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'VIDEO_FOUND',
                    url: vid.currentSrc,
                    method: 'video_currentSrc'
                  }));
                  return true;
                }
              }
            }

            // Method 2: Meta tags
            const metaTags = document.querySelectorAll('meta[property="og:video"], meta[property="og:video:secure_url"]');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: 'Meta tags found: ' + metaTags.length
            }));

            if (metaTags.length > 0) {
              const videoUrl = metaTags[0].content;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: 'Meta video URL: ' + videoUrl
              }));

              if (videoUrl && videoUrl.length > 0) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'VIDEO_FOUND',
                  url: videoUrl,
                  method: 'meta_tag'
                }));
                return true;
              }
            }

            // Method 3: React/Redux state'den video URL çıkar (Instagram modern yapısı)
            try {
              // Instagram'ın global state'ini kontrol et
              const stateKeys = Object.keys(window);
              for (let key of stateKeys) {
                if (key.startsWith('__') || key.includes('State') || key.includes('Redux')) {
                  try {
                    const stateObj = window[key];
                    const stateStr = JSON.stringify(stateObj);

                    // video_url pattern'ini ara
                    const videoUrlMatch = stateStr.match(/"video_url"\\s*:\\s*"([^"]+)"/);
                    if (videoUrlMatch && videoUrlMatch[1]) {
                      const videoUrl = videoUrlMatch[1].replace(/\\\\u0026/g, '&').replace(/\\\\\\\\/g, '/');
                      if (videoUrl.includes('.mp4')) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'VIDEO_FOUND',
                          url: videoUrl,
                          method: 'react_state'
                        }));
                        return true;
                      }
                    }
                  } catch (e) {
                    // State parse edilemedi, devam et
                  }
                }
              }
            } catch (e) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: 'React state search error: ' + e.message
              }));
            }

            // Method 4: Page HTML içinde video URL ara
            const bodyHtml = document.body.innerHTML;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: 'Body HTML length: ' + bodyHtml.length
            }));

            // Instagram CDN URL'lerini ara - Daha kapsamlı pattern'ler
            const cdnPatterns = [
              /https?:\\\\/\\\\/[^"'\\\\s]*cdninstagram[^"'\\\\s]*\\\\.mp4[^"'\\\\s]*/gi,
              /https?:\\\\/\\\\/[^"'\\\\s]*fbcdn[^"'\\\\s]*\\\\.mp4[^"'\\\\s]*/gi,
              /https?:\\\\/\\\\/[^"'\\\\s]*instagram[^"'\\\\s]*video[^"'\\\\s]*\\\\.mp4[^"'\\\\s]*/gi,
              /https?:\\\\/\\\\/scontent[^"'\\\\s]*\\\\.mp4[^"'\\\\s]*/gi,
              /https?:\\\\/\\\\/video[^"'\\\\s]*\\\\.cdninstagram[^"'\\\\s]*\\\\.mp4[^"'\\\\s]*/gi
            ];

            for (let pattern of cdnPatterns) {
              const matches = bodyHtml.match(pattern);
              if (matches && matches.length > 0) {
                let videoUrl = matches[0]
                  .replace(/\\\\u0026/g, '&')
                  .replace(/\\\\\\\\\\\\/g, '/')
                  .replace(/\\\\"/g, '')
                  .replace(/&amp;/g, '&');

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: 'Found CDN URL: ' + videoUrl
                }));

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'VIDEO_FOUND',
                  url: videoUrl,
                  method: 'html_pattern'
                }));
                return true;
              }
            }

            // Method 5: Script tags içindeki JSON data - Geliştirilmiş
            const scripts = document.querySelectorAll('script[type="application/ld+json"], script:not([src])');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: 'Script tags found: ' + scripts.length
            }));

            for (let script of scripts) {
              const text = script.textContent || script.innerHTML;

              if (text.includes('video_url') || text.includes('contentUrl') || text.includes('playbackUrl') || text.includes('.mp4')) {
                // playbackUrl pattern (Instagram'ın GraphQL response'ında)
                let match = text.match(/"playbackUrl"\\\\s*:\\\\s*"([^"]+)"/);
                if (match && match[1]) {
                  let videoUrl = match[1].replace(/\\\\u0026/g, '&').replace(/\\\\\\\\\\\\/g, '/').replace(/\\\\\\\\u0026/g, '&');
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'VIDEO_FOUND',
                    url: videoUrl,
                    method: 'script_playback_url'
                  }));
                  return true;
                }

                // video_url pattern
                match = text.match(/"video_url"\\\\s*:\\\\s*"([^"]+)"/);
                if (match && match[1]) {
                  let videoUrl = match[1].replace(/\\\\u0026/g, '&').replace(/\\\\\\\\\\\\/g, '/');
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'VIDEO_FOUND',
                    url: videoUrl,
                    method: 'script_video_url'
                  }));
                  return true;
                }

                // contentUrl pattern (LD+JSON)
                match = text.match(/"contentUrl"\\\\s*:\\\\s*"([^"]+)"/);
                if (match && match[1]) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'VIDEO_FOUND',
                    url: match[1],
                    method: 'script_content_url'
                  }));
                  return true;
                }

                // Direct .mp4 URL pattern - Daha geniş
                match = text.match(/https?:\\\\/\\\\/[^"'\\\\s]*\\\\.mp4[^"'\\\\s]*/i);
                if (match && match[0]) {
                  let videoUrl = match[0].replace(/\\\\u0026/g, '&').replace(/\\\\\\\\\\\\/g, '/').replace(/\\\\"/g, '');
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'VIDEO_FOUND',
                    url: videoUrl,
                    method: 'script_mp4_pattern'
                  }));
                  return true;
                }
              }
            }

            // Henüz bulunamadı, tekrar dene
            if (attempts < maxAttempts) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: 'Video not found yet, will retry in 1.5s'
              }));
              setTimeout(findVideo, 1500);
              return false;
            }

            // Max attempts reached
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ERROR',
              message: 'Video URL bulunamadı (' + attempts + ' deneme yapıldı)'
            }));
            return false;

          } catch (error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: 'Error in findVideo: ' + error.message
            }));

            if (attempts < maxAttempts) {
              setTimeout(findVideo, 1500);
              return false;
            }

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ERROR',
              message: error.message
            }));
            return false;
          }
        }

            // Retry yoksa devam et
            if (attempts < maxAttempts) {
              setTimeout(findAndTriggerVideo, 2000);
              return false;
            }

            // Max attempts
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ERROR',
              message: 'Video URL bulunamadı (' + attempts + ' deneme)'
            }));
            return false;

          } catch (error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ERROR',
              message: 'Hata: ' + error.message
            }));

            if (attempts < maxAttempts) {
              setTimeout(findAndTriggerVideo, 2000);
            }
            return false;
          }
        }

        // Blob URL'den gerçek video data'yı çıkar
        async function extractBlobUrl() {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '🔍 Starting blob extraction...'
            }));

            const videoElements = document.querySelectorAll('video');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '📹 Found ' + videoElements.length + ' video elements'
            }));

            if (videoElements.length === 0) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'ERROR',
                message: 'No video element found'
              }));
              return;
            }

            const videoElement = videoElements[0];
            const blobUrl = videoElement.src;

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '📎 Video src: ' + (blobUrl || 'EMPTY').substring(0, 50)
            }));

            if (!blobUrl || !blobUrl.startsWith('blob:')) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'ERROR',
                message: 'Not a blob URL: ' + (blobUrl || 'empty')
              }));
              return;
            }

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '🔄 Fetching blob: ' + blobUrl.substring(0, 40)
            }));

            // Blob URL'den binary data çek
            const response = await fetch(blobUrl);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '✅ Blob fetched, reading as blob...'
            }));

            const blob = await response.blob();

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '📦 Blob received: ' + (blob.size / 1024 / 1024).toFixed(2) + ' MB, type: ' + blob.type
            }));

            // Blob'u Base64'e çevir
            const reader = new FileReader();

            reader.onerror = function(error) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'ERROR',
                message: 'FileReader error: ' + error
              }));
            };

            reader.onloadend = function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: '✅ Base64 conversion done, sending to React Native...'
              }));

              const base64data = reader.result;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'BLOB_DATA',
                data: base64data,
                size: blob.size,
                type: blob.type
              }));
            };

            reader.readAsDataURL(blob);

          } catch (error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ERROR',
              message: 'Blob extraction error: ' + error.message
            }));
          }
        }

        // İlk deneme: Sayfa yüklenince başla
        setTimeout(findAndTriggerVideo, 2000);

        // Video trigger loop - Daha agresif
        let triggerCount = 0;
        const triggerInterval = setInterval(function() {
          triggerCount++;

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: '⏱️ Trigger #' + triggerCount + ', captured: ' + (capturedVideoUrl ? 'YES' : 'NO')
          }));

          if (!capturedVideoUrl && videoElement) {
            videoElement.muted = true;
            videoElement.play().catch(function() {});
          }

          // 3 denemeden sonra blob extraction dene
          if (triggerCount >= 3 && !capturedVideoUrl) {
            clearInterval(triggerInterval);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '🔄 Network capture failed, trying blob extraction...'
            }));
            extractBlobUrl();
          }
        }, 2000);
      })();
      true;
    `;
  }

  /**
   * Instagram oembed API'sini kullanarak video thumbnail'ını al
   * Not: Bu sadece thumbnail verir, tam video için başka yöntemler gerekli
   */
  async getVideoInfoFromOembed(instagramUrl) {
    try {
      const oembedUrl = `https://graph.facebook.com/v12.0/instagram_oembed?url=${encodeURIComponent(instagramUrl)}&access_token=`;

      console.log('🔍 Trying official oembed API:', oembedUrl);

      const response = await fetch(oembedUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📦 Oembed response:', data);
        return data;
      }

      throw new Error('Oembed API failed');
    } catch (error) {
      console.error('❌ Oembed error:', error);
      throw error;
    }
  }

  /**
   * Instagram video URL'sini al - Basit yöntem
   */
  async getVideoUrlFromJson(instagramUrl) {
    try {
      // Instagram post ID'sini çıkar
      const videoId = this.extractVideoId(instagramUrl);

      console.log('🔍 Trying to get video URL for:', videoId);

      // Method 1: Instagram'ın embed sayfasını kullan
      const embedUrl = `https://www.instagram.com/p/${videoId}/embed/captioned`;
      console.log('📱 Fetching embed page...');

      const embedResponse = await fetch(embedUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'text/html',
        },
      });

      if (embedResponse.ok) {
        const html = await embedResponse.text();
        console.log('📄 Got embed HTML, length:', html.length);

        // Embed sayfasında video URL ara
        const videoMatch = html.match(/"video_url":"([^"]+)"/);
        if (videoMatch && videoMatch[1]) {
          const videoUrl = videoMatch[1].replace(/\\\//g, '/');
          console.log('✅ Found video in embed:', videoUrl.substring(0, 80));
          return videoUrl;
        }
      }

      // Method 2: Normal sayfa
      const pageUrl = `https://www.instagram.com/p/${videoId}/`;
      console.log('📱 Fetching normal page...');

      const pageResponse = await fetch(pageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (pageResponse.ok) {
        const html = await pageResponse.text();
        console.log('📄 Got HTML, length:', html.length);

        // Debug: HTML'de .mp4 var mı kontrol et
        const hasMp4 = html.includes('.mp4');
        console.log('🔍 HTML contains .mp4:', hasMp4);

        if (hasMp4) {
          // HTML içinde .mp4 kelimesinin etrafını göster
          const mp4Index = html.indexOf('.mp4');
          const snippet = html.substring(Math.max(0, mp4Index - 100), Math.min(html.length, mp4Index + 100));
          console.log('📝 Snippet around .mp4:', snippet);
        }

        // HTML içinde video URL'lerini ara
        try {
          // Pattern 1: "video_url":"..."
          let matches = html.match(/"video_url"\s*:\s*"([^"]+)"/i);
          console.log('🔍 Pattern 1 (video_url) matches:', matches ? matches.length : 0);
          if (matches && matches[1]) {
            let videoUrl = matches[1]
              .replace(/\\u0026/g, '&')
              .replace(/\\\//g, '/')
              .replace(/\\"/g, '');
            console.log('✅ Found video URL in HTML:', videoUrl.substring(0, 100) + '...');
            return videoUrl;
          }

          // Pattern 2: playbackUrl
          matches = html.match(/"playbackUrl"\s*:\s*"([^"]+\.mp4[^"]*)"/i);
          console.log('🔍 Pattern 2 (playbackUrl) matches:', matches ? matches.length : 0);
          if (matches && matches[1]) {
            let videoUrl = matches[1]
              .replace(/\\u0026/g, '&')
              .replace(/\\\//g, '/')
              .replace(/\\"/g, '');
            console.log('✅ Found video URL in HTML:', videoUrl.substring(0, 100) + '...');
            return videoUrl;
          }

          // Pattern 3: Herhangi bir .mp4 URL
          matches = html.match(/https:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i);
          console.log('🔍 Pattern 3 (any .mp4) matches:', matches ? matches.length : 0);
          if (matches && matches[0]) {
            let videoUrl = matches[0]
              .replace(/\\u0026/g, '&')
              .replace(/\\\//g, '/')
              .replace(/\\"/g, '');
            console.log('✅ Found video URL in HTML:', videoUrl.substring(0, 100) + '...');
            return videoUrl;
          }

          console.log('❌ No video URL patterns matched in HTML');
        } catch (patternError) {
          console.error('❌ Pattern matching error:', patternError.message);
        }
      }

      // Method 2: GraphQL endpoint
      console.log('🔍 Trying GraphQL endpoint...');
      const graphqlUrl = `https://www.instagram.com/graphql/query/?query_hash=2b0673e0dc4580674a88d426fe00ea90&variables={"shortcode":"${videoId}"}`;

      const graphqlResponse = await fetch(graphqlUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (graphqlResponse.ok) {
        const data = await graphqlResponse.json();
        console.log('📦 Got GraphQL response');

        if (data.data?.shortcode_media?.video_url) {
          const videoUrl = data.data.shortcode_media.video_url;
          console.log('✅ Found video URL in GraphQL:', videoUrl);
          return videoUrl;
        }
      }

      throw new Error('Video URL bulunamadı');
    } catch (error) {
      console.error('❌ JSON fetch error:', error);
      throw error;
    }
  }

  /**
   * Ana download fonksiyonu - WebView callback ile çalışır
   */
  async downloadVideo(instagramUrl, videoUrl, onProgress) {
    try {
      if (!videoUrl) {
        throw new Error('Video URL bulunamadı');
      }

      console.log('📥 Downloading video from:', videoUrl);

      // Videoyu indir
      onProgress?.({ stage: 'downloading', message: 'Video indiriliyor...', progress: 0 });

      // Video ID'sini Instagram URL'den çıkar
      let videoId = 'unknown';
      try {
        videoId = this.extractVideoId(instagramUrl);
      } catch (e) {
        videoId = Date.now().toString();
      }

      const fileName = `instagram_${videoId}_${Date.now()}.mp4`;
      const fileUri = FileSystem.documentDirectory + fileName;

      const downloadResumable = FileSystem.createDownloadResumable(
        videoUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          onProgress?.({
            stage: 'downloading',
            message: 'Video indiriliyor...',
            progress: Math.round(progress * 100)
          });
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (!result) {
        throw new Error('Video indirilemedi');
      }

      onProgress?.({ stage: 'completed', message: 'Video indirildi!', progress: 100 });

      return {
        uri: result.uri,
        fileName: fileName,
        videoId: videoId,
      };

    } catch (error) {
      console.error('Download error:', error);
      throw new Error(error.message || 'Instagram videosu indirilemedi. Lütfen URL\'yi kontrol edin.');
    }
  }

  /**
   * URL'nin Instagram URL'si olup olmadığını kontrol eder
   */
  isInstagramUrl(url) {
    return /instagram\.com|instagr\.am/.test(url);
  }

  /**
   * URL'nin profil URL'si mi yoksa post URL'si mi olduğunu belirler
   */
  getUrlType(url) {
    if (this.extractUsername(url)) {
      return 'profile';
    } else if (/\/(reel|p|tv|stories)\//.test(url)) {
      return 'post';
    }
    return 'unknown';
  }

  /**
   * Cache'ten video URL'sini al
   */
  async getCachedVideoUrl(instagramUrl) {
    try {
      const cacheData = await AsyncStorage.getItem(this.cacheKey);
      if (!cacheData) return null;

      const cache = JSON.parse(cacheData);
      const cached = cache[instagramUrl];

      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        console.log('✅ Found cached video URL');
        return cached.videoUrl;
      }

      return null;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  /**
   * Video URL'sini cache'e kaydet
   */
  async cacheVideoUrl(instagramUrl, videoUrl) {
    try {
      const cacheData = await AsyncStorage.getItem(this.cacheKey);
      let cache = cacheData ? JSON.parse(cacheData) : {};

      // Eski cache'leri temizle (24 saatten eski)
      Object.keys(cache).forEach(key => {
        if (Date.now() - cache[key].timestamp > this.cacheExpiry) {
          delete cache[key];
        }
      });

      // Yeni URL'i kaydet
      cache[instagramUrl] = {
        videoUrl,
        timestamp: Date.now()
      };

      await AsyncStorage.setItem(this.cacheKey, JSON.stringify(cache));
      console.log('✅ Cached video URL');
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  /**
   * Cache'i temizle
   */
  async clearCache() {
    try {
      await AsyncStorage.removeItem(this.cacheKey);
      console.log('✅ Cache cleared');
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Tüm indirme yöntemlerini dener - akıllı fallback sistemi
   */
  async smartDownload(instagramUrl, onProgress) {
    const urlType = this.getUrlType(instagramUrl);

    // Profil fotoğrafı indirme
    if (urlType === 'profile') {
      return await this.downloadProfilePhoto(instagramUrl, onProgress);
    }

    // Cache'i kontrol et
    onProgress?.({
      stage: 'loading',
      message: 'Cache kontrol ediliyor...',
      progress: 0
    });

    const cachedUrl = await this.getCachedVideoUrl(instagramUrl);
    if (cachedUrl) {
      try {
        console.log('🎯 Using cached URL');
        return await this.downloadVideo(instagramUrl, cachedUrl, onProgress);
      } catch (error) {
        console.warn('⚠️ Cached URL failed, trying fresh download');
      }
    }

    // Video/Post indirme - Tüm yöntemleri sırayla dene
    const methods = [
      {
        name: 'Shaon Videos Downloader',
        func: () => this.getVideoUrlWithShaon(instagramUrl)
      },
      {
        name: 'HTML Scraping',
        func: () => this.getVideoUrlFromJson(instagramUrl)
      }
    ];

    let lastError = null;

    for (const method of methods) {
      try {
        console.log(`🔄 Trying ${method.name}...`);
        onProgress?.({
          stage: 'loading',
          message: `${method.name} deneniyor...`,
          progress: 0
        });

        const videoUrl = await method.func();

        if (videoUrl) {
          console.log(`✅ Success with ${method.name}`);

          // Başarılı URL'i cache'e kaydet
          await this.cacheVideoUrl(instagramUrl, videoUrl);

          return await this.downloadVideo(instagramUrl, videoUrl, onProgress);
        }
      } catch (error) {
        console.warn(`⚠️ ${method.name} failed:`, error.message);
        lastError = error;
      }
    }

    // Hiçbir yöntem işe yaramadıysa
    throw lastError || new Error('Video indirilemedi');
  }
}

export default new InstagramDownloader();