/* ------------------------------------------------------------------
 * Full-screen attention grid
 *  – colour ramp now: light-blue → dark-blue → black
 * ---------------------------------------------------------------- */
import React, { memo } from "react";

/* ---------- dwell-time → colour ---------------------------------- *
 *  <   50 ms   : #ffffff        (white, not yet visited)
 *  50-500 ms   : #e5f2ff        (very-light blue)
 *  0.5-1.5 s   : #99ccff        (soft sky-blue)
 *  1.5-3 s     : #3399ff        (medium blue)
 *  3-6 s       : #0066cc        (dark royal-blue)
 *  6-10 s      : #003366        (midnight blue)
 *  ≥10 s       : #000000        (black – maximum dwell)
 * ---------------------------------------------------------------- */
export function dwellToColor(ms) {
  if (ms >= 10000) return "#000000";  // 10 s+
  if (ms >= 6000)  return "#003366";  // 6-10 s
  if (ms >= 3000)  return "#0066cc";  // 3-6 s
  if (ms >= 1500)  return "#3399ff";  // 1.5-3 s
  if (ms >=  500)  return "#99ccff";  // 0.5-1.5 s
  if (ms >    50)  return "#e5f2ff";  // 50-500 ms
  return "#ffffff";                   // <50 ms
}

/* ---------- grid dimensions -------------------------------------- */
export const COLS = 12;
export const ROWS = 8;
export const defaultPanes = Array.from({ length: COLS * ROWS }, (_, i) => ({
  id: i,
  dwellMs: 0,
}));

/* ---------- renderer --------------------------------------------- */
export const PaneGrid = memo(function PaneGrid({ panes, getPaneRef }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows:    `repeat(${ROWS}, 1fr)`,
        zIndex: 1,                // allow hit-testing
      }}
    >
      {panes.map((p) => (
        <div
          key={p.id}
          ref={(el) => getPaneRef(p.id, el)}
          data-pane-id={p.id}
          style={{
            transition: "background 0.12s linear",
            background: dwellToColor(p.dwellMs),
            border: "1px solid #ffffff40",
          }}
        />
      ))}
    </div>
  );
});
