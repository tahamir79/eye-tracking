"use client"; // Ensure the component is treated as a Client Component

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import TextBox from './components/TextBox';
import Keyboard from './components/Keyboard';

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [cursorPosition, setCursorPosition] = useState({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
  });
  const [typedText, setTypedText] = useState('');
  const [isShiftActive, setIsShiftActive] = useState(false);
  const isShiftActiveRef = useRef(isShiftActive);
  const [hoveredKey, setHoveredKey] = useState(null);

  const prevCursorPosition = useRef(cursorPosition);
  const cooldownRef = useRef(false);

  const EAR_THRESHOLD = 0.25;
  const GAZE_SCALE = 5.0;

  const edgeKeyRefs = useRef({
    topKeys: [],
    leftKeys: [],
    rightKeys: [],
    bottomKeys: [],
  });

  const addEdgeKeyRef = (key, ref) => {
    if (['1','2','3','4','5','6','7','8','9','0','-','=','Backspace'].includes(key)) {
      edgeKeyRefs.current.topKeys.push(ref);
    }
    if (['q','a','z'].includes(key.toLowerCase())) {
      edgeKeyRefs.current.leftKeys.push(ref);
    }
    if (['Backspace','\\','Enter','Shift'].includes(key)) {
      edgeKeyRefs.current.rightKeys.push(ref);
    }
    if (key === 'Space') {
      edgeKeyRefs.current.bottomKeys.push(ref);
    }
  };

  const keyboardBounds = useRef({
    left: 0,
    right: typeof window !== 'undefined' ? window.innerWidth : 0,
    top: 0,
    bottom: 0,
  });

  useEffect(() => {
    const calculateKeyboardBounds = () => {
      let left = window.innerWidth;
      let right = 0;
      let top = window.innerHeight;
      let bottom = 0;

      edgeKeyRefs.current.leftKeys.forEach((ref) => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (rect.left < left) left = rect.left;
        }
      });
      edgeKeyRefs.current.rightKeys.forEach((ref) => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (rect.right > right) right = rect.right;
        }
      });
      edgeKeyRefs.current.topKeys.forEach((ref) => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (rect.top < top) top = rect.top;
        }
      });
      edgeKeyRefs.current.bottomKeys.forEach((ref) => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (rect.bottom > bottom) bottom = rect.bottom;
        }
      });
      keyboardBounds.current = { left, right, top, bottom };
    };

    calculateKeyboardBounds();
    window.addEventListener('resize', calculateKeyboardBounds);
    return () => {
      window.removeEventListener('resize', calculateKeyboardBounds);
    };
  }, []);

  const computeEAR = (eye) => {
    const p2_p6 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const p3_p5 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const p1_p4 = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (p2_p6 + p3_p5) / (2.0 * p1_p4);
  };

  const isBlinking = useCallback((landmarks) => {
    const leftEyeIndices = [33, 160, 158, 133, 153, 144];
    const rightEyeIndices = [362, 385, 387, 263, 373, 380];
    const leftEye = leftEyeIndices.map((i) => landmarks[i]);
    const rightEye = rightEyeIndices.map((i) => landmarks[i]);
    const earLeft = computeEAR(leftEye);
    const earRight = computeEAR(rightEye);
    return earLeft < EAR_THRESHOLD || earRight < EAR_THRESHOLD;
  }, []);

  const handleBlink = useCallback((gazeX, gazeY) => {
    if (!cooldownRef.current) {
      const element = document.elementFromPoint(gazeX, gazeY);
      if (element && element.dataset) {
        const value = element.dataset.value;
        if (value === 'Shift') {
          setIsShiftActive((prev) => {
            const newState = !prev;
            isShiftActiveRef.current = newState;
            return newState;
          });
        } else if (value === 'Backspace') {
          setTypedText((prev) => prev.slice(0, -1));
          if (isShiftActiveRef.current) {
            setIsShiftActive(false);
            isShiftActiveRef.current = false;
          }
        } else if (value === 'Space') {
          setTypedText((prev) => prev + ' ');
          if (isShiftActiveRef.current) {
            setIsShiftActive(false);
            isShiftActiveRef.current = false;
          }
        } else if (value === 'Enter') {
          setTypedText((prev) => prev + '\n');
          if (isShiftActiveRef.current) {
            setIsShiftActive(false);
            isShiftActiveRef.current = false;
          }
        } else if (value) {
          let letter = isShiftActiveRef.current ? value.toUpperCase() : value.toLowerCase();
          setTypedText((prev) => prev + letter);
          if (isShiftActiveRef.current) {
            setIsShiftActive(false);
            isShiftActiveRef.current = false;
          }
        }
      }
      cooldownRef.current = true;
      setTimeout(() => {
        cooldownRef.current = false;
      }, 1000);
    }
  }, []);

  useEffect(() => {
    const videoElement = videoRef.current;
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
        const amplifiedGazeX = 0.5 + GAZE_SCALE * (gazePoint.x - 0.5);
        const amplifiedGazeY = 0.5 + GAZE_SCALE * (gazePoint.y - 0.5);
        let screenX = (1 - amplifiedGazeX) * window.innerWidth;
        let screenY = amplifiedGazeY * window.innerHeight;
        screenX = Math.max(keyboardBounds.current.left, Math.min(screenX, keyboardBounds.current.right));
        screenY = Math.max(keyboardBounds.current.top, Math.min(screenY, keyboardBounds.current.bottom));
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
    if (typeof window !== 'undefined') {
      const camera = new Camera(videoElement, {
        onFrame: async () => await faceMesh.send({ image: videoElement }),
        width: 640,
        height: 480
      });
      camera.start();
    }
  }, [handleBlink, isBlinking]);

  const keyRefs = useRef({});

  const getKeyRef = (key) => {
    if (!keyRefs.current[key]) {
      keyRefs.current[key] = React.createRef();
      addEdgeKeyRef(key, keyRefs.current[key]);
    }
    return keyRefs.current[key];
  };

  const getKeyStyle = (hoveredKey, key) => ({
    fontSize: '36px',
    padding: '20px',
    borderRadius: '3px',
    backgroundColor: hoveredKey === key ? '#d3d3d3' : '#f0f0f0',
    textAlign: 'center',
    cursor: 'pointer',
    margin: '0px',
    border: '0px',
  });

  return (
    <div
      style={{
        cursor: 'none',
        height: '100vh',
        position: 'relative',
        fontSize: '115%',
        overflow: 'hidden',
      }}
    >
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <TextBox typedText={typedText} isShiftActive={isShiftActive} />
      <Keyboard
        hoveredKey={hoveredKey}
        getKeyRef={getKeyRef}
        setHoveredKey={setHoveredKey}
        getKeyStyle={getKeyStyle}
      />
    </div>
  );
}