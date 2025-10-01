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

  // URL'den shortcode çıkar
  const currentUrl = window.location.href;
  const shortcodeMatch = currentUrl.match(/\\/(reel|p|tv)\\/([^\\/\\?]+)/);
  const targetShortcode = shortcodeMatch ? shortcodeMatch[2] : null;

  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'DEBUG',
    message: '🎯 Target shortcode: ' + (targetShortcode || 'NOT FOUND')
  }));

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

            // Tüm videoları logla
            videoUrls.forEach((v, idx) => {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: '  [' + idx + '] ' + v.width + 'x' + v.height + ' - ' + v.url.substring(0, 80)
              }));
            });

            // Birden fazla video varsa kullanıcıya sor
            if (videoUrls.length > 1) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MULTIPLE_VIDEOS_FOUND',
                videos: videoUrls,
                count: videoUrls.length
              }));
            } else {
              // Tek video varsa direkt indir
              const bestVideo = videoUrls[0];

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'VIDEO_URL_FOUND',
                url: bestVideo.url,
                width: bestVideo.width,
                height: bestVideo.height,
                method: 'graphql_intercept'
              }));
            }
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
              type: 'DEBUG',
              message: '✅ XHR Video URL bulundu: ' + videoUrls.length + ' adet'
            }));

            // Tüm videoları logla
            videoUrls.forEach((v, idx) => {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: '  [' + idx + '] ' + v.width + 'x' + v.height + ' - ' + v.url.substring(0, 80)
              }));
            });

            // Birden fazla video varsa kullanıcıya sor
            if (videoUrls.length > 1) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MULTIPLE_VIDEOS_FOUND',
                videos: videoUrls,
                count: videoUrls.length
              }));
            } else {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'VIDEO_URL_FOUND',
                url: videoUrls[0].url,
                width: videoUrls[0].width,
                height: videoUrls[0].height,
                method: 'xhr_intercept'
              }));
            }
          }
        } catch (err) {
          console.log('⚠️ XHR parse error:', err.message);
        }
      });
    }

    return originalXHRSend.apply(this, args);
  };

  // JSON objesinde video URL'lerini bul (recursive)
  function findVideoUrls(obj, results = [], path = '') {
    if (!obj || typeof obj !== 'object') return results;

    // video_url alanını ara
    if (obj.video_url && typeof obj.video_url === 'string') {
      const objShortcode = obj.shortcode || obj.code || obj.short_code || 'unknown';

      const videoInfo = {
        url: obj.video_url,
        width: obj.video_width || obj.dimensions?.width || 0,
        height: obj.video_height || obj.dimensions?.height || 0,
        path: path,
        id: obj.id || obj.pk || 'unknown',
        shortcode: objShortcode
      };

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DEBUG',
        message: '🎬 Video bulundu: ' + videoInfo.width + 'x' + videoInfo.height + ' (shortcode: ' + objShortcode + ', target: ' + targetShortcode + ')'
      }));

      // SADECE hedef shortcode'u eşleşenleri ekle
      if (targetShortcode && objShortcode === targetShortcode) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG',
          message: '✅ MATCH! Target video bulundu: ' + objShortcode
        }));
        results.push(videoInfo);
      } else if (!targetShortcode) {
        // Shortcode yoksa hepsini ekle (fallback)
        results.push(videoInfo);
      } else {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG',
          message: '⏭️ Skipping: ' + objShortcode + ' (not matching ' + targetShortcode + ')'
        }));
      }
    }

    // video_versions array'ini ara (Instagram yeni API)
    if (Array.isArray(obj.video_versions)) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DEBUG',
        message: '📹 video_versions bulundu: ' + obj.video_versions.length + ' versiyon'
      }));

      obj.video_versions.forEach((v, idx) => {
        if (v.url) {
          const videoInfo = {
            url: v.url,
            width: v.width || 0,
            height: v.height || 0,
            path: path + '.video_versions[' + idx + ']',
            id: v.id || 'version_' + idx
          };
          results.push(videoInfo);

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: '  └─ Version ' + idx + ': ' + videoInfo.width + 'x' + videoInfo.height
          }));
        }
      });
    }

    // carousel_media (çoklu medya) kontrol et
    if (Array.isArray(obj.carousel_media)) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DEBUG',
        message: '🎠 CAROUSEL bulundu: ' + obj.carousel_media.length + ' öğe var!'
      }));
    }

    // edge_sidecar_to_children (GraphQL carousel)
    if (obj.edge_sidecar_to_children && Array.isArray(obj.edge_sidecar_to_children.edges)) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DEBUG',
        message: '🎠 SIDECAR CAROUSEL bulundu: ' + obj.edge_sidecar_to_children.edges.length + ' öğe!'
      }));
    }

    // Nested objelerde ara
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newPath = path ? path + '.' + key : key;
        findVideoUrls(obj[key], results, newPath);
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

  // Fallback: Sayfadaki script tag'lerini parse et
  setTimeout(function() {
    if (captured) return;

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'DEBUG',
      message: '🔍 Fallback: Parsing page scripts for video URL...'
    }));

    try {
      // Tüm script tag'lerini kontrol et
      const scripts = document.querySelectorAll('script:not([src])');

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DEBUG',
        message: '📜 Found ' + scripts.length + ' inline scripts'
      }));

      for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i];
        const content = script.textContent || script.innerHTML;

        // Her script'in içeriğini logla
        if (content.length > 5000) {
          const preview = content.substring(0, 200);
          const hasShortcode = content.includes(targetShortcode);
          const hasVideoUrl = content.includes('video_url');
          const hasPlaybackUrl = content.includes('playback_url');
          const hasDashManifest = content.includes('dash_manifest');

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: 'Script #' + i + ' (len: ' + content.length + '): shortcode=' + hasShortcode + ', video_url=' + hasVideoUrl + ', playback_url=' + hasPlaybackUrl + ', dash=' + hasDashManifest
          }));

          // Hedef shortcode ve dash_manifest içeren script'i işle
          if (hasShortcode && hasDashManifest) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '🎯 BINGO! Script #' + i + ' has both shortcode AND dash_manifest!'
            }));

            // dash_manifest kelimesinin etrafındaki 300 karakteri logla
            const dashIndex = content.indexOf('dash_manifest');
            if (dashIndex !== -1) {
              const start = Math.max(0, dashIndex - 50);
              const end = Math.min(content.length, dashIndex + 250);
              const snippet = content.substring(start, end);

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: 'DASH snippet: ' + snippet
              }));
            }

            // DASH manifest XML içeriğini çıkar (embedded XML, URL değil)
            // Format: "video_dash_manifest":"<XML_CONTENT>"
            const dashManifestMatch = content.match(/"video_dash_manifest"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"/);

            if (dashManifestMatch && dashManifestMatch[1]) {
              let manifestXml = dashManifestMatch[1];

              // Escape karakterlerini decode et
              manifestXml = manifestXml.replace(/\\\\u003C/g, '<');
              manifestXml = manifestXml.replace(/\\\\u003E/g, '>');
              manifestXml = manifestXml.replace(/\\\\"/g, '"');
              manifestXml = manifestXml.replace(/\\\\\\\\/g, '/');
              manifestXml = manifestXml.replace(/\\\\n/g, '\n');

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: '📥 DASH XML çıkarıldı: ' + manifestXml.length + ' bytes'
              }));

              // DASH manifest XML'den BaseURL'leri çıkar
              const baseUrlPattern = /<BaseURL>([^<]+)<\\/BaseURL>/g;
              const videoUrls = [];
              let match;

              while ((match = baseUrlPattern.exec(manifestXml)) !== null) {
                videoUrls.push(match[1]);
              }

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: '🎬 DASH\'tan ' + videoUrls.length + ' video URL bulundu'
              }));

              if (videoUrls.length > 0) {
                // İlk URL genelde en yüksek kalite
                const videoUrl = videoUrls[0];

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '✅ Video URL: ' + videoUrl.substring(0, 100)
                }));

                captured = true;

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'VIDEO_URL_FOUND',
                  url: videoUrl,
                  width: 0,
                  height: 0,
                  method: 'dash_manifest_embedded'
                }));
              } else {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '⚠️ DASH XML\'de BaseURL bulunamadı'
                }));
              }
            } else {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: '⚠️ video_dash_manifest regex eşleşmedi'
              }));
            }
          }
        }

        // video_url pattern'ini ara (shortcode olmadan da)
        if (content.includes('video_url') && content.length > 1000) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: '📜 Script #' + i + ' has video_url (length: ' + content.length + ')'
          }));
        }

        // Shortcode ile eşleşen video ara VEYA sadece video_url
        if (content.includes('video_url') && content.length > 500) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG',
            message: '✅ Found script with target shortcode!'
          }));

          // Direkt video_url regex ile çıkar - daha basit pattern
          try {
            // Instagram script içinde video_url'i bul
            // Pattern: "video_url":"https://..."
            const videoUrlIndex = content.indexOf('"video_url"');

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: 'video_url aranıyor, found at index: ' + videoUrlIndex
            }));

            if (videoUrlIndex !== -1) {
              // video_url'den sonraki URL'i çıkar
              const afterVideoUrl = content.substring(videoUrlIndex);
              const urlMatch = afterVideoUrl.match(/"video_url"\\s*:\\s*"([^"]+)"/);

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG',
                message: 'URL match bulundu mu: ' + (urlMatch ? 'EVET' : 'HAYIR')
              }));

              if (urlMatch && urlMatch[1]) {
                // URL'i temizle (\u0026 -> &, \/ -> /)
                let videoUrl = urlMatch[1];
                videoUrl = videoUrl.replace(/\\\\u0026/g, '&');
                videoUrl = videoUrl.replace(/\\\\/g, '');

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '✅ Video URL çıkarıldı: ' + videoUrl.substring(0, 80)
                }));

                captured = true;

                // Çözünürlük bul
                const widthMatch = afterVideoUrl.match(/"dimensions"\\s*:\\s*{\\s*"width"\\s*:\\s*(\\d+)/);
                const heightMatch = afterVideoUrl.match(/"height"\\s*:\\s*(\\d+)/);

                const width = widthMatch ? parseInt(widthMatch[1]) : 0;
                const height = heightMatch ? parseInt(heightMatch[1]) : 0;

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'VIDEO_URL_FOUND',
                  url: videoUrl,
                  width: width,
                  height: height,
                  method: 'script_regex'
                }));

                break;
              }
            }

            // Format 1: window._sharedData (fallback)
            let match = content.match(/window\\._sharedData\\s*=\\s*({.+?});/);
            if (match) {
              const data = JSON.parse(match[1]);
              const videos = findVideoUrls(data);

              if (videos.length > 0) {
                captured = true;

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG',
                  message: '✅ Found video in _sharedData'
                }));

                if (videos.length > 1) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'MULTIPLE_VIDEOS_FOUND',
                    videos: videos,
                    count: videos.length
                  }));
                } else {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'VIDEO_URL_FOUND',
                    url: videos[0].url,
                    width: videos[0].width,
                    height: videos[0].height,
                    method: 'script_tag_parse'
                  }));
                }
                break;
              }
            }

            // Format 2: Direkt JSON
            const jsonMatch = content.match(/{.+}/);
            if (jsonMatch) {
              try {
                const data = JSON.parse(jsonMatch[0]);
                const videos = findVideoUrls(data);

                if (videos.length > 0) {
                  captured = true;

                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'DEBUG',
                    message: '✅ Found video in inline JSON'
                  }));

                  if (videos.length > 1) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'MULTIPLE_VIDEOS_FOUND',
                      videos: videos,
                      count: videos.length
                    }));
                  } else {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'VIDEO_URL_FOUND',
                      url: videos[0].url,
                      width: videos[0].width,
                      height: videos[0].height,
                      method: 'script_tag_parse'
                    }));
                  }
                  break;
                }
              } catch (e) {
                // JSON parse failed, continue
              }
            }
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DEBUG',
              message: '⚠️ Script parse error: ' + e.message
            }));
          }
        }
      }

      if (!captured) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG',
          message: '⚠️ Video not found in scripts, waiting for XHR/Fetch...'
        }));
      }
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DEBUG',
        message: '❌ Fallback error: ' + e.message
      }));
    }
  }, 8000); // 8 saniye bekle - Instagram lazy load yapıyor olabilir

})();
true;
`;
}
