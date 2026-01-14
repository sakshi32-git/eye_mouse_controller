
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera as CameraIcon, Loader2, AlertCircle } from 'lucide-react';
import { AppState, Point, CalibrationData, GazeStats } from './types';
import VirtualCursor from './components/VirtualCursor';
import CalibrationOverlay from './components/CalibrationOverlay';
import { mapFaceToScreen, calculateEAR, lerp } from './utils/math';

// FaceMesh indices for eyes and iris
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const BLINK_THRESHOLD = 0.22;
const SMOOTHING_FACTOR = 0.15;

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<Point>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [calibrationData, setCalibrationData] = useState<CalibrationData[]>([]);
  const [stats, setStats] = useState<GazeStats>({
    fps: 0,
    isBlinking: false,
    isLeftEyeOpen: true,
    isRightEyeOpen: true,
    eyeAspectRatio: 1.0
  });

  const lastFrameTime = useRef<number>(0);
  const currentFacePoint = useRef<Point | null>(null);
  const prevCursorPos = useRef<Point>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  const onResults = useCallback((results: any) => {
    const now = performance.now();
    const fps = Math.round(1000 / (now - lastFrameTime.current));
    lastFrameTime.current = now;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];
      
      const leftIris = landmarks[468]; 
      const rightIris = landmarks[473];
      
      if (leftIris && rightIris) {
        const faceX = (leftIris.x + rightIris.x) / 2;
        const faceY = (leftIris.y + rightIris.y) / 2;
        currentFacePoint.current = { x: faceX, y: faceY };
      }

      const leftEyePoints = LEFT_EYE.map(idx => landmarks[idx]);
      const rightEyePoints = RIGHT_EYE.map(idx => landmarks[idx]);
      const earLeft = calculateEAR(leftEyePoints);
      const earRight = calculateEAR(rightEyePoints);
      const avgEar = (earLeft + earRight) / 2;

      setStats(prev => ({
        ...prev,
        fps,
        eyeAspectRatio: avgEar,
        isBlinking: avgEar < BLINK_THRESHOLD,
        isLeftEyeOpen: earLeft >= BLINK_THRESHOLD,
        isRightEyeOpen: earRight >= BLINK_THRESHOLD
      }));

      if (appState === AppState.RUNNING && calibrationData.length >= 4 && currentFacePoint.current) {
        const rawPos = mapFaceToScreen(currentFacePoint.current, calibrationData);
        const smoothedX = lerp(prevCursorPos.current.x, rawPos.x, SMOOTHING_FACTOR);
        const smoothedY = lerp(prevCursorPos.current.y, rawPos.y, SMOOTHING_FACTOR);
        const newPos = { x: smoothedX, y: smoothedY };
        setCursorPos(newPos);
        prevCursorPos.current = newPos;
      }
    }
  }, [appState, calibrationData]);

  useEffect(() => {
    let active = true;

    const waitForLibraries = async (retries = 20): Promise<boolean> => {
      for (let i = 0; i < retries; i++) {
        // @ts-ignore
        if (window.FaceMesh && window.Camera) return true;
        await new Promise(r => setTimeout(r, 500));
      }
      return false;
    };

    const init = async () => {
      const loaded = await waitForLibraries();
      if (!loaded) {
        if (active) {
          setError("MediaPipe failed to load. Please check your internet connection.");
          setIsInitializing(false);
        }
        return;
      }

      try {
        // @ts-ignore
        const faceMesh = new window.FaceMesh({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
          }
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        faceMesh.onResults(onResults);
        faceMeshRef.current = faceMesh;

        if (videoRef.current) {
          // @ts-ignore
          const camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (faceMeshRef.current && videoRef.current) {
                try {
                  await faceMeshRef.current.send({ image: videoRef.current });
                } catch (e) {
                  // Silent fail on individual frames
                }
              }
            },
            width: 640,
            height: 480
          });
          cameraRef.current = camera;
          await camera.start();
        }

        if (active) setIsInitializing(false);
      } catch (err) {
        console.error("Initialization error:", err);
        if (active) {
          setError("Failed to initialize tracking system.");
          setIsInitializing(false);
        }
      }
    };

    init();

    return () => {
      active = false;
      if (faceMeshRef.current) faceMeshRef.current.close();
    };
  }, [onResults]);

  const handleStartCalibration = () => {
    setCalibrationData([]);
    setAppState(AppState.CALIBRATING);
  };

  const captureCalibrationPoint = (screenPoint: Point) => {
    if (currentFacePoint.current) {
      setCalibrationData(prev => [
        ...prev, 
        { screenPoint, facePoint: { ...currentFacePoint.current! } }
      ]);
    }
  };

  const finalizeCalibration = () => {
    setAppState(AppState.RUNNING);
  };

  return (
    <div className="relative w-full h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none" />

      <div className="absolute top-8 left-8 z-40 space-y-4">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 p-6 rounded-2xl shadow-2xl w-80">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-black italic tracking-tighter text-sky-400">EYE-CONTROL v2.5</h1>
            <div className={`w-3 h-3 rounded-full animate-pulse ${appState === AppState.RUNNING ? 'bg-green-500' : 'bg-amber-500'}`} />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm font-mono">
              <span className="text-slate-400">System State</span>
              <span className="text-sky-300 font-bold">{isInitializing ? 'INITIALIZING...' : (error ? 'ERROR' : appState)}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-mono">
              <span className="text-slate-400">Tracker FPS</span>
              <span className="text-sky-300 font-bold">{stats.fps}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-mono">
              <span className="text-slate-400">E.A.R. Value</span>
              <span className="text-sky-300 font-bold">{(stats.eyeAspectRatio).toFixed(3)}</span>
            </div>
          </div>

          {error ? (
            <div className="mt-8 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <p>{error}</p>
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              <button 
                onClick={handleStartCalibration}
                disabled={isInitializing}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-sky-900/20 disabled:opacity-50"
              >
                {appState === AppState.IDLE ? 'Initialize Calibration' : 'Recalibrate System'}
              </button>
              <button 
                onClick={() => setAppState(prev => prev === AppState.RUNNING ? AppState.PAUSED : AppState.RUNNING)}
                disabled={appState === AppState.IDLE || appState === AppState.CALIBRATING || isInitializing}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl transition-all disabled:opacity-50"
              >
                {appState === AppState.PAUSED ? 'Resume Tracking' : 'Pause Interaction'}
              </button>
            </div>
          )}
        </div>

        <div className="relative group overflow-hidden rounded-2xl border border-slate-700 bg-black aspect-video w-80 shadow-2xl flex items-center justify-center">
          <video 
            ref={videoRef} 
            className={`w-full h-full object-cover grayscale transition-opacity ${isInitializing || error ? 'opacity-0' : 'opacity-60 group-hover:opacity-100'}`}
            autoPlay 
            playsInline 
            muted 
          />
          {(isInitializing && !error) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Loader2 className="animate-spin" size={24} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-center px-4">Loading Tracking Libraries...</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 gap-2 p-4 text-center">
              <AlertCircle size={32} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Hardware Fault</span>
            </div>
          )}
          {!isInitializing && !error && (
            <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <CameraIcon size={10} /> Live Monitoring
            </div>
          )}
          {stats.isBlinking && (
            <div className="absolute inset-0 border-4 border-red-500/50 pointer-events-none" />
          )}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="grid grid-cols-3 gap-8 opacity-40">
           {[...Array(9)].map((_, i) => (
             <div key={i} className="w-48 h-32 rounded-3xl border-2 border-slate-800 bg-slate-900/20 backdrop-blur-[2px] flex items-center justify-center">
                <div className="w-12 h-1 bg-slate-800 rounded-full" />
             </div>
           ))}
        </div>
      </div>

      {appState === AppState.IDLE && !isInitializing && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-950/40 backdrop-blur-sm">
          <div className="text-center max-w-xl animate-in fade-in duration-700">
            <div className="mb-6 inline-flex p-4 rounded-3xl bg-sky-500/10 border border-sky-500/20">
               <CameraIcon className="text-sky-400" size={48} />
            </div>
            <h2 className="text-4xl font-black mb-4 tracking-tight">Ready for Hands-Free?</h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              Welcome to the EyeControl Mouse System. Calibrate your gaze to begin interacting with your environment completely hands-free.
            </p>
            <div className="grid grid-cols-3 gap-4 text-xs font-bold uppercase tracking-widest text-slate-500">
               <div className="px-4 py-2 border border-slate-800 rounded-full">Gaze to Move</div>
               <div className="px-4 py-2 border border-slate-800 rounded-full">Blink to Click</div>
               <div className="px-4 py-2 border border-slate-800 rounded-full">Smooth Tracking</div>
            </div>
          </div>
        </div>
      )}

      {appState === AppState.CALIBRATING && (
        <CalibrationOverlay 
          onPointCaptured={captureCalibrationPoint}
          onComplete={finalizeCalibration}
        />
      )}

      <VirtualCursor 
        position={cursorPos}
        isBlinking={stats.isBlinking}
        isActive={appState === AppState.RUNNING}
      />

      <div className="absolute bottom-8 right-8 text-slate-600 font-mono text-[10px] uppercase tracking-[0.2em]">
        Research Module: Bio-Interface Interface // Project 2025
      </div>
    </div>
  );
};

export default App;
