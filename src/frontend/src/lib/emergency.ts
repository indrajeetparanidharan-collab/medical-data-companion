/**
 * Owner-editable emergency number placeholder.
 *
 * The value below is a clearly marked placeholder. The app owner replaces
 * `EMERGENCY_NUMBER` with the local emergency services number before release.
 * Nothing here is sent anywhere — it only renders in the disclaimer banner.
 */

/** Replace this with the local emergency services number. */
export const EMERGENCY_NUMBER = "911";

/** True while the number is still the shipped placeholder. */
export const IS_EMERGENCY_PLACEHOLDER = EMERGENCY_NUMBER === "911";

/** Human-readable emergency instruction used across the app. */
export function emergencyCallText(): string {
  return `Emergency? Call ${EMERGENCY_NUMBER}.`;
}

/** `tel:` href for the emergency number, digits only. */
export function emergencyTelHref(): string {
  return `tel:${EMERGENCY_NUMBER.replace(/[^\d+]/g, "")}`;
}
