import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';

export default function SubtitleConfigScreen({ onSave, initialConfig }) {
  const [config, setConfig] = useState(initialConfig || {
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

  const updateConfig = (key, value) => {
    setConfig({ ...config, [key]: value });
  };

  const positions = ['top', 'center', 'bottom'];
  const languages = [
    { code: 'tr', label: 'Türkçe' },
    { code: 'en', label: 'English' },
    { code: 'ar', label: 'العربية' },
    { code: 'de', label: 'Deutsch' },
    { code: 'fr', label: 'Français' },
    { code: 'es', label: 'Español' },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Altyazı Ayarları</Text>

      {/* Dil Seçimi */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dil</Text>
        <View style={styles.buttonGroup}>
          {languages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.button,
                config.language === lang.code && styles.buttonActive,
              ]}
              onPress={() => updateConfig('language', lang.code)}
            >
              <Text
                style={[
                  styles.buttonText,
                  config.language === lang.code && styles.buttonTextActive,
                ]}
              >
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Pozisyon */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pozisyon</Text>
        <View style={styles.buttonGroup}>
          {positions.map((pos) => (
            <TouchableOpacity
              key={pos}
              style={[
                styles.button,
                config.position === pos && styles.buttonActive,
              ]}
              onPress={() => updateConfig('position', pos)}
            >
              <Text
                style={[
                  styles.buttonText,
                  config.position === pos && styles.buttonTextActive,
                ]}
              >
                {pos === 'top' ? 'Üst' : pos === 'center' ? 'Orta' : 'Alt'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Font Boyutu */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Font Boyutu: {config.fontSize}px</Text>
        <View style={styles.sliderContainer}>
          {[12, 14, 16, 18, 20, 24, 28, 32].map((size) => (
            <TouchableOpacity
              key={size}
              style={[
                styles.sizeButton,
                config.fontSize === size && styles.sizeButtonActive,
              ]}
              onPress={() => updateConfig('fontSize', size)}
            >
              <Text style={styles.sizeButtonText}>{size}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Font Rengi */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Font Rengi</Text>
        <TextInput
          style={styles.input}
          value={config.fontColor}
          onChangeText={(text) => updateConfig('fontColor', text)}
          placeholder="#FFFFFF"
        />
      </View>

      {/* Arka Plan Rengi */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Arka Plan Rengi</Text>
        <TextInput
          style={styles.input}
          value={config.backgroundColor}
          onChangeText={(text) => updateConfig('backgroundColor', text)}
          placeholder="rgba(0,0,0,0.7)"
        />
      </View>

      {/* Çerçeve Genişliği */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Çerçeve Genişliği: {config.outlineWidth}px</Text>
        <View style={styles.sliderContainer}>
          {[0, 1, 2, 3, 4, 5].map((width) => (
            <TouchableOpacity
              key={width}
              style={[
                styles.sizeButton,
                config.outlineWidth === width && styles.sizeButtonActive,
              ]}
              onPress={() => updateConfig('outlineWidth', width)}
            >
              <Text style={styles.sizeButtonText}>{width}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Otomatik Çeviri */}
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={styles.sectionTitle}>Otomatik Çeviri</Text>
          <Switch
            value={config.autoTranslate}
            onValueChange={(value) => updateConfig('autoTranslate', value)}
            trackColor={{ false: '#767577', true: '#E1306C' }}
            thumbColor={config.autoTranslate ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Zaman Damgaları */}
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={styles.sectionTitle}>Zaman Damgalarını Göster</Text>
          <Switch
            value={config.showTimestamps}
            onValueChange={(value) => updateConfig('showTimestamps', value)}
            trackColor={{ false: '#767577', true: '#E1306C' }}
            thumbColor={config.showTimestamps ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Kaydet Butonu */}
      <TouchableOpacity
        style={styles.saveButton}
        onPress={() => onSave(config)}
      >
        <Text style={styles.saveButtonText}>Kaydet ve Devam Et</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E1306C',
    marginBottom: 30,
    textAlign: 'center',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1306C',
    backgroundColor: '#fff',
  },
  buttonActive: {
    backgroundColor: '#E1306C',
  },
  buttonText: {
    color: '#E1306C',
    fontSize: 16,
  },
  buttonTextActive: {
    color: '#fff',
  },
  sliderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sizeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E1306C',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  sizeButtonActive: {
    backgroundColor: '#E1306C',
  },
  sizeButtonText: {
    fontSize: 14,
    color: '#E1306C',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#E1306C',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});