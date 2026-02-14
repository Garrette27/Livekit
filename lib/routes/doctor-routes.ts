/**
 * Canonical route helper for doctor consultation history.
 * Keep all navigation callsites using this helper to avoid route drift.
 */
export const DOCTOR_HISTORY_ROUTE = '/doctor/dashboard' as const;

export function getDoctorHistoryRoute(): typeof DOCTOR_HISTORY_ROUTE {
  return DOCTOR_HISTORY_ROUTE;
}
