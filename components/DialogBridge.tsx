import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal'; // Ganti ke komponen Modal bawaan folder UI kamu
import { Text } from '@/components/ui/text';
import React from 'react';
import { useNotifyStore } from '../store/useNotifyStore'; // Sesuaikan path ke store kamu

export default function DialogBridge() {
  const isDialogOpen = useNotifyStore((state) => state.isDialogOpen);
  const dialogConfig = useNotifyStore((state) => state.dialogConfig);
  const closeDialog = useNotifyStore((state) => state.closeDialog);

  if (!isDialogOpen || !dialogConfig) return null;

  return (
    <Modal isOpen={isDialogOpen} onClose={closeDialog} size="md">
      <ModalBackdrop />
      <ModalContent style={{ backgroundColor: '#ffffff', padding: 16, borderRadius: 16 }}>
        
        <ModalHeader>
          <Heading size="md" className='text-black'>{dialogConfig.title}</Heading>
        </ModalHeader>
        
        <ModalBody className="mt-2 mb-4">
          <Text size="sm" className='text-black'>{dialogConfig.description}</Text>
        </ModalBody>
        
        <ModalFooter style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="outline" action="secondary" size="sm" onPress={closeDialog}>
            <ButtonText className='text-black'>{dialogConfig.cancelText || 'Batal'}</ButtonText>
          </Button>
          <Button size="sm" action="primary" onPress={() => {
            if (dialogConfig.onConfirm) dialogConfig.onConfirm();
            closeDialog();
          }}>
            <ButtonText className='text-black'>{dialogConfig.confirmText || 'OK'}</ButtonText>
          </Button>
        </ModalFooter>

      </ModalContent>
    </Modal>
  );
}