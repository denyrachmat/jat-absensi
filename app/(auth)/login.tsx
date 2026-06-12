import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import {
  FormControl,
  FormControlError,
  FormControlErrorIcon,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { AlertCircleIcon } from "@/components/ui/icon";
import { Input, InputField } from "@/components/ui/input";
import { VStack } from "@/components/ui/vstack";
import { registerForPushNotificationsAsync } from "@/services/notificationService";
import * as Device from "expo-device";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Text, View } from "react-native";

import { api } from "@/services/api";
import { useNotifyStore } from "@/store/useNotifyStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Login() {
  const [isInvalid, setIsInvalid] = React.useState(false);
  const [Username, setUsername] = React.useState("");
  const [Password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [fcmToken, setFcmToken] = React.useState("");
  const [notifReady, setNotifReady] = React.useState(false);

  const intervalCompanyRef = React.useRef<NodeJS.Timeout | number | null>(null);

  const $q = useNotifyStore();
  const router = useRouter();

  // 1. Hook Inisialisasi Pertama
  React.useEffect(() => {
    async function initNotification() {
      setTimeout(async () => {
        try {
          const token = await registerForPushNotificationsAsync();
          if (token) setFcmToken(token);
        } catch (e) {
          console.error("Gagal mengambil token di Android 16:", e);
        } finally {
          setNotifReady(true);
        }
      }, 1500);
    }
    
    initNotification();

    return () => {
      if (intervalCompanyRef.current) clearInterval(intervalCompanyRef.current);
    };
  }, []);

  // 2. Hook Pemicu Cek Login setelah proses notifikasi selesai (berhasil dapat token atau tidak)
  React.useEffect(() => {
    if (notifReady) {
      checkLoginStatus();
    }
  }, [notifReady]);

  const handleSubmit = async () => {
    if (Password.length < 6) {
      setIsInvalid(true);
    } else {
      setIsInvalid(false);
      setIsLoading(true);
      try {
        const getDeviceId = await AsyncStorage.getItem("device_id");
        if (!getDeviceId) {
          const newDeviceId = Device.osBuildId || "device_unique_id_here";
          await AsyncStorage.setItem("device_id", newDeviceId);
        }

        const deviceId = await AsyncStorage.getItem("device_id");

        const response = await api.post("/auth/login", {
          employee_id: Username,
          password: Password,
          device_id: deviceId,
          token_fcm: fcmToken,
        });

        const tokenJWT = response.data.data.token;

        // Simpan token ke storage lokal agar di-pick up oleh Axios Interceptor
        await AsyncStorage.setItem("user_token", tokenJWT);
        await AsyncStorage.setItem("employee_id", Username);
        await AsyncStorage.setItem(
          "employee",
          JSON.stringify(response.data.data.employee),
        );

        $q.notif({
          title: "Success",
          description: "Login successful!",
          action: "success",
        });

        router.replace("/(tabs)");
      } catch (error) {
        const err = error as any;
        console.error("Login failed:", err.response || err.message);
        const deviceId = await AsyncStorage.getItem("device_id");
        $q.notif({
          title: "Login Failed",
          description: "Please check your credentials and try again.",
          action: "error",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getCompanyData = async () => {
    try {
      const response = await api.get("/company");
      AsyncStorage.removeItem("company");
      AsyncStorage.setItem("company", JSON.stringify(response.data.data));

      console.log("Company data updated:", response.data.data);
    } catch (error) {
      const err = error as any;
      console.error(
        "Failed to fetch company data:",
        err.response || err.message,
      );
    }
  };

  const checkLoginStatus = async () => {
    try {
      const token = await AsyncStorage.getItem("user_token");
      if (!token) return; // Jika tidak ada token login, hentikan fungsi dengan aman

      setIsInvalid(false);
      setIsLoading(true);

      const employeeId = await AsyncStorage.getItem("employee_id");
      const deviceId = await AsyncStorage.getItem("device_id");

      const response = await api.post(
        "/auth/check-login-expiring",
        { employee_id: employeeId, device_id: deviceId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await AsyncStorage.setItem("employee", JSON.stringify(response.data.data.employee));

      if (response.data.data.is_expiring) {
        $q.notif({
          title: "Session Expiring",
          description: "Your session is expiring soon. Please log in again.",
          action: "warning",
        });
      } else {
        await getCompanyData();

        // 👈 Manajemen timer menggunakan useRef (Aman dari Infinite Loop Re-render)
        if (intervalCompanyRef.current) clearInterval(intervalCompanyRef.current);
        intervalCompanyRef.current = setInterval(() => {
          getCompanyData();
        }, 30000);

        // Berikan jeda waktu mikroskopis agar state stabil sebelum navigasi berjalan
        setTimeout(() => {
          router.replace("/(tabs)");
        }, 100);
      }
    } catch (error) {
      const err = error as any;
      console.error("Check login expiring failed:", err.response || err.message);
      if (err.response?.status === 401) {
        await AsyncStorage.multiRemove(["user_token", "employee_id", "employee"]);
        router.replace("/(auth)/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1">
      <VStack className="justify-center items-center bg-white">
        <Image
          source={require("@/assets/images/jatlogo.png")}
          style={{ width: 250, height: 250, alignSelf: "center" }}
        />
      </VStack>
      <VStack className="flex-1 justify-top ">
        <LinearGradient
          colors={["#fff", "#0ea5e9"]}
          className="flex-1 px-8 pt-10"
        >
          <View className="mb-4 justify-top">
            <Text className="text-3xl font-bold text-gray-500">HRIS Login</Text>
          </View>
          <FormControl
            isInvalid={isInvalid}
            size="md"
            isDisabled={false}
            isReadOnly={false}
            isRequired={false}
          >
            <FormControlLabel>
              <FormControlLabelText className="text-gray-500">
                Username
              </FormControlLabelText>
            </FormControlLabel>
            <Input className="my-1 bg-white" size="md" isDisabled={isLoading}>
              <InputField
                type="text"
                value={Username}
                onChangeText={(text) => setUsername(text)}
                className="text-black-300"
              />
            </Input>
            <FormControlLabel>
              <FormControlLabelText className="text-gray-500">
                Password
              </FormControlLabelText>
            </FormControlLabel>
            <Input className="my-1 bg-white" size="md" isDisabled={isLoading}>
              <InputField
                type="password"
                value={Password}
                onChangeText={(text) => setPassword(text)}
                className="text-black-300"
              />
            </Input>
            <FormControlError>
              <FormControlErrorIcon
                as={AlertCircleIcon}
                className="text-red-500"
              />
              <FormControlErrorText className="text-red-500">
                At least 6 characters are required.
              </FormControlErrorText>
            </FormControlError>
          </FormControl>
          <Button
            className="w-full mt-4 bg-blue-500 border border-white"
            size="lg"
            variant="outline"
            onPress={handleSubmit}
          >
            {isLoading && <ButtonSpinner color="white" />}
            <ButtonText className="text-white">{isLoading ? "Loading..." : "Login"}</ButtonText>
          </Button>
        </LinearGradient>
      </VStack>
      <VStack className="justify-top items-center bg-white h-20 pt-4">
        <Text className="text-gray-500">Don't have an account? Sign up</Text>
      </VStack>
    </View>
  );
}
