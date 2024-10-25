"use client"; // Ensure the component is treated as a Client Component

import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [typedText, setTypedText] = useState('');
  const [cooldown, setCooldown] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(false); // Shift state
  const [hoveredKey, setHoveredKey] = useState(null); // For key hover effect

  const prevCursorPosition = useRef({ x: 0, y: 0 });
  const cooldownRef = useRef(null);

  const EAR_THRESHOLD = 0.25;
  const GAZE_SCALE = 5.0; // Increased value for higher sensitivity to eye movement

  // Compute Eye Aspect Ratio (EAR) to detect blinks
  const computeEAR = (eye) => {
    const p2_p6 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const p3_p5 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const p1_p4 = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (p2_p6 + p3_p5) / (2.0 * p1_p4);
  };

  const isBlinking = (landmarks) => {
    const leftEyeIndices = [33, 160, 158, 133, 153, 144];
    const rightEyeIndices = [362, 385, 387, 263, 373, 380];

    const leftEye = leftEyeIndices.map((index) => landmarks[index]);
    const rightEye = rightEyeIndices.map((index) => landmarks[index]);

    const earLeft = computeEAR(leftEye);
    const earRight = computeEAR(rightEye);

    return earLeft < EAR_THRESHOLD || earRight < EAR_THRESHOLD;
  };

  const handleBlink = useCallback(
    (gazeX, gazeY) => {
      if (!cooldownRef.current) {
        const element = document.elementFromPoint(gazeX, gazeY);

        if (element && element.dataset) {
          const value = element.dataset.value;

          if (value === 'Backspace') {
            setTypedText((prev) => prev.slice(0, -1));
          } else if (value === 'Shift') {
            setIsShiftActive((prev) => !prev);
          } else if (value === 'Space') {
            setTypedText((prev) => prev + ' ');
          } else if (value === 'Enter') {
            setTypedText((prev) => prev + '\n'); // Add a newline for Enter key
          } else if (value) {
            let letter = isShiftActive ? value.toUpperCase() : value.toLowerCase();
            setTypedText((prev) => prev + letter);
            setIsShiftActive(false); // Turn off Shift after one use
          }
        }

        setCooldown(true);
        cooldownRef.current = true;

        setTimeout(() => {
          cooldownRef.current = false;
        }, 1000); // Adjust as needed
      }
    },
    [isShiftActive]
  );

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext('2d');

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

        // Gaze calculation for eye tracking
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

        // Amplify gaze movement to make it more pronounced
        const amplifiedGazeX = 0.5 + GAZE_SCALE * (gazePoint.x - 0.5);
        const amplifiedGazeY = 0.5 + GAZE_SCALE * (gazePoint.y - 0.5);

        // Map amplified gaze to screen coordinates
        const screenX = (1 - amplifiedGazeX) * window.innerWidth;
        const screenY = amplifiedGazeY * window.innerHeight;

        // Increase smoothing alpha by 15% (from 0.05 to 0.2)
        const alpha = 0.2; // Less smoothing, more responsive
        const smoothedX = alpha * screenX + (1 - alpha) * prevCursorPosition.current.x;
        const smoothedY = alpha * screenY + (1 - alpha) * prevCursorPosition.current.y;

        setCursorPosition({ x: smoothedX, y: smoothedY });
        prevCursorPosition.current = { x: smoothedX, y: smoothedY };

        // Hover effect logic
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

    if (typeof window !== 'undefined') {
      const camera = new Camera(videoElement, {
        onFrame: async () => await faceMesh.send({ image: videoElement }),
        width: 640,
        height: 480,
      });
      camera.start();
    }
  }, [handleBlink]);

  return (
    <div
      style={{
        cursor: 'url("https://image.shutterstock.com/image-vector/cursor-hand-icon-pointer-vector-260nw-1144710749.jpg"), auto',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontSize: '115%',
      }}
    >
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas
        ref={canvasRef}
        style={{
          display: 'none',
          position: 'absolute',
          width: '100%',
          height: '100%',
        }}
      />

      {/* Text Box */}
      <div
        style={{
          position: 'relative',
          top: '10px',
          fontSize: '24px',
          backgroundColor: 'white',
          padding: '10px',
          width: '80%',
          margin: '0 auto',
          borderRadius: '5px',
          textAlign: 'left',
          border: '1px solid black',
          whiteSpace: 'pre-wrap', // Allows for new lines to be displayed
          overflow: 'hidden',
        }}
      >
        {typedText}
        <span
          style={{
            display: 'inline-block',
            width: '1ch',
            backgroundColor: 'black',
            marginLeft: '5px',
            animation: 'blink 1s step-start infinite',
          }}
        >
          &nbsp;
        </span>
      </div>

      {/* QWERTY keyboard */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(14, 1fr)', // First row with 14 columns
          gridGap: '0px', // No gap between keys
          maxWidth: '1400px', // Increased width for larger keys
          margin: '0 auto',
          marginBottom: '10px',
        }}
      >
        {/* First Row */}
        {'1234567890-='.split('').map((key) => (
          <div key={key} data-value={key} style={getKeyStyle(hoveredKey, key)}>
            {key}
          </div>
        ))}
        <div data-value="Backspace" style={getKeyStyle(hoveredKey, 'Backspace')}>
          Backspace
        </div>

        {/* Second Row */}
        <div style={{ gridColumn: 'span 1' }}></div> {/* Empty space for alignment */}
        {'QWERTYUIOP[]\\'.split('').map((key) => (
          <div key={key} data-value={key} style={getKeyStyle(hoveredKey, key)}>
            {key}
          </div>
        ))}

        {/* Third Row */}
        <div style={{ gridColumn: 'span 1' }}></div> {/* Empty space for alignment */}
        {'ASDFGHJKL;\'"'.split('').map((key) => (
          <div key={key} data-value={key} style={getKeyStyle(hoveredKey, key)}>
            {key}
          </div>
        ))}
        <div data-value="Enter" style={getKeyStyle(hoveredKey, 'Enter')}>
          Enter
        </div>

        {/* Fourth Row */}
        <div data-value="Shift" style={getKeyStyle(hoveredKey, 'Shift')}>
          Shift
        </div>
        {'ZXCVBNM,./'.split('').map((key) => (
          <div key={key} data-value={key} style={getKeyStyle(hoveredKey, key)}>
            {key}
          </div>
        ))}
      </div>

      {/* Space Bar */}
      <div
        data-value="Space"
        style={{
          gridColumn: 'span 10',
          backgroundColor: hoveredKey === 'Space' ? 'lightgrey' : 'white',
          borderRadius: '5px',
          padding: '20px', // Increased padding for larger Space key
          textAlign: 'center',
          cursor: 'pointer',
          boxShadow: hoveredKey === 'Space' ? '0px 4px 10px rgba(0, 0, 0, 0.1)' : 'none',
        }}
      >
        Space
      </div>
    </div>
  );
}

// Key styling function
const getKeyStyle = (hoveredKey, key) => ({
  fontSize: '36px', // Increased font size for larger keys
  padding: '20px', // Increased padding for larger key area
  borderRadius: '3px',
  backgroundColor: hoveredKey === key ? '#d3d3d3' : '#f0f0f0',
  textAlign: 'center',
  cursor: 'pointer',
  margin: '0px', // No margin
  border: '0px', // No border
});
