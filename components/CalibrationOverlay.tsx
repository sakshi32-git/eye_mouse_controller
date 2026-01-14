
import React, { useState, useEffect } from 'react';
import { Point } from '../types';

interface CalibrationOverlayProps {
  onPointCaptured: (screenPoint: Point) => void;
  onComplete: () => void;
}

const CALIBRATION_POINTS: Point[] = [
  { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 }
];

const CalibrationOverlay: React.FC<CalibrationOverlayProps> = ({ onPointCaptured, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      const captureTimer = setTimeout(() => {
        const p = CALIBRATION_POINTS[currentIndex];
        onPointCaptured({ x: p.x * window.innerWidth, y: p.y * window.innerHeight });
        
        if (currentIndex < CALIBRATION_POINTS.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setCountdown(2);
        } else {
          onComplete();
        }
      }, 1500);
      return () => clearTimeout(captureTimer);
    }
  }, [currentIndex, countdown, onPointCaptured, onComplete]);

  const currentPoint = CALIBRATION_POINTS[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4 text-sky-400 uppercase tracking-tighter">System Calibration</h2>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">
          Look at the orange target and keep your head steady. 
          Capturing point {currentIndex + 1} of {CALIBRATION_POINTS.length}.
        </p>
      </div>

      <div 
        className="absolute transition-all duration-500 ease-in-out"
        style={{
          left: `${currentPoint.x * 100}%`,
          top: `${currentPoint.y * 100}%`,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div className={`relative w-12 h-12 rounded-full border-4 flex items-center justify-center transition-colors ${countdown === 0 ? 'border-orange-500 animate-pulse' : 'border-slate-600'}`}>
          <div className="w-2 h-2 bg-orange-500 rounded-full" />
          {countdown > 0 && (
             <span className="absolute -bottom-8 font-mono text-orange-500 text-xl font-bold">{countdown}</span>
          )}
        </div>
      </div>
      
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-slate-500 text-sm italic">
        Calibration ensures precise gaze tracking mapping.
      </div>
    </div>
  );
};

export default CalibrationOverlay;
