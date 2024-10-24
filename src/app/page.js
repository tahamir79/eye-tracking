"use client"; // Ensure the component is treated as a Client Component

import { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const dotRef = useRef(null);
  const [status, setStatus] = useState('Loading model...');
  const [text, setText] = useState(""); // The text box content
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 }); // Track pointer position
  const [blinkCooldown, setBlinkCooldown] = useState(false); // Cooldown to prevent multiple blinks
  const EAR_THRESHOLD = 0.2; // Eye Aspect Ratio threshold to detect blinks

  useEffect(() => {
    const initializeFaceMesh = async () => {
      const faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // Enable iris tracking for better eye tracking
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults(onResults);

      const videoElement = videoRef.current;
      const camera = new Camera(videoElement, {
        onFrame: async () => {
          await faceMesh.send({ image: videoElement });
        },
        width: 640,
        height: 480,
      });
      camera.start();

      setStatus('Model loaded and webcam is active!');
    };

    initializeFaceMesh();
  }, []);

  // Blink detection logic based on Eye Aspect Ratio (EAR)
  const isBlinking = (landmarks) => {
    const leftEye = landmarks.slice(33, 42);
    const rightEye = landmarks.slice(362, 371);

    // Calculate vertical and horizontal distances for both eyes
    const verticalLeft = Math.sqrt(
      Math.pow(leftEye[1].x - leftEye[5].x, 2) + Math.pow(leftEye[1].y - leftEye[5].y, 2)
    );
    const horizontalLeft = Math.sqrt(
      Math.pow(leftEye[0].x - leftEye[3].x, 2) + Math.pow(leftEye[0].y - leftEye[3].y, 2)
    );

    const verticalRight = Math.sqrt(
      Math.pow(rightEye[1].x - rightEye[5].x, 2) + Math.pow(rightEye[1].y - rightEye[5].y, 2)
    );
    const horizontalRight = Math.sqrt(
      Math.pow(rightEye[0].x - rightEye[3].x, 2) + Math.pow(rightEye[0].y - rightEye[3].y, 2)
    );

    const earLeft = verticalLeft / horizontalLeft;
    const earRight = verticalRight / horizontalRight;

    // Return true if both eyes are blinking (EAR is below the threshold)
    return earLeft < EAR_THRESHOLD && earRight < EAR_THRESHOLD;
  };

  // Handle the results of the face mesh model
  const onResults = (results) => {
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext('2d');

    canvasElement.width = results.image.width;
    canvasElement.height = results.image.height;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];

      // Detect blink
      const blinking = isBlinking(landmarks);

      if (blinking && !blinkCooldown) {
        // Log blink detection in the console
        console.log('Blink detected!');

        // Trigger click with blink
        handleBlinkClick();

        // Set cooldown to avoid multiple blinks being detected quickly
        setBlinkCooldown(true);
        setTimeout(() => setBlinkCooldown(false), 1000); // 1 second cooldown
      }

      // Calculate the gaze point based on iris position
      const leftIris = landmarks[468]; // Left iris center
      const rightIris = landmarks[473]; // Right iris center
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const eyeCenterX = (leftIris.x + rightIris.x) / 2;
      const eyeCenterY = (leftIris.y + rightIris.y) / 2;

      // Adjust the sensitivity factor to increase the scale of movement
      const sensitivityFactor = 4.0; // Increase this to make the movement more pronounced

      // Reverse X-axis to correct for mirroring and scale the movement
      const gazeX = screenWidth / 2 - (eyeCenterX - 0.5) * screenWidth * sensitivityFactor;
      const gazeY = screenHeight / 2 + (eyeCenterY - 0.5) * screenHeight * sensitivityFactor;

      // Move the red dot (pointer)
      setPointerPosition({ x: gazeX, y: gazeY });
    }

    canvasCtx.restore();
  };

  // Handle blink click event
  const handleBlinkClick = () => {
    const x = pointerPosition.x;
    const y = pointerPosition.y;

    // Check if the pointer is over a key and blink is detected
    const keyElements = document.elementsFromPoint(x, y);
    const key = keyElements.find((el) => el.classList.contains('key'));

    if (key) {
      const char = key.innerText;
      if (char === "Backspace") {
        setText((prev) => prev.slice(0, -1)); // Remove the last character
      } else {
        setText((prev) => prev + (char === "Space" ? " " : char)); // Add the character to the text box
      }
    }
  };

  // Handle mouse click event
  const handleMouseClick = (event) => {
    const key = event.target;
    if (key.classList.contains('key')) {
      const char = key.innerText;
      if (char === "Backspace") {
        setText((prev) => prev.slice(0, -1)); // Remove the last character
      } else {
        setText((prev) => prev + (char === "Space" ? " " : char)); // Add the character to the text box
      }
    }
  };

  return (
    <div>
      <h1>Gaze-Driven Virtual Keyboard with Blink Detection</h1>
      <p>{status}</p>

      {/* Text box to display the typed text */}
      <textarea
        value={text}
        readOnly
        style={{
          width: '100%',
          height: '100px',
          fontSize: '24px',
          marginBottom: '20px',
          textAlign: 'center',
        }}
      />

      {/* Virtual Keyboard */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '10px' }}
        onClick={handleMouseClick} // Add mouse click event
      >
        {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((key) => (
          <button key={key} className="key" style={keyboardButtonStyle}>
            {key}
          </button>
        ))}
        {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((key) => (
          <button key={key} className="key" style={keyboardButtonStyle}>
            {key}
          </button>
        ))}
        {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((key) => (
          <button key={key} className="key" style={keyboardButtonStyle}>
            {key}
          </button>
        ))}
        <button className="key" style={keyboardButtonStyle}>
          Space
        </button>
        <button className="key" style={keyboardButtonStyle}>
          Backspace
        </button>
      </div>

      {/* Pointer */}
      <div
        ref={dotRef}
        style={{
          position: 'absolute',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: 'red',
          left: `${pointerPosition.x}px`,
          top: `${pointerPosition.y}px`,
          pointerEvents: 'none',
        }}
      />

      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

// Style for the keyboard buttons
const keyboardButtonStyle = {
  fontSize: '24px',
  padding: '20px',
  cursor: 'pointer',
};
