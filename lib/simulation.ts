import type {
  CoursePath,
  DistanceConfig,
  DistanceCourseConfig,
  LengthUnit,
  Participant,
  Point2D,
  SimSwimmer,
} from "./types";

export const PERSON_DIAMETER_FEET = 6;
export const MAX_SIM_SWIMMERS = 1800;
/** Snap threshold in normalized coords to close the lap on the start point */
export const CLOSE_SNAP = 0.035;
/** Lateral pack width ~ several body-widths (Gaussian σ in feet) */
const LATERAL_SIGMA_FEET = 12;
const LATERAL_CLIP_FEET = 36;
/** Along-track pack depth at start (Gaussian σ in feet) */
const ALONG_SIGMA_FEET = 18;
const ALONG_CLIP_FEET = 48;

const FEET_PER_MILE = 5280;
const FEET_PER_YARD = 3;
const FEET_PER_METER = 3.280839895;

export function lengthToFeet(value: number, unit: LengthUnit): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  switch (unit) {
    case "miles":
      return value * FEET_PER_MILE;
    case "yards":
      return value * FEET_PER_YARD;
    case "meters":
      return value * FEET_PER_METER;
  }
}

export function dist2(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function polylineLength(points: Point2D[], closed = true): number {
  if (points.length < 2) return 0;
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += dist2(points[i], points[i + 1]);
  }
  if (closed && points.length >= 2) {
    len += dist2(points[points.length - 1], points[0]);
  }
  return len;
}

type PathSample = {
  point: Point2D;
  tangent: Point2D;
};

type CumPath = {
  points: Point2D[];
  cum: number[];
  total: number;
};

function buildCumPath(points: Point2D[]): CumPath | null {
  if (points.length < 2) return null;
  const n = points.length;
  const cum: number[] = [0];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    total += dist2(a, b);
    cum.push(total);
  }
  if (total <= 0) return null;
  return { points, cum, total };
}

function sampleClosedPath(path: CumPath, distanceAlong: number): PathSample {
  const { points, cum, total } = path;
  const d = ((distanceAlong % total) + total) % total;
  // Prefer the open interval at the end so we land on the last segment
  let i = 0;
  while (i < cum.length - 1 && cum[i + 1] < d) i++;
  if (i >= points.length) i = points.length - 1;

  const segStart = cum[i];
  const segEnd = cum[i + 1];
  const segLen = segEnd - segStart;
  const a = points[i];
  const b = points[(i + 1) % points.length];
  const t = segLen > 0 ? (d - segStart) / segLen : 0;
  const point: Point2D = {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mag = Math.hypot(dx, dy) || 1;
  return {
    point,
    tangent: { x: dx / mag, y: dy / mag },
  };
}

/** Deterministic mulberry32 PRNG from a string seed. */
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  // Box-Muller
  const u = Math.max(1e-12, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clippedGaussian(
  rand: () => number,
  sigma: number,
  clip: number,
): number {
  return Math.max(-clip, Math.min(clip, gaussian(rand) * sigma));
}

export function buildSimRoster(
  participants: Participant[],
  configs: DistanceConfig[],
  maxSwimmers: number = MAX_SIM_SWIMMERS,
): SimSwimmer[] {
  const byDistance = new Map<string, Participant[]>();
  for (const p of participants) {
    const list = byDistance.get(p.distance);
    if (list) list.push(p);
    else byDistance.set(p.distance, [p]);
  }

  type Weighted = { distance: string; startMinutes: number; finishMinutes: number };
  const pool: Weighted[] = [];

  for (const config of configs) {
    const rows = byDistance.get(config.distance) ?? [];
    if (config.scaleCount <= 0 || rows.length === 0) continue;

    const target = Math.max(0, Math.round(config.scaleCount));
    for (let i = 0; i < target; i++) {
      const src = rows[i % rows.length];
      pool.push({
        distance: config.distance,
        startMinutes: config.startMinutes,
        finishMinutes: src.finishMinutes,
      });
    }
  }

  let selected = pool;
  if (pool.length > maxSwimmers) {
    // Stride sample to preserve distribution shape
    const stride = pool.length / maxSwimmers;
    selected = [];
    for (let i = 0; i < maxSwimmers; i++) {
      selected.push(pool[Math.floor(i * stride)]);
    }
  }

  return selected.map((w, index) => {
    const id = `${w.distance}-${index}`;
    const rand = mulberry32(hashSeed(id));
    return {
      id,
      distance: w.distance,
      startMinutes: w.startMinutes,
      finishMinutes: w.finishMinutes,
      lateralFeet: clippedGaussian(rand, LATERAL_SIGMA_FEET, LATERAL_CLIP_FEET),
      alongFeet: clippedGaussian(rand, ALONG_SIGMA_FEET, ALONG_CLIP_FEET),
    };
  });
}

export function eventWindow(
  participants: Participant[],
  configs: DistanceConfig[],
): { start: number; end: number } | null {
  let start = Infinity;
  let end = -Infinity;
  const byDistance = new Map<string, Participant[]>();
  for (const p of participants) {
    const list = byDistance.get(p.distance);
    if (list) list.push(p);
    else byDistance.set(p.distance, [p]);
  }

  for (const config of configs) {
    if (config.scaleCount <= 0) continue;
    const rows = byDistance.get(config.distance) ?? [];
    for (const p of rows) {
      start = Math.min(start, config.startMinutes);
      end = Math.max(end, config.startMinutes + p.finishMinutes);
    }
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }
  return { start, end };
}

export function feetPerNormUnit(
  path: CoursePath,
  lapLengthFeet: number,
): number {
  const len = polylineLength(path.points, true);
  if (len <= 0 || lapLengthFeet <= 0) return 0;
  return lapLengthFeet / len;
}

/** Dot diameter in normalized canvas units for a 6′ person. */
export function personDiameterNorm(
  path: CoursePath,
  lapLengthFeet: number,
): number {
  const fpn = feetPerNormUnit(path, lapLengthFeet);
  if (fpn <= 0) return 0.012;
  return PERSON_DIAMETER_FEET / fpn;
}

/**
 * Average person diameter across configured courses (for mixed-path events).
 * Falls back to a small fixed size when scale is unavailable.
 */
export function averagePersonDiameterNorm(
  paths: CoursePath[],
  courseByDistance: Record<string, DistanceCourseConfig>,
): number {
  const pathMap = new Map(paths.map((p) => [p.id, p]));
  const sizes: number[] = [];
  for (const cfg of Object.values(courseByDistance)) {
    const path = pathMap.get(cfg.pathId);
    if (!path || cfg.lapLengthFeet <= 0) continue;
    sizes.push(personDiameterNorm(path, cfg.lapLengthFeet));
  }
  if (sizes.length === 0) return 0.012;
  return sizes.reduce((a, b) => a + b, 0) / sizes.length;
}

export function positionAt(
  tMinutes: number,
  swimmer: SimSwimmer,
  path: CoursePath,
  laps: number,
  lapLengthFeet: number,
): Point2D | null {
  if (laps < 1 || path.points.length < 2 || lapLengthFeet <= 0) return null;
  if (swimmer.finishMinutes <= 0) return null;

  const start = swimmer.startMinutes;
  const end = start + swimmer.finishMinutes;
  if (tMinutes < start || tMinutes >= end) return null;

  const cum = buildCumPath(path.points);
  if (!cum) return null;

  const fpn = lapLengthFeet / cum.total;
  const progress = (tMinutes - start) / swimmer.finishMinutes; // 0..1
  const raceNormLength = cum.total * laps;
  const alongNorm =
    progress * raceNormLength + swimmer.alongFeet / fpn;

  // Keep finished agents off; clamp within race for along-jitter near start only
  const clampedAlong = Math.max(0, Math.min(raceNormLength * 0.999999, alongNorm));
  const sample = sampleClosedPath(cum, clampedAlong);

  const lateralNorm = swimmer.lateralFeet / fpn;
  // Perpendicular (left normal)
  const nx = -sample.tangent.y;
  const ny = sample.tangent.x;

  return {
    x: sample.point.x + nx * lateralNorm,
    y: sample.point.y + ny * lateralNorm,
  };
}

export function coursesComplete(
  distances: string[],
  courseByDistance: Record<string, DistanceCourseConfig>,
): boolean {
  if (distances.length === 0) return false;
  return distances.every((d) => {
    const c = courseByDistance[d];
    return !!c && c.laps >= 1 && c.lapLengthFeet > 0 && !!c.pathId;
  });
}

export function newPathId(): string {
  return `path-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
