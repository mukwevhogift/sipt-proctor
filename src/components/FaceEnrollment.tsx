'use client';
import { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { getSupabase } from '@/lib/supabase';

interface FaceEnrollmentProps {
  onComplete: (descriptor: Float32Array) => void;
}

export default function FaceEnrollment({ onComplete }: FaceEnrollmentProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'starting' | 'ready' | 'capturing' | 'done' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('ready');
      } catch (err: any) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(err?.message ?? 'Failed to access camera');
        }
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Draw face detection overlay while user positions themselves
  useEffect(() => {
    if (status !== 'ready') return;
    const video = videoRef.current;
    if (!video) return;

    let isProcessing = false;
    const interval = setInterval(async () => {
      if (video.readyState < 2 || isProcessing) return;
      isProcessing = true;
      try {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks(true);

        if (canvasRef.current) {
          const dims = faceapi.matchDimensions(canvasRef.current, video, true);
          const resized = faceapi.resizeResults(detections, dims);
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          faceapi.draw.drawDetections(canvasRef.current, resized);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);
        }
      } catch { /* ignore frame errors */ }
      finally { isProcessing = false; }
    }, 500);

    return () => clearInterval(interval);
  }, [status]);

  const captureReference = async () => {
    if (!videoRef.current) return;
    setStatus('capturing');

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!detection) {
        setStatus('ready');
        setErrorMsg('No face detected. Position your face in the frame and try again.');
        return;
      }

      const descriptor = detection.descriptor;

      // Save to Supabase profile
      const sb = getSupabase();
      if (sb) {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          await sb.from('profiles').update({
            face_descriptor: Array.from(descriptor),
          }).eq('id', user.id);
        }
      }

      setStatus('done');

      // Stop the enrollment camera (exam will start its own)
      streamRef.current?.getTracks().forEach(t => t.stop());

      setTimeout(() => onComplete(descriptor), 800);
    } catch (err: any) {
      setStatus('ready');
      setErrorMsg(err?.message ?? 'Face capture failed');
    }
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-white">
      <h2 className="text-2xl font-bold mb-2">📸 Face Enrollment</h2>
      <p className="text-gray-400 mb-6 text-center max-w-md">
        Position your face clearly in the frame. This reference photo will be used to verify your identity throughout the exam.
      </p>

      <div className="relative mb-6">
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-96 rounded-2xl border-4 border-green-500/60"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
        {status === 'done' && (
          <div className="absolute inset-0 bg-green-500/20 rounded-2xl flex items-center justify-center">
            <span className="text-6xl">✅</span>
          </div>
        )}
      </div>

      {errorMsg && status !== 'done' && (
        <p className="text-yellow-400 text-sm mb-4 max-w-md text-center">{errorMsg}</p>
      )}

      {status === 'starting' && (
        <div className="flex items-center gap-2 text-gray-400">
          <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
          Starting camera…
        </div>
      )}

      {status === 'ready' && (
        <button
          onClick={captureReference}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
        >
          📸 Capture Reference Photo
        </button>
      )}

      {status === 'capturing' && (
        <div className="flex items-center gap-2 text-blue-400">
          <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
          Analyzing face…
        </div>
      )}

      {status === 'done' && (
        <p className="text-green-400 font-semibold text-lg">Face enrolled successfully! Proceeding…</p>
      )}

      {status === 'error' && (
        <div className="text-center">
          <p className="text-red-400 mb-4">{errorMsg}</p>
          <button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
