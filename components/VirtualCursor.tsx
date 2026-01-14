
import React from 'react';
import { Point } from '../types';

interface VirtualCursorProps {
  position: Point;
  isBlinking: boolean;
  isActive: boolean;
}

const VirtualCursor: React.FC<VirtualCursorProps> = ({ position, isBlinking, isActive }) => {
  if (!isActive) return null;

  return (
    <div
      className={`fixed z-[9999] pointer-events-none transition-transform duration-75 ease-out rounded-full border-2 
        ${isBlinking ? 'scale-150 border-red-400 bg-red-400/20' : 'scale-100 border-sky-400 bg-sky-400/20 cursor-glow'}`}
      style={{
        width: '32px',
        height: '32px',
        left: 0,
        top: 0,
        transform: `translate3d(${position.x - 16}px, ${position.y - 16}px, 0)`,
      }}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-sky-400 rounded-full" />
      {isBlinking && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-bold text-red-400 uppercase tracking-widest whitespace-nowrap">
          Click
        </div>
      )}
    </div>
  );
};

export default VirtualCursor;
