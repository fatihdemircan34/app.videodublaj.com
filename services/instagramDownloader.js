import * as FileSystem from 'expo-file-system';
import * as shaonVideosDownloader from 'shaon-videos-downloader';

/**
 * Instagram video downloader service
 * shaon-videos-downloader paketi kullanarak video indirme
 */

class InstagramDownloader {
  constructor() {
    this.webViewRef = null;
    this.rapidApiKey = null;
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
  async getVideoUrlWithShaon(instagramUrl) {
    try {
      console.log('📦 Using shaon-videos-downloader...');

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

      const result = await downloadFunc(instagramUrl);

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
      console.error('❌ Shaon error:', error);
      throw error;
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
      /instagr\.am\/p\/([A-Za-z0-9_-]+)/,
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
   * WebView injection script - Instagram sayfasından video URL'sini çıkarır
   */
  getInjectedJavaScript() {
    return `
      (function() {
        // İlk olarak script'in çalıştığını doğrula
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG',
          message: 'JavaScript injection started'
        }));

        let attempts = 0;
        const maxAttempts = 15;

        function findVideo() {
          attempts++;

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: 'Attempt ' + attempts + ' - Starting video search'
          }));

          try {
            // Method 1: Video element
            const videoElements = document.querySelectorAll('video');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: 'Video elements found: ' + videoElements.length
            }));

            if (videoElements.length > 0) {
              const videoUrl = videoElements[0].src;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: 'Video src: ' + videoUrl
              }));

              if (videoUrl && videoUrl.length > 0 && !videoUrl.startsWith('blob:')) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'VIDEO_FOUND',
                  url: videoUrl,
                  method: 'video_element'
                }));
                return true;
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

            // Method 3: Page HTML içinde video URL ara
            const bodyHtml = document.body.innerHTML;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: 'Body HTML length: ' + bodyHtml.length
            }));

            // Instagram CDN URL'lerini ara
            const cdnPatterns = [
              /https?:\\\\/\\\\/[^"'\\\\s]*cdninstagram[^"'\\\\s]*\\\\.mp4[^"'\\\\s]*/gi,
              /https?:\\\\/\\\\/[^"'\\\\s]*fbcdn[^"'\\\\s]*\\\\.mp4[^"'\\\\s]*/gi,
              /https?:\\\\/\\\\/[^"'\\\\s]*instagram[^"'\\\\s]*video[^"'\\\\s]*\\\\.mp4[^"'\\\\s]*/gi
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

            // Method 4: Script tags içindeki JSON data
            const scripts = document.querySelectorAll('script');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: 'Script tags found: ' + scripts.length
            }));

            for (let script of scripts) {
              const text = script.textContent || script.innerHTML;

              if (text.includes('video_url') || text.includes('contentUrl') || text.includes('.mp4')) {
                // video_url pattern
                let match = text.match(/"video_url"\\\\s*:\\\\s*"([^"]+)"/);
                if (match && match[1]) {
                  let videoUrl = match[1].replace(/\\\\u0026/g, '&').replace(/\\\\\\\\\\\\/g, '/');
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'VIDEO_FOUND',
                    url: videoUrl,
                    method: 'script_video_url'
                  }));
                  return true;
                }

                // contentUrl pattern
                match = text.match(/"contentUrl"\\\\s*:\\\\s*"([^"]+)"/);
                if (match && match[1]) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'VIDEO_FOUND',
                    url: match[1],
                    method: 'script_content_url'
                  }));
                  return true;
                }

                // Direct .mp4 URL pattern
                match = text.match(/https?:\\\\/\\\\/[^"'\\\\s]*\\\\.mp4[^"'\\\\s]*/i);
                if (match && match[0]) {
                  let videoUrl = match[0].replace(/\\\\u0026/g, '&').replace(/\\\\\\\\\\\\/g, '/');
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

        // İlk deneme 2 saniye bekle (sayfa yüklensin)
        setTimeout(findVideo, 2000);
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
}

export default new InstagramDownloader();