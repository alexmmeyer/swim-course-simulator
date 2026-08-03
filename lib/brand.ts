export const brand = {
  /** PMS 032C */
  red: "#ef4135",
  /** PMS 281C */
  blue: "#003e7e",
  /** PMS 299C */
  brightBlue: "#009ddc",
  /** PMS 2905C */
  lightBlue: "#8cd2f4",
  white: "#ffffff",
  navyText: "#012a56",
  muted: "#6b7a8d",
  border: "#d5dde8",
  surface: "#f4f7fb",
  grid: "#e6ebf2",
  /** Course vertex markers (buoys / start) */
  buoyOrange: "#f36c3d",
  canvasWater: "#c5e4f5",
} as const;

/** On-brand distance series colors (blue/red family). */
export const DISTANCE_COLORS = [
  "#003e7e",
  "#ef4135",
  "#009ddc",
  "#c73a32",
  "#5b8fc7",
  "#8b1e18",
  "#8cd2f4",
] as const;

export function colorForDistance(index: number): string {
  return DISTANCE_COLORS[index % DISTANCE_COLORS.length];
}
