import * as Location from "expo-location";

import { FIX_TIMEOUT_MS, type LocationIssueStatus } from "./geo";

export type LocationFixResult =
  | { ok: true; position: Location.LocationObject }
  | { ok: false; status: LocationIssueStatus; detail: "timeout" | null };

class FixTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new FixTimeoutError("location fix timeout")),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Single entry point for "give me the employee's position right now".
 * Distinguishes permission denied / services off / no usable fix so the caller
 * can show a specific message instead of a silent console.error.
 */
export async function acquireLocationFix(
  accuracy: Location.Accuracy = Location.Accuracy.Balanced,
): Promise<LocationFixResult> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) {
      return { ok: false, status: "services_off", detail: null };
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return { ok: false, status: "denied", detail: null };
    }

    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy }),
      FIX_TIMEOUT_MS,
    );

    if (!position?.coords) {
      return { ok: false, status: "no_fix", detail: null };
    }

    return { ok: true, position };
  } catch (error) {
    console.error("Error saat mendeteksi lokasi:", error);
    return {
      ok: false,
      status: "no_fix",
      detail: error instanceof FixTimeoutError ? "timeout" : null,
    };
  }
}
