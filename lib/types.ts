export type Participant = {
  /** Optional; each CSV row is a participant regardless of name */
  name?: string;
  distance: string;
  /** Expected finish duration in minutes */
  finishMinutes: number;
};

export type ParseResult = {
  participants: Participant[];
  distances: string[];
  countsByDistance: Record<string, number>;
  skippedRows: number;
  errors: string[];
};

export type DistanceConfig = {
  distance: string;
  /** Minutes since midnight */
  startMinutes: number;
  /** Modeled participant count (scaled) */
  scaleCount: number;
  /** Original CSV row count */
  sourceCount: number;
};

export type ChartPoint = {
  /** Minutes since midnight */
  t: number;
  timeLabel: string;
  total: number;
  [distance: string]: number | string;
};
