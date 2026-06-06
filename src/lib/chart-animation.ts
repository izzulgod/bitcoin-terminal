// Track which charts have already played their intro animation in this session.
// Charts animate on first mount only; subsequent tab switches render instantly.
const played = new Set<string>();

/**
 * Returns whether the given chart key should animate on this mount.
 * Marks the key as played as a side-effect.
 */
export function consumeChartAnimation(key: string): boolean {
  if (played.has(key)) return false;
  played.add(key);
  return true;
}
