/* ====================================================================
 *  /src/app/page.js   – attention-heat-map + coordinate logger
 * ==================================================================== */
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { FaceMesh }  from "@mediapipe/face_mesh";
import { Camera }    from "@mediapipe/camera_utils";
import {
  PaneGrid,          // full-screen grid
  defaultPanes,
  COLS,
  ROWS,
} from "./components/PaneGrid";

/* ---------- tunables ---------- */
const EAR_THRESHOLD  = 0.25;   // blink cut-off
const GAZE_SCALE     = 7.5;    // ← 50 % more than 5.0
const LOG_INTERVAL   = 500;    // ms – how often to print coordinates
/* ------------------------------ */

export default function Home() {
  /* ───────── refs & state ─────── */
  const videoRef     = useRef(null);
  const faceMeshRef  = useRef(null);

  const lastT        = useRef(performance.now());           // dwell timer
  const lastLogT     = useRef(performance.now());           // console timer

  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  /* panes = [{ id , dwellMs }] */
  const [panes, setPanes] = useState(defaultPanes);
  const paneRefs   = useRef({});        // id → DOM node
  const paneHitRef = useRef(null);      // id of pane gazed at this frame
  const coordRef   = useRef(null);      // { x , y } bottom-origin coords

  /* helper so <PaneGrid/> can hand us refs */
  const getPaneRef = (id, el) => {
    if (el) paneRefs.current[id] = el;
  };

  /* ───────── FaceMesh init (once) ───────── */
  useEffect(() => {
    faceMeshRef.current = new FaceMesh({
      locateFile: f =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
    });
    faceMeshRef.current.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }, []);

  /* ───────── main vision loop ───────── */
  useEffect(() => {
    if (!faceMeshRef.current) return;

    faceMeshRef.current.onResults(({ multiFaceLandmarks }) => {
      const now  = performance.now();
      const dt   = now - lastT.current;
      lastT.current = now;

      /* accumulate dwell for last pane */
      if (paneHitRef.current !== null) {
        setPanes(prev =>
          prev.map(p =>
            p.id === paneHitRef.current ? { ...p, dwellMs: p.dwellMs + dt } : p
          )
        );
      }

      /* nothing detected?  exit early */
      if (!multiFaceLandmarks?.length) return;

      /* --- gaze point ---------------------------------------------------- */
      const lm = multiFaceLandmarks[0];
      const x = (lm[33].x + lm[263].x) / 2;   // eyes centre (norm 0-1)
      const y = (lm[159].y + lm[386].y) / 2;

      let screenX = (1 - (0.5 + GAZE_SCALE * (x - 0.5))) * window.innerWidth;
      let screenY = (0.5 + GAZE_SCALE * (y - 0.5)) * window.innerHeight;
      setCursor({ x: screenX, y: screenY });

      /* --- hit-test vs panes -------------------------------------------- */
      const hit = document.elementFromPoint(screenX, screenY);
      const id  = hit?.dataset?.paneId ? parseInt(hit.dataset.paneId, 10) : null;

      paneHitRef.current = id;

      if (id !== null) {
        /* convert to (col, row) top-origin */
        const colTop  = id % COLS;
        const rowTop  = Math.floor(id / COLS);
        /* invert Y so bottom = 0 */
        const rowBot  = ROWS - 1 - rowTop;
        coordRef.current = { x: colTop, y: rowBot };
      } else {
        coordRef.current = null;
      }

      /* --- log every LOG_INTERVAL ms ------------------------------------ */
      if (coordRef.current && now - lastLogT.current >= LOG_INTERVAL) {
        const { x: cx, y: cy } = coordRef.current;
        console.log(`pane (${cx},${cy})`);
        lastLogT.current = now;
      }
    });

    /* start camera ------------------------------------------------------- */
    const cam = new Camera(videoRef.current, {
      onFrame: async () =>
        await faceMeshRef.current.send({ image: videoRef.current }),
      width: 640,
      height: 480,
    });
    cam.start();

    return () => cam.stop();
  }, []);

  /* ───────── render ───────── */
  return (
    <div style={{ height: "100vh", overflow: "hidden", position: "relative" }}>
      {/* hidden video feed */}
      <video ref={videoRef} style={{ display: "none" }} />

      {/* heat-map grid */}
      <PaneGrid panes={panes} getPaneRef={getPaneRef} />

      {/* gaze cursor */}
      <div
        style={{
          position: "fixed",
          left: cursor.x - 6,
          top:  cursor.y - 6,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.7)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
    </div>
  );
}
