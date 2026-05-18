import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Konfigurasi bagaimana notifikasi muncul saat aplikasi sedang terbuka (Foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token = '';

  // 1. Cek apakah ini perangkat fisik (Emulator/Simulator kadang tidak bisa dapet token)
  if (!Device.isDevice) {
    console.warn('Harus menggunakan perangkat fisik untuk mendapatkan Push Token');
    return 'dummy_emulator_fcm_token';
  }

  // 2. Minta izin (Permission) ke user untuk memunculkan notifikasi
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.warn('Gagal mendapatkan izin untuk push notification!');
    return '';
  }

  // 3. Ambil Token FCM via Expo Service
  try {
    // Catatan: Jika kamu menggunakan EAS Build, masukkan projectId kamu di sini
    const tokenData = await Notifications.getDevicePushTokenAsync();
    token = tokenData.data;
    console.log('FCM Device Token:', token);
  } catch (error) {
    console.error('Gagal mengambil token:', error);
  }

  // 4. Khusus Android, buatkan Channel Notifikasi agar muncul dengan benar
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}