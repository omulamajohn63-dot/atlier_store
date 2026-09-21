export interface NewsletterResult {
  status: 'subscribed' | 'duplicate';
  count: number;
}

const STORAGE_KEY = 'modeza_newsletter_v1';

function readSubscribers(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((email) => typeof email === 'string') : [];
  } catch {
    return [];
  }
}

function persistSubscribers(subscribers: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subscribers));
  } catch {
    // storage unavailable — ignore
  }
}

/**
 * Registers a newsletter subscription. The boutique frontend has no dedicated
 * marketing backend yet, so sign-ups are recorded on this device and surfaced
 * honestly in the UI rather than pretending an email was dispatched.
 */
export function addNewsletterSubscriber(email: string): NewsletterResult {
  const normalized = email.trim().toLowerCase();
  const subscribers = readSubscribers();
  if (subscribers.some((existing) => existing.toLowerCase() === normalized)) {
    return { status: 'duplicate', count: subscribers.length };
  }
  const next = [...subscribers, normalized];
  persistSubscribers(next);
  return { status: 'subscribed', count: next.length };
}