import { ToastBridge } from "@/components/ToastBridge";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen"; // 👈 1. IMPORT SPLASH SCREEN
import { StatusBar } from "expo-status-bar";
import React from "react"; // 👈 Pastikan React terimport dengan benar
import "react-native-reanimated";

import DialogBridge from "@/components/DialogBridge";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { useColorScheme } from "@/hooks/use-color-scheme";
import "../global.css"; // Cukup satu saja import global.css nya

// 👈 2. Cegah Splash Screen menutup otomatis sebelum layout siap
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    // 👈 3. Buat simulasi jeda kecil agar arsitektur Gluestack & Theme siap, lalu sembunyikan Splash Screen
    async function prepare() {
      try {
        // Kamu bisa taruh inisialisasi font atau asset lain di sini jika ada
        await new Promise((resolve) => setTimeout(resolve, 500)); 
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync(); // 👈 KUNCI UTAMA: Matikan splash screen native!
      }
    }

    prepare();
  }, []);

  // Jika belum ready, tahan dulu rendering-nya agar Android tidak crash me-render halaman kosong
  if (!isReady) {
    return null;
  }

  return (
    <GluestackUIProvider mode="dark">
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <ToastBridge />
        <Stack>
          <Stack.Screen
            name="(auth)"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
      <DialogBridge />
    </GluestackUIProvider>
  );
}