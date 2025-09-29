export const API_BASE_URL = 'http://your-backend-url.com/api';
export const SUBTITLE_ENDPOINT = '/subtitle/generate';
export const UPLOAD_ENDPOINT = '/upload/video';

export const SUBTITLE_STYLES = {
  DEFAULT: {
    fontSize: 16,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    fontWeight: 'bold',
  },
  INSTAGRAM: {
    fontSize: 18,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    fontWeight: '600',
    textAlign: 'center',
  },
};

export const VIDEO_CONFIG = {
  maxDuration: 60, // seconds
  quality: 'high',
  outputFormat: 'mp4',
};