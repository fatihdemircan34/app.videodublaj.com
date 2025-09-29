# Instagram Alt Yazı Uygulaması

Bu uygulama, Instagram için videolara alt yazı eklemeyi sağlayan bir React Native uygulamasıdır.

## Özellikler

- Video seçme (galeri veya kamera)
- Alt yazı ekleme ve düzenleme
- Farklı alt yazı stilleri
- Alt yazı pozisyonunu ayarlama (üst, orta, alt)
- İşlenmiş videoyu Instagram'da paylaşma

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. iOS için pod'ları yükleyin (Mac'te):
```bash
cd ios && pod install
```

## Çalıştırma

### Android
```bash
npm run android
```

### iOS
```bash
npm run ios
```

### Web
```bash
npm run web
```

## Backend Konfigürasyonu

`src/constants/config.js` dosyasında backend URL'ini güncellemeyi unutmayın:

```javascript
export const API_BASE_URL = 'http://your-backend-url.com/api';
```

## Kullanılan Teknolojiler

- React Native
- Expo
- react-native-video
- react-native-image-picker
- react-native-fs
- react-native-share
- React Navigation
- Axios

## API Endpoints

Backend'in sağlaması gereken endpoint'ler:

- `POST /api/upload/video` - Video yükleme
- `POST /api/subtitle/generate` - Alt yazı ekleme

## Notlar

- Uygulama maksimum 60 saniyelik videolar destekler
- Instagram Stories formatında paylaşım yapabilir
- Alt yazı stilleri özelleştirilebilir