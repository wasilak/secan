// Small runtime normalization helpers used by the frontend API client.
// Keep these functions minimal and well-typed so callers can avoid repetitive
// casts like `as unknown as Record<string, unknown>`.

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const asRecord = (v: unknown): Record<string, unknown> =>
  isRecord(v) ? v : {};

export const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const numOrUndefined = (v: unknown): number | undefined =>
  v === null || v === undefined ? undefined : Number(v as number);

export const numOrZero = (v: unknown): number =>
  v === null || v === undefined ? 0 : Number(v as number);

// Parse common timestamp fields used by metrics responses.
// Accepts ISO date string in `date` or `time`, or a unix timestamp in `timestamp`.
export const parseTimestamp = (rec: Record<string, unknown>): string | undefined => {
  const date = rec.date as string | undefined;
  if (date) return date;
  const time = rec.time as string | undefined;
  if (time) return time;
  const ts = rec.timestamp as unknown;
  if (ts !== undefined && ts !== null) {
    const n = Number(ts as number);
    if (!Number.isNaN(n)) return new Date(n * 1000).toISOString();
  }
  return undefined;
};

// Return the metrics data array whether the server returned a plain array or an
// envelope { data: [...] }.
export const getDataArray = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  const rec = asRecord(raw);
  if (Array.isArray(rec.data)) return rec.data as unknown[];
  return [];
};

// Return first non-null/undefined string-like value from the list of keys.
export const pickFirstString = (
  rec: Record<string, unknown>,
  keys: string[],
  fallback?: string
): string | undefined => {
  for (const k of keys) {
    const v = rec[k];
    if (v !== undefined && v !== null) return String(v);
  }
  return fallback;
};
