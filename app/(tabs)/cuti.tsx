import { Badge, BadgeText } from "@/components/ui/badge";
import {
  Button,
  ButtonSpinner,
  ButtonText,
} from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { api } from "@/services/api";
import {
  STATUS_ACTION,
  STATUS_LABEL,
  type LeaveRequestItem,
  countDays,
  parseServerDate,
  toApiDate,
  toDisplayDate,
  validateLeaveForm,
} from "@/services/leave";
import { useNotifyStore } from "@/store/useNotifyStore";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { CalendarDays, Paperclip, Send, X } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

type Segment = "ajukan" | "riwayat";

interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export default function CutiScreen() {
  const $q = useNotifyStore();

  const [segment, setSegment] = React.useState<Segment>("ajukan");

  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [endDate, setEndDate] = React.useState<Date | null>(null);
  const [reason, setReason] = React.useState("");
  const [file, setFile] = React.useState<PickedFile | null>(null);
  const [picker, setPicker] = React.useState<"start" | "end" | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [history, setHistory] = React.useState<LeaveRequestItem[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const totalDays = React.useMemo(() => {
    if (!startDate || !endDate) return 0;
    return countDays(startDate, endDate) ?? 0;
  }, [startDate, endDate]);

  const fetchHistory = React.useCallback(
    async (targetPage: number, mode: "replace" | "append") => {
      if (mode === "replace") setLoadingHistory(true);
      else setLoadingMore(true);

      try {
        const response = await api.get(
          "/attendances/current-employee-pengajuan-cuti",
          { params: { page: targetPage } },
        );
        const paginator = response.data?.data;
        const rows: LeaveRequestItem[] = paginator?.data ?? [];

        setHistory((prev) => (mode === "append" ? [...prev, ...rows] : rows));
        setPage(targetPage);
        setHasMore(Boolean(paginator?.next_page_url));
      } catch {
        useNotifyStore.getState().notif({
          title: "Gagal Memuat Riwayat",
          description:
            "Riwayat permohonan cuti tidak dapat dimuat. Periksa koneksi kamu lalu coba lagi.",
          action: "error",
        });
      } finally {
        setLoadingHistory(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    fetchHistory(1, "replace");
    // Sekali saat tab dibuka; refresh berikutnya lewat tombol / setelah submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setPicker(null);
    if (event.type === "dismissed" || !selected) return;

    if (picker === "start") {
      setStartDate(selected);
      // Jaga agar tanggal selesai tidak pernah mendahului tanggal mulai.
      if (endDate && endDate.getTime() < selected.getTime()) setEndDate(selected);
    } else {
      setEndDate(selected);
    }
  };

  const pickAttachment = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      $q.notif({
        title: "Izin Galeri Ditolak",
        description:
          "Aplikasi butuh izin galeri untuk melampirkan berkas permohonan cuti.",
        action: "warning",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setFile({
      uri: asset.uri,
      name: asset.fileName || asset.uri.split("/").pop() || "lampiran.jpg",
      type: asset.mimeType || "image/jpeg",
    });
  };

  const resetForm = () => {
    setStartDate(null);
    setEndDate(null);
    setReason("");
    setFile(null);
    setPicker(null);
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const invalid = validateLeaveForm({ startDate, endDate, reason });
    if (invalid) {
      $q.notif({ ...invalid, action: "warning" });
      return;
    }
    if (!startDate || !endDate) return; // sudah dijaga validateLeaveForm

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("start_date", toApiDate(startDate));
      formData.append("end_date", toApiDate(endDate));
      formData.append("reason", reason.trim());
      if (file) {
        formData.append("file_attachment", {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as any);
      }

      const response = await api.post("/attendances/pengajuan-cuti", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      $q.notif({
        title: "Permohonan Terkirim",
        description:
          response.data?.msg || "Berhasil, Permohonan Cuti telah dikirim",
        action: "success",
      });

      resetForm();
      setSegment("riwayat");
      await fetchHistory(1, "replace");
    } catch (error) {
      const data = (error as { response?: { data?: any } })?.response?.data;
      // Guard "masih ada permohonan Menunggu" dikirim sebagai field `error`;
      // pesannya bermakna bagi karyawan, jadi tampilkan apa adanya.
      const serverMessage =
        (typeof data?.error === "string" && data.error) ||
        (typeof data?.msg === "string" && data.msg) ||
        (error instanceof Error ? error.message : null);

      $q.notif({
        title: "Permohonan Gagal Dikirim",
        description:
          serverMessage || "Permohonan cuti gagal dikirim. Silakan coba lagi.",
        action: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Heading size="lg" style={styles.title}>
        Cuti
      </Heading>

      <HStack space="sm" style={styles.segmentRow}>
        {(["ajukan", "riwayat"] as Segment[]).map((item) => {
          const active = segment === item;
          return (
            <Pressable
              key={item}
              onPress={() => setSegment(item)}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Text
                size="sm"
                style={[styles.segmentText, active && styles.segmentTextActive]}
              >
                {item === "ajukan" ? "Ajukan Cuti" : "Riwayat"}
              </Text>
            </Pressable>
          );
        })}
      </HStack>

      {segment === "ajukan" ? (
        <VStack space="md" style={styles.card}>
          <View>
            <Text size="xs" style={styles.label}>
              Tanggal Mulai
            </Text>
            <Pressable
              style={styles.dateField}
              onPress={() => setPicker("start")}
            >
              <CalendarDays size={18} color="#6b7280" />
              <Text
                size="sm"
                style={startDate ? styles.dateValue : styles.datePlaceholder}
              >
                {startDate ? toDisplayDate(startDate) : "Pilih tanggal mulai"}
              </Text>
            </Pressable>
          </View>

          <View>
            <Text size="xs" style={styles.label}>
              Tanggal Selesai
            </Text>
            <Pressable style={styles.dateField} onPress={() => setPicker("end")}>
              <CalendarDays size={18} color="#6b7280" />
              <Text
                size="sm"
                style={endDate ? styles.dateValue : styles.datePlaceholder}
              >
                {endDate ? toDisplayDate(endDate) : "Pilih tanggal selesai"}
              </Text>
            </Pressable>
          </View>

          {picker && (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={
                  picker === "start"
                    ? startDate || startOfToday()
                    : endDate || startDate || startOfToday()
                }
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={picker === "start" ? undefined : startDate || undefined}
                onChange={onPickerChange}
              />
              {Platform.OS === "ios" && (
                <Button
                  size="sm"
                  variant="outline"
                  action="secondary"
                  onPress={() => setPicker(null)}
                >
                  <ButtonText>Selesai</ButtonText>
                </Button>
              )}
            </View>
          )}

          <View>
            <Text size="xs" style={styles.label}>
              Jumlah Hari
            </Text>
            <Text size="sm" style={styles.dayCount}>
              {totalDays > 0
                ? `${totalDays} hari`
                : "Pilih tanggal mulai dan selesai"}
            </Text>
          </View>

          <View>
            <Text size="xs" style={styles.label}>
              Alasan
            </Text>
            <Input size="md" style={styles.reasonInput}>
              <InputField
                placeholder="Contoh: keperluan keluarga di luar kota"
                placeholderTextColor="#6b7280"
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={4}
                style={styles.reasonField}
              />
            </Input>
          </View>

          <View>
            <Text size="xs" style={styles.label}>
              Lampiran (opsional)
            </Text>
            {file ? (
              <HStack space="sm" style={styles.fileRow}>
                <Paperclip size={16} color="#374151" />
                <Text size="xs" numberOfLines={1} style={styles.fileName}>
                  {file.name}
                </Text>
                <Pressable onPress={() => setFile(null)} hitSlop={8}>
                  <X size={16} color="#ef4444" />
                </Pressable>
              </HStack>
            ) : (
              <Button
                size="sm"
                variant="outline"
                action="secondary"
                onPress={pickAttachment}
                isDisabled={submitting}
              >
                <ButtonText>Pilih Lampiran</ButtonText>
              </Button>
            )}
          </View>

          <Button
            size="lg"
            className="w-full rounded-full bg-blue-500"
            onPress={handleSubmit}
            isDisabled={submitting}
          >
            {submitting && <ButtonSpinner color="#ffffff" />}
            <ButtonText className="text-white">Kirim Permohonan</ButtonText>
            <Send size={18} color="#ffffff" />
          </Button>
        </VStack>
      ) : (
        <VStack space="md" style={styles.card}>
          {loadingHistory && history.length === 0 && (
            <View style={styles.center}>
              <ActivityIndicator color="#0052CC" />
              <Text size="xs" style={styles.mutedText}>
                Memuat riwayat...
              </Text>
            </View>
          )}

          {!loadingHistory && history.length === 0 && (
            <Text size="sm" style={styles.mutedText}>
              Belum ada permohonan cuti.
            </Text>
          )}

          {history.map((item) => {
            const start = parseServerDate(item.start_date);
            const end = parseServerDate(item.end_date);
            const days =
              start && end && end.getTime() >= start.getTime()
                ? countDays(start, end)
                : null;

            return (
              <View key={item.id} style={styles.historyItem}>
                <HStack space="sm" style={styles.historyHeader}>
                  <VStack>
                    <Text size="sm" style={styles.historyDates}>
                      {item.start_date} — {item.end_date}
                    </Text>
                    <Text size="xs" style={styles.mutedText}>
                      {days ? `${days} hari` : "Durasi tidak diketahui"} · diajukan{" "}
                      {item.created_at}
                    </Text>
                  </VStack>
                  <Badge
                    action={STATUS_ACTION[item.status] || "muted"}
                    variant="outline"
                    size="sm"
                  >
                    <BadgeText>{STATUS_LABEL[item.status] || item.status}</BadgeText>
                  </Badge>
                </HStack>

                <Text size="sm" style={styles.historyReason}>
                  {item.reason}
                </Text>

                {item.file_attachment && (
                  <Text size="xs" style={styles.attachmentLink}>
                    Lampiran: {item.file_attachment}
                  </Text>
                )}
              </View>
            );
          })}

          {hasMore && (
            <Button
              size="md"
              variant="outline"
              action="secondary"
              onPress={() => fetchHistory(page + 1, "append")}
              isDisabled={loadingMore}
            >
              {loadingMore && <ButtonSpinner color="#0052CC" />}
              <ButtonText>Muat Lebih Banyak</ButtonText>
            </Button>
          )}

          <Button
            size="md"
            variant="link"
            action="primary"
            onPress={() => fetchHistory(1, "replace")}
            isDisabled={loadingHistory}
          >
            <ButtonText>Muat Ulang</ButtonText>
          </Button>
        </VStack>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  title: {
    color: "#000000",
  },
  segmentRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 999,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: "#0052CC",
  },
  segmentText: {
    color: "#374151",
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#ffffff",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  label: {
    color: "#6b7280",
    fontWeight: "bold",
    marginBottom: 4,
  },
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f9f9f9",
  },
  datePlaceholder: {
    color: "#6b7280",
  },
  dateValue: {
    color: "#000000",
    fontWeight: "600",
  },
  pickerWrap: {
    gap: 8,
  },
  dayCount: {
    color: "#0052CC",
    fontWeight: "bold",
  },
  reasonInput: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    height: undefined,
  },
  reasonField: {
    minHeight: 80,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlignVertical: "top",
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d4d4d4",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f9f9f9",
  },
  fileName: {
    flex: 1,
    color: "#374151",
  },
  center: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
  },
  mutedText: {
    color: "#6b7280",
  },
  historyItem: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  historyDates: {
    color: "#000000",
    fontWeight: "bold",
  },
  historyReason: {
    color: "#374151",
  },
  attachmentLink: {
    color: "#0052CC",
  },
});
