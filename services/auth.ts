import { api } from "./api";

export const login = async (username: string, password: string) => {
  const endpoint = "/auth/login";
  const response = await api.post(endpoint, {
    username,
    password,
  });

  console.log("Full URL:", `${api.defaults.baseURL}${endpoint}`);

  return response.data;
};
