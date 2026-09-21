const KEY = 'modeza_post_auth_destination';

/**
 * Remembers an intended destination (e.g. /checkout) before routing a guest to
 * the sign-in page, so they are returned there after authenticating.
 */
export function setPostAuthDestination(path: string): void {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // storage unavailable — ignore
  }
}

export function consumePostAuthDestination(): string | null {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return value;
  } catch {
    return null;
  }
}