"use client";
import React, { useRef } from "react";

export default function TextBox({
  typedText,
  setTypedText,
  suggestions,
  hoveredKey,
  getKeyRef,
  isShiftActive,
}) {
  const taRef = useRef(null);

  const choose = (w) => {
    setTypedText((p) => p + (p.endsWith(" ") ? "" : " ") + w + " ");
    taRef.current?.focus();
  };

  return (
    <div className="flex flex-col items-center space-y-4 pt-4">
      {/* textarea */}
      <textarea
        ref={taRef}
        value={typedText}
        onChange={(e) => setTypedText(e.target.value)}
        className="w-1/2 min-h-[120px] p-2 border rounded-md"
        placeholder="Start typing…"
      />

      {/* suggestion bar */}
      <div className="flex gap-6 bg-gray-900 px-6 py-4 rounded-md">
        {suggestions.map((w, i) => (
          <button
            key={i}
            data-value={w}                 /* for gaze click */
            ref={getKeyRef(`SUG${i}`)}     /* register as edge-top */
            onClick={() => choose(w)}
            style={{
              color: "#fff",
              padding: "8px 24px",
              fontSize: 20,
              border: "none",
              background: hoveredKey === w ? "#555" : "transparent",
              userSelect: "none",
              cursor: "pointer",
            }}
          >
            {w}
          </button>
        ))}
      </div>

      {isShiftActive && (
        <div className="text-red-600 font-semibold">Shift key is active</div>
      )}
    </div>
  );
}
