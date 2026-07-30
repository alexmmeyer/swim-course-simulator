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

/** Normalized canvas coordinates (0..1). */
export type Point2D = {
  x: number;
  y: number;
};

/** Closed lap path; points do not duplicate the start vertex. */
export type CoursePath = {
  id: string;
  points: Point2D[];
};

export type DistanceCourseConfig = {
  distance: string;
  pathId: string;
  laps: number;
  /** Physical length of one drawn lap, in feet */
  lapLengthFeet: number;
};

export type SimSwimmer = {
  id: string;
  distance: string;
  startMinutes: number;
  finishMinutes: number;
  /** Perpendicular offset from path centerline (feet) */
  lateralFeet: number;
  /** Along-track offset for pack depth at start (feet) */
  alongFeet: number;
};

export type LengthUnit = "miles" | "yards" | "meters";
