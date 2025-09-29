import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SUBTITLE_STYLES } from '../constants/config';

const SubtitleEditor = ({ onSubtitleChange, onStyleChange }) => {
  const [subtitle, setSubtitle] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('DEFAULT');
  const [position, setPosition] = useState('bottom');

  const handleSubtitleChange = (text) => {
    setSubtitle(text);
    if (onSubtitleChange) {
      onSubtitleChange(text);
    }
  };

  const handleStyleSelect = (styleName) => {
    setSelectedStyle(styleName);
    if (onStyleChange) {
      onStyleChange(styleName, SUBTITLE_STYLES[styleName]);
    }
  };

  const positionOptions = ['top', 'center', 'bottom'];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Alt Yazı Metni</Text>
        <TextInput
          style={styles.input}
          placeholder="Alt yazı metnini girin..."
          placeholderTextColor="#999"
          value={subtitle}
          onChangeText={handleSubtitleChange}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.sectionTitle}>Stil Seçimi</Text>
        <View style={styles.styleOptions}>
          {Object.keys(SUBTITLE_STYLES).map((styleName) => (
            <TouchableOpacity
              key={styleName}
              style={[
                styles.styleButton,
                selectedStyle === styleName && styles.selectedStyle,
              ]}
              onPress={() => handleStyleSelect(styleName)}
            >
              <Text
                style={[
                  styles.styleButtonText,
                  selectedStyle === styleName && styles.selectedStyleText,
                ]}
              >
                {styleName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Pozisyon</Text>
        <View style={styles.positionOptions}>
          {positionOptions.map((pos) => (
            <TouchableOpacity
              key={pos}
              style={[
                styles.positionButton,
                position === pos && styles.selectedPosition,
              ]}
              onPress={() => setPosition(pos)}
            >
              <Text
                style={[
                  styles.positionButtonText,
                  position === pos && styles.selectedPositionText,
                ]}
              >
                {pos === 'top' ? 'Üst' : pos === 'center' ? 'Orta' : 'Alt'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Önizleme</Text>
          <View style={styles.previewBox}>
            <Text
              style={[
                styles.previewText,
                SUBTITLE_STYLES[selectedStyle],
                position === 'top' && styles.positionTop,
                position === 'center' && styles.positionCenter,
                position === 'bottom' && styles.positionBottom,
              ]}
            >
              {subtitle || 'Alt yazı önizlemesi'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#DDD',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  styleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  styleButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  selectedStyle: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  styleButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedStyleText: {
    color: '#FFFFFF',
  },
  positionOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  positionButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
  },
  selectedPosition: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  positionButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedPositionText: {
    color: '#FFFFFF',
  },
  preview: {
    marginTop: 30,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  previewBox: {
    height: 200,
    backgroundColor: '#000',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  previewText: {
    position: 'absolute',
    left: 10,
    right: 10,
    padding: 10,
    borderRadius: 4,
  },
  positionTop: {
    top: 10,
  },
  positionCenter: {
    top: '50%',
    transform: [{ translateY: -15 }],
  },
  positionBottom: {
    bottom: 10,
  },
});

export default SubtitleEditor;