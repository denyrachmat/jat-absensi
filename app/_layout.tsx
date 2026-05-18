import { ToastBridge } from "@/components/ToastBridge";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import "../global.css";

import { useColorScheme } from "@/hooks/use-color-scheme";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";

import DialogBridge from "@/components/DialogBridge";

// export const unstable_settings = {
//   anchor: "(auth)",
// };

export default function RootLayout() {
  const colorScheme = useColorScheme();

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
