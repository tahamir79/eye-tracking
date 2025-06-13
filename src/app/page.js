"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import TextBox from "./components/TextBox.tsx";
import "./globals.css";

/*  ========  CONSTANTS  ========  */
const EAR_THRESHOLD = 0.25;
const GAZE_SCALE = 5.0;
const SUGGEST_BAR_HEIGHT = 80; // px -– space above the first key row that suggestions occupy

/*  ─────────────────────────────── */
export default function Home() {
  /* webcam refs */
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  /* typing state */
  const [typedText, setTypedText] = useState("");
  const [isShift, setIsShift] = useState(false);
  const isShiftRef = useRef(false);

  /* suggestions (filled by /api/suggest) */
  const [suggestions, setSuggestions] = useState(["The", "I", "In"]);

  /* gaze / hover */
  const [hovered, setHovered] = useState(null);
  const prevCursor = useRef({ x: 0, y: 0 });
  const cooldownRef = useRef(false);

  /* refs for every selectable element   */
  const keyRefs = useRef({});
  const edgeRefs = useRef({ top: [], left: [], right: [], bottom: [] });
  const bounds = useRef({ left: 0, right: 0, top: 0, bottom: 0 });

  /* helper – create / fetch a ref & register edge membership */
  const getRef = (id, isTop = false, isLeft = false, isRight = false, isBottom = false) => {
    if (!keyRefs.current[id]) {
      keyRefs.current[id] = React.createRef();
      if (isTop) edgeRefs.current.top.push(keyRefs.current[id]);
      if (isLeft) edgeRefs.current.left.push(keyRefs.current[id]);
      if (isRight) edgeRefs.current.right.push(keyRefs.current[id]);
      if (isBottom) edgeRefs.current.bottom.push(keyRefs.current[id]);
    }
    return keyRefs.current[id];
  };

  /* ────────────────────────────────────────────── */
  /* 1.   update word suggestions (400 ms debounce) */
  /* ────────────────────────────────────────────── */
  useEffect(() => {
    if (!typedText.trim()) {
      setSuggestions(["The", "I", "In"]);
      return;
    }
    const h = setTimeout(() => {
      fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: typedText }),
      })
        .then((r) => r.json())
        .then((d) =>
          setSuggestions(
            Array.isArray(d.suggestions) && d.suggestions.length
              ? d.suggestions.slice(0, 3)
              : ["the", "and", "to"]
          )
        )
        .catch(() => setSuggestions(["(error)", "try", "again"]));
    }, 400);
    return () => clearTimeout(h);
  }, [typedText]);

  /* ────────────────────────────────────────────── */
  /* 2.   keyboard / suggestion bounding box calc   */
  /* ────────────────────────────────────────────── */
  useEffect(() => {
    const recalc = () => {
      let l = window.innerWidth,
        r = 0,
        t = window.innerHeight,
        b = 0;
      const { top, left, right, bottom } = edgeRefs.current;
      [...top, ...left, ...right, ...bottom].forEach((ref) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        l = Math.min(l, rect.left);
        r = Math.max(r, rect.right);
        t = Math.min(t, rect.top);
        b = Math.max(b, rect.bottom);
      });
      bounds.current = { left: l, right: r, top: t, bottom: b };
    };
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  /* ────────────────────────────────────────────── */
  /* 3.   EAR & blink detection helpers            */
  /* ────────────────────────────────────────────── */
  const ear = (eye) => {
    const p2p6 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const p3p5 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const p1p4 = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (p2p6 + p3p5) / (2.0 * p1p4);
  };
  const blinked = useCallback((lm) => {
    const leftIdx = [33, 160, 158, 133, 153, 144];
    const rightIdx = [362, 385, 387, 263, 373, 380];
    const L = leftIdx.map((i) => lm[i]);
    const R = rightIdx.map((i) => lm[i]);
    return ear(L) < EAR_THRESHOLD || ear(R) < EAR_THRESHOLD;
  }, []);

  /* ────────────────────────────────────────────── */
  /* 4.   blink → “click” handler                  */
  /* ────────────────────────────────────────────── */
  const clickCurrent = useCallback((x, y) => {
    if (cooldownRef.current) return;
    const el = document.elementFromPoint(x, y);
    const val = el?.dataset?.value;
    if (!val) return;

    if (val === "Shift") {
      setIsShift((p) => {
        isShiftRef.current = !p;
        return !p;
      });
    } else if (val === "Backspace") {
      setTypedText((p) => p.slice(0, -1));
      isShiftRef.current && setIsShift(false);
    } else if (val === "Space") {
      setTypedText((p) => p + " ");
      isShiftRef.current && setIsShift(false);
    } else if (val === "Enter") {
      setTypedText((p) => p + "\n");
      isShiftRef.current && setIsShift(false);
    } else {
      const char = isShiftRef.current ? val.toUpperCase() : val.toLowerCase();
      setTypedText((p) => p + char + (["how", "are", "you"].includes(val) ? " " : ""));
      isShiftRef.current && setIsShift(false);
    }

    cooldownRef.current = true;
    setTimeout(() => (cooldownRef.current = false), 800);
  }, []);

  /* ────────────────────────────────────────────── */
  /* 5.   start MediaPipe FaceMesh                 */
  /* ────────────────────────────────────────────── */
  useEffect(() => {
    const fm = new FaceMesh({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
    });
    fm.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    fm.onResults((res) => {
      const lm = res.multiFaceLandmarks?.[0];
      if (!lm) return;

      /* gaze point */
      const le = { x: (lm[33].x + lm[133].x) / 2, y: (lm[33].y + lm[133].y) / 2 };
      const re = { x: (lm[362].x + lm[263].x) / 2, y: (lm[362].y + lm[263].y) / 2 };
      const g = { x: (le.x + re.x) / 2, y: (le.y + re.y) / 2 };

      let sx = (1 - (0.5 + GAZE_SCALE * (g.x - 0.5))) * window.innerWidth;
      let sy = (0.5 + GAZE_SCALE * (g.y - 0.5)) * window.innerHeight;

      /* clamp to keyboard & suggestion bar */
      const kb = bounds.current;
      sx = Math.max(kb.left, Math.min(sx, kb.right));
      sy = Math.max(kb.top - SUGGEST_BAR_HEIGHT, Math.min(sy, kb.bottom));

      const α = 0.2;
      const smX = α * sx + (1 - α) * prevCursor.current.x;
      const smY = α * sy + (1 - α) * prevCursor.current.y;
      prevCursor.current = { x: smX, y: smY };

      setHovered(document.elementFromPoint(smX, smY)?.dataset?.value || null);
      if (blinked(lm)) clickCurrent(smX, smY);
    });

    if (typeof window === "undefined") return;
    const cam = new Camera(videoRef.current, {
      onFrame: async () => await fm.send({ image: videoRef.current }),
      width: 640,
      height: 480,
    });
    cam.start();
  }, [blinked, clickCurrent]);

  /* ────────────────────────────────────────────── */
  /* 6.  render                                    */
  /* ────────────────────────────────────────────── */
  return (
    <div style={{ cursor: "none", height: "100vh", overflow: "hidden", fontSize: "115%" }}>
      <video ref={videoRef} style={{ display: "none" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* -------- TEXT BOX + SUGGEST BAR -------- */}
      <TextBox
        typedText={typedText}
        setTypedText={setTypedText}
        suggestions={suggestions}
        hoveredKey={hovered}
        getKeyRef={(id) => getRef(id, true)} // suggestions live on top edge
        isShiftActive={isShift}
      />

      {/* -------- KEYBOARD -------- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(14, 1fr)",
          gridGap: 0,
          maxWidth: 1400,
          margin: "4px auto 0",
        }}
      >
        {/* 1st row */}
        {"1234567890-=".split("").map((k) => (
          <Key k={k} hovered={hovered} ref={getRef(k, true)} key={k} />
        ))}
        <Key k="Backspace" hovered={hovered} ref={getRef("Backspace", true, false, true)} />

        {/* 2nd row */}
        <Spacer />
        {"QWERTYUIOP[]\\".split("").map((k) => (
          <Key k={k} hovered={hovered} ref={getRef(k, false, false, k === "\\")} key={k} />
        ))}

        {/* 3rd row */}
        <Spacer />
        {'ASDFGHJKL;\'"'.split("").map((k) => (
          <Key k={k} hovered={hovered} ref={getRef(k)} key={k} />
        ))}
        <Key k="Enter" hovered={hovered} ref={getRef("Enter", false, false, true)} />

        {/* 4th row */}
        <Key k="Shift" hovered={hovered} ref={getRef("Shift", false, false, true)} />
        {"ZXCVBNM,./".split("").map((k) => (
          <Key k={k} hovered={hovered} ref={getRef(k, false, true)} key={k} />
        ))}
      </div>

      {/* SPACE BAR */}
      <div
        data-value="Space"
        ref={getRef("Space", false, false, false, true)}
        style={{
          gridColumn: "span 14",
          textAlign: "center",
          margin: "30px auto 0",
          padding: 20,
          borderRadius: 5,
          background: hovered === "Space" ? "#d3d3d3" : "#fff",
          width: "80%",
        }}
      >
        Space
      </div>
    </div>
  );
}

/* KEY helper component */
const Key = React.forwardRef(({ k, hovered }, ref) => (
  <div
    data-value={k}
    ref={ref}
    style={{
      fontSize: 36,
      padding: 20,
      borderRadius: 4,
      background: hovered === k ? "#d3d3d3" : "#f0f0f0",
      textAlign: "center",
      userSelect: "none",
    }}
  >
    {k}
  </div>
));
const Spacer = () => <div style={{ gridColumn: "span 1" }} />;
