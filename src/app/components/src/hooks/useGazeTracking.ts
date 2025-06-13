import { useEffect, useState } from 'react';

const useGazeTracking = () => {
  const [gazeData, setGazeData] = useState({ x: 0, y: 0 });
  const [isGazing, setIsGazing] = useState(false);

  useEffect(() => {
    const handleGazeEvent = (event: MouseEvent) => {
      setGazeData({ x: event.clientX, y: event.clientY });
      setIsGazing(true);
    };

    const handleGazeEnd = () => {
      setIsGazing(false);
    };

    window.addEventListener('mousemove', handleGazeEvent);
    window.addEventListener('mouseleave', handleGazeEnd);

    return () => {
      window.removeEventListener('mousemove', handleGazeEvent);
      window.removeEventListener('mouseleave', handleGazeEnd);
    };
  }, []);

  return { gazeData, isGazing };
};

export default useGazeTracking;