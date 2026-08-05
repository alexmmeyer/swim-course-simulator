"use client";

import { brand, colorForDistance } from "@/lib/brand";
import type { ChartPoint } from "@/lib/types";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import styles from "./CourseChart.module.css";

type Props = {
  points: ChartPoint[];
  /** Stack / series order (e.g. by start time) */
  distances: string[];
  /** Stable color assignment order (CSV upload order). Defaults to `distances`. */
  colorDistances?: string[];
};

type CursorProps = {
  points?: Array<{ x?: number; y?: number }>;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  payload?: Array<{ payload?: ChartPoint }>;
};

function ChartCursor(props: CursorProps) {
  const x = props.points?.[0]?.x;
  if (x == null || props.height == null || props.top == null) return null;

  const axisY = props.top + props.height;
  const pointerSize = 8;

  return (
    <g className="course-chart-cursor">
      <line
        x1={x}
        x2={x}
        y1={props.top}
        y2={axisY}
        stroke={brand.blue}
        strokeWidth={1}
        strokeDasharray="4 3"
        opacity={0.55}
      />
      <polygon
        points={`${x},${axisY + 2} ${x - pointerSize},${axisY + 2 + pointerSize} ${x + pointerSize},${axisY + 2 + pointerSize}`}
        fill={brand.red}
      />
    </g>
  );
}

function ChartTooltip(props: TooltipContentProps<number, string>) {
  const { active, payload, label } = props;
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as ChartPoint | undefined;
  const timeLabel =
    typeof label === "string"
      ? label
      : point?.timeLabel ?? (typeof label === "number" ? String(label) : "");

  const rows = payload.filter(
    (p) => p.dataKey !== "total" && typeof p.value === "number",
  );
  const total =
    typeof point?.total === "number"
      ? point.total
      : rows.reduce((sum, r) => sum + (Number(r.value) || 0), 0);

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTime}>{timeLabel}</div>
      <ul className={styles.tooltipList}>
        {rows.map((row) => (
          <li key={String(row.dataKey)} className={styles.tooltipRow}>
            <span
              className={styles.swatch}
              style={{ background: String(row.color ?? brand.blue) }}
            />
            <span className={styles.tooltipName}>{String(row.name)}</span>
            <span className={styles.tooltipValue}>{row.value}</span>
          </li>
        ))}
      </ul>
      <div className={styles.tooltipTotal}>
        <span>Total</span>
        <span>{total}</span>
      </div>
    </div>
  );
}

export function CourseChart({ points, distances, colorDistances }: Props) {
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    (colorDistances ?? distances).forEach((d, i) => {
      map[d] = colorForDistance(i);
    });
    return map;
  }, [colorDistances, distances]);

  const xTicks = useMemo(() => {
    return points
      .filter((p, index) => {
        if (index === 0 || index === points.length - 1) return true;
        return p.t % 5 === 0;
      })
      .map((p) => p.timeLabel);
  }, [points]);

  if (points.length === 0 || distances.length === 0) {
    return (
      <section className={styles.section}>
        <h2 className={styles.chartTitle}>TOTAL SWIMMERS IN THE WATER</h2>
        <p className={styles.empty}>
          Upload participant data to see course density over time.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.chartTitle}>TOTAL SWIMMERS IN THE WATER</h2>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart
            data={points}
            margin={{ top: 12, right: 16, left: 0, bottom: 48 }}
          >
            <CartesianGrid
              stroke={brand.grid}
              vertical={false}
              strokeDasharray="0"
            />
            <XAxis
              dataKey="timeLabel"
              ticks={xTicks}
              tick={{ fill: brand.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: brand.border }}
              minTickGap={18}
              height={40}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: brand.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              content={(props) => <ChartTooltip {...(props as TooltipContentProps<number, string>)} />}
              cursor={<ChartCursor />}
              isAnimationActive={false}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="square"
              wrapperStyle={{ paddingTop: 12 }}
            />
            {distances.map((distance) => (
              <Area
                key={distance}
                type="linear"
                dataKey={distance}
                name={distance}
                stackId="course"
                stroke={colorMap[distance]}
                fill={colorMap[distance]}
                fillOpacity={0.72}
                strokeWidth={1.5}
                isAnimationActive={false}
                activeDot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
