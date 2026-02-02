/* ===========================================================
   page.js  – gaze keyboard + heat-map + on-screen coordinates
   =========================================================== */
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera   } from "@mediapipe/camera_utils";
import { PaneGrid, defaultPanes, COLS, ROWS } from "./components/PaneGrid";

/* ---------- constants ------------------------------------ */
const GAZE_SCALE     = 5.0;          // sensitivity
const LOG_EVERY_MS   = 500;          // half-second logging cadence

/* ==========  MAIN COMPONENT  ============================== */
export default function Home() {
  const videoRef   = useRef(null);
  const faceMesh   = useRef(null);
  const lastT      = useRef(performance.now());

  /* gaze & dwell */
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [panes,     setPanes    ] = useState(defaultPanes);
  const currentPane = useRef(null);

  /* on-screen coordinate log */
  const [logs, setLogs]   = useState([]);          // array of strings
  const lastLogT          = useRef(performance.now());

  /* --------------------------------------------------------
     REF HELPER so PaneGrid can store DOM nodes for hit-test
     ------------------------------------------------------ */
  const paneRefs = useRef({});
  const getPaneRef = (id, el) => { if (el) paneRefs.current[id] = el; };

  /* ---------- init MediaPipe FaceMesh -------------------- */
  useEffect(() => {
    faceMesh.current = new FaceMesh({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
    });
    faceMesh.current.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }, []);

  /* ---------- main vision loop --------------------------- */
  useEffect(() => {
    if (!faceMesh.current) return;

    faceMesh.current.onResults(({ multiFaceLandmarks }) => {
      const now  = performance.now();
      const dt   = now - lastT.current;      /* ms since prev frame */
      lastT.current = now;

      /* accumulate dwell time on current tile */
      if (currentPane.current !== null) {
        setPanes((p) =>
          p.map((tile) =>
            tile.id === currentPane.current
              ? { ...tile, dwellMs: tile.dwellMs + dt }
              : tile
          )
        );
      }

      /* ---- gaze & hit-test -------------------------------- */
      if (multiFaceLandmarks?.length) {
        const lm = multiFaceLandmarks[0];

        /* simple iris centre average → (x,y) 0-1 */
        const gx = ( (lm[33].x + lm[263].x) / 2 );
        const gy = ( (lm[159].y + lm[386].y) / 2 );
        const screenX = (1 - (0.5 + GAZE_SCALE * (gx - 0.5))) * innerWidth;
        const screenY = (0.5 + GAZE_SCALE * (gy - 0.5)) * innerHeight;

        setCursorPos({ x: screenX, y: screenY });

        const hit = document.elementFromPoint(screenX, screenY);
        const id  = hit?.dataset?.paneId ? parseInt(hit.dataset.paneId, 10) : null;
        currentPane.current = id;

        /* ---- coordinate log every LOG_EVERY_MS ------------ */
        if (id !== null && now - lastLogT.current >= LOG_EVERY_MS) {
          const col = id % COLS;                       // 0 → left
          const rowTop = Math.floor(id / COLS);        // 0 → top
          const row = ROWS - 1 - rowTop;               // 0 → bottom
          const stamp = new Date().toLocaleTimeString();
          const line  = `(${col}, ${row}) @ ${stamp}`;
          setLogs((prev) => [...prev.slice(-29), line]); // keep last 30
          lastLogT.current = now;
        }
      }
    });

    /* camera start ---------------------------------------- */
    const cam = new Camera(videoRef.current, {
      onFrame: async () =>
        await faceMesh.current.send({ image: videoRef.current }),
      width: 640,
      height: 480,
    });
    cam.start();
    return () => cam.stop();
  }, []);

  /* ------------------  UI  ------------------------------- */
  return (
    <div style={{ height: "100vh", overflow: "hidden", position: "relative" }}>
      {/* hidden webcam */}
      <video ref={videoRef} style={{ display: "none" }} />

      {/* full-screen heat-map grid */}
      <PaneGrid panes={panes} getPaneRef={getPaneRef} />

      {/* gaze cursor */}
      <div
        style={{
          position: "fixed",
          left: cursorPos.x - 6,
          top:  cursorPos.y - 6,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.75)",
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      {/* coordinate log (top-right) */}
      <div
        style={{
          position: "fixed",
          right: 6,
          top:   6,
          fontSize: 12,
          lineHeight: "1.3em",
          color: "#000",
          textAlign: "left",
          zIndex: 4,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {logs.map((ln, i) => (
          <div key={i}>{ln}</div>
        ))}
      </div>
    </div>
  );
}
