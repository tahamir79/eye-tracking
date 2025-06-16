/* ------------------------------------------------------------------
 *  Full-screen flex-grid that darkens a pane as dwell-time grows.
 *  No refs are needed any more – page.js only needs data-pane-idx.
 * ----------------------------------------------------------------*/
import React from "react";

/* How many columns / rows do you want? */
const COLS = 6;
const ROWS = 4;

/* Helper – build a default pane array if caller doesn’t supply one */
export const defaultPanes = Array.from(
  { length: COLS * ROWS },
  () => ({ dwell: 0 })
);

export function PaneGrid({ panes }) {
  return (
    <div
      className="grid w-full h-full"
      style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
    >
      {panes.map((p, i) => (
        <div
          key={i}
          data-pane-idx={i}
          className={`transition-colors duration-100 ${p.className}`}
        />
      ))}
    </div>
  );
}
