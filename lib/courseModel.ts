import type { ChartPoint, DistanceConfig, Participant } from "./types";

export const DEFAULT_START_MINUTES = 9 * 60; // 09:00
export const BIN_MINUTES = 1;

export function formatClock(minutesSinceMidnight: number): string {
  const total = Math.round(minutesSinceMidnight);
  const day = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(day / 60);
  const m = day % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function parseClockToMinutes(value: string): number | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (minutes < 0 || minutes > 59 || hours < 0) return null;

  if (period) {
    if (hours < 1 || hours > 12) return null;
    if (period === "AM") {
      if (hours === 12) hours = 0;
    } else if (hours !== 12) {
      hours += 12;
    }
  } else if (hours > 23) {
    return null;
  }

  return hours * 60 + minutes;
}

export function minutesToTimeInput(minutesSinceMidnight: number): string {
  const total = ((Math.round(minutesSinceMidnight) % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function clampMinutes(minutes: number): number {
  return ((Math.round(minutes) % (24 * 60)) + 24 * 60) % (24 * 60);
}

/** Stable stack order: earlier start first, then distance name. */
export function orderedDistances(configs: DistanceConfig[]): string[] {
  return [...configs]
    .sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
      return a.distance.localeCompare(b.distance);
    })
    .map((c) => c.distance);
}

export function buildCourseSeries(
  participants: Participant[],
  configs: DistanceConfig[],
  binMinutes: number = BIN_MINUTES,
): { points: ChartPoint[]; distances: string[] } {
  const distances = orderedDistances(configs);
  const configByDistance = new Map(configs.map((c) => [c.distance, c]));

  const byDistance = new Map<string, Participant[]>();
  for (const d of distances) byDistance.set(d, []);
  for (const p of participants) {
    const list = byDistance.get(p.distance);
    if (list) list.push(p);
  }

  let windowStart = Infinity;
  let windowEnd = -Infinity;

  type WeightedInterval = { start: number; end: number; weight: number };
  const intervalsByDistance = new Map<string, WeightedInterval[]>();

  for (const distance of distances) {
    const config = configByDistance.get(distance)!;
    const rows = byDistance.get(distance) ?? [];
    const n = config.sourceCount || rows.length;
    const weight = n > 0 ? config.scaleCount / n : 0;
    const intervals: WeightedInterval[] = [];

    if (weight > 0 && rows.length > 0) {
      for (const p of rows) {
        const start = config.startMinutes;
        const end = start + p.finishMinutes;
        intervals.push({ start, end, weight });
        windowStart = Math.min(windowStart, start);
        windowEnd = Math.max(windowEnd, end);
      }
    } else if (config.scaleCount > 0 && rows.length === 0) {
      // No source rows; nothing to model
    }

    intervalsByDistance.set(distance, intervals);
  }

  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart) {
    return { points: [], distances };
  }

  // Pad a few minutes before/after for chart breathing room
  const pad = 5;
  const startBin = Math.floor(windowStart / binMinutes) * binMinutes - pad;
  const endBin = Math.ceil(windowEnd / binMinutes) * binMinutes + pad;

  const points: ChartPoint[] = [];
  for (let t = startBin; t <= endBin; t += binMinutes) {
    const point: ChartPoint = {
      t,
      timeLabel: formatClock(t),
      total: 0,
    };
    let total = 0;
    for (const distance of distances) {
      const intervals = intervalsByDistance.get(distance) ?? [];
      let count = 0;
      for (const iv of intervals) {
        // On course from start (inclusive) until finish (exclusive of exact finish instant)
        if (t >= iv.start && t < iv.end) count += iv.weight;
      }
      const rounded = Math.round(count);
      point[distance] = rounded;
      total += rounded;
    }
    point.total = total;
    points.push(point);
  }

  return { points, distances };
}
