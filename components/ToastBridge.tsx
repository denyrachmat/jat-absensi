import { Toast, ToastDescription, ToastTitle, useToast } from '@/components/ui/toast';
import { VStack } from "@/components/ui/vstack";
import { useEffect } from 'react';
import { useNotifyStore } from '../store/useNotifyStore'; // Sesuaikan path

export const ToastBridge = () => {
  const toast = useToast();

  useEffect(() => {
    // Kita "daftarkan" fungsi toast Gluestack ke dalam Zustand
    useNotifyStore.setState({
      _show: ({ title, description, action = 'info', variant = 'solid' }) => {
        toast.show({
          placement: "top",
          render: ({ id }) => {
            return (
              <Toast nativeID={"toast-" + id} action={action as 'success' | 'error' | 'warning' | 'info' | 'muted'} variant={(variant as 'solid' | 'subtle' | 'outline') === 'subtle' ? 'solid' : (variant as 'solid' | 'outline')}>
                <VStack space="xs">
                  <ToastTitle>{title}</ToastTitle>
                  {description && <ToastDescription>{description}</ToastDescription>}
                </VStack>
              </Toast>
            );
          },
        });
      },
    });
  }, [toast]);

  return null; // Komponen ini tidak merender apa-apa di layar
};