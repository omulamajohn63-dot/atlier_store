export interface RecentlyViewedEntry {
  productId: string;
  viewedAt: string;
}

const STORAGE_KEY = 'modeza_recently_viewed_v1';
export const MAX_RECENT = 12;

export function getRecentlyViewed(): RecentlyViewedEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentlyViewedEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(entries: RecentlyViewedEntry[]): RecentlyViewedEntry[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage unavailable — return in-memory result only
  }
  return entries;
}

/** Records a product visit, new visits first, de-duplicated and capped. */
export function addRecentlyViewedProduct(productId: string): RecentlyViewedEntry[] {
  const without = getRecentlyViewed().filter((entry) => entry.productId !== productId);
  return persist(
    [{ productId, viewedAt: new Date().toISOString() }, ...without].slice(0, MAX_RECENT)
  );
}

export function clearRecentlyViewed(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}