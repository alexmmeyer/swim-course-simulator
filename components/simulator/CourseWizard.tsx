"use client";

import { lengthToFeet, newPathId } from "@/lib/simulation";
import type {
  CoursePath,
  DistanceCourseConfig,
  LengthUnit,
  Point2D,
} from "@/lib/types";
import { useMemo, useState } from "react";
import { BackgroundUpload } from "./BackgroundUpload";
import { CourseCanvas } from "./CourseCanvas";
import styles from "./CourseWizard.module.css";

type Props = {
  distances: string[];
  backgroundImageUrl: string | null;
  backgroundFileName: string | null;
  onBackground: (url: string | null, fileName: string | null) => void;
  paths: CoursePath[];
  courseByDistance: Record<string, DistanceCourseConfig>;
  onCommitDistance: (config: DistanceCourseConfig, path?: CoursePath) => void;
  onFinished: () => void;
};

type Phase =
  | { kind: "draw"; distanceIndex: number; draft: Point2D[] }
  | {
      kind: "details";
      distanceIndex: number;
      pathId: string;
      points: Point2D[];
      isNewPath: boolean;
    }
  | { kind: "choose"; distanceIndex: number; prevPathId: string; prevLapLengthFeet: number };

export function CourseWizard({
  distances,
  backgroundImageUrl,
  backgroundFileName,
  onBackground,
  paths,
  courseByDistance,
  onCommitDistance,
  onFinished,
}: Props) {
  const firstIncomplete = Math.max(
    0,
    distances.findIndex((d) => {
      const c = courseByDistance[d];
      return !(c && c.laps >= 1 && c.lapLengthFeet > 0 && c.pathId);
    }),
  );

  const [phase, setPhase] = useState<Phase>(() => ({
    kind: "draw",
    distanceIndex: firstIncomplete === -1 ? 0 : firstIncomplete,
    draft: [],
  }));
  const [lapLength, setLapLength] = useState("0.5");
  const [unit, setUnit] = useState<LengthUnit>("miles");
  const [laps, setLaps] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);

  const distance =
    distances[
      phase.kind === "choose" || phase.kind === "draw" || phase.kind === "details"
        ? phase.distanceIndex
        : 0
    ] ?? distances[0];

  const stepLabel = useMemo(() => {
    const i =
      phase.kind === "draw" || phase.kind === "details" || phase.kind === "choose"
        ? phase.distanceIndex
        : 0;
    return `Distance ${i + 1} of ${distances.length}: ${distances[i] ?? ""}`;
  }, [phase, distances]);

  const previewPaths = useMemo(() => {
    if (phase.kind === "details") {
      return [
        ...paths.filter((p) => p.id !== phase.pathId),
        { id: phase.pathId, points: phase.points },
      ];
    }
    if (phase.kind === "choose") {
      const existing = paths.find((p) => p.id === phase.prevPathId);
      return existing ? [existing] : paths;
    }
    // show already-committed paths while drawing next
    return paths;
  }, [phase, paths]);

  function resetForm(fromFeet?: number) {
    if (fromFeet && fromFeet > 0) {
      // Prefer miles if reasonable
      if (fromFeet >= 5280 * 0.2) {
        setUnit("miles");
        setLapLength((fromFeet / 5280).toFixed(2).replace(/\.?0+$/, "") || "0.5");
      } else if (fromFeet >= 100) {
        setUnit("yards");
        setLapLength(String(Math.round(fromFeet / 3)));
      } else {
        setUnit("meters");
        setLapLength(String(Math.round(fromFeet / 3.280839895)));
      }
    } else {
      setLapLength("0.5");
      setUnit("miles");
    }
    setLaps("1");
    setFormError(null);
  }

  function advanceAfterCommit(distanceIndex: number, pathId: string, lapLengthFeet: number) {
    const next = distanceIndex + 1;
    if (next >= distances.length) {
      onFinished();
      return;
    }
    setPhase({
      kind: "choose",
      distanceIndex: next,
      prevPathId: pathId,
      prevLapLengthFeet: lapLengthFeet,
    });
  }

  function submitDetails() {
    if (phase.kind !== "details") return;
    const lengthNum = Number(lapLength);
    const lapsNum = Math.round(Number(laps));
    const feet = lengthToFeet(lengthNum, unit);
    if (!(feet > 0)) {
      setFormError("Enter a valid lap length greater than zero.");
      return;
    }
    if (!(lapsNum >= 1)) {
      setFormError("Laps must be at least 1.");
      return;
    }

    const config: DistanceCourseConfig = {
      distance: distances[phase.distanceIndex],
      pathId: phase.pathId,
      laps: lapsNum,
      lapLengthFeet: feet,
    };

    if (phase.isNewPath) {
      onCommitDistance(config, { id: phase.pathId, points: phase.points });
    } else {
      onCommitDistance(config);
    }

    advanceAfterCommit(phase.distanceIndex, phase.pathId, feet);
  }

  function undoLastVertex() {
    if (phase.kind !== "draw") return;
    setPhase({ ...phase, draft: phase.draft.slice(0, -1) });
  }

  function clearDraft() {
    if (phase.kind !== "draw") return;
    setPhase({ ...phase, draft: [] });
  }

  return (
    <div className={styles.wizard}>
      <div className={styles.header}>
        <h2 className={styles.title}>Build your course</h2>
        <p className={styles.step}>{stepLabel}</p>
      </div>

      <BackgroundUpload
        fileName={backgroundFileName}
        onImage={(url, name) => {
          if (backgroundImageUrl) URL.revokeObjectURL(backgroundImageUrl);
          onBackground(url, name);
        }}
        onClear={() => {
          if (backgroundImageUrl) URL.revokeObjectURL(backgroundImageUrl);
          onBackground(null, null);
        }}
      />

      {phase.kind === "choose" && (
        <div className={styles.choose}>
          <p className={styles.hint}>
            Configure <strong>{distance}</strong> — reuse the previous course or draw a new one.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                resetForm(phase.prevLapLengthFeet);
                setPhase({
                  kind: "details",
                  distanceIndex: phase.distanceIndex,
                  pathId: phase.prevPathId,
                  points:
                    paths.find((p) => p.id === phase.prevPathId)?.points ?? [],
                  isNewPath: false,
                });
              }}
            >
              Reuse same course
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                resetForm();
                setPhase({
                  kind: "draw",
                  distanceIndex: phase.distanceIndex,
                  draft: [],
                });
              }}
            >
              Draw new course
            </button>
          </div>
        </div>
      )}

      {phase.kind === "draw" && (
        <p className={styles.hint}>
          Click to place the start, then buoy markers. Click near the start again to close the lap
          ({phase.draft.length} marker{phase.draft.length === 1 ? "" : "s"}).
        </p>
      )}

      {(phase.kind === "draw" || phase.kind === "details" || phase.kind === "choose") && (
        <CourseCanvas
          backgroundImageUrl={backgroundImageUrl}
          paths={previewPaths}
          draftPoints={phase.kind === "draw" ? phase.draft : []}
          interactive={phase.kind === "draw"}
          onAddPoint={(point) => {
            if (phase.kind !== "draw") return;
            setPhase({ ...phase, draft: [...phase.draft, point] });
          }}
          onClosePath={() => {
            if (phase.kind !== "draw" || phase.draft.length < 3) return;
            const id = newPathId();
            resetForm(
              courseByDistance[distances[phase.distanceIndex - 1]]?.lapLengthFeet,
            );
            setPhase({
              kind: "details",
              distanceIndex: phase.distanceIndex,
              pathId: id,
              points: phase.draft,
              isNewPath: true,
            });
          }}
        />
      )}

      {phase.kind === "draw" && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={undoLastVertex}
            disabled={phase.draft.length === 0}
          >
            Undo marker
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={clearDraft}
            disabled={phase.draft.length === 0}
          >
            Clear
          </button>
        </div>
      )}

      {phase.kind === "details" && (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            submitDetails();
          }}
        >
          <p className={styles.hint}>
            Lap closed for <strong>{distance}</strong>. Enter the physical length of one lap and
            how many laps this distance swims.
          </p>
          <div className={styles.formRow}>
            <label className={styles.label}>
              Lap length
              <input
                type="number"
                min="0"
                step="any"
                className={styles.input}
                value={lapLength}
                onChange={(e) => setLapLength(e.target.value)}
                required
              />
            </label>
            <label className={styles.label}>
              Unit
              <select
                className={styles.input}
                value={unit}
                onChange={(e) => setUnit(e.target.value as LengthUnit)}
              >
                <option value="miles">Miles</option>
                <option value="yards">Yards</option>
                <option value="meters">Meters</option>
              </select>
            </label>
            <label className={styles.label}>
              Laps
              <input
                type="number"
                min="1"
                step="1"
                className={styles.input}
                value={laps}
                onChange={(e) => setLaps(e.target.value)}
                required
              />
            </label>
          </div>
          {formError && <p className={styles.error}>{formError}</p>}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                setPhase({
                  kind: "draw",
                  distanceIndex: phase.distanceIndex,
                  draft: phase.isNewPath ? phase.points : [],
                });
              }}
            >
              Redraw
            </button>
            <button type="submit" className={styles.primary}>
              {phase.distanceIndex + 1 >= distances.length
                ? "Save & simulate"
                : "Save & continue"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
