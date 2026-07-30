export const brand = {
  red: "#ef4036",
  blue: "#013e7f",
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
  "#013e7f",
  "#ef4036",
  "#2a6fad",
  "#c73a32",
  "#5b8fc7",
  "#8b1e18",
  "#7aa8d4",
] as const;

export function colorForDistance(index: number): string {
  return DISTANCE_COLORS[index % DISTANCE_COLORS.length];
}
