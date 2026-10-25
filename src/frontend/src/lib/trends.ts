/**
 * Shared trends module for the Analyze Labs feature.
 *
 * Compares a current reading against previous readings of the same marker and
 * returns the ordered series plus a rising, falling or stable direction. The
 * comparison is purely local and never sends data anywhere.
 */

/** One reading of a marker at a point in time. */
export interface TrendPoint {
  /** Epoch milliseconds when the reading was taken. */
  at: number;
  /** Value in the marker's canonical unit. */
  value: number;
}

/** Direction of change between the current reading and the previous one. */
export type TrendDirection = "rising" | "falling" | "stable";

/** The result of comparing a current reading against its history. */
export interface TrendResult {
  /** Marker id the series belongs to. */
  markerId: string;
  /** Readings ordered oldest to newest, including the current one. */
  series: TrendPoint[];
  /** Direction from the previous reading to the current one. */
  direction: TrendDirection;
  /** Signed change from the previous reading to the current one. */
  change: number;
  /** Percentage change, or null when the previous value was zero. */
  changePercent: number | null;
  /** True when there is at least one earlier reading to compare against. */
  hasHistory: boolean;
}

/**
 * Relative change below this fraction is treated as stable rather than a real
 * move, so small measurement noise does not read as a trend.
 */
const STABLE_THRESHOLD = 0.02;

/**
 * Compare a current reading against previous readings of the same marker.
 *
 * `previous` may be in any order; the returned series is sorted oldest to
 * newest with the current reading appended last.
 */
export function compareTrend(
  markerId: string,
  current: TrendPoint,
  previous: TrendPoint[],
): TrendResult {
  const history = [...previous].sort((a, b) => a.at - b.at);
  const series = [...history, current];

  const last = history.length > 0 ? history[history.length - 1] : undefined;
  if (!last) {
    return {
      markerId,
      series,
      direction: "stable",
      change: 0,
      changePercent: null,
      hasHistory: false,
    };
  }

  const change = current.value - last.value;
  const changePercent =
    last.value === 0 ? null : (change / Math.abs(last.value)) * 100;

  let direction: TrendDirection = "stable";
  if (last.value !== 0 && Math.abs(change / last.value) >= STABLE_THRESHOLD) {
    direction = change > 0 ? "rising" : "falling";
  } else if (last.value === 0 && change !== 0) {
    direction = change > 0 ? "rising" : "falling";
  }

  return {
    markerId,
    series,
    direction,
    change,
    changePercent,
    hasHistory: true,
  };
}

/** Plain-language label for a trend direction. */
export function trendLabel(direction: TrendDirection): string {
  switch (direction) {
    case "rising":
      return "Rising";
    case "falling":
      return "Falling";
    default:
      return "Stable";
  }
}

/**
 * Normalize a series to 0..1 for a sparkline, preserving shape. Returns an
 * empty array when there is nothing to draw.
 */
export function sparklinePoints(series: TrendPoint[]): number[] {
  if (series.length === 0) return [];
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span === 0) return values.map(() => 0.5);
  return values.map((value) => (value - min) / span);
}
