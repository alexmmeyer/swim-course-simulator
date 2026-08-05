"use client";

import { coursesComplete } from "@/lib/simulation";
import type {
  CoursePath,
  DistanceConfig,
  DistanceCourseConfig,
  Participant,
} from "@/lib/types";
import { useMemo, useState } from "react";
import { CourseWizard } from "./CourseWizard";
import { SimulationPlayback } from "./SimulationPlayback";
import styles from "./SimulatorPanel.module.css";

type Props = {
  participants: Participant[];
  configs: DistanceConfig[];
  distances: string[];
  backgroundImageUrl: string | null;
  backgroundFileName: string | null;
  onBackground: (url: string | null, fileName: string | null) => void;
  paths: CoursePath[];
  courseByDistance: Record<string, DistanceCourseConfig>;
  onPathsChange: (paths: CoursePath[]) => void;
  onCourseByDistanceChange: (
    courseByDistance: Record<string, DistanceCourseConfig>,
  ) => void;
};

export function SimulatorPanel({
  participants,
  configs,
  distances,
  backgroundImageUrl,
  backgroundFileName,
  onBackground,
  paths,
  courseByDistance,
  onPathsChange,
  onCourseByDistanceChange,
}: Props) {
  const ready = useMemo(
    () => coursesComplete(distances, courseByDistance),
    [distances, courseByDistance],
  );
  const [forceWizard, setForceWizard] = useState(false);

  const showWizard = !ready || forceWizard || distances.length === 0;

  if (participants.length === 0 || distances.length === 0) {
    return (
      <section className={styles.empty}>
        <h2 className={styles.emptyTitle}>Congestion simulator</h2>
        <p>
          Upload participant data and set start times to build courses and run a
          spatial time-lapse.
        </p>
      </section>
    );
  }

  if (showWizard) {
    return (
      <CourseWizard
        distances={distances}
        backgroundImageUrl={backgroundImageUrl}
        backgroundFileName={backgroundFileName}
        onBackground={onBackground}
        paths={paths}
        courseByDistance={courseByDistance}
        onCommitDistance={(config, path) => {
          if (path) {
            onPathsChange([...paths.filter((p) => p.id !== path.id), path]);
          }
          onCourseByDistanceChange({
            ...courseByDistance,
            [config.distance]: config,
          });
        }}
        onFinished={() => setForceWizard(false)}
      />
    );
  }

  const activePaths = paths.filter((p) =>
    Object.values(courseByDistance).some((c) => c.pathId === p.id),
  );

  return (
    <SimulationPlayback
      participants={participants}
      configs={configs}
      paths={activePaths}
      courseByDistance={courseByDistance}
      backgroundImageUrl={backgroundImageUrl}
      distanceOrder={distances}
      onRebuild={() => {
        onPathsChange([]);
        onCourseByDistanceChange({});
        setForceWizard(true);
      }}
    />
  );
}
