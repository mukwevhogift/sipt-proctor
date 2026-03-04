'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

declare global {
  interface Window {
    webgazer: any;
  }
}

const CALIBRATION_POINTS = [
  { x: 10, y: 15 }, { x: 50, y: 15 }, { x: 90, y: 15 },
  { x: 10, y: 50 }, { x: 50, y: 50 }, { x: 90, y: 50 },
  { x: 10, y: 85 }, { x: 50, y: 85 }, { x: 90, y: 85 },
];

const CLICKS_PER_POINT = 3;

interface CalibrationScreenProps {
  onComplete: () => void;
}

export default function CalibrationScreen({ onComplete }: CalibrationScreenProps) {
  const [currentPoint, setCurrentPoint] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  const [webgazerReady, setWebgazerReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // If WebGazer already loaded (from a previous page), reuse it
    if (window.webgazer) {
      try {
        window.webgazer
          .clearData()
          .saveDataAcrossSessions(false)
          .begin()
          .then(() => { setWebgazerReady(true); setLoading(false); })
          .catch(() => { setWebgazerReady(true); setLoading(false); });
      } catch {
        setWebgazerReady(true);
        setLoading(false);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/webgazer@3.5.3/dist/webgazer.min.js';
    script.async = true;

    script.onload = () => {
      window.webgazer
        .saveDataAcrossSessions(false)
        .begin()
        .then(() => { setWebgazerReady(true); setLoading(false); })
        .catch((err: any) => {
          console.warn('WebGazer start error:', err);
          setWebgazerReady(true);
          setLoading(false);
        });
    };

    script.onerror = () => {
      console.warn('WebGazer CDN failed to load');
      setLoading(false);
      // Skip calibration if WebGazer unavailable
      onCompleteRef.current();
    };

    document.head.appendChild(script);

    return () => {
      // Don't end WebGazer here – it's needed for the exam
    };
  // Use empty deps – onCompleteRef avoids re-running this effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointClick = useCallback(() => {
    const newCount = clickCount + 1;

    if (newCount >= CLICKS_PER_POINT) {
      if (currentPoint >= CALIBRATION_POINTS.length - 1) {
        // Calibration complete — hide WebGazer overlay but keep prediction running
        try {
          window.webgazer?.showVideoPreview(false);
          window.webgazer?.showPredictionPoints(false);
        } catch { /* older builds may not support these */ }
        onCompleteRef.current();
        return;
      }
      setCurrentPoint(prev => prev + 1);
      setClickCount(0);
    } else {
      setClickCount(newCount);
    }
  }, [clickCount, currentPoint]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-950 z-50 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-lg">Loading eye tracking calibration…</p>
        </div>
      </div>
    );
  }

  const point = CALIBRATION_POINTS[currentPoint];
  const progress = ((currentPoint * CLICKS_PER_POINT + clickCount) / (CALIBRATION_POINTS.length * CLICKS_PER_POINT)) * 100;

  return (
    <div className="fixed inset-0 bg-gray-950 z-50">
      {/* Header */}
      <div className="absolute top-6 left-0 right-0 text-center text-white z-10">
        <h2 className="text-2xl font-bold mb-2">👁 Eye Tracking Calibration</h2>
        <p className="text-gray-400">
          Look at the <span className="text-red-400 font-semibold">red dot</span> and click it {CLICKS_PER_POINT} times
        </p>
        <p className="text-gray-500 text-sm mt-1">
          Point {currentPoint + 1} of {CALIBRATION_POINTS.length}
        </p>
        {/* Progress bar */}
        <div className="max-w-xs mx-auto mt-3">
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Calibration dot */}
      <button
        onClick={handlePointClick}
        className="absolute w-10 h-10 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 hover:scale-125 focus:outline-none"
        style={{
          left: `${point.x}%`,
          top: `${point.y}%`,
          background: `radial-gradient(circle, #ef4444 30%, #dc2626 70%)`,
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.6), 0 0 40px rgba(239, 68, 68, 0.3)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      >
        <span className="sr-only">Calibration point</span>
      </button>

      {/* Click indicators */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
        {Array.from({ length: CLICKS_PER_POINT }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              i < clickCount ? 'bg-green-500 border-green-500' : 'border-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Skip button */}
      <button
        onClick={onComplete}
        className="absolute bottom-8 right-8 text-gray-600 hover:text-gray-400 text-sm transition-colors"
      >
        Skip calibration →
      </button>
    </div>
  );
}
