import { Button, ButtonText } from "@/components/ui/button";
import {
  FormControl,
  FormControlError,
  FormControlErrorIcon,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { AlertCircleIcon } from "@/components/ui/icon";
import { Input, InputField } from "@/components/ui/input";
import { VStack } from "@/components/ui/vstack";
import { login } from "@/services/auth";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Text, View } from "react-native";

export default function Login() {
  const [isInvalid, setIsInvalid] = React.useState(false);
  const [Username, setUsername] = React.useState("");
  const [Password, setPassword] = React.useState("");

  const handleSubmit = async () => {
    if (Password.length < 6) {
      setIsInvalid(true);
    } else {
      setIsInvalid(false);
      try {
        const response = await login(Username, Password);
        console.log("Login successful:", response);
      } catch (error) {
        console.error("Login failed:", error);
      }
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
            <Input className="my-1 bg-white" size="md">
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
            <Input className="my-1 bg-white" size="md">
              <InputField
                type="password"
                value={Password}
                onChangeText={(text) => setPassword(text)}
                className="text-black-300"
              />
            </Input>
            <FormControlHelper>
              <FormControlHelperText className="text-red-500">
                Must be at least 6 characters.
              </FormControlHelperText>
            </FormControlHelper>
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
            className="w-fit self-end mt-4 bg-gray-500"
            size="sm"
            variant="outline"
            onPress={handleSubmit}
          >
            <ButtonText>Submit</ButtonText>
          </Button>
        </LinearGradient>
      </VStack>
      <VStack className="justify-top items-center bg-white h-20 pt-4">
        <Text className="text-gray-500">Don't have an account? Sign up</Text>
      </VStack>
    </View>
  );
}
