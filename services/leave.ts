/**
 * Helper tanggal & status untuk tab Cuti. Murni (tanpa React Native) supaya
 * bisa diperiksa langsung: `node --experimental-strip-types services/leave.check.ts`
 */

export type LeaveStatus = "Waiting" | "Approved" | "Rejected";

export interface LeaveRequestItem {
  id: number;
  employee_id?: number;
  start_date: string;
  end_date: string;
  reason: string;
  file_attachment: string | null;
  status: LeaveStatus | string;
  created_at: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Tanggal lokal -> "YYYY-MM-DD" tanpa pergeseran UTC. */
export const toApiDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const toDisplayDate = (d: Date) =>
  `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/**
 * Server memakai cast `date:d/m/Y` dan `datetime:d/m/Y H:i`, jadi nilai bisa
 * datang sebagai "dd/mm/yyyy" atau ISO. Tangani keduanya.
 */
export const parseServerDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  return null;
};

/** Jumlah hari inklusif antara dua tanggal. Null bila rentang tidak valid. */
export const countDays = (start: Date, end: Date): number | null => {
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (b.getTime() < a.getTime()) return null;
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
};

export const STATUS_LABEL: Record<string, string> = {
  Waiting: "Menunggu",
  Approved: "Disetujui",
  Rejected: "Ditolak",
};

export const STATUS_ACTION: Record<string, "warning" | "success" | "error"> = {
  Waiting: "warning",
  Approved: "success",
  Rejected: "error",
};

/** Validasi form sisi klien sebelum menembak API. */
export const validateLeaveForm = (input: {
  startDate: Date | null;
  endDate: Date | null;
  reason: string;
}): { title: string; description: string } | null => {
  if (!input.startDate || !input.endDate) {
    return {
      title: "Tanggal Belum Lengkap",
      description: "Tanggal mulai dan tanggal selesai wajib diisi.",
    };
  }
  if (input.endDate.getTime() < input.startDate.getTime()) {
    return {
      title: "Tanggal Tidak Valid",
      description: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.",
    };
  }
  if (!input.reason.trim()) {
    return {
      title: "Alasan Belum Diisi",
      description: "Alasan pengajuan cuti wajib diisi.",
    };
  }
  return null;
};
