"use client";

import styles from "./BackgroundUpload.module.css";

type Props = {
  fileName: string | null;
  onImage: (objectUrl: string, fileName: string) => void;
  onClear: () => void;
};

export function BackgroundUpload({ fileName, onImage, onClear }: Props) {
  function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    onImage(url, file.name);
  }

  return (
    <div className={styles.row}>
      <label className={styles.uploadBtn}>
        {fileName ? "Replace background" : "Upload background (optional)"}
        <input
          type="file"
          accept="image/*"
          className={styles.hidden}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {fileName ? (
        <>
          <span className={styles.fileName}>{fileName}</span>
          <button type="button" className={styles.clearBtn} onClick={onClear}>
            Clear
          </button>
        </>
      ) : null}
    </div>
  );
}
