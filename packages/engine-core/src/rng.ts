export function normalizeSeed(seed: number): number {
  const normalized = seed | 0;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
}

export function randomIndex(state: number, maxExclusive: number): { state: number; index: number } {
  let next = state;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return { state: next | 0, index: (next >>> 0) % maxExclusive };
}
