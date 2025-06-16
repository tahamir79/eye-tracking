"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera }   from "@mediapipe/camera_utils";
import { PaneGrid, defaultPanes, COLS, ROWS } from "./components/PaneGrid";

/* --- amplify gaze: 1.0 = no change, 1.5 gives +50 % reach -------------- */
const GAIN = 5;

export default function Home() {
  /* refs & state -------------------------------------------------------- */
  const videoRef   = useRef(null);
  const faceMesh   = useRef(null);
  const lastT      = useRef(performance.now());

  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [panes,     setPanes]     = useState(defaultPanes);

  const paneRefs       = useRef({});
  const currentPaneId  = useRef(null);

  const getPaneRef = (id, el) => { if (el) paneRefs.current[id] = el; };

  /* FaceMesh init ------------------------------------------------------- */
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

  /* Vision loop --------------------------------------------------------- */
  useEffect(() => {
    if (!faceMesh.current) return;

    faceMesh.current.onResults(({ multiFaceLandmarks }) => {
      const now = performance.now();
      const dt  = now - lastT.current;
      lastT.current = now;

      /* accumulate dwell time */
      if (currentPaneId.current !== null) {
        setPanes((prev) =>
          prev.map((p) =>
            p.id === currentPaneId.current ? { ...p, dwellMs: p.dwellMs + dt } : p
          )
        );
      }

      /* update cursor ---------------------------------------------------- */
      if (multiFaceLandmarks?.length) {
        const lm = multiFaceLandmarks[0];

        /* 0-1 normalised iris midpoint */
        const xNorm = (lm[33].x + lm[263].x) / 2;
        const yNorm = (lm[159].y + lm[386].y) / 2;

        /* centre-relative displacement, then amplify -------------------- */
        const xAmp = 0.5 + GAIN * (0.5 - xNorm);  // invert X (mirror)
        const yAmp = 0.5 + GAIN * (yNorm - 0.5);

        /* clamp to viewport --------------------------------------------- */
        const xClamped = Math.min(1, Math.max(0, xAmp));
        const yClamped = Math.min(1, Math.max(0, yAmp));

        const screenX = xClamped * window.innerWidth;
        const screenY = yClamped * window.innerHeight;
        setCursorPos({ x: screenX, y: screenY });

        /* hit-test ------------------------------------------------------- */
        const hit = document.elementFromPoint(screenX, screenY);
        currentPaneId.current = hit?.dataset?.paneId
          ? parseInt(hit.dataset.paneId, 10)
          : null;
      }
    });

    /* start camera ------------------------------------------------------ */
    const cam = new Camera(videoRef.current, {
      onFrame: async () =>
        await faceMesh.current.send({ image: videoRef.current }),
      width: 640,
      height: 480,
    });
    cam.start();
    return () => cam.stop();
  }, []);

  /* render -------------------------------------------------------------- */
  return (
    <div style={{ height: "100vh", overflow: "hidden", position: "relative" }}>
      <video ref={videoRef} style={{ display: "none" }} />

      {/* full-screen attention grid */}
      <PaneGrid panes={panes} getPaneRef={(id, el) => {
        if (el) { el.dataset.paneId = id; getPaneRef(id, el); }
      }}/>

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
