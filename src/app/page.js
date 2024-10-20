"use client"; // Ensure this component is client-side for hooks

import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const dotRef = useRef(null);
  const [model, setModel] = useState(null);
  const [status, setStatus] = useState('Loading model...');

  // Load the BlazeFace model
  useEffect(() => {
    const loadModel = async () => {
      const loadedModel = await blazeface.load();
      setModel(loadedModel);
      setStatus('Model loaded. Turn on your webcam!');
    };
    loadModel();
  }, []);

  // Set up the webcam stream
  const setupWebcam = async () => {
    const video = videoRef.current;
    if (navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        setStatus('Webcam is active');
        runDetection();
      };
    }
  };

  // Function to calculate gaze using triangulation and trigonometry, reverse the X-axis
  const calculateGazePoint = (eyeLeft, eyeRight, faceWidth) => {
    const cameraWidth = videoRef.current.videoWidth;
    const cameraHeight = videoRef.current.videoHeight;

    // **Step 1: Estimate the distance from the camera (Z-axis) based on face width**
    const referenceFaceWidth = 200; // Arbitrary reference face width for a normal distance
    const distanceFromCamera = referenceFaceWidth / faceWidth; // Inversely proportional

    // **Step 2: Calculate angles based on eye positions relative to face center**
    const faceCenterX = (eyeLeft[0] + eyeRight[0]) / 2;
    const faceCenterY = (eyeLeft[1] + eyeRight[1]) / 2;

    // Horizontal and vertical angles based on face center
    const angleX = (faceCenterX - cameraWidth / 2) / cameraWidth;
    const angleY = (faceCenterY - cameraHeight / 2) / cameraHeight;

    // **Step 3: Extrapolate gaze point based on angles and reverse the X-axis**
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const sensitivityFactor = 2.0; // Controls the sensitivity of the gaze tracking
    const gazeX = screenWidth / 2 - angleX * screenWidth * sensitivityFactor * distanceFromCamera; // Reverse X-axis
    const gazeY = screenHeight / 2 + angleY * screenHeight * sensitivityFactor * distanceFromCamera;

    return { x: gazeX, y: gazeY };
  };

  // Function to run face and eye detection and map gaze position
  const runDetection = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const dot = dotRef.current;
    const ctx = canvas.getContext('2d');

    if (model) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const predictions = await model.estimateFaces(video, false);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'green';
      ctx.lineWidth = 3;

      // If a face is detected
      if (predictions.length > 0) {
        predictions.forEach((prediction) => {
          const start = prediction.topLeft;
          const end = prediction.bottomRight;

          const size = [end[0] - start[0], end[1] - start[1]];

          // Draw rectangle around face (for debugging)
          ctx.beginPath();
          ctx.rect(start[0], start[1], size[0], size[1]);
          ctx.stroke();

          // **Estimate eye positions based on face bounding box**
          const eyeY = start[1] + size[1] * 0.35; // Eyes are around 35% down the face height
          const eyeLeftX = start[0] + size[0] * 0.3; // Left eye
          const eyeRightX = start[0] + size[0] * 0.7; // Right eye

          // Calculate the gaze point based on triangulation and reversed X-axis
          const gaze = calculateGazePoint([eyeLeftX, eyeY], [eyeRightX, eyeY], size[0]);

          // Move the red dot to the mapped screen position
          dot.style.left = `${gaze.x}px`;
          dot.style.top = `${gaze.y}px`;

          setStatus('Face detected, tracking gaze...');
        });
      } else {
        setStatus('Face not detected');
      }
    }

    requestAnimationFrame(runDetection); // Keep detecting in a loop
  };

  return (
    <div>
      <h1>Gaze Tracker with Webcam</h1>
      <p>{status}</p>
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {/* Red dot representing gaze position */}
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
      <button onClick={setupWebcam}>Turn on Webcam</button>
    </div>
  );
}
