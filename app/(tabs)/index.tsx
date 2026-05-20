import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Avatar, AvatarBadge, AvatarFallbackText } from '@/components/ui/avatar';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

import { Camera, ClockCheck, Compass, TimerOff } from 'lucide-react-native';

import { useNotifyStore } from '@/store/useNotifyStore';
import * as Location from 'expo-location';
import MapView, { Circle, Marker, UrlTile } from 'react-native-maps';
// import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';
import { TimerHelper } from '@/services/timerServices';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

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
  const [company, setCompany] = useState<any>({});
  const [photo, setPhoto] = useState<Array<string> | null>([]);
  const [listSetupLocations, setListSetupLocations] = useState<any[]>([]);

  const mapRef = React.useRef<MapView>(null);
  const router = useRouter();
  const params = useLocalSearchParams();

  const $q = useNotifyStore();

  React.useEffect(() => {
    getInitialLocation();
    getEmployeeData();
    fetchCurrentLocation()
    getListLocations();

    AsyncStorage.getItem('company').then(data => {
      setCompany(JSON.parse(data || '{}'));
    });
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
      setPhoto(prev => [...(prev || []), params.photoUri as string]);
    }
  }, [params?.photoUri]);

  React.useEffect(() => {
    syncTimer()
  }, [company]);

  // Koordinat default (Jakarta) jika lokasi gagal dimuat
  const initialRegion = {
    latitude: location?.coords.latitude || -6.2088,
    longitude: location?.coords.longitude || 106.8456,
    latitudeDelta: 0.005, // Mengatur tingkat zoom peta
    longitudeDelta: 0.005,
  };

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

  const getDeviceTimezone = () => {
    // Mengambil timezone aktif di HP gawai saat ini
    const tz = Localization.getCalendars()[0].timeZone;

    console.log("Timezone via Expo:", tz); // Output: "Asia/Jakarta"
    return tz;
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
      const remaining_cooldown_seconds = response.data.data;

      console.log("Remaining cooldown from server:", remaining_cooldown_seconds);
      if (remaining_cooldown_seconds) {
        // Sinkronkan storage lokal dengan angka terbaru dari server
        const getCurrentRemaining = calculateRemainingCooldown(company.start_clock_out, remaining_cooldown_seconds.clock_in);

        console.log("Calculated remaining cooldown in seconds:", getCurrentRemaining);
        await TimerHelper.setTarget(getCurrentRemaining);
        setCooldown(getCurrentRemaining);

        const getPhotoUri = remaining_cooldown_seconds.file_attachment ? `${process.env.EXPO_PUBLIC_STORAGE_URL}${remaining_cooldown_seconds.file_attachment}` : null;
        // setPhoto(getPhotoUri ? [getPhotoUri] : []);
        console.log("Photo URI from server:", getPhotoUri);
        setPhoto(prev => [...(prev || []), getPhotoUri as string]);
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

  const handleDeletePhoto = (idx: number) => {
    if (cooldown > 0) {
      $q.notif({
        title: 'Tidak Bisa Hapus Foto',
        description: 'Foto tidak bisa dihapus saat kamu sudah melakukan Clock In. Silakan lakukan Clock Out terlebih dahulu untuk menghapus foto.',
        action: 'error',
      });

      return;
    }
    $q.dialog({
      title: 'Hapus Foto',
      description: 'Apakah kamu yakin ingin menghapus foto ini dari daftar?',
      confirmText: 'Hapus',
      cancelText: 'Batal',
      onConfirm: () => {
        setPhoto((prevPhotos) => prevPhotos?.filter((_, index) => index !== idx) || []);
        $q.notif({
          title: 'Foto Dihapus',
          description: 'Foto berhasil dihapus dari daftar.',
          action: 'success',
        });
      }
    });
  };

  const initHandleClockIn = async () => {
    const getCompanyStore = JSON.parse(await AsyncStorage.getItem('company') || '{}');
    const getNowTime = new Date();
    const timeString = getCompanyStore.work_start_time || '08:00';
    const [hours, minutes] = timeString.split(':').map(Number);
    const getStartWorkTime = new Date();
    getStartWorkTime.setHours(hours, minutes, 0, 0);

    if (getNowTime < getStartWorkTime) {
      $q.dialog({
        title: 'Belum Waktu Kerja',
        description: `Waktu kerja kamu mulai pukul ${getStartWorkTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Silakan kembali lagi nanti.`,
        confirmText: 'OK',
        onConfirm: () => {
          router.push('/camera-modal');
        }
      });
    } else if (getNowTime > getStartWorkTime && getNowTime < new Date(getStartWorkTime.getTime() + 60 * 60 * 1000)) {
      $q.dialog({
        title: 'Waktu Kerja Dimulai',
        description: `Waktu kerja kamu sudah dimulai. Silakan lakukan Clock In sekarang.`,
        confirmText: 'OK',
        onConfirm: () => {
          router.push('/camera-modal');
        }
      });
    } else if (getNowTime > new Date(getStartWorkTime.getTime() + 60 * 60 * 1000)) {
      $q.dialog({
        title: 'Terlambat Clock In',
        description: `Waktu kerja kamu sudah dimulai lebih dari 1 jam yang lalu ${getStartWorkTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Apakah kamu yakin ingin melakukan Clock In?`,
        confirmText: 'Yakin',
        cancelText: 'Batal',
        onConfirm: () => {
          router.push('/camera-modal');
        },
        onCancel: () => {
          console.log('User membatalkan Clock In karena terlambat');
        }
      });
    } else {
      router.push('/camera-modal');
    }
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

  const handleClockOut = () => {}

  const handleRestClockIn = () => {
    $q.dialog({
        title: 'Istirahat Clock In',
        description: 'Apakah kamu yakin ingin melakukan Clock In untuk istirahat?',
        confirmText: 'Yakin',
        cancelText: 'Batal',
        onConfirm: () => {
          api.post('/attendances/rest-clock-in')
        },
        onCancel: () => {
          console.log('User membatalkan Clock In untuk istirahat');
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
        const localUri = typeof photo === 'string' ? photo : (Array.isArray(photo) ? photo[0] : photo);

        // 2. Ekstrak nama file asli dari ujung URI cache ImagePicker
        const filename = String(localUri).split('/').pop() || 'photo.jpg';
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

        let getData = response.data.data

        const getCompanyStore = JSON.parse(await AsyncStorage.getItem('company') || '{}');

        // Get remaining time between start_clock_out and now
        if (getCompanyStore.start_clock_out) {
          getDeviceTimezone(); // Pastikan untuk mendapatkan timezone perangkat sebelum menghitung waktu

          const remainingTimeInSeconds = calculateRemainingCooldown(getCompanyStore.start_clock_out);
          await TimerHelper.setTarget(remainingTimeInSeconds)
          setCooldown(remainingTimeInSeconds); // Set cooldown berdasarkan sisa waktu ke work_start_time
        }

        return getData;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorResponse = error && typeof error === 'object' && 'response' in error ? (error as any).response : null;

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

  const calculateRemainingCooldown = (startClockOut: string, startClockIn: string = '') => {
    const [hours, minutes] = startClockOut.split(':').map(Number);
    const workEndTime = new Date();
    workEndTime.setHours(hours, minutes, 0, 0);

    let now
    if (startClockIn) {
      const [inHours, inMinutes] = startClockIn.split(':').map(Number);
      now = new Date();
      now.setHours(inHours, inMinutes, 0, 0);
    } else {
      now = new Date();
    }

    const remainingTime = workEndTime.getTime() - now.getTime();
    return Math.max(0, Math.floor(remainingTime / 1000)); // Pastikan tidak negatif
  }

  const convertSecondsToHMS = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  const getListLocations = async () => {
    try {
      const response = await api.get('/gps-location');
      console.log("List of attendance locations:", response.data);
      setListSetupLocations(response.data.data);
    } catch (error) {
      console.error("Failed to fetch attendance locations:", error);
      $q.notif({
        title: 'Gagal Memuat Lokasi',
        description: 'Tidak dapat memuat daftar lokasi kehadiran. Silakan coba lagi nanti.',
        action: 'error',
      });
    }
  }

  const onPressPhoto = (uri: string) => {
    router.push({
      pathname: '/photo-viewer',
      params: {
        photoUri: uri,
        title: 'Foto Presensi',
        subtitle: new Date().toLocaleString()
      }
    });
  }

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        loadingEnabled={loadingLocation}
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
            key="user-location"
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Posisi Kamu"
            description="Lokasi clock-in saat ini"
          >
            <Image
              source={require('@/assets/images/location.png')}
              style={{ width: 35, height: 35 }}
              resizeMode="contain"
            />
          </Marker>
        )}

        {listSetupLocations.length > 0 &&
          listSetupLocations.map((loc) => (
            <Marker
              key={loc.id}
              coordinate={{
                latitude: parseFloat(loc.latitude),
                longitude: parseFloat(loc.longitude),
              }}
              title={loc.gpc_location_name}
              description={`Radius absen : ${loc.radius} Meter`}
              pinColor="#FF6B6B"
            />
          ))
        }

        {listSetupLocations.length > 0 &&
          listSetupLocations.map((loc) => (
            <Circle
              center={{
                latitude: parseFloat(loc.latitude),
                longitude: parseFloat(loc.longitude),
              }}
              radius={parseFloat(loc.radius)}
              strokeColor="rgba(0, 0, 255, 0.5)"
              fillColor="rgba(0, 0, 255, 0.2)"
            />
          ))
        }
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
              <Text size="xs" className='text-gray-500'>Until Clock Out</Text>
              <Heading size="xs" className='text-black'>{cooldown > 0 ? convertSecondsToHMS(cooldown) : 'Ready'}</Heading>
            </VStack>
          </HStack>
        </VStack>
      </View>

      {/* For button */}
      <View style={styles.floatingButtonContainer}>
        <VStack space="md" className="w-full">
          {
            cooldown === 0 && photo?.length === 0 && (
              <Button size="lg" className={`w-full rounded-full bg-blue-500`} onPress={initHandleClockIn}>
                <ButtonText className='text-white'>Ambil Foto Absen</ButtonText>
                <ButtonIcon as={Camera} color="#ffffff" />
              </Button>
            )
          }
          {
            cooldown === 0 && (
              <Button size="lg" className={`w-full rounded-full bg-green-500`} onPress={initHandleClockIn}>
                <ButtonText className='text-white'>Clock In Sekarang</ButtonText>
                <ButtonIcon as={ClockCheck} color="#ffffff" />
              </Button>
            )
          }
          {
            cooldown > 0 && (
              <Button size="lg" className={`w-full rounded-full bg-red-500`} onPress={handleClockOut} isDisabled={cooldown > 0}>
                <ButtonText className='text-white'>Clock Out Sekarang</ButtonText>
                <ButtonIcon as={ClockCheck} color="#ffffff" />
              </Button>
            )
          }
          
          <Button isDisabled={cooldown === 0} size="lg" className={`w-full rounded-full bg-orange-500`} onPress={handleRestClockIn}>
            <ButtonText className='text-white'>{`Istirahat Clock In`}</ButtonText>
            <ButtonIcon as={TimerOff} color="#ffffff" />
          </Button>
        </VStack>
      </View>

      {/* Teste */}

      <View style={styles.floatingListPhotosContainer}>
        <VStack space="md" className='justify-end items-left'>
          <Text size="md" className='text-gray-500'>Foto Presensi Kamu</Text>
        </VStack>
        <VStack space="md" className='justify-end items-center'>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <HStack space="md">
              {photo && photo.length > 0 ? (
                photo.map((uri, index) => (
                  <TouchableOpacity key={index} onPress={() => onPressPhoto(uri)} onLongPress={() => handleDeletePhoto(index)}>
                    <Image
                      key={index}
                      source={{ uri }}
                      style={{ width: 40, height: 40, borderRadius: 8 }}
                      resizeMode="cover"

                    />
                  </TouchableOpacity>
                ))
              ) : (
                <Text size="md" className='text-gray-500'>Belum ada foto yang diambil.</Text>
              )}
            </HStack>
          </ScrollView>
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
    right: 20,        // Jarak dari kanan layar
    backgroundColor: '#fff',
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
  floatingListPhotosContainer: {
    position: 'absolute',
    bottom: 130,      // Atur jarak dari bawah layar sesuai selera (di atas tombol absen)
    left: 20,        // Jarak dari kiri layar
    right: 90,       // Jarak dari kanan layar (50 untuk myLocationButton + 20 padding + 20 spacing)
    backgroundColor: 'rgba(194, 194, 194, 0.85)',
    borderRadius: 12,
    padding: 5,
    zIndex: 10,      // Memastikan tombol berada di atas peta
    height: 70,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
