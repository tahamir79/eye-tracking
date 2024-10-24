"use client"; // Ensure the component is treated as a Client Component

import { useEffect, useRef, useState, useCallback } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [typedText, setTypedText] = useState("");
  const [cooldown, setCooldown] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [hoveredKey, setHoveredKey] = useState(null);

  const prevCursorPosition = useRef({ x: 0, y: 0 });
  const cooldownRef = useRef(false);

  const EAR_THRESHOLD = 0.25;

  const computeEAR = useCallback((eye) => {
    const p2_p6 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const p3_p5 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const p1_p4 = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (p2_p6 + p3_p5) / (2.0 * p1_p4);
  }, []);

  const isBlinking = useCallback(
    (landmarks) => {
      const leftEyeIndices = [33, 160, 158, 133, 153, 144];
      const rightEyeIndices = [362, 385, 387, 263, 373, 380];

      const leftEye = leftEyeIndices.map((index) => landmarks[index]);
      const rightEye = rightEyeIndices.map((index) => landmarks[index]);

      const earLeft = computeEAR(leftEye);
      const earRight = computeEAR(rightEye);

      return earLeft < EAR_THRESHOLD || earRight < EAR_THRESHOLD;
    },
    [computeEAR]
  );

  const handleBlink = useCallback(
    (gazeX, gazeY) => {
      if (!cooldownRef.current) {
        const element = document.elementFromPoint(gazeX, gazeY);

        if (element && element.dataset) {
          const value = element.dataset.value;

          if (value === "Backspace") {
            setTypedText((prev) => prev.slice(0, -1));
          } else if (value === "Shift") {
            setIsShiftActive((prev) => !prev);
          } else if (value === "Space") {
            setTypedText((prev) => prev + " ");
          } else if (value) {
            let letter = isShiftActive ? value.toUpperCase() : value.toLowerCase();
            setTypedText((prev) => prev + letter);
            setIsShiftActive(false);
          }
        }

        setCooldown(true);
        cooldownRef.current = true;

        setTimeout(() => {
          cooldownRef.current = false;
        }, 1000);
      }
    },
    [isShiftActive]
  );

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext("2d");

    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults((results) => {
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        const leftEyeCenter = {
          x: (landmarks[33].x + landmarks[133].x) / 2,
          y: (landmarks[33].y + landmarks[133].y) / 2,
        };
        const rightEyeCenter = {
          x: (landmarks[362].x + landmarks[263].x) / 2,
          y: (landmarks[362].y + landmarks[263].y) / 2,
        };
        const gazePoint = {
          x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
          y: (leftEyeCenter.y + rightEyeCenter.y) / 2,
        };

        const screenX = (1 - gazePoint.x) * window.innerWidth;
        const screenY = gazePoint.y * window.innerHeight;

        const alpha = 0.2;
        const smoothedX = alpha * screenX + (1 - alpha) * prevCursorPosition.current.x;
        const smoothedY = alpha * screenY + (1 - alpha) * prevCursorPosition.current.y;

        setCursorPosition({ x: smoothedX, y: smoothedY });
        prevCursorPosition.current = { x: smoothedX, y: smoothedY };

        const hoveredElement = document.elementFromPoint(smoothedX, smoothedY);
        if (hoveredElement && hoveredElement.dataset && hoveredElement.dataset.value) {
          setHoveredKey(hoveredElement.dataset.value);
        } else {
          setHoveredKey(null);
        }

        if (isBlinking(landmarks)) {
          handleBlink(smoothedX, smoothedY);
        }
      }
    });

    if (typeof window !== "undefined") {
      const camera = new Camera(videoElement, {
        onFrame: async () => await faceMesh.send({ image: videoElement }),
        width: 640,
        height: 480,
      });
      camera.start();
    }
  }, [isBlinking, handleBlink]);

  const getKeyStyle = useCallback(
    (key, isShift = false) => ({
      backgroundColor: hoveredKey === key ? "lightgrey" : "white",
      border: "none", // No border for a clean look
      padding: "15px",
      textAlign: "center",
      cursor: "pointer",
      fontSize: "20px",
      boxShadow: hoveredKey === key ? "0px 4px 10px rgba(0, 0, 0, 0.1)" : "none",
      gridColumn: isShift ? "span 2" : "auto",
    }),
    [hoveredKey]
  );

  return (
    <div
      style={{
        cursor: 'url("https://image.shutterstock.com/image-vector/cursor-hand-icon-pointer-vector-260nw-1144710749.jpg"), auto',
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontSize: "115%",
      }}
    >
      <video ref={videoRef} style={{ display: "none" }} />
      <canvas
        ref={canvasRef}
        style={{
          display: "none",
          position: "absolute",
          width: "100%",
          height: "100%",
        }}
      />

      {/* Text display */}
      <div
        style={{
          position: "relative",
          top: "10px",
          fontSize: "24px",
          backgroundColor: "white",
          padding: "10px",
          width: "80%",
          margin: "0 auto",
          borderRadius: "5px",
          textAlign: "left",
          border: "1px solid black",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {typedText}
        <span
          style={{
            display: "inline-block",
            width: "1ch",
            backgroundColor: "black",
            marginLeft: "5px",
            animation: "blink 1s step-start infinite",
          }}
        >
          &nbsp;
        </span>
      </div>

      {/* Keyboard Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(15, 1fr)", // Standard keyboard layout size
          gridGap: "5px", // Small gap between the keys
          maxWidth: "1000px",
          margin: "0 auto",
          marginBottom: "10px",
        }}
      >
        {/* First Row */}
        {"1234567890-=".split("").map((key) => (
          <div key={key} data-value={key} style={getKeyStyle(key)}>
            {key}
          </div>
        ))}
        <div data-value="Backspace" style={getKeyStyle("Backspace", true)}>
          Backspace
        </div>

        {/* Second Row */}
        {"QWERTYUIOP[]\\".split("").map((key) => (
          <div key={key} data-value={key} style={getKeyStyle(key)}>
            {key}
          </div>
        ))}

        {/* Third Row */}
        {"ASDFGHJKL;".split("").map((key) => (
          <div key={key} data-value={key} style={getKeyStyle(key)}>
            {key}
          </div>
        ))}
        <div key="single-quote" data-value="&#39;" style={getKeyStyle("&#39;")}>
          &#39;
        </div>
        <div data-value="Enter" style={getKeyStyle("Enter", true)}>
          Enter
        </div>

        {/* Fourth Row */}
        <div data-value="Shift" style={getKeyStyle("Shift", true)}>
          Shift
        </div>
        {"ZXCVBNM,./".split("").map((key) => (
          <div key={key} data-value={key} style={getKeyStyle(key)}>
            {key}
          </div>
        ))}
        <div data-value="Shift" style={getKeyStyle("Shift", true)}>
          Shift
        </div>
      </div>

      {/* Space Bar */}
      <div
        data-value="Space"
        style={{
          gridColumn: "span 10",
          backgroundColor: hoveredKey === "Space" ? "lightgrey" : "white",
          borderRadius: "5px",
          padding: "15px",
          textAlign: "center",
          cursor: "pointer",
          fontSize: "20px",
          boxShadow: hoveredKey === "Space" ? "0px 4px 10px rgba(0, 0, 0, 0.1)" : "none",
        }}
      >
        Space
      </div>
    </div>
  );
}
