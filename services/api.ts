import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useNotifyStore } from '../store/useNotifyStore'; // Sesuaikan path store kamu

// 1. Ambil URL API secara otomatis sesuai environment (dev / prod)
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// 2. Request Interceptor: Otomatis tempel Token Bearer jika user sudah login
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('user_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 3. Response Interceptor: Tangkap error global & langsung munculin $q.notif
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ambil fungsi notif dari Zustand di luar komponen React
    const $q = useNotifyStore.getState();

    let message = 'Terjadi kesalahan pada server';
    
    if (error.response) {
      // Error dari server (e.g. status 400, 422, 500)
      message = error.response.data?.message || message;
      
      // Contoh handle session kadaluwarsa (401)
      if (error.response.status === 401) {
        message = 'Sesi kamu telah berakhir, silakan login ulang.';
        AsyncStorage.removeItem('user_token');
        // Kamu bisa trigger redirect ke halaman login di sini jika perlu
      }
    } else if (error.request) {
      // Error karena masalah jaringan / timeout
      message = 'Gagal terhubung ke server. Periksa koneksi internet kamu.';
    }

    // Tampilkan pesan error ala Quasar secara otomatis!
    // $q.notif({
    //   title: 'Gagal',
    //   description: message,
    //   action: 'error',
    // });

    return Promise.reject(error);
  }
);