import axios from 'axios';

// Backend URL'inizi buraya ekleyin
const API_BASE_URL = 'https://your-backend-url.com/api';

export const videoService = {
  /**
   * Videoyu backend'e yükler ve altyazı eklenmesini sağlar
   * @param {string} videoUri - Video dosyasının URI'si
   * @param {Object} subtitleConfig - Altyazı konfigürasyonu
   * @returns {Promise<Object>} - İşlenmiş video bilgisi
   */
  async uploadAndProcessVideo(videoUri, subtitleConfig) {
    try {
      const formData = new FormData();

      // Video dosyasını form data'ya ekle
      formData.append('video', {
        uri: videoUri,
        type: 'video/mp4',
        name: 'video.mp4',
      });

      // Altyazı konfigürasyonunu ekle
      formData.append('config', JSON.stringify(subtitleConfig));

      const response = await axios.post(`${API_BASE_URL}/process-video`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000, // 5 dakika timeout
      });

      return response.data;
    } catch (error) {
      console.error('Upload error:', error);
      throw new Error(error.response?.data?.message || 'Video yüklenirken hata oluştu');
    }
  },

  /**
   * İşlenmiş videoyu indirir
   * @param {string} videoId - Video ID
   * @returns {Promise<string>} - İndirilen video URI
   */
  async downloadProcessedVideo(videoId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/download-video/${videoId}`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Download error:', error);
      throw new Error('Video indirilirken hata oluştu');
    }
  },

  /**
   * Video işleme durumunu kontrol eder
   * @param {string} jobId - İş ID
   * @returns {Promise<Object>} - İş durumu
   */
  async checkProcessingStatus(jobId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/status/${jobId}`);
      return response.data;
    } catch (error) {
      console.error('Status check error:', error);
      throw new Error('Durum kontrolü yapılırken hata oluştu');
    }
  },
};

export const subtitleService = {
  /**
   * Mevcut altyazı şablonlarını getirir
   * @returns {Promise<Array>} - Şablon listesi
   */
  async getTemplates() {
    try {
      const response = await axios.get(`${API_BASE_URL}/subtitle-templates`);
      return response.data;
    } catch (error) {
      console.error('Get templates error:', error);
      return [];
    }
  },

  /**
   * Özel altyazı konfigürasyonu kaydeder
   * @param {Object} config - Altyazı konfigürasyonu
   * @returns {Promise<Object>} - Kaydedilen konfigürasyon
   */
  async saveConfig(config) {
    try {
      const response = await axios.post(`${API_BASE_URL}/subtitle-config`, config);
      return response.data;
    } catch (error) {
      console.error('Save config error:', error);
      throw new Error('Konfigürasyon kaydedilirken hata oluştu');
    }
  },
};