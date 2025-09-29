import * as ImagePicker from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';

export const selectVideo = () => {
  return new Promise((resolve, reject) => {
    const options = {
      mediaType: 'video',
      videoQuality: 'high',
      durationLimit: 60,
    };

    ImagePicker.launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        reject(new Error('User cancelled video selection'));
      } else if (response.errorMessage) {
        reject(new Error(response.errorMessage));
      } else if (response.assets && response.assets[0]) {
        resolve(response.assets[0]);
      } else {
        reject(new Error('No video selected'));
      }
    });
  });
};

export const recordVideo = () => {
  return new Promise((resolve, reject) => {
    const options = {
      mediaType: 'video',
      videoQuality: 'high',
      durationLimit: 60,
      cameraType: 'back',
    };

    ImagePicker.launchCamera(options, (response) => {
      if (response.didCancel) {
        reject(new Error('User cancelled video recording'));
      } else if (response.errorMessage) {
        reject(new Error(response.errorMessage));
      } else if (response.assets && response.assets[0]) {
        resolve(response.assets[0]);
      } else {
        reject(new Error('No video recorded'));
      }
    });
  });
};

export const saveVideoToDevice = async (videoUrl, fileName = 'subtitle_video.mp4') => {
  try {
    const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

    const downloadResult = await RNFS.downloadFile({
      fromUrl: videoUrl,
      toFile: destPath,
    }).promise;

    if (downloadResult.statusCode === 200) {
      return destPath;
    } else {
      throw new Error('Failed to download video');
    }
  } catch (error) {
    console.error('Save video error:', error);
    throw error;
  }
};

export const shareVideo = async (videoPath, message = 'Check out this video!') => {
  try {
    const shareOptions = {
      title: 'Share Video',
      message: message,
      url: `file://${videoPath}`,
      type: 'video/mp4',
      social: Share.Social.INSTAGRAM,
    };

    const result = await Share.open(shareOptions);
    return result;
  } catch (error) {
    if (error.message !== 'User did not share') {
      console.error('Share video error:', error);
      throw error;
    }
  }
};

export const shareToInstagram = async (videoPath, caption = '') => {
  try {
    const shareOptions = {
      title: 'Share to Instagram',
      message: caption,
      url: `file://${videoPath}`,
      type: 'video/mp4',
      social: Share.Social.INSTAGRAM_STORIES,
    };

    const result = await Share.shareSingle(shareOptions);
    return result;
  } catch (error) {
    console.error('Instagram share error:', error);
    throw error;
  }
};