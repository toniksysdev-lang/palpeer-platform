/**
 * In-memory flag: this install already passed PIN (or set PIN) for the current signed-in session,
 * so we do not re-prompt on every navigation after a new-device check.
 */
let verifiedForUserId: string | null = null;

export function markDeviceVerifiedForSession(userId: string): void {
  verifiedForUserId = userId;
}

export function clearDeviceVerifiedSession(): void {
  verifiedForUserId = null;
}

export function isDeviceVerifiedForSession(userId: string | null | undefined): boolean {
  return !!userId && verifiedForUserId === userId;
}
