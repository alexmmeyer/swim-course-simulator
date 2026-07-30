"use client";

import { colorForDistance } from "@/lib/brand";
import { formatClock } from "@/lib/courseModel";
import {
  averagePersonDiameterNorm,
  buildSimRoster,
  eventWindow,
  positionAt,
} from "@/lib/simulation";
import type {
  CoursePath,
  DistanceConfig,
  DistanceCourseConfig,
  Participant,
} from "@/lib/types";
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { CourseCanvas, type SwimmerDot } from "./CourseCanvas";
import styles from "./SimulationPlayback.module.css";

type Speed = "fast" | "medium" | "slow";

const PLAYBACK_SECONDS: Record<Speed, number> = {
  fast: 10,
  medium: 20,
  slow: 30,
};

type Props = {
  participants: Participant[];
  configs: DistanceConfig[];
  paths: CoursePath[];
  courseByDistance: Record<string, DistanceCourseConfig>;
  backgroundImageUrl: string | null;
  onRebuild: () => void;
};

export function SimulationPlayback({
  participants,
  configs,
  paths,
  courseByDistance,
  backgroundImageUrl,
  onRebuild,
}: Props) {
  const timeWindow = useMemo(
    () => eventWindow(participants, configs),
    [participants, configs],
  );
  const roster = useMemo(
    () => buildSimRoster(participants, configs),
    [participants, configs],
  );

  const pathMap = useMemo(() => new Map(paths.map((p) => [p.id, p])), [paths]);
  const distanceIndex = useMemo(() => {
    const map: Record<string, number> = {};
    configs.forEach((c, i) => {
      map[c.distance] = i;
    });
    return map;
  }, [configs]);

  const [speed, setSpeed] = useState<Speed>("medium");
  const [playing, setPlaying] = useState(false);
  const [simTime, setSimTime] = useState(timeWindow?.start ?? 0);
  const [scrubbing, setScrubbing] = useState(false);
  const [windowEpoch, setWindowEpoch] = useState(
    () =>
      timeWindow ? `${timeWindow.start}:${timeWindow.end}` : "none",
  );

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const nextEpoch = timeWindow
    ? `${timeWindow.start}:${timeWindow.end}`
    : "none";
  if (nextEpoch !== windowEpoch) {
    setWindowEpoch(nextEpoch);
    setSimTime(timeWindow?.start ?? 0);
    setPlaying(false);
  }

  const onFrame = useEffectEvent((now: number) => {
    if (!timeWindow || !playing || scrubbing) {
      lastTsRef.current = null;
      return;
    }
    const last = lastTsRef.current ?? now;
    lastTsRef.current = now;
    const dtSec = (now - last) / 1000;
    const eventMinutes = timeWindow.end - timeWindow.start;
    const playbackSec = PLAYBACK_SECONDS[speed];
    const minutesPerSec = eventMinutes / playbackSec;
    setSimTime((t) => {
      const next = t + dtSec * minutesPerSec;
      if (next >= timeWindow.end) {
        setPlaying(false);
        return timeWindow.end;
      }
      return next;
    });
  });

  useEffect(() => {
    if (!playing || scrubbing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      return;
    }
    const loop = (now: number) => {
      onFrame(now);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, scrubbing, speed]);

  const dots: SwimmerDot[] = useMemo(() => {
    const result: SwimmerDot[] = [];
    for (const s of roster) {
      const course = courseByDistance[s.distance];
      if (!course) continue;
      const path = pathMap.get(course.pathId);
      if (!path) continue;
      const pos = positionAt(
        simTime,
        s,
        path,
        course.laps,
        course.lapLengthFeet,
      );
      if (!pos) continue;
      result.push({
        id: s.id,
        x: pos.x,
        y: pos.y,
        color: colorForDistance(distanceIndex[s.distance] ?? 0),
      });
    }
    return result;
  }, [roster, courseByDistance, pathMap, simTime, distanceIndex]);

  const dotDiameterNorm = useMemo(
    () => averagePersonDiameterNorm(paths, courseByDistance),
    [paths, courseByDistance],
  );

  function restart() {
    if (!timeWindow) return;
    setSimTime(timeWindow.start);
    setPlaying(false);
    lastTsRef.current = null;
  }

  function timeFromClientX(clientX: number): number | null {
    if (!timeWindow || !trackRef.current) return null;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return timeWindow.start + ratio * (timeWindow.end - timeWindow.start);
  }

  function beginScrub(clientX: number) {
    const t = timeFromClientX(clientX);
    if (t == null) return;
    setScrubbing(true);
    setPlaying(false);
    setSimTime(t);
  }

  const onScrubMove = useEffectEvent((clientX: number) => {
    const t = timeFromClientX(clientX);
    if (t != null) setSimTime(t);
  });

  useEffect(() => {
    if (!scrubbing) return;
    function onMove(e: PointerEvent) {
      onScrubMove(e.clientX);
    }
    function onUp() {
      setScrubbing(false);
    }
    globalThis.addEventListener("pointermove", onMove);
    globalThis.addEventListener("pointerup", onUp);
    return () => {
      globalThis.removeEventListener("pointermove", onMove);
      globalThis.removeEventListener("pointerup", onUp);
    };
  }, [scrubbing]);

  if (!timeWindow) {
    return (
      <p className={styles.empty}>
        Need participant finish times to run the simulation.
      </p>
    );
  }

  const span = timeWindow.end - timeWindow.start || 1;
  const playhead = ((simTime - timeWindow.start) / span) * 100;

  return (
    <div className={styles.playback}>
      <div className={styles.toolbar}>
        <h2 className={styles.title}>Congestion simulation</h2>
        <button type="button" className={styles.linkBtn} onClick={onRebuild}>
          Edit courses
        </button>
      </div>

      <CourseCanvas
        backgroundImageUrl={backgroundImageUrl}
        paths={paths}
        swimmerDots={dots}
        dotDiameterNorm={dotDiameterNorm}
        clockLabel={formatClock(simTime)}
        interactive={false}
      />

      <div className={styles.controls}>
        <div className={styles.transport}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" className={styles.secondary} onClick={restart}>
            Restart
          </button>
        </div>

        <fieldset className={styles.speed}>
          <legend className={styles.legend}>Speed</legend>
          {(
            [
              ["fast", "Fast (10s)"],
              ["medium", "Medium (20s)"],
              ["slow", "Slow (30s)"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={styles.radio}>
              <input
                type="radio"
                name="sim-speed"
                value={value}
                checked={speed === value}
                onChange={() => setSpeed(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </div>

      <div className={styles.timelineBlock}>
        <div className={styles.timeLabels}>
          <span>{formatClock(timeWindow.start)}</span>
          <span>{formatClock(timeWindow.end)}</span>
        </div>
        <div
          ref={trackRef}
          className={styles.track}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            beginScrub(e.clientX);
          }}
          role="slider"
          aria-valuemin={timeWindow.start}
          aria-valuemax={timeWindow.end}
          aria-valuenow={simTime}
          aria-label="Simulation time"
          tabIndex={0}
          onKeyDown={(e) => {
            const step = span / 100;
            if (e.key === "ArrowLeft") {
              setPlaying(false);
              setSimTime((t) => Math.max(timeWindow.start, t - step));
            } else if (e.key === "ArrowRight") {
              setPlaying(false);
              setSimTime((t) => Math.min(timeWindow.end, t + step));
            }
          }}
        >
          <div className={styles.trackFill} style={{ width: `${playhead}%` }} />
          <div
            className={styles.playhead}
            style={{ left: `${playhead}%` }}
            aria-hidden
          />
        </div>
        <p className={styles.scrubHint}>
          {scrubbing || !playing
            ? "Drag the indicator to scrub time"
            : "Playing — pause or drag to scrub"}
        </p>
      </div>
    </div>
  );
}
