// Pure location helpers: accuracy grading, geofence assessment, user copy.
// No expo-location import here so this module is unit-checkable with node.

export type LocationIssueStatus = "denied" | "services_off" | "no_fix";
export type LocationAccuracyLevel = "good" | "fair" | "poor";

export const ACCURACY_GOOD_METERS = 20;
export const ACCURACY_FAIR_METERS = 100;
export const FIX_TIMEOUT_MS = 15000;

export const ACCURACY_COLORS: Record<LocationAccuracyLevel, string> = {
  good: "#16A34A",
  fair: "#D97706",
  poor: "#DC2626",
};

export const LOCATION_ISSUE_MESSAGES: Record<
  LocationIssueStatus,
  { title: string; description: string }
> = {
  denied: {
    title: "Izin Lokasi Ditolak",
    description:
      "Presensi membutuhkan izin lokasi untuk mencatat titik absen kamu. Aktifkan izin lokasi untuk aplikasi ini di Pengaturan HP, lalu coba lagi.",
  },
  services_off: {
    title: "Lokasi GPS Anda Tidak Aktif",
    description:
      "Layanan lokasi (GPS) di perangkat kamu sedang dimatikan. Aktifkan GPS terlebih dahulu, lalu tekan Coba Perbaiki.",
  },
  no_fix: {
    title: "Ada Masalah dengan Lokasi GPS Anda",
    description:
      "Titik lokasi kamu tidak berhasil didapatkan. Pindah ke area terbuka, pastikan GPS aktif, lalu tekan Coba Perbaiki.",
  },
};

export function accuracyLevel(
  accuracy: number | null | undefined,
): LocationAccuracyLevel | null {
  if (accuracy === null || accuracy === undefined || !isFinite(accuracy)) {
    return null;
  }
  if (accuracy < ACCURACY_GOOD_METERS) return "good";
  if (accuracy <= ACCURACY_FAIR_METERS) return "fair";
  return "poor";
}

export function formatAccuracy(
  accuracy: number | null | undefined,
): string | null {
  if (accuracy === null || accuracy === undefined || !isFinite(accuracy)) {
    return null;
  }
  return `Akurasi ±${Math.round(accuracy)}m`;
}

export function issueDetail(
  status: LocationIssueStatus,
  detail?: string | null,
): string | null {
  if (status !== "no_fix") return null;
  if (detail === "timeout") {
    return `GPS tidak merespons dalam ${Math.round(FIX_TIMEOUT_MS / 1000)} detik.`;
  }
  return null;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Haversine distance in metres. */
export function distanceMeters(from: Coordinates, to: Coordinates): number {
  const earthRadius = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface GpsSetupLocation {
  latitude: string | number;
  longitude: string | number;
  radius: string | number;
  gpc_location_name?: string;
}

export interface GeofenceAssessment {
  name: string;
  radius: number;
  distance: number;
  outsideRadius: boolean;
  /** GPS uncertainty is wider than the attendance radius: warn prominently. */
  accuracyExceedsRadius: boolean;
}

/** Nearest configured attendance location, if any parse to valid coordinates. */
export function assessGeofence(
  coords: Coordinates & { accuracy?: number | null },
  setups: GpsSetupLocation[] | null | undefined,
): GeofenceAssessment | null {
  if (!setups?.length) return null;

  let nearest: { setup: GpsSetupLocation; distance: number } | null = null;
  for (const setup of setups) {
    const latitude = parseFloat(String(setup.latitude));
    const longitude = parseFloat(String(setup.longitude));
    if (!isFinite(latitude) || !isFinite(longitude)) continue;
    const distance = distanceMeters(coords, { latitude, longitude });
    if (!nearest || distance < nearest.distance) nearest = { setup, distance };
  }
  if (!nearest) return null;

  const radius = parseFloat(String(nearest.setup.radius));
  const accuracy = coords.accuracy ?? null;

  return {
    name: nearest.setup.gpc_location_name || "lokasi absen",
    radius: isFinite(radius) ? radius : 0,
    distance: nearest.distance,
    outsideRadius: isFinite(radius) ? nearest.distance > radius : false,
    accuracyExceedsRadius:
      accuracy !== null && isFinite(radius) && accuracy > radius && radius > 0,
  };
}
