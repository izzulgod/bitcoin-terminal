// localStorage-backed cache for the last successful wallet sync.
// Lets the dashboard render instantly on reopen while a fresh sync
// runs in the background.
import type { SyncResult } from "./sync-engine";

const KEY_PREFIX = "btc-terminal:sync:v1:";

interface CacheEntry {
  result: SyncResult;
  savedAt: number;
}

function key(xpub: string, scriptType: string) {
  return `${KEY_PREFIX}${scriptType}:${xpub}`;
}

export function loadSyncCache(
  xpub: string,
  scriptType: string
): { result: SyncResult; savedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(xpub, scriptType));
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

export function saveSyncCache(
  xpub: string,
  scriptType: string,
  result: SyncResult
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      key(xpub, scriptType),
      JSON.stringify({ result, savedAt: Date.now() })
    );
  } catch {
    // ignore quota errors
  }
}

export function clearSyncCache() {
  if (typeof window === "undefined") return;
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(KEY_PREFIX)) localStorage.removeItem(k);
  }
}
