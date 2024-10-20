"use client"; // Ensure this is a client component

import { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const dotRef = useRef(null);
  const [status, setStatus] = useState('Loading model...');
  const [faceMesh, setFaceMesh] = useState(null);

  // Initialize MediaPipe Face Mesh and setup the webcam feed
  useEffect(() => {
    const initializeFaceMesh = async () => {
      const faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // For tracking iris and eye movement
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults(onResults);
      setFaceMesh(faceMesh);

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

  // Function to calculate the angles of the irises relative to the camera center
  const calculateGazeUsingTrigonometry = (leftIris, rightIris) => {
    const cameraWidth = videoRef.current.videoWidth;
    const cameraHeight = videoRef.current.videoHeight;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Get the center of the irises
    const leftIrisX = leftIris.x * cameraWidth;
    const leftIrisY = leftIris.y * cameraHeight;
    const rightIrisX = rightIris.x * cameraWidth;
    const rightIrisY = rightIris.y * cameraHeight;

    // Calculate the center point between both irises
    const eyeCenterX = (leftIrisX + rightIrisX) / 2;
    const eyeCenterY = (leftIrisY + rightIrisY) / 2;

    // Assume the camera is at the center of the screen (cameraWidth/2, cameraHeight/2)
    const cameraCenterX = cameraWidth / 2;
    const cameraCenterY = cameraHeight / 2;

    // **Horizontal and vertical angle calculation using atan2**
    const angleX = Math.atan2(eyeCenterX - cameraCenterX, cameraWidth);
    const angleY = Math.atan2(eyeCenterY - cameraCenterY, cameraHeight);

    // Convert angles into screen coordinates by mapping them
    const sensitivity = 2.0;
    const gazeX = screenWidth / 2 - angleX * screenWidth * sensitivity; // Reverse X-axis
    const gazeY = screenHeight / 2 + angleY * screenHeight * sensitivity;

    return { x: gazeX, y: gazeY };
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

      // Get the iris landmarks
      const leftIris = landmarks[468]; // Left iris center
      const rightIris = landmarks[473]; // Right iris center

      // Calculate the gaze point based on trigonometry
      const gaze = calculateGazeUsingTrigonometry(leftIris, rightIris);

      // Move the red dot to the mapped screen position
      const dotElement = dotRef.current;
      dotElement.style.left = `${gaze.x}px`;
      dotElement.style.top = `${gaze.y}px`;
    }
    canvasCtx.restore();
  };

  return (
    <div>
      <h1>Gaze Tracker with MediaPipe and Trigonometry</h1>
      <p>{status}</p>
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div
        ref={dotRef}
        style={{
          position: 'absolute',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: 'red',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
