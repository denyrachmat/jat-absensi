import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useNotifyStore } from '../store/useNotifyStore';

export default function DialogBridge() {
  const isDialogOpen = useNotifyStore((state) => state.isDialogOpen);
  const dialogConfig = useNotifyStore((state) => state.dialogConfig);
  const closeDialog = useNotifyStore((state) => state.closeDialog);

  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [isFormValid, setIsFormValid] = useState(true);

  // Reset & Inisialisasi data form
  useEffect(() => {
    if (isDialogOpen && dialogConfig?.formFields) {
      const initialValues: Record<string, string> = {};
      dialogConfig.formFields.forEach((field) => {
        initialValues[field.key] = field.defaultValue || '';
      });
      setFormValues(initialValues);
    } else {
      setFormValues({});
    }
  }, [isDialogOpen, dialogConfig]);

  // 🌟 VALIDASI FORM REAL-TIME SETIAP KALI INPUT BERUBAH
  useEffect(() => {
    if (!dialogConfig?.formFields) {
      setIsFormValid(true);
      return;
    }

    // Cek apakah ada field required yang masih kosong (string kosong atau hanya spasi)
    const hasEmptyRequiredField = dialogConfig.formFields.some((field) => {
      if (field.required) {
        const value = formValues[field.key];
        return !value || value.trim() === '';
      }
      return false;
    });

    // Form valid jika TIDAK ADA field required yang kosong
    setIsFormValid(!hasEmptyRequiredField);
  }, [formValues, dialogConfig]);

  if (!isDialogOpen || !dialogConfig) return null;

  const handleInputChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirmSubmit = async () => {
    if (dialogConfig.onConfirm) {
      await dialogConfig.onConfirm(formValues);
    }
    closeDialog();
  };

  return (
    <Modal isOpen={isDialogOpen} onClose={closeDialog} size="md">
      <ModalBackdrop />
      <ModalContent style={{ backgroundColor: '#ffffff', padding: 16, borderRadius: 16 }}>
        
        <ModalHeader>
          <Heading size="md" style={{ color: '#000000' }}>{dialogConfig.title}</Heading>
        </ModalHeader>
        
        <ModalBody className="mt-2 mb-4">
          <Text size="sm" style={{ color: '#333333', marginBottom: 12 }}>{dialogConfig.description}</Text>

          {dialogConfig.formFields && dialogConfig.formFields.map((field) => (
            <View key={field.key} style={styles.fieldContainer}>
              {/* Label dengan tanda bintang merah jika required */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text size="xs" style={{ color: '#666666', fontWeight: 'bold' }}>
                  {field.label}
                </Text>
                {field.required && (
                  <Text size="xs" style={{ color: '#ef4444', marginLeft: 2, fontWeight: 'bold' }}>*</Text>
                )}
              </View>

              <TextInput
                style={[
                  styles.inputBase,
                  field.type === 'textarea' ? styles.inputTextarea : null
                ]}
                placeholder={field.placeholder}
                placeholderTextColor="#999999"
                value={formValues[field.key] || ''}
                onChangeText={(text) => handleInputChange(field.key, text)}
                keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                multiline={field.type === 'textarea'}
                numberOfLines={field.type === 'textarea' ? 3 : 1}
              />
            </View>
          ))}
        </ModalBody>
        
        <ModalFooter style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="outline" action="secondary" size="sm" onPress={() => {
            if (dialogConfig.onCancel) dialogConfig.onCancel();
            closeDialog();
          }}>
            <ButtonText style={{ color: '#000000' }}>{dialogConfig.cancelText || 'Batal'}</ButtonText>
          </Button>
          
          {/* 🌟 TOMBOL OK OTOMATIS DISABLE JIKA FORM BELUM VALID */}
          <Button 
            size="sm" 
            action="primary" 
            onPress={handleConfirmSubmit}
            isDisabled={!isFormValid}
            style={{ opacity: isFormValid ? 1 : 0.5 }} // Efek visual buram jika terkunci
          >
            <ButtonText style={{ color: '#ffffff' }}>{dialogConfig.confirmText || 'OK'}</ButtonText>
          </Button>
        </ModalFooter>

      </ModalContent>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fieldContainer: {
    marginBottom: 12,
    width: '100%',
  },
  inputBase: {
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#000000',
    fontSize: 14,
    backgroundColor: '#f9f9f9',
  },
  inputTextarea: {
    height: 70,
    textAlignVertical: 'top',
  }
});