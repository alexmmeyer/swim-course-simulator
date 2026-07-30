"use client";

import {
  clampMinutes,
  minutesToTimeInput,
  parseClockToMinutes,
} from "@/lib/courseModel";
import styles from "./StartTimeControls.module.css";

type Props = {
  distances: string[];
  startTimes: Record<string, number>;
  onChange: (distance: string, startMinutes: number) => void;
};

export function StartTimeControls({ distances, startTimes, onChange }: Props) {
  if (distances.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>2. Start times</h2>
      <p className={styles.hint}>
        Default 9:00 AM. Adjust each distance — times are required.
      </p>
      <ul className={styles.list}>
        {distances.map((distance) => {
          const minutes = startTimes[distance] ?? 9 * 60;
          const inputValue = minutesToTimeInput(minutes);
          return (
            <li key={distance} className={styles.row}>
              <span className={styles.label}>{distance}</span>
              <div className={styles.control}>
                <button
                  type="button"
                  className={styles.step}
                  aria-label={`Earlier start for ${distance}`}
                  onClick={() => onChange(distance, clampMinutes(minutes - 5))}
                >
                  −
                </button>
                <input
                  type="time"
                  className={styles.timeInput}
                  value={inputValue}
                  required
                  onChange={(e) => {
                    const parsed = parseClockToMinutes(e.target.value);
                    if (parsed != null) onChange(distance, parsed);
                  }}
                />
                <button
                  type="button"
                  className={styles.step}
                  aria-label={`Later start for ${distance}`}
                  onClick={() => onChange(distance, clampMinutes(minutes + 5))}
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
