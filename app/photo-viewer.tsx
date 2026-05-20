import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, X } from 'lucide-react-native';
import React from 'react';
import { Image, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PhotoViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Tangkap URI foto dan detail opsional dari halaman sebelumnya
  const photoUri = params?.photoUri as string;
  const title = (params?.title as string) || 'Foto Presensi';
  const subtitle = params?.subtitle as string; // Bisa diisi tanggal atau info tambahan

  // Jika tidak ada foto yang dilempar, tampilkan fallback aman
  if (!photoUri) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text className="text-white mb-4">Gagal memuat foto.</Text>
        <TouchableOpacity style={styles.closeButtonText} onPress={() => router.back()}>
          <Text className="text-indigo-400 font-bold">Kembali</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Paksa status bar di atas menjadi gelap agar menyatu dengan tema hitam */}
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* HEADER ATAS */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Heading size="md" style={{ color: '#ffffff' }}>
            {title}
          </Heading>
          {subtitle && (
            <Text size="xs" style={{ color: '#a3a3a3', marginTop: 2 }}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Tombol Tutup Silang */}
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.closeButtonCircle}
          activeOpacity={0.7}
        >
          <X color="#ffffff" size={22} />
        </TouchableOpacity>
      </View>

      {/* AREA UTAMA: DISPLAY FOTO FULL SCREEN */}
      <View style={styles.imageWrapper}>
        <Image 
          source={{ uri: photoUri }} 
          style={styles.mainImage} 
          resizeMode="contain" // Memastikan foto tidak terpotong terlepas dari rasio HP
        />
      </View>

      {/* FOOTER BAWAH (Opsional - Bagus untuk info Audit Internal AEO) */}
      <View style={styles.footer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MapPin color="#ef4444" size={14} />
          <Text size="xs" style={{ color: '#e5e5e5', fontWeight: '500' }}>
            Metadata Presensi Terkunci
          </Text>
        </View>
        <Text style={styles.footerNote}>
          Foto ini diambil langsung melalui kamera aplikasi dan dilampirkan sebagai bukti kehadiran fisik yang sah.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Latar belakang hitam pekat khas galeri foto
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#171717',
  },
  closeButtonCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    backgroundColor: 'rgba(23, 23, 23, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  footerNote: {
    color: '#737373',
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    padding: 10,
  }
});