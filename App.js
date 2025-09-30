import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ActivityIndicator, Alert, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { useState, useEffect } from 'react';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import SubtitleConfigScreen from './screens/SubtitleConfigScreen';
import UrlInputScreen from './screens/UrlInputScreen';
import SettingsScreen from './screens/SettingsScreen';
import { videoService } from './services/api';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [sharedVideo, setSharedVideo] = useState(null);
  const [processedVideo, setProcessedVideo] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [subtitleConfig, setSubtitleConfig] = useState({
    language: 'tr',
    position: 'bottom',
    fontSize: 16,
    fontColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.7)',
    outlineColor: '#000000',
    outlineWidth: 2,
    showTimestamps: true,
    autoTranslate: true,
    maxLineLength: 40,
  });

  useEffect(() => {
    // Android'den gelen video paylaşım eventini dinle
    const videoSharedSubscription = DeviceEventEmitter.addListener(
      'onVideoShared',
      (videoUri) => {
        console.log('Video shared from Instagram:', videoUri);
        setSharedVideo(videoUri);
        setShowConfig(true);
      }
    );

    handleIncomingIntent();

    return () => {
      videoSharedSubscription.remove();
    };
  }, []);

  const handleIncomingIntent = async () => {
    // Intent handling is done via MainActivity.kt
    // This function is kept for future use if needed
  };

  const pickVideo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSharedVideo(result.assets[0].uri);
        setShowConfig(true);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Hata', 'Video seçilirken bir hata oluştu');
    }
  };

  const handleConfigSave = async (config) => {
    setSubtitleConfig(config);
    setShowConfig(false);
    if (sharedVideo) {
      await saveVideoLocally(sharedVideo, config);
    }
  };

  const saveVideoLocally = async (videoUri, config) => {
    setLoading(true);
    setLoadingMessage('Video kaydediliyor...');

    try {
      // Videoyu cihazın download klasörüne kopyala
      const fileName = `subtitle_video_${Date.now()}.mp4`;
      const destinationUri = FileSystem.documentDirectory + fileName;

      // Video dosyasını kopyala
      await FileSystem.copyAsync({
        from: videoUri,
        to: destinationUri,
      });

      setProcessedVideo(destinationUri);
      setLoading(false);

      Alert.alert(
        'Başarılı',
        `Video kaydedildi!\n\nAyarlar:\n- Dil: ${config.language}\n- Pozisyon: ${config.position}\n- Font: ${config.fontSize}px\n\nDosya: ${fileName}`,
        [
          { text: 'Tamam' },
          { text: 'Paylaş', onPress: () => shareToInstagram(destinationUri) },
        ]
      );

    } catch (error) {
      console.error('Error saving video:', error);
      Alert.alert('Hata', 'Video kaydedilirken bir hata oluştu');
      setLoading(false);
    }
  };

  const shareToInstagram = async (videoUri) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(videoUri, {
          dialogTitle: 'Instagram\'a Paylaş',
          mimeType: 'video/mp4',
          UTI: 'public.movie',
        });
      } else {
        Alert.alert('Hata', 'Paylaşım özelliği kullanılamıyor');
      }
    } catch (error) {
      console.error('Error sharing to Instagram:', error);
      Alert.alert('Hata', 'Instagram\'a paylaşırken bir hata oluştu');
    }
  };

  const handleVideoDownloaded = (videoUri) => {
    setSharedVideo(videoUri);
    setShowUrlInput(false);
    setShowConfig(true);
  };

  if (showSettings) {
    return (
      <SettingsScreen
        onBack={() => setShowSettings(false)}
      />
    );
  }

  if (showUrlInput) {
    return (
      <UrlInputScreen
        onVideoDownloaded={handleVideoDownloaded}
        onBack={() => setShowUrlInput(false)}
      />
    );
  }

  if (showConfig) {
    return (
      <SubtitleConfigScreen
        initialConfig={subtitleConfig}
        onSave={handleConfigSave}
      />
    );
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <>
          <ActivityIndicator size="large" color="#E1306C" />
          <Text style={styles.loadingText}>{loadingMessage}</Text>
        </>
      ) : (
        <>
          <Text style={styles.title}>Video Altyazı Uygulaması</Text>
          <Text style={styles.subtitle}>
            Videolarınıza otomatik altyazı ekleyin!
          </Text>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={pickVideo}
          >
            <Text style={styles.buttonText}>📂 Video Seç ve İşle</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.instagramButton]}
            onPress={() => setShowUrlInput(true)}
          >
            <Text style={styles.buttonText}>📱 Instagram İndirici</Text>
          </TouchableOpacity>

          {processedVideo && (
            <TouchableOpacity
              style={[styles.button, styles.shareButton]}
              onPress={() => shareToInstagram(processedVideo)}
            >
              <Text style={styles.buttonText}>Instagram'a Paylaş</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.configButton]}
            onPress={() => setShowConfig(true)}
          >
            <Text style={styles.buttonText}>⚙️ Altyazı Ayarları</Text>
          </TouchableOpacity>
        </>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E1306C',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  button: {
    backgroundColor: '#E1306C',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
    elevation: 5,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  secondaryButton: {
    backgroundColor: '#9E9E9E',
  },
  instagramButton: {
    backgroundColor: '#E1306C',
    elevation: 5,
    shadowColor: '#E1306C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  shareButton: {
    backgroundColor: '#405DE6',
  },
  configButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});