
import { Point, CalibrationData } from '../types';

export const lerp = (start: number, end: number, amt: number) => {
  return (1 - amt) * start + amt * end;
};

export const getDistance = (p1: Point, p2: Point) => {
  if (!p1 || !p2) return 0;
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

/**
 * Simple Bi-linear interpolation based mapping for gaze estimation.
 */
export const mapFaceToScreen = (facePoint: Point, calibration: CalibrationData[]): Point => {
  if (!facePoint || calibration.length < 4) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  // Find bounds of face points in calibration
  const minX = Math.min(...calibration.map(c => c.facePoint.x));
  const maxX = Math.max(...calibration.map(c => c.facePoint.x));
  const minY = Math.min(...calibration.map(c => c.facePoint.y));
  const maxY = Math.max(...calibration.map(c => c.facePoint.y));

  // Normalize facePoint within these bounds
  const rangeX = maxX - minX || 0.0001;
  const rangeY = maxY - minY || 0.0001;
  
  const normX = (facePoint.x - minX) / rangeX;
  const normY = (facePoint.y - minY) / rangeY;

  // Clamp and map to screen dimensions
  const screenX = Math.max(0, Math.min(1, normX)) * window.innerWidth;
  const screenY = Math.max(0, Math.min(1, normY)) * window.innerHeight;

  return { x: screenX, y: screenY };
};

export const calculateEAR = (eyePoints: any[]) => {
  if (!eyePoints || eyePoints.length < 6) return 1.0;
  
  const p1 = eyePoints[0];
  const p2 = eyePoints[1];
  const p3 = eyePoints[2];
  const p4 = eyePoints[3];
  const p5 = eyePoints[4];
  const p6 = eyePoints[5];

  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 1.0;

  const distVertical1 = getDistance(p2, p6);
  const distVertical2 = getDistance(p3, p5);
  const distHorizontal = getDistance(p1, p4);

  if (distHorizontal === 0) return 1.0;
  return (distVertical1 + distVertical2) / (2.0 * distHorizontal);
};
