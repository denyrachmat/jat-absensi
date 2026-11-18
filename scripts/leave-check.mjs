/**
 * Check untuk helper tab Cuti. Jalankan: node scripts/leave-check.mjs
 * Node >= 22.18 menjalankan .ts langsung (type stripping).
 */
import {
  countDays,
  parseServerDate,
  STATUS_LABEL,
  toApiDate,
  toDisplayDate,
  validateLeaveForm,
} from "../services/leave.ts";

let failed = 0;
const eq = (got, want, name) => {
  const ok = String(got) === String(want);
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${String(got)}`);
  if (!ok) console.log(`     harusnya: ${String(want)}`);
};

eq(toApiDate(new Date(2026, 11, 5)), "2026-12-05", "toApiDate");
eq(toApiDate(new Date(2026, 0, 9)), "2026-01-09", "toApiDate pad nol");
eq(toDisplayDate(new Date(2026, 11, 5)), "05/12/2026", "toDisplayDate");

eq(parseServerDate("2026-12-05")?.getMonth(), 11, "parseServerDate ISO bulan");
eq(parseServerDate("2026-12-05")?.getDate(), 5, "parseServerDate ISO hari");
eq(parseServerDate("05/12/2026")?.getMonth(), 11, "parseServerDate d/m/Y bulan");
eq(parseServerDate("05/12/2026")?.getDate(), 5, "parseServerDate d/m/Y hari");
eq(parseServerDate("05/12/2026 13:45")?.getDate(), 5, "parseServerDate d/m/Y H:i");
eq(parseServerDate(""), "null", "parseServerDate string kosong");
eq(parseServerDate(null), "null", "parseServerDate null");

eq(countDays(new Date(2026, 11, 5), new Date(2026, 11, 5)), 1, "countDays hari sama");
eq(countDays(new Date(2026, 11, 5), new Date(2026, 11, 7)), 3, "countDays 3 hari");
eq(countDays(new Date(2026, 11, 30), new Date(2027, 0, 2)), 4, "countDays lintas tahun");
eq(countDays(new Date(2026, 2, 7), new Date(2026, 2, 10)), 4, "countDays lintas DST");
eq(countDays(new Date(2026, 11, 7), new Date(2026, 11, 5)), "null", "countDays end < start");

eq(
  validateLeaveForm({ startDate: null, endDate: null, reason: "x" })?.title,
  "Tanggal Belum Lengkap",
  "validate tanpa tanggal",
);
eq(
  validateLeaveForm({
    startDate: new Date(2026, 11, 7),
    endDate: new Date(2026, 11, 5),
    reason: "x",
  })?.title,
  "Tanggal Tidak Valid",
  "validate end < start",
);
eq(
  validateLeaveForm({
    startDate: new Date(2026, 11, 5),
    endDate: new Date(2026, 11, 6),
    reason: "   ",
  })?.title,
  "Alasan Belum Diisi",
  "validate alasan spasi",
);
eq(
  validateLeaveForm({
    startDate: new Date(2026, 11, 5),
    endDate: new Date(2026, 11, 6),
    reason: "keluarga",
  }),
  "null",
  "validate form valid",
);

eq(STATUS_LABEL.Waiting, "Menunggu", "STATUS_LABEL Waiting");
eq(STATUS_LABEL.Approved, "Disetujui", "STATUS_LABEL Approved");
eq(STATUS_LABEL.Rejected, "Ditolak", "STATUS_LABEL Rejected");

if (failed > 0) {
  console.error(`\n${failed} check gagal`);
  process.exit(1);
}
console.log("\nsemua check lolos");
