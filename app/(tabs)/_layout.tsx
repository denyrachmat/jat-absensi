import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Icon } from '@/components/ui/icon';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlarmClock, Settings } from 'lucide-react-native';


export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Clock In/Out',
            tabBarIcon: ({ color }) => <Icon className="text-typography-600" as={AlarmClock} color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <Icon className="text-typography-600" as={Settings} color={color} />,
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // Samakan dengan warna background tema aplikasi
  },
});