"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera }   from "@mediapipe/camera_utils";
import { PaneGrid, defaultPanes, COLS, ROWS } from "./components/PaneGrid";

export default function Home() {
  /* ---------------------------------------------------------------
   * refs & state
   * ------------------------------------------------------------- */
  const videoRef   = useRef(null);
  const faceMesh   = useRef(null);
  const lastT      = useRef(performance.now());

  /* gaze-related */
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  /* panes state – an array of {id, dwellMs} */
  const [panes, setPanes] = useState(defaultPanes);
  const paneRefs = useRef({});            // id → DOM node
  const currentPaneId = useRef(null);     // id we’re gazing at this frame

  /* expose ref setter for PaneGrid */
  const getPaneRef = (id, el) => {
    if (el) paneRefs.current[id] = el;
  };

  /* ---------------------------------------------------------------
   * FaceMesh initialisation (once)
   * ------------------------------------------------------------- */
  useEffect(() => {
    faceMesh.current = new FaceMesh({
      locateFile: (f) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
    });
    faceMesh.current.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }, []);

  /* ---------------------------------------------------------------
   * Main vision loop – update cursor + dwell counters
   * ------------------------------------------------------------- */
  useEffect(() => {
    if (!faceMesh.current) return;

    faceMesh.current.onResults(({ multiFaceLandmarks }) => {
      const now = performance.now();
      const dt  = now - lastT.current;          // ms since previous frame
      lastT.current = now;

      /* --- pick the pane we were staring at last frame and add dwell */
      if (currentPaneId.current !== null) {
        setPanes((prev) =>
          prev.map((p) =>
            p.id === currentPaneId.current
              ? { ...p, dwellMs: p.dwellMs + dt }
              : p
          )
        );
      }

      /* --- update cursor (only need iris centre for coarse mapping) */
      if (multiFaceLandmarks?.length) {
        const lm = multiFaceLandmarks[0];
        const x = (lm[33].x + lm[263].x) / 2;   // normalised 0-1
        const y = (lm[159].y + lm[386].y) / 2;
        const screenX = (1 - x) * window.innerWidth;
        const screenY = y * window.innerHeight;
        setCursorPos({ x: screenX, y: screenY });

        /* hit-test vs panes */
        const hit = document.elementFromPoint(screenX, screenY);
        const id  = hit?.dataset?.paneId
          ? parseInt(hit.dataset.paneId, 10)
          : null;
        currentPaneId.current = id;
      }
    });

    /* --- start camera once ------------------------------------------------ */
    const cam = new Camera(videoRef.current, {
      onFrame: async () =>
        await faceMesh.current.send({ image: videoRef.current }),
      width: 640,
      height: 480,
    });
    cam.start();

    return () => cam.stop();
  }, []);

  /* ---------------------------------------------------------------
   * rendering
   * ------------------------------------------------------------- */
  return (
    <div style={{ height: "100vh", overflow: "hidden", position: "relative" }}>
      {/* hidden webcam video feed */}
      <video ref={videoRef} style={{ display: "none" }} />

      {/* full-screen attention grid */}
      <PaneGrid panes={panes} getPaneRef={(id, el) => {
          if (el) {
            el.dataset.paneId = id;       //  ← for hit-testing
            getPaneRef(id, el);
          }
        }}
      />

      {/* gaze cursor */}
      <div
        style={{
          position: "fixed",
          left: cursorPos.x - 6,
          top:  cursorPos.y - 6,
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
