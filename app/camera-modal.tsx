import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export default function CameraModal() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const jepretFoto = async () => {
    // 1. Minta izin kamera
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Aplikasi butuh izin kamera untuk ambil foto absen!');
      router.back();
      return;
    }

    // 2. Buka Kamera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    // 3. Jika sukses dapat foto, balik ke route clockin sambil bawa hasil URI-nya
    if (!result.canceled) {
      const uriFoto = result.assets[0].uri;
      
      // router.replace akan menutup modal dan mengirim parameter 'photoUri' kembali ke halaman absen
      router.replace({
        pathname: '/(tabs)', 
        params: { photoUri: uriFoto, idPhoto: id as string || null }
      });
    } else {
      // Jika user klik cancel/back di kamera, tutup modal dan kembali
      router.back();
    }
  };

  // Otomatis langsung buka kamera begitu modal ini meluncur naik dari bawah
  useEffect(() => {
    jepretFoto();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#fff', marginBottom: 20 }}>Membuka Kamera Perangkat...</Text>
      
      {/* Tombol darurat untuk menutup modal jika kamera macet */}
      <TouchableOpacity 
        onPress={() => router.back()} 
        style={{ position: 'absolute', top: 40, right: 20, backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 50 }}
      >
        <X color="#fff" size={24} />
      </TouchableOpacity>
    </View>
  );
}