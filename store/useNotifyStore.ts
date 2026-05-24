import { create } from 'zustand';

// 1. Definisikan tipe input yang didukung oleh form dialog
export interface DialogFormField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'textarea';
  defaultValue?: string;
  required?: boolean; // 🌟 Tambahkan opsi required di sini
}

// 2. Perbarui opsi dialog agar mendukung field form dan callback data
interface DialogOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  formFields?: DialogFormField[]; // Tempat menaruh array field form kustom
  // Perbarui agar bisa menerima objek dynamic string: { [key]: 'value' }
  onConfirm?: (formData: Record<string, string>) => void | Promise<void>; 
  onCancel?: () => void;
}

// Opsi Toast/Notifikasi tetap aman tidak berubah
interface ToastOptions {
  title: string;
  description?: string;
  action?: 'success' | 'error' | 'warning' | 'info' | 'primary';
  variant?: 'solid' | 'outline' | 'accent';
}

interface NotifyState {
  _show: (opts: ToastOptions) => void;
  notif: (opts: ToastOptions) => void;
  isDialogOpen: boolean;
  dialogConfig: DialogOptions | null;
  dialog: (options: DialogOptions) => void;
  closeDialog: () => void;
}

export const useNotifyStore = create<NotifyState>((set, get) => ({
  _show: () => {}, 
  notif: (opts) => {
    const trigger = get()._show;
    trigger(opts);
  },
  isDialogOpen: false,
  dialogConfig: null,

  // Fungsi Panggil Dialog (Mendukung penggabungan properti default)
  dialog: (options) => set({
    isDialogOpen: true,
    dialogConfig: {
      confirmText: 'OK',
      cancelText: 'Batal',
      ...options // Otomatis memasukkan formFields dan onConfirm versi baru jika dilempar
    }
  }),

  // Fungsi Tutup Dialog
  closeDialog: () => set({ isDialogOpen: false, dialogConfig: null }),
}));