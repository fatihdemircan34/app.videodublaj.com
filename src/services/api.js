import axios from 'axios';
import { API_BASE_URL, SUBTITLE_ENDPOINT, UPLOAD_ENDPOINT } from '../constants/config';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadVideo = async (videoUri) => {
  try {
    const formData = new FormData();
    formData.append('video', {
      uri: videoUri,
      type: 'video/mp4',
      name: 'video.mp4',
    });

    const response = await api.post(UPLOAD_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Video upload error:', error);
    throw error;
  }
};

export const generateSubtitle = async (videoId, subtitleText, options = {}) => {
  try {
    const response = await api.post(SUBTITLE_ENDPOINT, {
      videoId,
      subtitle: subtitleText,
      style: options.style || 'DEFAULT',
      position: options.position || 'bottom',
      duration: options.duration,
    });

    return response.data;
  } catch (error) {
    console.error('Subtitle generation error:', error);
    throw error;
  }
};

export const processInstagramPost = async (videoUri, subtitleText, options = {}) => {
  try {
    // First upload the video
    const uploadResponse = await uploadVideo(videoUri);
    const videoId = uploadResponse.videoId;

    // Then generate subtitle
    const subtitleResponse = await generateSubtitle(videoId, subtitleText, {
      ...options,
      style: 'INSTAGRAM',
    });

    return {
      success: true,
      videoUrl: subtitleResponse.processedVideoUrl,
      videoId: videoId,
    };
  } catch (error) {
    console.error('Instagram post processing error:', error);
    throw error;
  }
};

export default api;