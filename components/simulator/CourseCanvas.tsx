"use client";

import { brand } from "@/lib/brand";
import { CLOSE_SNAP, dist2 } from "@/lib/simulation";
import type { CoursePath, Point2D } from "@/lib/types";
import { useCallback, useRef, type MouseEvent } from "react";
import styles from "./CourseCanvas.module.css";

export type SwimmerDot = {
  id: string;
  x: number;
  y: number;
  color: string;
};

type Props = {
  backgroundImageUrl: string | null;
  /** Paths to draw (closed loops) */
  paths: CoursePath[];
  /** Draft points while drawing (open polyline) */
  draftPoints?: Point2D[];
  /** Whether clicks add / close vertices */
  interactive?: boolean;
  onAddPoint?: (point: Point2D) => void;
  onClosePath?: () => void;
  swimmerDots?: SwimmerDot[];
  /** Diameter in normalized units (0..1 of min canvas side ≈ we use viewBox 0..1) */
  dotDiameterNorm?: number;
  clockLabel?: string | null;
  className?: string;
};

const VIEW = 1000;

function toSvg(p: Point2D): { x: number; y: number } {
  return { x: p.x * VIEW, y: p.y * VIEW };
}

function trianglePoints(cx: number, cy: number, size: number): string {
  const h = size;
  const w = size * 0.9;
  return `${cx},${cy - h} ${cx - w},${cy + h * 0.55} ${cx + w},${cy + h * 0.55}`;
}

export function CourseCanvas({
  backgroundImageUrl,
  paths,
  draftPoints = [],
  interactive = false,
  onAddPoint,
  onClosePath,
  swimmerDots = [],
  dotDiameterNorm = 0.012,
  clockLabel,
  className,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const clientToNorm = useCallback((clientX: number, clientY: number): Point2D | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    return {
      x: Math.min(1, Math.max(0, local.x / VIEW)),
      y: Math.min(1, Math.max(0, local.y / VIEW)),
    };
  }, []);

  function handleClick(e: MouseEvent<SVGSVGElement>) {
    if (!interactive || !onAddPoint) return;
    const point = clientToNorm(e.clientX, e.clientY);
    if (!point) return;

    if (draftPoints.length >= 3 && dist2(point, draftPoints[0]) <= CLOSE_SNAP) {
      onClosePath?.();
      return;
    }
    onAddPoint(point);
  }

  const dotR = Math.max(2, (dotDiameterNorm * VIEW) / 2);

  return (
    <div
      className={`${styles.wrap} ${className ?? ""}`}
      style={{
        backgroundColor: backgroundImageUrl ? undefined : brand.canvasWater,
        backgroundImage: backgroundImageUrl
          ? `url(${backgroundImageUrl})`
          : undefined,
      }}
    >
      <svg
        ref={svgRef}
        className={`${styles.svg} ${interactive ? styles.interactive : ""}`}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={handleClick}
        role={interactive ? "application" : "img"}
        aria-label="Course canvas"
      >
        {paths.map((path) => {
          if (path.points.length < 2) return null;
          const pts = path.points.map(toSvg);
          const d =
            pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") +
            " Z";
          return (
            <g key={path.id}>
              <path
                d={d}
                fill="none"
                stroke={brand.blue}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.9}
              />
              {path.points.map((p, i) => {
                const s = toSvg(p);
                return (
                  <polygon
                    key={`${path.id}-v-${i}`}
                    points={trianglePoints(s.x, s.y, 14)}
                    fill={brand.buoyOrange}
                    stroke={brand.white}
                    strokeWidth={1.5}
                  />
                );
              })}
            </g>
          );
        })}

        {draftPoints.length > 0 && (
          <g>
            {draftPoints.length >= 2 && (
              <polyline
                points={draftPoints
                  .map((p) => {
                    const s = toSvg(p);
                    return `${s.x},${s.y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke={brand.blue}
                strokeWidth={3}
                strokeDasharray="10 6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {draftPoints.map((p, i) => {
              const s = toSvg(p);
              return (
                <polygon
                  key={`draft-${i}`}
                  points={trianglePoints(s.x, s.y, 14)}
                  fill={brand.buoyOrange}
                  stroke={brand.white}
                  strokeWidth={1.5}
                />
              );
            })}
            {draftPoints.length >= 3 && (
              <circle
                cx={toSvg(draftPoints[0]).x}
                cy={toSvg(draftPoints[0]).y}
                r={CLOSE_SNAP * VIEW}
                fill="none"
                stroke={brand.buoyOrange}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.55}
              />
            )}
          </g>
        )}

        {swimmerDots.map((dot) => (
          <circle
            key={dot.id}
            cx={dot.x * VIEW}
            cy={dot.y * VIEW}
            r={dotR}
            fill={dot.color}
            opacity={0.82}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={0.6}
          />
        ))}
      </svg>

      {clockLabel != null && (
        <div className={styles.clock} aria-live="polite">
          {clockLabel}
        </div>
      )}
    </div>
  );
}
