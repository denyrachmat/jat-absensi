import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Avatar, AvatarBadge, AvatarFallbackText } from '@/components/ui/avatar';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

import { ClockCheck, Compass, Timer, TimerOff } from 'lucide-react-native';

import { useNotifyStore } from '@/store/useNotifyStore';
import * as Location from 'expo-location';
import MapView, { Marker, UrlTile } from 'react-native-maps';
// import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';
import { TimerHelper } from '@/services/timerServices';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Employee {
  full_name?: string;
  job_position?: string;
  [key: string]: any;
}

export default function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee>({});
  const [photo, setPhoto] = useState<string | null>(null);

  const mapRef = React.useRef<MapView>(null);
  const router = useRouter();
  const params = useLocalSearchParams();

  const $q = useNotifyStore();

  React.useEffect(() => {
    getInitialLocation();
    getEmployeeData();
    fetchCurrentLocation()
    syncTimer()
  }, []);

  React.useEffect(() => {
    if (cooldown <= 0) return;

    const interval = setInterval(async () => {
      // Selalu cek sisa waktu asli dari helper agar presisi
      const remaining = await TimerHelper.getRemaining();
      setCooldown(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  React.useEffect(() => {
    if (params?.photoUri) {
      setPhoto(params.photoUri as string); // Simpan hasil jepretan modal ke state lokal absen
    }
  }, [params?.photoUri]);

  React.useEffect(() => {
    if (photo && location) {
      handleClockIn(); // Langsung trigger proses Clock In setelah dapat URI foto dari modal kamera
    }
  }, [photo, location]);

  const getEmployeeData = async () => {
    try {
      const employeeData = await AsyncStorage.getItem('employee');
      if (employeeData) {
        console.log("Employee data loaded from AsyncStorage:", JSON.parse(employeeData));
        setEmployee(JSON.parse(employeeData));
      }
    } catch (error) {
      console.error("Error fetching employee data:", error);
    }
  };

  // Koordinat default (Jakarta) jika lokasi gagal dimuat
  const initialRegion = {
    latitude: location?.coords.latitude || -6.2088,
    longitude: location?.coords.longitude || 106.8456,
    latitudeDelta: 0.005, // Mengatur tingkat zoom peta
    longitudeDelta: 0.005,
  };

  const fetchCurrentLocation = async (quiet = false) => {
    if (!quiet) setLoadingLocation(true);

    try {
      // Menggunakan fungsi expo-location yang benar untuk cek saklar GPS HP
      const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();

      if (!isLocationServicesEnabled) {
        $q.dialog({
          title: 'GPS Tidak Aktif',
          description: 'Layanan lokasi (GPS) di perangkat kamu dinonaktifkan. Silakan aktifkan GPS kamu terlebih dahulu.',
          confirmText: 'OK'
        });
        setLoadingLocation(false);
        return;
      }

      // Minta izin permission foreground
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        $q.dialog({
          title: 'Akses Ditolak',
          description: 'Aplikasi membutuhkan izin lokasi untuk melakukan presensi kehadiran.',
          confirmText: 'OK'
        });
        setLoadingLocation(false);
        return;
      }

      // Ambil koordinat GPS
      let currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log('Koordinat GPS berhasil dideteksi:', currentPosition);

      setLocation(currentPosition);

      if (mapRef.current && currentPosition) {
        mapRef.current.animateToRegion({
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        }, 1000);
      }

    } catch (error) {
      console.error("Error saat mendeteksi lokasi:", error);
    } finally {
      setLoadingLocation(false);
    }
  };

  const syncTimer = async () => {
    try {
      // 1. Cek status resmi ke Laravel Herd terlebih dahulu
      const response = await api.get('/attendances/today-presence');
      const { remaining_cooldown_seconds } = response.data.data;

      if (remaining_cooldown_seconds > 0) {
        // Sinkronkan storage lokal dengan angka terbaru dari server
        await TimerHelper.setTarget(remaining_cooldown_seconds);
        setCooldown(remaining_cooldown_seconds);
      } else {
        await TimerHelper.clear();
        setCooldown(0);
      }
    } catch (error) {
      // 2. FALLBACK: Jika internet putus/offline, gunakan hitungan lokal AsyncStorage
      const localRemaining = await TimerHelper.getRemaining();
      setCooldown(localRemaining);
    } finally {
      setLoading(false);
    }
  };

  async function getInitialLocation() {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      $q.notif({
        title: 'Izin Ditolak',
        description: 'Aplikasi butuh izin lokasi untuk melakukan Clock In.',
        action: 'error',
      });
      setLoadingLocation(false);
      return;
    }

    // Ambil koordinat GPS dengan akurasi tinggi
    let currentPosition = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    setLocation(currentPosition);
    setLoadingLocation(false);
  }

  const initHandleClockIn = () => {
    router.push('/camera-modal');
  }

  const handleClockIn = () => {
    if (!photo) {
      $q.notif({
        title: 'Foto Absen Belum Ada',
        description: 'Silakan ambil foto absen terlebih dahulu sebelum melakukan Clock In.',
        action: 'error',
      });
      return;
    }

    $q.dialog({
      title: 'Konfirmasi Presensi',
      description: 'Apakah kamu yakin ingin melakukan Clock In pada lokasi saat ini?',
      confirmText: 'Yakin',
      cancelText: 'Batal',
      onConfirm: async () => {
        // Jalankan fungsi hit API kamu di sini jika klik Yakin
        const success = await executeClockInBackend();
        if (success) {
          await TimerHelper.setTarget(60); // Contoh set cooldown 60 detik setelah Clock In
          setCooldown(60);
          $q.notif({
            title: 'Clock In Berhasil',
            description: 'Kamu berhasil melakukan Clock In. Selamat bekerja!',
            action: 'success',
          });
        }
      },
      onCancel: () => {
        console.log('User membatalkan absen');
      }
    });
  }

  const executeClockInBackend = async () => {
    if (!location) {
      $q.notif({
        title: 'Lokasi Tidak Terdeteksi',
        description: 'Tidak dapat mendeteksi lokasi kamu. Pastikan GPS aktif dan coba lagi.',
        action: 'error',
      });

      console.log('Check Location Failed: Location data is null', location);
      return false;
    } else {
      try {
        if (!photo) {
          $q.notif({
            title: 'Foto Tidak Tersedia',
            description: 'Silakan ambil foto terlebih dahulu sebelum melakukan Clock In.',
            action: 'error',
          });

          console.log('Check Photo Failed: Photo data is null', photo);
          return false;
        }

        setSubmitting(true);

        // Convert photo URI to blob for proper file upload
        const formData = new FormData();
        formData.append('latitude', String(location.coords.latitude));
        formData.append('longitude', String(location.coords.longitude));
        const localUri = photo!;

        // 2. Ekstrak nama file asli dari ujung URI cache ImagePicker
        const filename = localUri.split('/').pop() || 'photo.jpg';
        formData.append('photo', {
          uri: localUri,
          name: filename,
          type: 'image/jpeg', // Menyesuaikan dengan ekstensi .jpeg dari ImagePicker kamu
        } as any);

        const response = await api.post('/attendances/clock-in', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log("Clock In API response:", response.data);
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorResponse = error && typeof error === 'object' && 'response' in error ? (error as any).response : null;
        console.error("Clock In API error:", errorResponse || errorMessage);
        console.error("Clock In API error details:", {
          message: errorMessage,
          responseData: errorResponse?.data,
          responseStatus: errorResponse?.status,
        });

        const serverMessage = errorResponse?.data?.error || errorMessage;
        $q.notif({
          title: 'Clock In Gagal',
          description: serverMessage,
          action: 'error',
        });

        return false;
      } finally {
        setSubmitting(false);
      }
    }
  }

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {/* Trik memuat OpenStreetMap secara gratis */}
        <UrlTile
          urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maximumZ={19}
          flipY={false}
        />

        {/* Pin Penanda Posisi Karyawan */}
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Posisi Kamu"
            description="Lokasi clock-in saat ini"
          />
        )}

      </MapView>

      <TouchableOpacity
        style={styles.myLocationButton}
        onPress={() => fetchCurrentLocation(true)} // Memanggil fungsi GPS yang sudah kamu buat
        activeOpacity={0.7}
      >
        {/* Kamu bisa pakai ikon Compass dari lucide-react-native */}
        <Compass color="#0052CC" size={24} />
      </TouchableOpacity>

      <View style={styles.floatingUsersContainer}>
        <VStack space="2xl">
          {/* Tambahkan className="w-full" di sini */}
          <HStack space="md" className="w-full items-center">
            <Avatar className="bg-indigo-600">
              <AvatarFallbackText className="text-white">
                {employee?.full_name ? employee.full_name.split(' ').map((n) => n[0]).join('') : 'NA'}
              </AvatarFallbackText>
              <AvatarBadge />
            </Avatar>

            <VStack>
              <Heading size="sm" className='text-black'>{employee?.full_name || 'Ronald Richards'}</Heading>
              <Text size="xs" className='text-gray-500'>{employee?.job_position || 'Nursing Assistant'}</Text>
            </VStack>

            {/* ml-auto sekarang akan bekerja sempurna karena parent-nya sudah full width */}
            <VStack className="ml-auto items-end px-2 py-1 rounded">
              <Text size="xs" className='text-gray-500'>Timer</Text>
              <Heading size="xs" className='text-black'>{cooldown > 0 ? `${cooldown}s` : 'Ready'}</Heading>
            </VStack>
          </HStack>
        </VStack>
      </View>

      <View style={styles.floatingButtonContainer}>
        <VStack space="md" className="w-full">
          <Button size="lg" className={`w-full rounded-full ${cooldown > 0 ? 'bg-red-500' : 'bg-blue-500'}`} onPress={initHandleClockIn}>
            <ButtonText className='text-white'>{cooldown > 0 ? `Clock Out` : 'Clock In Sekarang'}</ButtonText>
            <ButtonIcon as={cooldown > 0 ? ClockCheck : Timer} color="#ffffff" />
          </Button>
          <Button isDisabled={cooldown === 0} size="lg" className={`w-full rounded-full bg-orange-500`} onPress={handleClockIn}>
            <ButtonText className='text-white'>{`Rest Clock In`}</ButtonText>
            <ButtonIcon as={TimerOff} color="#ffffff" />
          </Button>
        </VStack>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // Samakan dengan warna background tema aplikasi
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 30,  // Jarak melayang dari ujung bawah layar HP
    left: 20,    // Memberikan space di kiri agar tombol tidak mentok screen
    right: 20,   // Memberikan space di kanan
    backgroundColor: 'transparent', // Dibuat transparan agar bayangan tombolnya saja yang kelihatan
    zIndex: 10,  // Memastikan wajib berdiri di atas lapisan peta
  },
  floatingUsersContainer: {
    position: 'absolute',
    top: 10,     // Jarak melayang dari ujung atas layar HP
    left: 20,    // Memberikan space di kiri agar tidak mentok screen
    right: 40,   // Memberikan space di kanan
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10,  // Memastikan wajib berdiri di atas lapisan peta
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 130,      // Atur jarak dari bawah layar sesuai selera (di atas tombol absen)
    right: 10,        // Jarak dari kanan layar
    backgroundColor: '#ffffff',
    width: 50,
    height: 50,
    borderRadius: 25, // Membuat tombol bulat sempurna
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,     // Efek bayangan timbul di Android
    shadowColor: '#000', // Efek bayangan di iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 10,       // Memastikan tombol berada di atas peta
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
