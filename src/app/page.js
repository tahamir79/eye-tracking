"use client"; // Ensure the component is treated as a Client Component

import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [cursorPosition, setCursorPosition] = useState({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const [typedText, setTypedText] = useState('');
  const [isShiftActive, setIsShiftActive] = useState(false); // Shift state
  const [hoveredKey, setHoveredKey] = useState(null); // For key hover effect
  const [suggestedWords, setSuggestedWords] = useState([]); // Suggested words from the model

  const prevCursorPosition = useRef({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const cooldownRef = useRef(false);

  const EAR_THRESHOLD = 0.25;
  const GAZE_SCALE = 5.0; // Increased value for higher sensitivity to eye movement

  // Refs for edge keys
  const edgeKeyRefs = {
    topKeys: [],
    leftKeys: [],
    rightKeys: [],
    bottomKeys: [],
  };

  // Function to add refs to edge keys
  const addEdgeKeyRef = (key, ref) => {
    // Top edge keys
    if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'].includes(key)) {
      edgeKeyRefs.topKeys.push(ref);
    }
    // Left edge keys
    if (['q', 'a', 'z'].includes(key.toLowerCase())) {
      edgeKeyRefs.leftKeys.push(ref);
    }
    // Right edge keys
    if (['Backspace', '\\', 'Enter', 'Shift'].includes(key)) {
      edgeKeyRefs.rightKeys.push(ref);
    }
    // Bottom edge keys (Space bar)
    if (key === 'Space') {
      edgeKeyRefs.bottomKeys.push(ref);
    }
  };

  // Keyboard boundaries
  const keyboardBounds = useRef({
    left: 0,
    right: window.innerWidth,
    top: 0,
    bottom: 0, // Will be set after rendering
  });

  useEffect(() => {
    // Calculate keyboard boundaries after rendering
    const calculateKeyboardBounds = () => {
      let left = window.innerWidth;
      let right = 0;
      let top = window.innerHeight;
      let bottom = 0;

      // Calculate left boundary
      edgeKeyRefs.leftKeys.forEach((ref) => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (rect.left < left) {
            left = rect.left;
          }
        }
      });

      // Calculate right boundary
      edgeKeyRefs.rightKeys.forEach((ref) => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (rect.right > right) {
            right = rect.right;
          }
        }
      });

      // Calculate top boundary
      edgeKeyRefs.topKeys.forEach((ref) => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (rect.top < top) {
            top = rect.top;
          }
        }
      });

      // Calculate bottom boundary (using the space bar)
      edgeKeyRefs.bottomKeys.forEach((ref) => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (rect.bottom > bottom) {
            bottom = rect.bottom;
          }
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

  const fetchWordSuggestions = async (text) => {
    try {
      const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
        method: 'POST',
        headers: {
          Authorization: `Bearer YOUR_HUGGINGFACE_API_KEY`, // Replace with your actual API key
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          parameters: { top_k: 3, max_new_tokens: 1 }, // Get the top 3 predictions
        }),
      });

      const data = await response.json();
      return data.length > 0 ? data[0].generated_text.split(' ').slice(-3) : [];
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }
  };

  const getSuggestions = async (currentText) => {
    const suggestions = await fetchWordSuggestions(currentText);
    setSuggestedWords(suggestions);
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
          } else if (suggestedWords.includes(value)) {
            setTypedText((prev) => prev + ' ' + value + ' '); // Add suggested word with space
            setSuggestedWords([]); // Clear suggestions after selection
          } else if (value) {
            let letter = isShiftActive ? value.toUpperCase() : value.toLowerCase();
            setTypedText((prev) => prev + letter);
            setIsShiftActive(false); // Turn off Shift after one use

            // Get the next word suggestions
            getSuggestions(typedText + letter);
          }
        }

        cooldownRef.current = true;
        setTimeout(() => {
          cooldownRef.current = false;
        }, 1000); // Adjust cooldown as needed
      }
    },
    [isShiftActive, suggestedWords, typedText]
  );

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;

    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true, // Enable iris landmarks for better accuracy
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults((results) => {
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
        let screenX = (1 - amplifiedGazeX) * window.innerWidth;
        let screenY = amplifiedGazeY * window.innerHeight;

        // Clamp gaze coordinates within the keyboard bounds
        screenX = Math.max(
          keyboardBounds.current.left,
          Math.min(screenX, keyboardBounds.current.right)
        );
        screenY = Math.max(
          keyboardBounds.current.top,
          Math.min(screenY, keyboardBounds.current.bottom)
        );

        // Smoothing
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
        cursor: 'none', // Hide the default cursor
        height: '100vh',
        position: 'relative',
        fontSize: '115%',
        overflow: 'hidden', // Lock scrolling
      }}
    >
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Pointer (Disabled as per your request) */}
      {/* <div
        style={{
          position: 'absolute',
          top: cursorPosition.y - 10,
          left: cursorPosition.x - 10,
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: 'red',
          pointerEvents: 'none',
        }}
      /> */}

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

      {/* Suggested Words */}
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        {suggestedWords.map((word, index) => (
          <span
            key={index}
            data-value={word}
            style={{
              margin: '0 5px',
              padding: '5px 10px',
              backgroundColor: hoveredKey === word ? '#d3d3d3' : '#f0f0f0',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            {word}
          </span>
        ))}
      </div>

      {/* QWERTY Keyboard Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(14, 1fr)',
          gridGap: '0px',
          maxWidth: '1400px',
          margin: '0 auto',
          marginBottom: '10px',
        }}
      >
        {/* First Row */}
        {'1234567890-='.split('').map((key) => {
          const ref = useRef(null);
          addEdgeKeyRef(key, ref);
          return (
            <div key={key} data-value={key} ref={ref} style={getKeyStyle(hoveredKey, key)}>
              {key}
            </div>
          );
        })}
        <div
          data-value="Backspace"
          ref={(ref) => addEdgeKeyRef('Backspace', { current: ref })}
          style={getKeyStyle(hoveredKey, 'Backspace')}
        >
          Backspace
        </div>

        {/* Second Row */}
        <div style={{ gridColumn: 'span 1' }}></div> {/* Empty space for alignment */}
        {'QWERTYUIOP[]\\'.split('').map((key) => {
          const ref = key === '\\' ? useRef(null) : null;
          if (ref) addEdgeKeyRef(key, ref);
          return (
            <div key={key} data-value={key} ref={ref} style={getKeyStyle(hoveredKey, key)}>
              {key}
            </div>
          );
        })}

        {/* Third Row */}
        <div style={{ gridColumn: 'span 1' }}></div> {/* Empty space for alignment */}
        {'ASDFGHJKL;\'"'.split('').map((key) => {
          const ref = ['Enter'].includes(key) ? useRef(null) : null;
          return (
            <div key={key} data-value={key} ref={ref} style={getKeyStyle(hoveredKey, key)}>
              {key}
            </div>
          );
        })}
        <div
          data-value="Enter"
          ref={(ref) => addEdgeKeyRef('Enter', { current: ref })}
          style={getKeyStyle(hoveredKey, 'Enter')}
        >
          Enter
        </div>

        {/* Fourth Row */}
        <div
          data-value="Shift"
          ref={(ref) => addEdgeKeyRef('Shift', { current: ref })}
          style={getKeyStyle(hoveredKey, 'Shift')}
        >
          Shift
        </div>
        {'ZXCVBNM,./'.split('').map((key) => {
          const ref = ['z'].includes(key.toLowerCase()) ? useRef(null) : null;
          if (ref) addEdgeKeyRef(key, ref);
          return (
            <div key={key} data-value={key} ref={ref} style={getKeyStyle(hoveredKey, key)}>
              {key}
            </div>
          );
        })}
      </div>

      {/* Space Bar */}
      <div
        id="space-bar"
        data-value="Space"
        ref={(ref) => addEdgeKeyRef('Space', { current: ref })}
        style={{
          gridColumn: 'span 14',
          backgroundColor: hoveredKey === 'Space' ? '#d3d3d3' : 'white',
          borderRadius: '5px',
          padding: '20px', // Increased padding for larger Space key
          textAlign: 'center',
          cursor: 'pointer',
          boxShadow: hoveredKey === 'Space' ? '0px 4px 10px rgba(0, 0, 0, 0.1)' : 'none',
          margin: '0 auto',
          width: '100%',
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
