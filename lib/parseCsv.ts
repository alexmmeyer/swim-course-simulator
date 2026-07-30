import Papa from "papaparse";
import type { ParseResult, Participant } from "./types";

const NAME_ALIASES = ["name", "participant", "swimmer", "athlete"];
const DISTANCE_ALIASES = ["distance", "event", "race", "wave", "category"];
const TIME_ALIASES = [
  "expected_finish_time",
  "expected finish time",
  "finish_time",
  "finish time",
  "estimated_finish_time",
  "estimated finish time",
  "time",
  "duration",
  "eta",
];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function findColumn(
  headers: string[],
  aliases: string[],
): string | undefined {
  const normalized = headers.map((h) => ({
    raw: h,
    key: normalizeHeader(h),
  }));
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    const match = normalized.find((h) => h.key === key);
    if (match) return match.raw;
  }
  return undefined;
}

/**
 * Parse a finish duration string into minutes.
 * Supports H:MM:SS, M:SS / MM:SS, and decimal minutes.
 */
export function parseFinishDuration(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d+(\.\d+)?$/.test(value)) {
    const minutes = Number(value);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
  }

  const parts = value.split(":").map((p) => p.trim());
  if (parts.length === 2 || parts.length === 3) {
    const nums = parts.map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
    if (parts.length === 3) {
      const [h, m, s] = nums;
      const total = h * 60 + m + s / 60;
      return total > 0 ? total : null;
    }
    const [m, s] = nums;
    const total = m + s / 60;
    return total > 0 ? total : null;
  }

  return null;
}

function uniqueDistancesInOrder(participants: Participant[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const p of participants) {
    if (!seen.has(p.distance)) {
      seen.add(p.distance);
      order.push(p.distance);
    }
  }
  return order;
}

export function parseParticipantCsv(csvText: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const errors: string[] = [];
  if (parsed.errors.length) {
    for (const e of parsed.errors.slice(0, 5)) {
      errors.push(`CSV parse: ${e.message}${e.row != null ? ` (row ${e.row})` : ""}`);
    }
  }

  const headers = parsed.meta.fields ?? [];
  if (!headers.length) {
    return {
      participants: [],
      distances: [],
      countsByDistance: {},
      skippedRows: 0,
      errors: [
        "No header row found. Expected columns: distance, expected_finish_time (name optional).",
      ],
    };
  }

  const nameCol = findColumn(headers, NAME_ALIASES);
  const distanceCol = findColumn(headers, DISTANCE_ALIASES);
  const timeCol = findColumn(headers, TIME_ALIASES);

  if (!distanceCol || !timeCol) {
    const missing = [
      !distanceCol && "distance",
      !timeCol && "expected_finish_time",
    ].filter(Boolean);
    return {
      participants: [],
      distances: [],
      countsByDistance: {},
      skippedRows: 0,
      errors: [
        `Missing required column(s): ${missing.join(", ")}. Found: ${headers.join(", ")}`,
      ],
    };
  }

  const participants: Participant[] = [];
  let skippedRows = 0;

  parsed.data.forEach((row, index) => {
    const name = nameCol ? (row[nameCol] ?? "").trim() : "";
    const distance = (row[distanceCol] ?? "").trim();
    const timeRaw = (row[timeCol] ?? "").trim();
    const finishMinutes = parseFinishDuration(timeRaw);

    if (!distance || finishMinutes == null) {
      skippedRows += 1;
      if (errors.length < 8) {
        const reason = !distance ? "missing distance" : "invalid finish time";
        errors.push(`Row ${index + 2}: ${reason}`);
      }
      return;
    }

    participants.push({
      ...(name ? { name } : {}),
      distance,
      finishMinutes,
    });
  });

  const distances = uniqueDistancesInOrder(participants);
  const countsByDistance: Record<string, number> = {};
  for (const d of distances) countsByDistance[d] = 0;
  for (const p of participants) countsByDistance[p.distance] += 1;

  return { participants, distances, countsByDistance, skippedRows, errors };
}
