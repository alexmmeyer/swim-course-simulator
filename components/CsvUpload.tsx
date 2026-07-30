"use client";

import { useRef, useState } from "react";
import styles from "./CsvUpload.module.css";

type Props = {
  onFileText: (text: string, fileName: string) => void;
  fileName: string | null;
  summary: string | null;
  errors: string[];
};

export function CsvUpload({ onFileText, fileName, summary, errors }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function readFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      onFileText("", file.name);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onFileText(String(reader.result ?? ""), file.name);
    };
    reader.readAsText(file);
  }

  return (
    <section className={styles.section}>
      <div className={styles.headerRow}>
        <h2 className={styles.heading}>1. Participant data</h2>
        <a
          className={styles.sampleBtn}
          href="/participant-template.csv"
          download="participant-template.csv"
        >
          Download template
        </a>
      </div>
      <p className={styles.hint}>
        CSV with <code>distance</code> and <code>expected_finish_time</code>{" "}
        (optional <code>name</code>)
      </p>

      <div
        className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) readFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className={styles.hiddenInput}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
            e.target.value = "";
          }}
        />
        <span className={styles.dropTitle}>Drop a CSV here or click to browse</span>
        {fileName ? (
          <span className={styles.fileName}>{fileName}</span>
        ) : (
          <span className={styles.dropSub}>One file · all distances</span>
        )}
      </div>

      {summary ? <p className={styles.summary}>{summary}</p> : null}
      {errors.length > 0 ? (
        <ul className={styles.errors}>
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
