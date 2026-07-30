"use client";

import styles from "./ScaleControls.module.css";

type Props = {
  distances: string[];
  scaleCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  onChange: (distance: string, count: number) => void;
};

export function ScaleControls({
  distances,
  scaleCounts,
  sourceCounts,
  onChange,
}: Props) {
  if (distances.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>3. Expected participants</h2>
      <p className={styles.hint}>
        Scale counts up or down. Finish-time mix stays the same as your CSV.
      </p>
      <ul className={styles.list}>
        {distances.map((distance) => {
          const count = scaleCounts[distance] ?? 0;
          const source = sourceCounts[distance] ?? 0;
          return (
            <li key={distance} className={styles.row}>
              <div className={styles.labelBlock}>
                <span className={styles.label}>{distance}</span>
                <span className={styles.source}>CSV: {source}</span>
              </div>
              <div className={styles.control}>
                <button
                  type="button"
                  className={styles.step}
                  aria-label={`Decrease ${distance} count`}
                  onClick={() => onChange(distance, Math.max(0, count - 1))}
                >
                  −
                </button>
                <input
                  type="number"
                  className={styles.numberInput}
                  min={0}
                  step={1}
                  value={count}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10);
                    if (Number.isFinite(next) && next >= 0) onChange(distance, next);
                    if (e.target.value === "") onChange(distance, 0);
                  }}
                />
                <button
                  type="button"
                  className={styles.step}
                  aria-label={`Increase ${distance} count`}
                  onClick={() => onChange(distance, count + 1)}
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
