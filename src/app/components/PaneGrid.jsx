/* ------------------------------------------------------------------
 * Full-screen attention grid — re-enable hit-testing so elementFromPoint works
 * ---------------------------------------------------------------- */
import React, { memo } from "react";

/* ---- colour ramp ------------------------------------------------ */
export function dwellToColor(ms) {
  if (ms >= 3000) return "#cc0000";   // deep red
  if (ms >= 1500) return "#ff6666";   // medium
  if (ms >    50) return "#ffe5e5";   // light pink
  return "#ffffff";                   // <50 ms : white (barely looked)
}

/* ---- grid dimensions ------------------------------------------- */
export const COLS = 12;
export const ROWS = 8;
export const defaultPanes = Array.from({ length: COLS * ROWS }, (_, i) => ({
  id: i,
  dwellMs: 0,
}));

/* ---- renderer --------------------------------------------------- */
export const PaneGrid = memo(function PaneGrid({ panes, getPaneRef }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows:    `repeat(${ROWS}, 1fr)`,
        /* pointerEvents **ON** so elementFromPoint detects tiles */
        zIndex: 1,
      }}
    >
      {panes.map((p) => (
        <div
          key={p.id}
          ref={(el) => getPaneRef(p.id, el)}
          data-pane-id={p.id}
          style={{
            transition: "background 0.1s linear",
            background: dwellToColor(p.dwellMs),
            border: "1px solid #ffffff40",
          }}
        />
      ))}
    </div>
  );
});
