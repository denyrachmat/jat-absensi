import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 1. MENGHAPUS DATA TIMER (RESET)
 * Dipanggil saat waktu cooldown habis atau saat reset manual oleh sistem.
 */
export const clearTimer = async (keyTimer: string): Promise<void> => {
  try {
    if (!keyTimer) return;
    await AsyncStorage.removeItem(keyTimer);
  } catch (error) {
    console.error('Gagal menghapus data timer di AsyncStorage:', error);
  }
};

/**
 * 2. MENYIMPAN TARGET WAKTU AKHIR
 * Mengonversi sisa detik dari server menjadi timestamp absolut di HP.
 * @param keyTimer Key unik AsyncStorage
 * @param seconds Sisa detik valid dari server (Laravel)
 */
export const setTimerTarget = async (keyTimer: string, seconds: number): Promise<void> => {
  try {
    if (!keyTimer) return;
    const now = Date.now(); // Epoch time milidetik saat ini di HP
    const targetTimestamp = now + seconds * 1000;

    // Simpan timestamp akhir dalam bentuk string
    await AsyncStorage.setItem(keyTimer, targetTimestamp.toString());
  } catch (error) {
    console.error('Gagal menyimpan target timer ke AsyncStorage:', error);
  }
};

/**
 * 3. MENAMBAHKAN WAKTU KE TIMER (INCREMENT)
 * Menambahkan durasi tertentu (misal 60 detik) ke timer yang sedang berjalan.
 */
export const timerIncrement = async (keyTimer: string, incrementSeconds = 60): Promise<void> => {
  try {
    if (!keyTimer) return;
    const targetString = await AsyncStorage.getItem(keyTimer);
    if (!targetString) return; // Tidak ada timer aktif

    const targetTimestamp = parseInt(targetString, 10);
    const newTarget = targetTimestamp + incrementSeconds * 1000;

    await AsyncStorage.setItem(keyTimer, newTarget.toString());
  } catch (error) {
    console.error('Gagal menambahkan waktu ke timer di AsyncStorage:', error);
  }
};

/**
 * 4. MENGHITUNG SISA DETIK SECARA REAL-TIME
 * Dipanggil saat aplikasi dibuka kembali atau saat menghitung mundur di layar.
 * Nilai otomatis berkurang mengikuti berjalannya waktu asli.
 */
export const getRemainingTimer = async (keyTimer: string, isCountdown: boolean = true): Promise<number> => {
  try {
    if (!keyTimer || typeof keyTimer !== 'string') return 0;

    const targetString = await AsyncStorage.getItem(keyTimer);

    // Jika tidak ada data timer tersimpan, artinya tidak sedang cooldown
    if (!targetString) return 0;

    const targetTimestamp = parseInt(targetString, 10);
    const now = Date.now();

    // Hitung selisih waktu
    if (isCountdown) {
      const remainingMillis = targetTimestamp - now;

      if (remainingMillis <= 0) {
        await clearTimer(keyTimer); // ✅ Langsung panggil tanpa "this."
        return 0;
      }
      return remainingMillis > 0 ? Math.ceil(remainingMillis / 1000) : 0;
    } else {
      const elapsedMillis = now - targetTimestamp;
      const elapsedSeconds = Math.floor(elapsedMillis / 1000);

      // console.log(`Timer '${keyTimer}' elapsed seconds:`, elapsedSeconds);

      return elapsedSeconds > 0 ? elapsedSeconds : 0;
    }

  } catch (error) {
    console.error('Gagal membaca timer dari AsyncStorage:', error);
    return 0;
  }
};