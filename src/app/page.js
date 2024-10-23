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

  const prevCursorPosition = useRef({ x: 0, y: 0 }); // For smoothing
  const cooldownRef = useRef(null); // Use a ref to track cooldown state

  const EAR_THRESHOLD = 0.25; // Adjust this value if needed

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

    const leftEye = leftEyeIndices.map(index => landmarks[index]);
    const rightEye = rightEyeIndices.map(index => landmarks[index]);

    const earLeft = computeEAR(leftEye);
    const earRight = computeEAR(rightEye);

    return earLeft < EAR_THRESHOLD || earRight < EAR_THRESHOLD;
  };

  const handleBlink = useCallback((gazeX, gazeY) => {
    if (!cooldownRef.current) {
      const element = document.elementFromPoint(gazeX, gazeY);
      if (element && element.dataset && element.dataset.value) {
        setTypedText(prevText => prevText + element.dataset.value);
      }

      setCooldown(true);
      cooldownRef.current = true;

      // Reset cooldown after 1 second
      setTimeout(() => {
        cooldownRef.current = false;
      }, 1000); // Adjust as needed
    }
  }, []);

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext('2d');

    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults((results) => {
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );
      canvasCtx.restore();

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        // Calculate gaze direction
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

        // Map gaze point to screen coordinates with x-axis reversed
        const screenX = (1 - gazePoint.x) * window.innerWidth;
        const screenY = gazePoint.y * window.innerHeight;

        // Smooth the cursor movement
        const alpha = 0.2; // Smoothing factor between 0 and 1
        const smoothedX = alpha * screenX + (1 - alpha) * prevCursorPosition.current.x;
        const smoothedY = alpha * screenY + (1 - alpha) * prevCursorPosition.current.y;

        setCursorPosition({ x: smoothedX, y: smoothedY });
        prevCursorPosition.current = { x: smoothedX, y: smoothedY };

        // Blink detection
        if (isBlinking(landmarks)) {
          handleBlink(smoothedX, smoothedY);
        }
      }
    });

    if (typeof window !== 'undefined') {
      const camera = new Camera(videoElement, {
        onFrame: async () => {
          await faceMesh.send({ image: videoElement });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }
  }, [handleBlink]);

  return (
    <div>
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas
        ref={canvasRef}
        style={{
          display: 'none', // Set to 'block' if you want to see the canvas
          position: 'absolute',
          width: '100%',
          height: '100%',
        }}
      />

      {/* Display the cursor */}
      <div
        style={{
          position: 'absolute',
          left: cursorPosition.x - 10,
          top: cursorPosition.y - 10,
          width: 20,
          height: 20,
          borderRadius: '50%',
          backgroundColor: 'red',
          pointerEvents: 'none',
        }}
      ></div>

      {/* Display the typed text */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          fontSize: '24px',
          backgroundColor: 'white',
          padding: '10px',
          borderRadius: '5px',
        }}
      >
        {typedText}
      </div>

      {/* Display the letters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(10, 1fr)',
          gridGap: '10px',
          marginTop: '100px',
          textAlign: 'center',
        }}
      >
        {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => (
          <div
            key={letter}
            data-value={letter}
            style={{
              fontSize: '36px',
              padding: '20px',
              border: '1px solid black',
              borderRadius: '5px',
            }}
          >
            {letter}
          </div>
        ))}
      </div>
    </div>
  );
}
