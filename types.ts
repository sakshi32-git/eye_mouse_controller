
export interface Point {
  x: number;
  y: number;
}

export interface CalibrationData {
  screenPoint: Point;
  facePoint: Point;
}

export enum AppState {
  IDLE = 'IDLE',
  CALIBRATING = 'CALIBRATING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED'
}

export interface GazeStats {
  fps: number;
  isBlinking: boolean;
  isLeftEyeOpen: boolean;
  isRightEyeOpen: boolean;
  eyeAspectRatio: number;
}
