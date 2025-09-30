import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import instagramDownloader from '../services/instagramDownloader';

export default function SettingsScreen({ onBack }) {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSavedApiKey();
  }, []);

  const loadSavedApiKey = async () => {
    try {
      const savedKey = await AsyncStorage.getItem('rapidapi_key');
      if (savedKey) {
        setApiKey(savedKey);
        instagramDownloader.setRapidApiKey(savedKey);
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }
  };

  const saveApiKey = async () => {
    if (!apiKey || apiKey.trim() === '') {
      Alert.alert('Hata', 'Lütfen geçerli bir API key girin');
      return;
    }

    setLoading(true);
    try {
      await AsyncStorage.setItem('rapidapi_key', apiKey.trim());
      instagramDownloader.setRapidApiKey(apiKey.trim());

      Alert.alert(
        'Başarılı',
        'API Key kaydedildi! Artık Instagram\'dan video indirebilirsiniz.',
        [{ text: 'Tamam', onPress: onBack }]
      );
    } catch (error) {
      Alert.alert('Hata', 'API Key kaydedilemedi');
      console.error('Error saving API key:', error);
    } finally {
      setLoading(false);
    }
  };

  const openRapidAPI = () => {
    Linking.openURL('https://rapidapi.com/');
  };

  return (
    <ScrollView style={styles.container}>
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Geri</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.header}>⚙️ Ayarlar</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RapidAPI Key</Text>
        <Text style={styles.helpText}>
          Instagram'dan video indirmek için RapidAPI key gereklidir.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="RapidAPI Key girin..."
          placeholderTextColor="#999"
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={true}
        />

        <TouchableOpacity
          style={styles.saveButton}
          onPress={saveApiKey}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 Nasıl API Key Alınır?</Text>

        <View style={styles.steps}>
          <Text style={styles.step}>
            <Text style={styles.stepNumber}>1.</Text> RapidAPI hesabı oluşturun (ücretsiz)
          </Text>
          <Text style={styles.step}>
            <Text style={styles.stepNumber}>2.</Text> Aşağıdaki API'lerden birine subscribe olun:
          </Text>
          <Text style={styles.apiName}>
            • Instagram Downloader v2{'\n'}
            • Instagram Scraper API
          </Text>
          <Text style={styles.step}>
            <Text style={styles.stepNumber}>3.</Text> API Key'inizi kopyalayın
          </Text>
          <Text style={styles.step}>
            <Text style={styles.stepNumber}>4.</Text> Yukarıdaki alana yapıştırın
          </Text>
        </View>

        <TouchableOpacity style={styles.rapidButton} onPress={openRapidAPI}>
          <Text style={styles.rapidButtonText}>
            🌐 RapidAPI'yi Aç
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.pricingBox}>
        <Text style={styles.pricingTitle}>💰 Ücretlendirme</Text>
        <Text style={styles.pricingText}>
          ✅ <Text style={styles.bold}>Ücretsiz Plan:</Text> 100-150 istek/ay{'\n'}
          ✅ Kredi kartı gerektirmez{'\n'}
          ✅ Rate limit dahil kullanıcılar arası dağıtılır
        </Text>
      </View>

      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>⚠️ Önemli Notlar</Text>
        <Text style={styles.warningText}>
          • API Key'inizi kimseyle paylaşmayın{'\n'}
          • Key güvenli şekilde cihazınızda saklanır{'\n'}
          • Sadece public Instagram içerikleri indirilebilir
        </Text>
      </View>
    </ScrollView>
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
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginBottom: 15,
  },
  saveButton: {
    backgroundColor: '#E1306C',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 15,
  },
  steps: {
    marginBottom: 15,
  },
  step: {
    fontSize: 14,
    color: '#1565C0',
    marginBottom: 10,
    lineHeight: 20,
  },
  stepNumber: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  apiName: {
    fontSize: 14,
    color: '#0D47A1',
    marginLeft: 20,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  rapidButton: {
    backgroundColor: '#1976D2',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  rapidButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pricingBox: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  pricingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 10,
  },
  pricingText: {
    fontSize: 14,
    color: '#1B5E20',
    lineHeight: 24,
  },
  bold: {
    fontWeight: 'bold',
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    marginBottom: 30,
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
    lineHeight: 22,
  },
});