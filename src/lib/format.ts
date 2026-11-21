/** 1234 -> "1.2k", 180000 -> "180k"; small numbers unchanged. */
export function formatCount(n: number | undefined | null): string {
  if (n == null) return "–";
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  return String(n);
}
