import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import {
  Avatar,
  AvatarBadge,
  AvatarFallbackText,
} from "@/components/ui/avatar";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import {
  AlarmClockCheck,
  Camera,
  Compass,
  TimerOff,
} from "lucide-react-native";

import { useNotifyStore } from "@/store/useNotifyStore";
import * as Location from "expo-location";
import MapView, { Circle, Marker, UrlTile } from "react-native-maps";
// import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from "@/services/api";
import {
  clearTimer,
  getRemainingTimer,
  setTimerTarget,
} from "@/services/timerServices";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

interface Employee {
  full_name?: string;
  job_position?: string;
  [key: string]: any;
}

export default function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [cooldown, setCooldown] = useState(0);
  const [isDonePresence, setIsDonePresence] = useState(false);

  const [restCooldown, setRestCooldown] = useState(0);
  const [isRestDone, setIsRestDone] = useState(false);

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee>({});
  const [company, setCompany] = useState<any>({});
  const [photo, setPhoto] = useState<Array<string> | null>([]);
  const [photoClockOut, setPhotoClockOut] = useState<string | null>(null);
  const [listSetupLocations, setListSetupLocations] = useState<any[]>([]);
  const [checkPhotoMode, setCheckPhotoMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());

  const intervalLocation = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const mapRef = React.useRef<MapView>(null);
  const restIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const blinkAnim = React.useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const params = useLocalSearchParams();

  const $q = useNotifyStore();

  React.useEffect(() => {
    getInitialLocation();
    getEmployeeData();
    fetchCurrentLocation();
    getListLocations();

    // const locationInterval = setInterval(getListLocations, 10000);
    intervalLocation.current = setInterval(getListLocations, 10000);
    // setIntervalLocation(locationInterval);

    AsyncStorage.getItem("company").then((data) => {
      setCompany(JSON.parse(data || "{}"));
    });

    return () => {
      if (intervalLocation.current) clearInterval(intervalLocation.current);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, []);

  // ==========================================
  // ⏱️ EFFECT 1: PEMANTAU COOLDOWN WORKTIME (HITUNG MUNDUR)
  // ==========================================
  React.useEffect(() => {
    if (cooldown <= 0) return;

    const interval = setInterval(async () => {
      const remaining = await getRemainingTimer("COOLDOWN_KEY");
      setCooldown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  // ==========================================
  // 📈 EFFECT 2: PEMANTAU DURASI ISTIRAHAT (HITUNG MAJU)
  // ==========================================
  React.useEffect(() => {
    const startRestInterval = async () => {
      // Ambil durasi awal saat screen dimuat
      const remainingRest = await getRemainingTimer("INCTIME_KEY", false);
      setRestCooldown(remainingRest);

      // Jalankan interval pemantau real-time
      restIntervalRef.current = setInterval(async () => {
        const currentRest = await getRemainingTimer("INCTIME_KEY", false);
        setRestCooldown(currentRest);
      }, 1000) as any;
    };

    startRestInterval();
    // Cleanup interval saat user keluar halaman
    return () => {
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (isRestDone) {
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current);
      }
    }
  }, [restCooldown, isRestDone]);

  // ==========================================
  // ✨ EFFECT 3: BLINKING ANIMATION UNTUK REST COOLDOWN
  // ==========================================
  React.useEffect(() => {
    if (restCooldown > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(blinkAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    } else {
      blinkAnim.setValue(0);
    }
  }, [restCooldown, blinkAnim]);

  // ==========================================
  // ✨ EFFECT 4: MENANGANI FOTO
  // ==========================================
  React.useEffect(() => {
    if (params?.photoUri) {
      setPhoto((prev) => [...(prev || []), params.photoUri as string]);

      if (params.idPhoto == "clock-out") {
        console.log("Received photo URI for clock-out:", params.photoUri);
        setPhotoClockOut(params.photoUri as string);
      }
    }
  }, [params.photoUri, params.idPhoto]);

  React.useEffect(() => {
    if (photoClockOut) {
      console.log("Photo Clock Out updated, initiating Clock Out process.");
      handleClockOut()
    }
  }, [photoClockOut]);

  // ==========================================
  // ✨ EFFECT 5: SINKRONISASI OTOMATIS TIMER COOLDOWN DENGAN WAKTU RESMI PERUSAHAAN DARI SERVER
  // ==========================================
  React.useEffect(() => {
    if (company) {
      console.log("Company start_clock_out:", company.start_clock_out);
      syncTimer(true);
    }
  }, [JSON.stringify(company)]);

  // Koordinat default (Jakarta) jika lokasi gagal dimuat
  const initialRegion = {
    latitude: location?.coords.latitude || -6.2088,
    longitude: location?.coords.longitude || 106.8456,
    latitudeDelta: 0.005, // Mengatur tingkat zoom peta
    longitudeDelta: 0.005,
  };

  const getEmployeeData = async () => {
    try {
      const employeeData = await AsyncStorage.getItem("employee");
      if (employeeData) {
        console.log("Employee data loaded:", JSON.parse(employeeData));
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
      const isLocationServicesEnabled =
        await Location.hasServicesEnabledAsync();

      if (!isLocationServicesEnabled) {
        $q.dialog({
          title: "GPS Tidak Aktif",
          description:
            "Layanan lokasi (GPS) di perangkat kamu dinonaktifkan. Silakan aktifkan GPS kamu terlebih dahulu.",
          confirmText: "OK",
        });
        setLoadingLocation(false);
        return;
      }

      // Minta izin permission foreground
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        $q.dialog({
          title: "Akses Ditolak",
          description:
            "Aplikasi membutuhkan izin lokasi untuk melakukan presensi kehadiran.",
          confirmText: "OK",
        });
        setLoadingLocation(false);
        return;
      }

      // Ambil koordinat GPS
      let currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation(currentPosition);

      if (mapRef.current && currentPosition) {
        mapRef.current.animateToRegion(
          {
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
            latitudeDelta: 0.003,
            longitudeDelta: 0.003,
          },
          1000,
        );
      }
    } catch (error) {
      console.error("Error saat mendeteksi lokasi:", error);
    } finally {
      setLoadingLocation(false);
    }
  };

  const syncTimer = async (withPhoto = false) => {
    try {
      setLoading(true)
      // 1. Cek status resmi ke Laravel Herd terlebih dahulu
      const response = await api.get("/attendances/today-presence");
      const remaining_cooldown_seconds = response.data.data;

      console.log(
        "Get last clock in & company clock out:",
        [remaining_cooldown_seconds, remaining_cooldown_seconds.clock_in, company.start_clock_out],
      );

      if (remaining_cooldown_seconds && remaining_cooldown_seconds.clock_in) {
        if (!company.start_clock_out) {
          $q.notif({
            title: "Data Perusahaan Tidak Lengkap",
            description: "Data perusahaan tidak lengkap. Mohon hubungi admin untuk mengatur waktu kerja dan jam pulang perusahaan.",
            action: "error",
          });
          setLoading(false)

          return;
        }

        if (remaining_cooldown_seconds.clock_out) {
          $q.notif({
            title: "Sudah Clock Out",
            description: "Kamu sudah melakukan Clock Out hari ini. Terima kasih!",
            action: "info",
          });

          await clearTimer("COOLDOWN_KEY");
          setCooldown(0);
          await clearTimer("INCTIME_KEY");
          setRestCooldown(0);
          setIsDonePresence(true);
          setLoading(false)
          return;
          // setIsDonePresence(true);
        }

        const checkTimerElapsed = await execTimerElapsed(
          new Date(Date.now()).toLocaleTimeString("en-GB", { hour12: false }),
          company.start_clock_out,
          3 * 3600,
        );

        console.log(
          "Calculated remaining cooldown in seconds:",
          [checkTimerElapsed, remaining_cooldown_seconds.clock_in, company.start_clock_out],
        );

        await setTimerTarget("COOLDOWN_KEY", checkTimerElapsed);
        setCooldown(checkTimerElapsed);

        const getPhotoUri = remaining_cooldown_seconds.file_attachment
          ? `${process.env.EXPO_PUBLIC_STORAGE_URL}${remaining_cooldown_seconds.file_attachment}`
          : null;

        console.log("Photo URI from server:", getPhotoUri);

        if (withPhoto && getPhotoUri) {
          setPhoto((prev) => [...([]), getPhotoUri as string]);
        }

        if (remaining_cooldown_seconds.clock_istirahat) {

          const [hoursStartClock, minutesStartClock] =
            remaining_cooldown_seconds.clock_istirahat.split(":").map(Number);

          const clockInStartTime = new Date();
          clockInStartTime.setHours(hoursStartClock, minutesStartClock, 0, 0);

          const restStartTime = convertStringTimetoDate(
            remaining_cooldown_seconds.clock_istirahat,
          );

          if (restStartTime.getTime() < Date.now()) {
            await AsyncStorage.setItem(
              "INCTIME_KEY",
              restStartTime.getTime().toString(),
            );

            const checkTimerElapsed = await execTimerElapsed(
              remaining_cooldown_seconds.clock_istirahat,
              new Date(Date.now()),
            );

            setRestCooldown(checkTimerElapsed);
          } else {
            await AsyncStorage.removeItem("INCTIME_KEY");
            setRestCooldown(0);
          }

          if (remaining_cooldown_seconds.clock_istirahat_out) {
            const restStartTimeOut = convertStringTimetoDate(
              remaining_cooldown_seconds.clock_istirahat_out,
            );

            const elapsedMillis =
              restStartTimeOut.getTime() - restStartTime.getTime();

            const elapsedMilisCheck = await execTimerElapsed(
              remaining_cooldown_seconds.clock_istirahat,
              remaining_cooldown_seconds.clock_istirahat_out,
            );

            console.log(
              "Elapsed milliseconds between clock_istirahat and clock_istirahat_out:",
              [elapsedMillis, elapsedMilisCheck],
            );

            await AsyncStorage.setItem(
              "INCTIME_KEY",
              elapsedMilisCheck.toString(),
            );
            setIsRestDone(true);
            setRestCooldown(Math.floor(elapsedMilisCheck));

            // setIsRestDone(true);
            // setRestCooldown(Math.floor(elapsedMillis / 1000));
            if (restIntervalRef.current) {
              clearInterval(restIntervalRef.current);
            }
          }
        } else {
          console.log(
            "No active rest cooldown from server, clearing local rest timer.",
          );
        }
      } else {
        console.log(
          "No active cooldown from server, clearing local timer.",
          remaining_cooldown_seconds,
        );
        await clearTimer("COOLDOWN_KEY");
        setCooldown(0);
        await clearTimer("INCTIME_KEY");
        setRestCooldown(0);
      }
    } catch (error) {
      // 2. FALLBACK: Jika internet putus/offline, gunakan hitungan lokal AsyncStorage
      const localRemaining = await getRemainingTimer("COOLDOWN_KEY");
      setCooldown(localRemaining);
      const localRestRemaining = await getRemainingTimer("INCTIME_KEY");
      setRestCooldown(localRestRemaining);
    } finally {
      setLoading(false);
    }
  };

  const execTimerElapsed = async (
    times: string,
    compareTimes: Date | string,
    spareTime: number = 0,
  ) => {
    const [hours, minutes] = times.split(":").map(Number);
    const targetTime = new Date();
    targetTime.setHours(hours, minutes, 0, 0);

    let compareTime: Date;

    if (typeof compareTimes === "string") {
      const [compHours, compMinutes] = compareTimes.split(":").map(Number);
      compareTime = new Date();
      compareTime.setHours(compHours, compMinutes, 0, 0);
    } else {
      compareTime = compareTimes;
    }

    const remainingTime = compareTime.getTime() - targetTime.getTime() + spareTime * 1000;
    return Math.max(0, Math.floor(remainingTime / 1000));
  };

  const convertStringTimetoDate = (times: string) => {
    const [hoursOut, minutesOut] = times.split(":").map(Number);
    const restStartTimeOut = new Date();

    restStartTimeOut.setHours(hoursOut, minutesOut, 0, 0);

    return restStartTimeOut;
  };

  async function getInitialLocation() {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      $q.notif({
        title: "Izin Ditolak",
        description: "Aplikasi butuh izin lokasi untuk melakukan Clock In.",
        action: "error",
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
        title: "Tidak Bisa Hapus Foto",
        description:
          "Foto tidak bisa dihapus saat kamu sudah melakukan Clock In. Silakan lakukan Clock Out terlebih dahulu untuk menghapus foto.",
        action: "error",
      });

      return;
    }
    $q.dialog({
      title: "Hapus Foto",
      description: "Apakah kamu yakin ingin menghapus foto ini dari daftar?",
      confirmText: "Hapus",
      cancelText: "Batal",
      onConfirm: () => {
        setPhoto(
          (prevPhotos) => prevPhotos?.filter((_, index) => index !== idx) || [],
        );
        $q.notif({
          title: "Foto Dihapus",
          description: "Foto berhasil dihapus dari daftar.",
          action: "success",
        });
      },
    });
  };

  const takePhoto = (idx: string) => {
    router.push({
      pathname: "/camera-modal",
      params: {
        id: idx,
      },
    });
  };

  const initHandleClockIn = async () => {
    const getCompanyStore = JSON.parse(
      (await AsyncStorage.getItem("company")) || "{}",
    );
    const getNowTime = new Date();
    const timeString = getCompanyStore.work_start_time || "08:00";
    const [hours, minutes] = timeString.split(":").map(Number);
    const getStartWorkTime = new Date();
    getStartWorkTime.setHours(hours, minutes, 0, 0);

    let result

    if (getNowTime < getStartWorkTime) {
      $q.dialog({
        title: "Belum Waktu Kerja",
        description: `Waktu kerja kamu mulai pukul ${getStartWorkTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Silakan kembali lagi nanti.`,
        confirmText: "OK",
        onConfirm: () => {
          result = executeClockInBackend();
        },
      });
    } else if (
      getNowTime > getStartWorkTime &&
      getNowTime < new Date(getStartWorkTime.getTime() + 60 * 60 * 1000)
    ) {
      $q.dialog({
        title: "Waktu Kerja Dimulai",
        description: `Waktu kerja kamu sudah dimulai. Silakan lakukan Clock In sekarang.`,
        confirmText: "OK",
        onConfirm: () => {
          result = executeClockInBackend();
        },
      });
    } else if (
      getNowTime > new Date(getStartWorkTime.getTime() + 60 * 60 * 1000)
    ) {
      $q.dialog({
        title: "Terlambat Clock In",
        description: `Waktu kerja kamu sudah dimulai lebih dari 1 jam yang lalu ${getStartWorkTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Apakah kamu yakin ingin melakukan Clock In?`,
        confirmText: "Yakin",
        cancelText: "Batal",
        onConfirm: () => {
          result = executeClockInBackend();
        },
        onCancel: () => {
          console.log("User membatalkan Clock In karena terlambat");
        },
      });
    } else {
      // executeClockInBackend();
    }

    if (result) {
      const remainingTimeInSeconds = calculateRemainingCooldown(
        getCompanyStore.start_clock_out,
      );
      await setTimerTarget("COOLDOWN_KEY", remainingTimeInSeconds);
      setCooldown(remainingTimeInSeconds); // Set cooldown berdasarkan sisa waktu ke work_start_time

      syncTimer();
    } else {
      syncTimer();
    }
  };

  const handleClockOut = () => {
    if (!photoClockOut) {
      takePhoto('clock-out')
      return;
    }

    $q.dialog({
      title: "Clock Out",
      description: "Apakah kamu yakin ingin melakukan Clock Out?",
      confirmText: "Yakin",
      cancelText: "Batal",
      formFields: [
        {
          key: "reason_note",
          label: "Job Description / Alasan Clock Out",
          placeholder:
            "Contoh: Selesai bekerja, pulang lebih awal karena ada keperluan mendadak, dll.",
          type: "textarea",
          required: true,
        },
      ],
      onConfirm: async (formValues) => {
        setLoading(true);
        try {
          const formData = new FormData();
          const localUri = typeof photoClockOut === "string"
            ? photoClockOut
            : photo?.[1];

          console.log("Local URI for Clock Out photo:", localUri);

          // 2. Ekstrak nama file asli dari ujung URI cache ImagePicker
          const filename = String(localUri).split("/").pop() || "photo.jpg";
          formData.append("photo", {
            uri: localUri,
            name: filename,
            type: "image/jpeg", // Menyesuaikan dengan ekstensi .jpeg dari ImagePicker kamu
          } as any);

          formData.append("activity", formValues.reason_note || "");

          const response = await api.post("/attendances/clock-out", formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });

          console.log("Response dari server setelah Clock Out:", response.data);
          if (response.data) {
            await clearTimer("COOLDOWN_KEY");
            await clearTimer("INCTIME_KEY");
            setCooldown(0);
            setRestCooldown(0);
            setIsRestDone(false);
            setPhoto([]);
            $q.notif({
              title: "Clock Out Berhasil",
              description:
                "Kamu telah melakukan Clock Out. Sampai jumpa besok!",
              action: "success",
            });
          } else {
            $q.notif({
              title: "Clock Out Gagal",
              description: "Gagal melakukan Clock Out. Silakan coba lagi.",
              action: "error",
            });
          }
        } catch (error) {
          console.log("Error saat melakukan Clock Out:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          const errorResponse =
            error && typeof error === "object" && "response" in error
              ? (error as any).response
              : null;
          const serverMessage = errorResponse?.data?.error || errorMessage;
          $q.notif({
            title: "Clock Out Gagal",
            description: serverMessage,
            action: "error",
          });
        } finally {
          setLoading(false);
        }
      },
      onCancel: () => {
        console.log("User membatalkan Clock Out");
        syncTimer(true);
      },
    });
  };

  const handleRestClockIn = () => {
    $q.dialog({
      title: "Istirahat Clock In",
      description:
        "Apakah kamu yakin ingin melakukan Clock In untuk istirahat?",
      confirmText: "Yakin",
      cancelText: "Batal",
      onConfirm: async () => {
        setLoading(true);
        if (!location) {
          $q.notif({
            title: "Lokasi Tidak Terdeteksi",
            description:
              "Tidak dapat mendeteksi lokasi kamu. Pastikan GPS aktif dan coba lagi.",
            action: "error",
          });
          return;
        }

        try {
          const formData = new FormData();
          formData.append("latitude", String(location.coords.latitude));
          formData.append("longitude", String(location.coords.longitude));
          const localUri =
            typeof photo === "string"
              ? photo
              : Array.isArray(photo)
                ? photo[0]
                : photo;

          // 2. Ekstrak nama file asli dari ujung URI cache ImagePicker
          const filename = String(localUri).split("/").pop() || "photo.jpg";
          formData.append("photo", {
            uri: localUri,
            name: filename,
            type: "image/jpeg", // Menyesuaikan dengan ekstensi .jpeg dari ImagePicker kamu
          } as any);

          const response = await api.post(
            "/attendances/clock-istirahat",
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            },
          );
          const getData = response.data.data;

          if (getData) {
            // const remainingTimeInSeconds = calculateRemainingCooldown(getData.start_clock_out);
            await AsyncStorage.removeItem("INCTIME_KEY");

            const startTime = Date.now().toString();
            await AsyncStorage.setItem("INCTIME_KEY", startTime);

            setRestCooldown(1);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          const errorResponse =
            error && typeof error === "object" && "response" in error
              ? (error as any).response
              : null;

          const serverMessage = errorResponse?.data?.error || errorMessage;
          $q.notif({
            title: "Clock In Gagal",
            description: serverMessage,
            action: "error",
          });
        } finally {
          setSubmitting(false);
          setLoading(false);
          syncTimer();
        }
      },
      onCancel: () => {
        console.log("User membatalkan Clock In untuk istirahat");
        syncTimer();
      },
    });
  };

  const handleRestClockOut = () => {
    $q.dialog({
      title: "Istirahat Clock Out",
      description:
        "Apakah kamu yakin ingin melakukan Clock Out untuk istirahat?",
      confirmText: "Yakin",
      cancelText: "Batal",
      onConfirm: async () => {
        try {
          setLoading(true);
          if (!location) {
            $q.notif({
              title: "Lokasi Tidak Terdeteksi",
              description:
                "Tidak dapat mendeteksi lokasi kamu. Pastikan GPS aktif dan coba lagi.",
              action: "error",
            });
            return;
          }

          const formData = new FormData();
          formData.append("latitude", String(location.coords.latitude));
          formData.append("longitude", String(location.coords.longitude));

          const response = await api.post("/attendances/clock-istirahat-out");

          if (response.data.data) {
            await clearTimer("INCTIME_KEY");
            setRestCooldown(0);
            $q.notif({
              title: "Clock Out Istirahat Berhasil",
              description: "Kamu telah melakukan Clock Out untuk istirahat.",
              action: "success",
            });

            syncTimer();
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          const errorResponse =
            error && typeof error === "object" && "response" in error
              ? (error as any).response
              : null;
          const serverMessage = errorResponse?.data?.error || errorMessage;
          $q.notif({
            title: "Clock Out Istirahat Gagal",
            description: serverMessage,
            action: "error",
          });
        } finally {
          setLoading(false);
          syncTimer();
        }
      },
      onCancel: () => {
        console.log("User membatalkan Clock Out untuk istirahat");
      },
    });
  };

  const executeClockInBackend = async () => {
    if (!location) {
      $q.notif({
        title: "Lokasi Tidak Terdeteksi",
        description:
          "Tidak dapat mendeteksi lokasi kamu. Pastikan GPS aktif dan coba lagi.",
        action: "error",
      });

      console.log("Check Location Failed: Location data is null", location);
      return false;
    } else {
      try {
        if (!photo) {
          $q.notif({
            title: "Foto Tidak Tersedia",
            description:
              "Silakan ambil foto terlebih dahulu sebelum melakukan Clock In.",
            action: "error",
          });
          return false;
        }

        setLoading(true);
        setSubmitting(true);

        // Convert photo URI to blob for proper file upload
        const formData = new FormData();
        formData.append("latitude", String(location.coords.latitude));
        formData.append("longitude", String(location.coords.longitude));
        const localUri =
          typeof photo === "string"
            ? photo
            : Array.isArray(photo)
              ? photo[0]
              : photo;

        // 2. Ekstrak nama file asli dari ujung URI cache ImagePicker
        const filename = String(localUri).split("/").pop() || "photo.jpg";
        formData.append("photo", {
          uri: localUri,
          name: filename,
          type: "image/jpeg", // Menyesuaikan dengan ekstensi .jpeg dari ImagePicker kamu
        } as any);


        const getCompanyStore = JSON.parse(
          (await AsyncStorage.getItem("company")) || "{}",
        );

        // Get remaining time between start_clock_out and now
        if (getCompanyStore.start_clock_out) {
          getDeviceTimezone(); // Pastikan untuk mendapatkan timezone perangkat sebelum menghitung waktu

          const remainingTimeInSeconds = calculateRemainingCooldown(
            getCompanyStore.start_clock_out,
          );

          if (remainingTimeInSeconds > 0) {
            // console.log('Remaining time in seconds until work_start_time:', remainingTimeInSeconds);
            // await setTimerTarget("COOLDOWN_KEY", remainingTimeInSeconds);
            // setCooldown(remainingTimeInSeconds); // Set cooldown berdasarkan sisa waktu ke work_start_time

            const response = await api.post("/attendances/clock-in", formData, {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            });

            let getData = response.data.data;

            return getData;
          } else {
            $q.notif({
              title: "Waktu Kerja Selesai",
              description: `Waktu kerja kamu sudah selesai untuk hari ini ${getCompanyStore.start_clock_out}. Silakan lakukan Clock In kembali saat waktu kerja berikutnya dimulai.`,
              action: "warning"
            });

            await clearTimer("COOLDOWN_KEY");
            setCooldown(0);

            return false
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        const errorResponse =
          error && typeof error === "object" && "response" in error
            ? (error as any).response
            : null;

        const serverMessage = errorResponse?.data?.error || errorMessage;
        $q.notif({
          title: "Clock In Gagal",
          description: serverMessage,
          action: "error",
        });

        return false;
      } finally {
        setSubmitting(false);
        setLoading(false);
      }
    }
  };

  const calculateRemainingCooldown = (
    startClockOut: string,
    startClockIn: string = "",
  ) => {
    const [hours, minutes] = startClockOut.split(":").map(Number);
    const workEndTime = new Date();
    workEndTime.setHours(hours, minutes, 0, 0);

    let now;
    if (startClockIn) {
      const [inHours, inMinutes] = startClockIn.split(":").map(Number);
      now = new Date();
      now.setHours(inHours, inMinutes, 0, 0);
    } else {
      now = new Date();
    }

    const remainingTime = workEndTime.getTime() - now.getTime();
    return Math.max(0, Math.floor(remainingTime / 1000)); // Pastikan tidak negatif
  };

  const convertSecondsToHMS = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const getListLocations = async () => {
    try {
      const response = await api.get("/gps-location");
      setListSetupLocations(response.data.data);
    } catch (error) {
      console.error("Failed to fetch attendance locations:", error);
      $q.notif({
        title: "Gagal Memuat Lokasi",
        description:
          "Tidak dapat memuat daftar lokasi kehadiran. Silakan coba lagi nanti.",
        action: "error",
      });
    }
  };

  const onPressPhoto = (uri: string) => {
    router.push({
      pathname: "/photo-viewer",
      params: {
        photoUri: uri,
        title: "Foto Presensi",
        subtitle: new Date().toLocaleString(),
      },
    });
  };

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
              source={require("@/assets/images/location.png")}
              style={{ width: 35, height: 35 }}
              resizeMode="contain"
            />
          </Marker>
        )}

        {listSetupLocations.length > 0 &&
          listSetupLocations.map((loc, index) => (
            <Marker
              key={`marker-${index}`}
              coordinate={{
                latitude: parseFloat(loc.latitude),
                longitude: parseFloat(loc.longitude),
              }}
              title={loc.gpc_location_name}
              description={`Radius absen : ${loc.radius} Meter`}
              pinColor="#FF6B6B"
            />
          ))}

        {listSetupLocations.length > 0 &&
          listSetupLocations.map((loc, index) => (
            <Circle
              key={`circle-${index}`}
              center={{
                latitude: parseFloat(loc.latitude),
                longitude: parseFloat(loc.longitude),
              }}
              radius={parseFloat(loc.radius)}
              strokeColor="rgba(0, 0, 255, 0.5)"
              fillColor="rgba(0, 0, 255, 0.2)"
            />
          ))}
      </MapView>

      {/* My Location Button */}
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
                {employee?.full_name
                  ? employee.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                  : "NA"}
              </AvatarFallbackText>
              <AvatarBadge />
            </Avatar>

            <VStack>
              <Heading size="xs" className="text-black">
                {employee?.full_name || "Ronald Richards"}
              </Heading>
              <Text size="xs" className="text-gray-500">
                {employee?.job_position || "Nursing Assistant"}
              </Text>
            </VStack>
          </HStack>
        </VStack>
      </View>

      <Animated.View
        style={[
          styles.floatingTimerRestContainer,
          restCooldown > 0 &&
          !isRestDone && {
            backgroundColor: blinkAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [
                "rgba(255, 255, 255, 0.9)",
                "rgba(255, 165, 0, 0.9)",
              ],
            }),
          },
        ]}
      >
        <VStack space="2xl">
          {/* Tambahkan className="w-full" di sini */}
          <HStack space="md" className="w-full items-center justify-start">
            <VStack className="px-2 py-1 rounded w-1/2">
              <Text size="xs" className="text-gray-500">
                Worktime Remaining
              </Text>
              <Heading size="xs" className="text-black">
                {cooldown > 0 ? convertSecondsToHMS(cooldown) : "Ready"}
              </Heading>
            </VStack>
            <VStack className="px-2 py-1 rounded w-1/2">
              <Text size="xs" className="text-gray-500">
                Istirahat
              </Text>
              <Heading size="xs" className="text-black">
                {restCooldown > 0 ? convertSecondsToHMS(restCooldown) : "Ready"}
              </Heading>
            </VStack>
          </HStack>
        </VStack>
      </Animated.View>

      {/* Floating Button Container */}
      <View style={styles.floatingButtonContainer}>
        <VStack space="md" className="w-full">
          {cooldown === 0 && photo?.length === 0 && (
            <Button
              size="lg"
              className={`w-full rounded-full bg-blue-500`}
              onPress={() => takePhoto('clock-in')}
              isDisabled={loading}
            >
              {loading && <ButtonSpinner color="#ffffff" />}
              <ButtonText className="text-white">Ambil Foto Absen</ButtonText>
              <ButtonIcon as={Camera} color="#ffffff" />
            </Button>
          )}
          {cooldown === 0 && (photo?.length ?? 0) > 0 && (
            <Button
              size="lg"
              className={`w-full rounded-full bg-green-500`}
              onPress={initHandleClockIn}
              isDisabled={loading}
            >
              {loading && <ButtonSpinner color="#ffffff" />}
              <ButtonText className="text-white">Clock In Sekarang</ButtonText>
              <ButtonIcon as={AlarmClockCheck} color="#ffffff" />
            </Button>
          )}
          {cooldown > 0 && (
            <Button
              size="lg"
              className={`w-full rounded-full bg-red-500`}
              onPress={handleClockOut}
              isDisabled={loading}
            >
              {loading && <ButtonSpinner color="#ffffff" />}
              <ButtonText className="text-white">Clock Out Sekarang</ButtonText>
              <ButtonIcon as={AlarmClockCheck} color="#ffffff" />
            </Button>
          )}

          {restCooldown === 0 && (
            <Button
              isDisabled={cooldown === 0 || loading}
              size="lg"
              className={`w-full rounded-full bg-orange-500`}
              onPress={handleRestClockIn}
            >
              {loading && <ButtonSpinner color="#ffffff" />}
              <ButtonText className="text-white">{`Istirahat Clock In`}</ButtonText>
              <ButtonIcon as={TimerOff} color="#ffffff" />
            </Button>
          )}
          {restCooldown > 0 && (
            <Button
              size="lg"
              className={`w-full rounded-full bg-purple-500`}
              onPress={handleRestClockOut}
              isDisabled={loading || isRestDone}
            >
              {loading && <ButtonSpinner color="#ffffff" />}
              <ButtonText className="text-white">
                Istirahat Clock Out
              </ButtonText>
              <ButtonIcon as={TimerOff} color="#ffffff" />
            </Button>
          )}
        </VStack>
      </View>

      {/* List Photos */}
      <View style={styles.floatingListPhotosContainer}>
        <VStack space="md" className="justify-end items-left">
          <HStack className="justify-between items-center">
            <Text size="md" className="text-gray-500 font-bold">
              Foto Presensi Kamu
            </Text>
            <Checkbox
              value="checkPhotoMode"
              isChecked={checkPhotoMode}
              onChange={() => setCheckPhotoMode(!checkPhotoMode)}
            />
          </HStack>
        </VStack>
        <VStack space="md" className="justify-end items-center">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <HStack space="md">
              {photo && photo.length > 0 ? (
                photo.map((uri, index) => (
                  <TouchableOpacity
                    key={index}
                    style={{ width: 60, height: 60 }}
                    onPress={() =>
                      checkPhotoMode
                        ? setSelectedPhotos((prev) => {
                          const newSet = new Set(prev);
                          newSet.has(index)
                            ? newSet.delete(index)
                            : newSet.add(index);
                          return newSet;
                        })
                        : onPressPhoto(uri)
                    }
                    onLongPress={() => handleDeletePhoto(index)}
                  >
                    <View style={{ position: "relative" }}>
                      <Image
                        key={index}
                        source={{ uri }}
                        style={{
                          width: 50,
                          height: 50,
                          top: 5,
                          borderRadius: 8,
                          opacity: selectedPhotos.has(index) ? 0.5 : 1,
                        }}
                        resizeMode="cover"
                      />
                      {checkPhotoMode && (
                        <View
                          style={{ position: "absolute", top: 2, right: 2 }}
                        >
                          <Checkbox
                            value={`photo-${index}`}
                            isChecked={selectedPhotos.has(index)}
                            onChange={() =>
                              setSelectedPhotos((prev) => {
                                const newSet = new Set(prev);
                                newSet.has(index)
                                  ? newSet.delete(index)
                                  : newSet.add(index);
                                return newSet;
                              })
                            }
                          />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text size="md" className="text-gray-500">
                  Belum ada foto yang diambil.
                </Text>
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
    backgroundColor: "#ffffff", // Samakan dengan warna background tema aplikasi
  },
  mapContainer: {
    flex: 1,
    overflow: "hidden",
  },
  floatingButtonContainer: {
    position: "absolute",
    bottom: 30, // Jarak melayang dari ujung bawah layar HP
    left: 20, // Memberikan space di kiri agar tombol tidak mentok screen
    right: 20, // Memberikan space di kanan
    backgroundColor: "transparent", // Dibuat transparan agar bayangan tombolnya saja yang kelihatan
    zIndex: 10, // Memastikan wajib berdiri di atas lapisan peta
  },
  floatingUsersContainer: {
    position: "absolute",
    top: 10, // Jarak melayang dari ujung atas layar HP
    left: 20, // Memberikan space di kiri agar tidak mentok screen
    right: 40, // Memberikan space di kanan
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10, // Memastikan wajib berdiri di atas lapisan peta
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 8,
  },
  floatingTimerRestContainer: {
    position: "absolute",
    top: 80, // Jarak melayang dari ujung atas layar HP
    left: 20, // Memberikan space di kiri agar tidak mentok screen
    right: 40, // Memberikan space di kanan
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10, // Memastikan wajib berdiri di atas lapisan peta
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 8,
  },
  myLocationButton: {
    position: "absolute",
    bottom: 130, // Atur jarak dari bawah layar sesuai selera (di atas tombol absen)
    right: 20, // Jarak dari kanan layar
    backgroundColor: "#fff",
    width: 50,
    height: 50,
    borderRadius: 25, // Membuat tombol bulat sempurna
    justifyContent: "center",
    alignItems: "center",
    elevation: 5, // Efek bayangan timbul di Android
    shadowColor: "#000", // Efek bayangan di iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 10, // Memastikan tombol berada di atas peta
  },
  floatingListPhotosContainer: {
    position: "absolute",
    bottom: 130, // Atur jarak dari bawah layar sesuai selera (di atas tombol absen)
    left: 20, // Jarak dari kiri layar
    right: 90, // Jarak dari kanan layar (50 untuk myLocationButton + 20 padding + 20 spacing)
    backgroundColor: "rgba(194, 194, 194, 0.85)",
    borderRadius: 12,
    padding: 8,
    zIndex: 10, // Memastikan tombol berada di atas peta
    height: 90,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
