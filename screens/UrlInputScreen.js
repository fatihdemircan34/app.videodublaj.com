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
import instagramDownloader from '../services/instagramDownloader';

export default function UrlInputScreen({ onVideoDownloaded, onBack }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ stage: '', message: '', progress: 0 });
  const [loadWebView, setLoadWebView] = useState(false);
  const webViewRef = useRef(null);

  const handleDownload = async () => {
    if (!url.trim()) {
      Alert.alert('Hata', 'Lütfen bir Instagram URL\'si girin');
      return;
    }

    if (!instagramDownloader.isInstagramUrl(url)) {
      Alert.alert('Hata', 'Geçerli bir Instagram URL\'si girin\n\nÖrnekler:\n- instagram.com/reel/...\n- instagram.com/p/...');
      return;
    }

    setLoading(true);
    setProgress({ stage: 'loading', message: 'Video URL alınıyor...', progress: 0 });

    try {
      let videoUrl = null;

      // Method 1: shaon-videos-downloader (öncelikli)
      try {
        console.log('📦 Trying shaon-videos-downloader...');
        videoUrl = await instagramDownloader.getVideoUrlWithShaon(url);
      } catch (shaonError) {
        console.log('⚠️ Shaon failed, trying HTML scraping...', shaonError.message);

        // Method 2: HTML scraping (yedek)
        try {
          videoUrl = await instagramDownloader.getVideoUrlFromJson(url);
        } catch (htmlError) {
          console.log('⚠️ HTML scraping also failed:', htmlError.message);
          throw new Error('Video URL alınamadı');
        }
      }

      if (videoUrl) {
        console.log('✅ Got video URL, downloading...');
        setProgress({ stage: 'downloading', message: 'Video indiriliyor...', progress: 0 });

        const result = await instagramDownloader.downloadVideo(url, videoUrl, (progressData) => {
          setProgress(progressData);
        });

        setLoading(false);
        Alert.alert('Başarılı', 'Video indirildi!', [
          {
            text: 'Tamam',
            onPress: () => onVideoDownloaded(result.uri),
          },
        ]);
      }

    } catch (error) {
      setLoading(false);
      console.error('❌ Download error:', error);
      Alert.alert(
        'İndirme Başarısız',
        'Instagram koruması nedeniyle video indirilemedi.\n\nAlternatif: Videoyu SaveFrom.net veya SnapInsta gibi sitelerden indirip "Galeriden Seç" ile yükleyin.',
        [
          { text: 'Tamam' },
          { text: 'Ana Ekrana Dön', onPress: onBack },
        ]
      );
    }
  };

  const handleWebViewMessage = async (event) => {
    try {
      console.log('📨 WebView message received:', event.nativeEvent.data);
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'DEBUG') {
        console.log('🔍 DEBUG:', data.message);
        return;
      }

      if (data.type === 'VIDEO_FOUND') {
        console.log('✅ Video URL found via', data.method + ':', data.url);

        setProgress({ stage: 'downloading', message: 'Video indiriliyor...', progress: 0 });

        // Video URL'i ile indirmeye devam et
        const result = await instagramDownloader.downloadVideo(url, data.url, (progressData) => {
          setProgress(progressData);
        });

        setLoadWebView(false);
        setLoading(false);

        Alert.alert('Başarılı', 'Video indirildi!', [
          {
            text: 'Tamam',
            onPress: () => onVideoDownloaded(result.uri),
          },
        ]);

      } else if (data.type === 'ERROR') {
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

    // Instagram deep link redirect'lerini ignore et
    if (nativeEvent.description && nativeEvent.description.includes('ERR_UNKNOWN_URL_SCHEME')) {
      console.log('⚠️ Ignoring deep link redirect, continuing...');
      return;
    }

    setLoadWebView(false);
    setLoading(false);
    Alert.alert('Hata', 'Instagram sayfası yüklenemedi: ' + nativeEvent.description);
  };

  const handleWebViewConsole = (event) => {
    console.log('🌐 WebView console:', event.nativeEvent.message);
  };

  const handleWebViewLoad = () => {
    // Sayfa yüklendi, JavaScript inject et
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(instagramDownloader.getInjectedJavaScript());
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

      <Text style={styles.title}>Instagram URL ile İndirme (Beta)</Text>
      <Text style={styles.subtitle}>
        Not: Instagram bot koruması nedeniyle çoğu zaman çalışmaz
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
        <Text style={styles.exampleText}>• instagram.com/reel/ABC123...</Text>
        <Text style={styles.exampleText}>• instagram.com/p/ABC123...</Text>
        <Text style={styles.exampleText}>• instagram.com/tv/ABC123...</Text>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>💡 Nasıl Kullanılır?</Text>
        <Text style={styles.infoText}>
          1. Instagram'da videoyu açın{'\n'}
          2. Paylaş → Linki Kopyala{'\n'}
          3. Buraya yapıştırın{'\n'}
          4. İndir butonuna tıklayın
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

      {/* Gizli WebView - Arka planda Instagram embed sayfasını yükler */}
      {loadWebView && (
        <WebView
          ref={webViewRef}
          source={{ uri: `${url.replace(/\/$/, '')}/embed/captioned/` }}
          style={{ width: 1, height: 1, opacity: 0.01, position: 'absolute', left: -1000 }}
          onMessage={handleWebViewMessage}
          onLoad={handleWebViewLoad}
          onError={handleWebViewError}
          onHttpError={handleWebViewError}
          onShouldStartLoadWithRequest={(request) => {
            // Instagram deep link'leri engelle, sadece http/https'e izin ver
            if (request.url.startsWith('instagram://')) {
              console.log('🚫 Blocked Instagram deep link:', request.url);
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
          cacheEnabled={false}
          incognito={false}
          setSupportMultipleWindows={false}
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
          originWhitelist={['*']}
        />
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
});