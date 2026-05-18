import AsyncStorage from '@react-native-async-storage/async-storage';

// Key unik untuk membedakan data di storage HP
const COOLDOWN_KEY = '@app_absensi_cooldown_target';

export const TimerHelper = {
  /**
   * 1. MENYIMPAN TARGET WAKTU AKHIR (Dipanggil saat sukses hit API)
   * Mengonversi sisa detik dari server menjadi timestamp absolut di HP.
   * @param seconds Sisa detik valid dari server (Laravel)
   */
  async setTarget(seconds: number): Promise<void> {
    try {
      const now = Date.now(); // Epoch time milidetik saat ini di HP
      const targetTimestamp = now + seconds * 1000;

      // Simpan timestamp akhir dalam bentuk string
      await AsyncStorage.setItem(COOLDOWN_KEY, targetTimestamp.toString());
    } catch (error) {
      console.error('Gagal menyimpan target timer ke AsyncStorage:', error);
    }
  },

  /**
   * 2. MENGHITUNG SISA DETIK SECARA REAL-TIME
   * Dipanggil saat aplikasi dibuka kembali atau saat menghitung mundur di layar.
   * Nilai otomatis berkurang mengikuti berjalannya waktu asli.
   */
  async getRemaining(): Promise<number> {
    try {
      const targetString = await AsyncStorage.getItem(COOLDOWN_KEY);
      
      // Jika tidak ada data timer tersimpan, artinya tidak sedang cooldown
      if (!targetString) return 0;

      const targetTimestamp = parseInt(targetString, 10);
      const now = Date.now();

      // Hitung selisih waktu
      const remainingMillis = targetTimestamp - now;

      // Jika waktu target sudah terlewati
      if (remainingMillis <= 0) {
        await this.clear(); // Bersihkan storage
        return 0;
      }

      // Konversi milidetik ke detik (dibulatkan ke atas)
      return Math.ceil(remainingMillis / 1000);
    } catch (error) {
      console.error('Gagal membaca timer dari AsyncStorage:', error);
      return 0;
    }
  },

  /**
   * 3. MENGHAPUS DATA TIMER (RESET)
   * Dipanggil saat waktu cooldown habis atau saat reset manual oleh sistem.
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(COOLDOWN_KEY);
    } catch (error) {
      console.error('Gagal menghapus data timer di AsyncStorage:', error);
    }
  }
};