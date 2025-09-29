import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import VideoPlayer from '../components/VideoPlayer';
import SubtitleEditor from '../components/SubtitleEditor';
import {
  selectVideo,
  recordVideo,
  saveVideoToDevice,
  shareToInstagram,
} from '../services/mediaHandler';
import { processInstagramPost } from '../services/api';

const HomeScreen = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedVideoUrl, setProcessedVideoUrl] = useState(null);
  const [subtitleText, setSubtitleText] = useState('');
  const [subtitleStyle, setSubtitleStyle] = useState('DEFAULT');

  const handleSelectVideo = async () => {
    try {
      const video = await selectVideo();
      setSelectedVideo(video);
      setProcessedVideoUrl(null);
    } catch (error) {
      Alert.alert('Hata', 'Video seçilemedi');
    }
  };

  const handleRecordVideo = async () => {
    try {
      const video = await recordVideo();
      setSelectedVideo(video);
      setProcessedVideoUrl(null);
    } catch (error) {
      Alert.alert('Hata', 'Video kaydedilemedi');
    }
  };

  const handleProcessVideo = async () => {
    if (!selectedVideo || !subtitleText) {
      Alert.alert('Uyarı', 'Lütfen video seçin ve alt yazı girin');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await processInstagramPost(
        selectedVideo.uri,
        subtitleText,
        { style: subtitleStyle }
      );

      if (result.success) {
        setProcessedVideoUrl(result.videoUrl);
        Alert.alert('Başarılı', 'Video alt yazı ile işlendi!');
      }
    } catch (error) {
      Alert.alert('Hata', 'Video işlenirken hata oluştu');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareToInstagram = async () => {
    if (!processedVideoUrl) {
      Alert.alert('Uyarı', 'Önce videoyu işleyin');
      return;
    }

    try {
      const localPath = await saveVideoToDevice(processedVideoUrl);
      await shareToInstagram(localPath, subtitleText);
    } catch (error) {
      Alert.alert('Hata', 'Instagram\'a paylaşılamadı');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Instagram Alt Yazı</Text>

      {/* Video Selection Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Video Seçimi</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleSelectVideo}
          >
            <Text style={styles.buttonText}>Galeri</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={handleRecordVideo}
          >
            <Text style={styles.buttonText}>Kamera</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Video Preview */}
      {selectedVideo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Video Önizleme</Text>
          <View style={styles.videoContainer}>
            <VideoPlayer
              source={{ uri: processedVideoUrl || selectedVideo.uri }}
              style={styles.video}
            />
          </View>
        </View>
      )}

      {/* Subtitle Editor */}
      {selectedVideo && (
        <View style={styles.section}>
          <SubtitleEditor
            onSubtitleChange={setSubtitleText}
            onStyleChange={(style) => setSubtitleStyle(style)}
          />
        </View>
      )}

      {/* Process Button */}
      {selectedVideo && subtitleText && (
        <TouchableOpacity
          style={[styles.processButton, isProcessing && styles.disabledButton]}
          onPress={handleProcessVideo}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.processButtonText}>Alt Yazı Ekle</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Share Button */}
      {processedVideoUrl && (
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareToInstagram}
        >
          <Text style={styles.shareButtonText}>Instagram'da Paylaş</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  videoContainer: {
    height: 300,
    backgroundColor: '#000',
    borderRadius: 10,
    overflow: 'hidden',
  },
  video: {
    flex: 1,
  },
  processButton: {
    backgroundColor: '#34C759',
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  processButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  shareButton: {
    backgroundColor: '#E4405F',
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default HomeScreen;