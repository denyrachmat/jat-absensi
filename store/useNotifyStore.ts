import { create } from 'zustand';

interface DialogOptions {
  title: string;
  description: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

// Tipe data agar coding lebih aman (Type Safety)
interface ToastOptions {
  title: string;
  description?: string;
  action?: 'success' | 'error' | 'warning' | 'info' | 'primary';
  variant?: 'solid' | 'outline' | 'accent';
}

interface NotifyState {
  _show: (opts: ToastOptions) => void; // Fungsi internal
  notif: (opts: ToastOptions) => void; // Fungsi yang akan kita panggil ($q.notif)
  isDialogOpen: boolean;
  dialogConfig: DialogOptions | null;
  dialog: (options: DialogOptions) => void;
  closeDialog: () => void;
}

export const useNotifyStore = create<NotifyState>((set, get) => ({
  _show: () => {}, // Placeholder awal
  notif: (opts) => {
    const trigger = get()._show;
    trigger(opts);
  },
  isDialogOpen: false,
  dialogConfig: null,

  // 3. Fungsi Panggil Dialog (Mirip $q.dialog)
  dialog: (options) => set({
    isDialogOpen: true,
    dialogConfig: {
      confirmText: 'OK',
      cancelText: 'Batal',
      ...options // Menggabungkan custom text jika ada
    }
  }),

  // 4. Fungsi Tutup Dialog
  closeDialog: () => set({ isDialogOpen: false, dialogConfig: null }),
}));