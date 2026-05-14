// config/env.ts
export const ENV = {
  API_URL: process.env.EXPO_PUBLIC_API_URL!,
  APP_NAME: process.env.EXPO_PUBLIC_APP_NAME!,

  IS_DEV: process.env.NODE_ENV === "development",
  IS_PROD: process.env.NODE_ENV === "production",
};
