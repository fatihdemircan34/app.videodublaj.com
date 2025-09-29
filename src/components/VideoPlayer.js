import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import Video from 'react-native-video';

const VideoPlayer = ({ source, style, onLoad, onError }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef(null);

  const handleLoad = (data) => {
    setIsLoading(false);
    if (onLoad) onLoad(data);
  };

  const handleError = (error) => {
    setIsLoading(false);
    if (onError) onError(error);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <View style={[styles.container, style]}>
      <Video
        ref={videoRef}
        source={source}
        style={styles.video}
        paused={!isPlaying}
        resizeMode="contain"
        onLoad={handleLoad}
        onError={handleError}
        repeat={false}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      <TouchableOpacity
        style={styles.playPauseButton}
        onPress={togglePlayPause}
      >
        <Text style={styles.playPauseText}>
          {isPlaying ? '⏸' : '▶'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  playPauseButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
});

export default VideoPlayer;