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
import instagramDownloader from '../services/instagramDownloader';
import { getSimpleInjectionScript } from '../services/instagramDownloaderSimple';
import { getMediaSourceCaptureScript } from '../services/instagramMediaSourceCapture';

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

    // Video için WebView kullan
    setLoading(true);
    setLoadWebView(true);
    setProgress({ stage: 'loading', message: 'Video yükleniyor...', progress: 0 });
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

        setProgress({
          stage: 'loading',
          message: `Video indiriliyor... (0/${data.totalChunks})`,
          progress: 0
        });

      } else if (data.type === 'BLOB_CHUNK') {
        blobChunksRef.current[data.chunkIndex] = data.data;
        const progress = Math.round(((data.chunkIndex + 1) / data.totalChunks) * 100);

        console.log(`📥 Parça ${data.chunkIndex + 1}/${data.totalChunks} alındı`);

        setProgress({
          stage: 'loading',
          message: `Video indiriliyor... (${data.chunkIndex + 1}/${data.totalChunks})`,
          progress: progress
        });

      } else if (data.type === 'BLOB_END') {
        console.log('✅ Tüm parçalar alındı, birleştiriliyor...');

        // Tüm chunk'ları birleştir
        const fullBase64 = blobChunksRef.current.join('');
        const metadata = blobMetadataRef.current;

        console.log('✅ Video yakalandı:', (metadata.size / 1024 / 1024).toFixed(2), 'MB, çözünürlük:', metadata.resolution);

        // Video data'sını kaydet ve download butonu göster
        setCapturedVideoData({
          data: fullBase64,
          size: metadata.size,
          resolution: metadata.resolution,
          type: metadata.mimeType
        });

        setProgress({
          stage: 'captured',
          message: `Video yakalandı! ${(metadata.size / 1024 / 1024).toFixed(2)} MB (${metadata.resolution})`,
          progress: 100
        });

        // Temizle
        blobChunksRef.current = [];
        blobMetadataRef.current = null;

      } else if (data.type === 'BLOB_DATA') {
        // Eski tek mesaj yöntemi (geriye dönük uyumluluk)
        const detectedRes = data.resolution || 'unknown';
        console.log('✅ Video yakalandı:', (data.size / 1024 / 1024).toFixed(2), 'MB, çözünürlük:', detectedRes);

        setCapturedVideoData({
          data: data.data,
          size: data.size,
          resolution: detectedRes,
          type: data.type
        });

        setProgress({
          stage: 'captured',
          message: `Video yakalandı! ${(data.size / 1024 / 1024).toFixed(2)} MB (${detectedRes})`,
          progress: 100
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

    // MSE capture zaten injectedJavaScriptBeforeContentLoaded ile yüklendi
    // Fallback script'i de ekle (blob capture için)
    if (webViewRef.current) {
      console.log('💉 Injecting fallback script...');
      const script = getSimpleInjectionScript();
      webViewRef.current.injectJavaScript(script);
      console.log('✅ Fallback script injected');
    }
  };

  const handleSaveVideo = async () => {
    if (!capturedVideoData) return;

    setLoading(true);
    setProgress({ stage: 'saving', message: 'Video kaydediliyor...', progress: 50 });

    try {
      // Video tipi WebM ise .webm, değilse .mp4
      const ext = capturedVideoData.type && capturedVideoData.type.includes('webm') ? 'webm' : 'mp4';
      const fileName = `instagram_${capturedVideoData.resolution}_${Date.now()}.${ext}`;
      const fileUri = FileSystem.documentDirectory + fileName;

      console.log('💾 Saving video to:', fileName);

      // data:video/webm;base64,... formatından base64 kısmını çıkar
      const base64Data = capturedVideoData.data.includes(',')
        ? capturedVideoData.data.split(',')[1]
        : capturedVideoData.data;

      // Yeni Expo FileSystem API kullanarak kaydet
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('✅ File saved successfully');

      // Dosya var mı kontrol et
      const fileInfo = await FileSystem.getInfoAsync(fileUri);

      setLoading(false);
      setLoadWebView(false);
      setCapturedVideoData(null);
      setProgress({ stage: 'completed', message: 'Video kaydedildi!', progress: 100 });

      const format = ext.toUpperCase();

      Alert.alert(
        'Başarılı',
        `Video indirildi!\n\nKalite: ${capturedVideoData.resolution}\nBoyut: ${(fileInfo.size / 1024 / 1024).toFixed(2)} MB\nFormat: ${format}`,
        [
          {
            text: 'Tamam',
            onPress: () => onVideoDownloaded(fileUri),
          },
        ]
      );
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
          {progress.stage === 'downloading' && progress.progress > 0 && (
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

      {/* Görünür WebView - Instagram sayfasını göster */}
      {loadWebView && (
        <View style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.webViewTitle}>
                {progress.message || 'Instagram Yükleniyor...'}
              </Text>
              {webViewProgress > 0 && webViewProgress < 100 && (
                <View style={styles.webViewProgressBar}>
                  <View style={[styles.webViewProgressFill, { width: `${webViewProgress}%` }]} />
                </View>
              )}
              {webViewProgress >= 100 && (
                <View style={styles.instructionContainer}>
                  {capturedVideoData ? (
                    <>
                      <Text style={styles.instructionText}>✅ Video hazır!</Text>
                      <Text style={styles.instructionSubtext}>
                        {(capturedVideoData.size / 1024 / 1024).toFixed(2)} MB • {capturedVideoData.resolution}
                      </Text>
                      <TouchableOpacity
                        style={styles.captureDownloadButton}
                        onPress={handleSaveVideo}
                      >
                        <Text style={styles.captureDownloadButtonText}>⬇️ İndir ve Kaydet</Text>
                      </TouchableOpacity>
                    </>
                  ) : progress.stage === 'loading' && (
                      progress.message.includes('Kaydediliyor') ||
                      progress.message.includes('Kayıt başladı') ||
                      progress.message.includes('Chunk')
                    ) ? (
                    <>
                      <Text style={styles.instructionText}>📥 Video kaydediliyor...</Text>
                      <Text style={styles.instructionSubtext}>{progress.message}</Text>
                    </>
                  ) : progress.stage === 'loading' && progress.message.includes('Video süresi') ? (
                    <>
                      <Text style={styles.instructionText}>🎬 Video oynatılıyor...</Text>
                      <Text style={styles.instructionSubtext}>{progress.message}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.instructionText}>▶️ Videoyu oynatın</Text>
                      <Text style={styles.instructionSubtext}>Video oynatıldığında otomatik yakalanacak</Text>
                    </>
                  )}
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.webViewCloseButton}
              onPress={() => {
                setLoadWebView(false);
                setLoading(false);
                setWebViewProgress(0);
              }}
            >
              <Text style={styles.webViewCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <WebView
            ref={webViewRef}
            source={{ uri: url }}
            style={styles.webView}
            injectedJavaScriptBeforeContentLoaded={getMediaSourceCaptureScript()}
            onMessage={handleWebViewMessage}
            onLoad={handleWebViewLoad}
            onLoadProgress={({ nativeEvent }) => setWebViewProgress(nativeEvent.progress * 100)}
            onError={handleWebViewError}
            onHttpError={handleWebViewError}
            onConsoleMessage={(event) => {
              console.log('🌐 WebView Console:', event.nativeEvent.message);
            }}
            onShouldStartLoadWithRequest={(request) => {
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
          <View style={styles.webViewFooter}>
            <Text style={styles.webViewHint}>
              💡 İpucu: Video tam yüklenene kadar bekleyin, sonra oynatın
            </Text>
          </View>
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
});