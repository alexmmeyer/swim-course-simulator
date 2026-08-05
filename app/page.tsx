"use client";

import { CourseChart } from "@/components/CourseChart";
import { CsvUpload } from "@/components/CsvUpload";
import { ScaleControls } from "@/components/ScaleControls";
import { StartTimeControls } from "@/components/StartTimeControls";
import { SimulatorPanel } from "@/components/simulator/SimulatorPanel";
import {
  DEFAULT_START_MINUTES,
  buildCourseSeries,
} from "@/lib/courseModel";
import { parseParticipantCsv } from "@/lib/parseCsv";
import type {
  CoursePath,
  DistanceConfig,
  DistanceCourseConfig,
  Participant,
} from "@/lib/types";
import { useMemo, useState } from "react";
import styles from "./page.module.css";

type MainTab = "density" | "simulator";

export default function Home() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [distances, setDistances] = useState<string[]>([]);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [startTimes, setStartTimes] = useState<Record<string, number>>({});
  const [scaleCounts, setScaleCounts] = useState<Record<string, number>>({});
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);

  const [mainTab, setMainTab] = useState<MainTab>("density");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(
    null,
  );
  const [backgroundFileName, setBackgroundFileName] = useState<string | null>(
    null,
  );
  const [paths, setPaths] = useState<CoursePath[]>([]);
  const [courseByDistance, setCourseByDistance] = useState<
    Record<string, DistanceCourseConfig>
  >({});

  function clearCourseGeometry() {
    setPaths([]);
    setCourseByDistance({});
  }

  function applyParse(text: string, name: string) {
    if (!text.trim()) {
      setParticipants([]);
      setDistances([]);
      setSourceCounts({});
      setStartTimes({});
      setScaleCounts({});
      setFileName(name || null);
      setParseErrors(["Could not read a CSV file. Please upload a .csv."]);
      setSummary(null);
      clearCourseGeometry();
      return;
    }

    const result = parseParticipantCsv(text);
    setFileName(name);
    setParseErrors(result.errors);
    setParticipants(result.participants);
    setDistances(result.distances);
    setSourceCounts(result.countsByDistance);

    const nextStarts: Record<string, number> = {};
    const nextScales: Record<string, number> = {};
    for (const d of result.distances) {
      nextStarts[d] = startTimes[d] ?? DEFAULT_START_MINUTES;
      nextScales[d] = result.countsByDistance[d] ?? 0;
    }
    setStartTimes(nextStarts);
    setScaleCounts(nextScales);
    clearCourseGeometry();

    if (result.participants.length) {
      const parts = result.distances.map(
        (d) => `${result.countsByDistance[d]} × ${d}`,
      );
      const skip =
        result.skippedRows > 0
          ? ` · ${result.skippedRows} row${result.skippedRows === 1 ? "" : "s"} skipped`
          : "";
      setSummary(
        `${result.participants.length} participants · ${parts.join(", ")}${skip}`,
      );
    } else {
      setSummary(null);
    }
  }

  const configs: DistanceConfig[] = useMemo(
    () =>
      distances.map((distance) => ({
        distance,
        startMinutes: startTimes[distance] ?? DEFAULT_START_MINUTES,
        scaleCount: scaleCounts[distance] ?? 0,
        sourceCount: sourceCounts[distance] ?? 0,
      })),
    [distances, startTimes, scaleCounts, sourceCounts],
  );

  const series = useMemo(
    () => buildCourseSeries(participants, configs),
    [participants, configs],
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <img
            className={styles.logo}
            src="/saa_blue_logo.jpg"
            alt="Swim Across America"
            width={420}
            height={156}
          />
          <div className={styles.headerCopy}>
            <h1 className={styles.product}>Course Density Modeler</h1>
            <p className={styles.tagline}>
              Estimate how many swimmers are on course at any time — by distance.
            </p>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.controls}>
          <CsvUpload
            onFileText={applyParse}
            fileName={fileName}
            summary={summary}
            errors={parseErrors}
          />
          <StartTimeControls
            distances={distances}
            startTimes={startTimes}
            onChange={(distance, startMinutes) =>
              setStartTimes((prev) => ({ ...prev, [distance]: startMinutes }))
            }
          />
          <ScaleControls
            distances={distances}
            scaleCounts={scaleCounts}
            sourceCounts={sourceCounts}
            onChange={(distance, count) =>
              setScaleCounts((prev) => ({ ...prev, [distance]: count }))
            }
          />
        </div>

        <div className={styles.chartPanel}>
          <div className={styles.tabs} role="tablist" aria-label="Main view">
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "density"}
              className={
                mainTab === "density" ? styles.tabActive : styles.tab
              }
              onClick={() => setMainTab("density")}
            >
              Density chart
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "simulator"}
              className={
                mainTab === "simulator" ? styles.tabActive : styles.tab
              }
              onClick={() => setMainTab("simulator")}
            >
              Swimulator
            </button>
          </div>

          <div className={styles.tabPanel} role="tabpanel">
            {mainTab === "density" ? (
              <CourseChart
                points={series.points}
                distances={series.distances}
                colorDistances={distances}
              />
            ) : (
              <SimulatorPanel
                participants={participants}
                configs={configs}
                distances={distances}
                backgroundImageUrl={backgroundImageUrl}
                backgroundFileName={backgroundFileName}
                onBackground={(url, name) => {
                  setBackgroundImageUrl(url);
                  setBackgroundFileName(name);
                }}
                paths={paths}
                courseByDistance={courseByDistance}
                onPathsChange={setPaths}
                onCourseByDistanceChange={setCourseByDistance}
              />
            )}
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        Built for Swim Across America event organizers · Make Waves
      </footer>
    </div>
  );
}
