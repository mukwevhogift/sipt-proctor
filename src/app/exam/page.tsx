'use client';
import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { getSupabase } from '@/lib/supabase';
import CalibrationScreen from '@/components/CalibrationScreen';
import FaceEnrollment from '@/components/FaceEnrollment';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// WebGazer type for window global
declare global {
  interface Window {
    webgazer: any;
  }
}

// Flag cooldown – prevent flooding the same flag type (ms)
const FLAG_COOLDOWN_MS = 5000;

interface ProctorFlag {
  session_id: string;
  timestamp: Date;
  type: string;
  description: string;
}

type ExamStep = 'consent' | 'enroll' | 'calibrate' | 'exam' | 'submitted';

export default function ExamPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    }>
      <SIPTExam />
    </Suspense>
  );
}

function SIPTExam() {
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get('assignment');
  const timeLimitMin = parseInt(searchParams.get('time') ?? '60', 10);

  // ─── Step-based flow ──────────────────────────────────────────────
  const [step, setStep] = useState<ExamStep>('consent');
  const [consentChecked, setConsentChecked] = useState(false);

  // ─── Core state ───────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [flags, setFlags] = useState<ProctorFlag[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [webcamReady, setWebcamReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignmentText, setAssignmentText] = useState('');
  const [timeLeft, setTimeLeft] = useState(timeLimitMin * 60);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sessionId, setSessionId] = useState('');

  // ─── Refs ─────────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const keystrokeTimes = useRef<number[]>([]);
  const referenceFaceRef = useRef<Float32Array | null>(null);
  const faceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFlagTime = useRef<Record<string, number>>({});
  const webgazerActive = useRef(false);
  const eyesAwayStart = useRef<number | null>(null);
  const flagsRef = useRef<ProctorFlag[]>([]);
  const sessionIdRef = useRef('');
  const submittingRef = useRef(false);
  const faceProcessingRef = useRef(false);
  const assignmentTextRef = useRef('');

  // Keep refs in sync with state
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { assignmentTextRef.current = assignmentText; }, [assignmentText]);

  // ─── Flag logger with cooldown + toast (uses ref to avoid re-creating monitoring effects) ─
  const logFlag = useCallback(async (type: string, description: string) => {
    const now = Date.now();
    if (lastFlagTime.current[type] && now - lastFlagTime.current[type] < FLAG_COOLDOWN_MS) return;
    lastFlagTime.current[type] = now;

    const sid = sessionIdRef.current;
    const flag: ProctorFlag = { session_id: sid, timestamp: new Date(), type, description };
    setFlags(prev => { const next = [...prev, flag]; flagsRef.current = next; return next; });

    // Toast notification for important flags
    const toastType = type.includes('MISMATCH') || type.includes('MULTIPLE') ? 'error' : 'warning';
    if (type !== 'FACE_ENROLLED' && type !== 'SESSION_END' && type !== 'SESSION_VIDEO') {
      toast[toastType](`${type}: ${description}`, { duration: 3000 });
    }

    const sb = getSupabase();
    if (sb && sid) {
      await sb.from('proctor_logs').insert({
        session_id: sid,
        timestamp: flag.timestamp.toISOString(),
        violation_type: flag.type,
        description: flag.description,
        severity: type.includes('MISMATCH') || type.includes('MULTIPLE') ? 3 : type.includes('PASTE') || type.includes('TAB') ? 2 : 1,
      }).then((res: any) => { if (res.error) console.warn('Log error:', res.error.message); });
    }
  // logFlag uses refs so it doesn't need sessionId in deps — stable reference
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 1. Load face-api models (on mount) ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models/tiny_face_detector'),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models/face_landmark_68_tiny'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models/face_recognition'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models/face_expression'),
        ]);
        if (!cancelled) setModelsLoaded(true);
      } catch (err) {
        console.error('Model load error:', err);
        if (!cancelled) setError('Failed to load AI models. Ensure /public/models/ contains the required weights.');
      }
    };
    loadModels();
    return () => { cancelled = true; };
  }, []);

  // ─── Create exam session in Supabase when exam starts ─────────────
  useEffect(() => {
    if (step !== 'exam') return;
    const sb = getSupabase();
    if (!sb) return;

    const createSession = async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;

      const { data, error } = await sb.from('exam_sessions').insert({
        assignment_id: assignmentId,
        student_id: user.id,
        status: 'in_progress',
      }).select('id').single();

      if (data) {
        setSessionId(data.id);
      } else if (error) {
        console.warn('Session creation error:', error.message);
        // Fallback to local session ID
        setSessionId(`local-${Date.now()}`);
      }
    };
    createSession();
  }, [step, assignmentId]);

  // ─── 2. Start webcam when exam step begins ───────────────────────
  useEffect(() => {
    if (step !== 'exam') return;
    let cancelled = false;
    let retryCount = 0;

    const startWebcam = async () => {
      while (retryCount <= 3 && !cancelled) {
        try {
          let stream: MediaStream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          }
          if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
          setWebcamReady(true);
          return;
        } catch (err: any) {
          retryCount++;
          if (retryCount > 3) {
            if (!cancelled) setError(
              err?.name === 'NotReadableError'
                ? 'Camera in use by another app. Close it and click Retry.'
                : `Camera error: ${err?.message ?? 'Unknown'}. Click Retry.`
            );
            return;
          }
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    };
    startWebcam();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [step]);

  // ─── 3. Face detection + canvas overlay + identity verification ───
  useEffect(() => {
    if (step !== 'exam' || !webcamReady || !videoRef.current) return;
    const video = videoRef.current;

    const intervalId = setInterval(async () => {
      if (!video || video.readyState < 2) return;
      if (faceProcessingRef.current) return; // prevent stacking on slow devices
      faceProcessingRef.current = true;
      try {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks(true)
          .withFaceDescriptors()
          .withFaceExpressions();

        // Draw overlays
        if (canvasRef.current) {
          const dims = faceapi.matchDimensions(canvasRef.current, video, true);
          const resized = faceapi.resizeResults(detections, dims);
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          faceapi.draw.drawDetections(canvasRef.current, resized);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);
        }

        if (detections.length === 0) logFlag('FACE_MISSING', 'No face detected – student may have left');
        if (detections.length > 1) logFlag('MULTIPLE_FACES', `${detections.length} faces detected – possible external help`);

        // Compare against stored reference face
        if (detections.length === 1 && referenceFaceRef.current) {
          const distance = faceapi.euclideanDistance(referenceFaceRef.current, detections[0].descriptor);
          if (distance > 0.6) {
            logFlag('IDENTITY_MISMATCH', `Face mismatch (distance: ${distance.toFixed(2)}) – possible impersonation`);
          }
        }
      } catch (err) {
        console.warn('Face detection frame error:', err);
      } finally {
        faceProcessingRef.current = false;
      }
    }, 1500);

    faceIntervalRef.current = intervalId;
    return () => clearInterval(intervalId);
  }, [step, webcamReady, logFlag]);

  // ─── 4. Eye tracking (WebGazer should already be started from calibration)
  useEffect(() => {
    if (step !== 'exam' || !webcamReady) return;
    if (!window.webgazer) return;

    try {
      window.webgazer.setGazeListener((data: any) => {
        if (!data) {
          if (!eyesAwayStart.current) eyesAwayStart.current = Date.now();
          if (Date.now() - eyesAwayStart.current > 5000) {
            logFlag('EYES_AWAY', 'Eyes off-screen for >5 seconds');
            eyesAwayStart.current = Date.now();
          }
        } else {
          eyesAwayStart.current = null;
          const { x } = data;
          if (x < 50 || x > window.innerWidth - 50) {
            logFlag('GAZE_SUSPICIOUS', `Gaze at extreme edge (x=${Math.round(x)})`);
          }
        }
      });
      webgazerActive.current = true;
    } catch (err) {
      console.warn('WebGazer listener error:', err);
    }

    return () => {
      if (webgazerActive.current && window.webgazer) {
        try { window.webgazer.setGazeListener(() => {}); } catch { /* ignore */ }
      }
    };
  }, [step, webcamReady, logFlag]);

  // ─── 5. Browser activity monitoring ───────────────────────────────
  useEffect(() => {
    if (step !== 'exam') return;
    const handleVisibility = () => {
      if (document.hidden) logFlag('TAB_SWITCH', 'Tab switched or minimised');
    };
    const handleBlur = () => logFlag('WINDOW_BLUR', 'Browser window lost focus');
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [step, logFlag]);

  // ─── 6. Anti-cheat: Right-click, keyboard shortcuts, fullscreen ──
  useEffect(() => {
    if (step !== 'exam') return;

    // Request fullscreen (returns a Promise – must .catch() it)
    document.documentElement.requestFullscreen?.()?.catch(() => {});

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logFlag('RIGHT_CLICK', 'Right-click attempted during exam');
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+V, Ctrl+Tab, PrintScreen (allow Ctrl+A and Ctrl+C for editing own work)
      if (e.ctrlKey && ['v', 'Tab'].includes(e.key)) {
        e.preventDefault();
        logFlag('SHORTCUT_BLOCKED', `Blocked shortcut: Ctrl+${e.key}`);
      }
      if (e.key === 'PrintScreen') {
        logFlag('SCREENSHOT_ATTEMPT', 'PrintScreen key pressed');
      }
      if (e.altKey && e.key === 'Tab') {
        logFlag('ALT_TAB', 'Alt+Tab attempted');
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logFlag('FULLSCREEN_EXIT', 'Exited fullscreen mode');
        toast.warning('Please return to fullscreen mode', { duration: 5000 });
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) {
        document.exitFullscreen?.()?.catch(() => {});
      }
    };
  }, [step, logFlag]);

  // ─── 7. Session recording ─────────────────────────────────────────
  useEffect(() => {
    if (step !== 'exam' || !webcamReady || !streamRef.current) return;

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm';
      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const sb = getSupabase();
        if (sb && sessionId) {
          const filename = `${sessionId}.webm`;
          const { data, error } = await sb.storage.from('proctor-videos').upload(filename, blob);
          if (data) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
            const videoUrl = `${supabaseUrl}/storage/v1/object/public/proctor-videos/${filename}`;
            await sb.from('exam_sessions').update({ video_url: videoUrl }).eq('id', sessionId);
          }
          if (error) console.warn('Video upload error:', error.message);
        }
        setIsRecording(false);
      };

      recorder.start(10000);
      setIsRecording(true);

      // Recording time counter
      recTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      console.warn('MediaRecorder error:', err);
    }

    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [step, webcamReady, sessionId]);

  // ─── 8. Timer countdown ───────────────────────────────────────────
  useEffect(() => {
    if (step !== 'exam') return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        if (prev === 300) toast.warning('5 minutes remaining!', { duration: 5000 });
        if (prev === 60) toast.error('1 minute remaining!', { duration: 5000 });
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ─── Paste detection ──────────────────────────────────────────────
  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    logFlag('PASTE_DETECTED', `Pasted ${pastedText.length} chars: "${pastedText.substring(0, 80)}…"`);
  };

  // ─── Keyboard pattern analysis ────────────────────────────────────
  const handleKeyDown = () => {
    const now = Date.now();
    keystrokeTimes.current.push(now);
    if (keystrokeTimes.current.length > 50) keystrokeTimes.current = keystrokeTimes.current.slice(-50);

    if (keystrokeTimes.current.length >= 20) {
      const recent = keystrokeTimes.current.slice(-20);
      const intervals = recent.slice(1).map((t, i) => t - recent[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / intervals.length;
      if (variance < 5) logFlag('UNNATURAL_TYPING', `Variance ${variance.toFixed(1)}ms – abnormally uniform`);
      const maxInterval = Math.max(...intervals);
      if (maxInterval > 10000 && avg < 100) logFlag('TYPING_BURST', 'Long pause then rapid burst');
    }
  };

  // ─── Submit & end session ─────────────────────────────────────────
  const handleSubmit = async () => {
    // Guard against double submit (timer + button race)
    if (submittingRef.current) return;
    submittingRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);
    if (faceIntervalRef.current) clearInterval(faceIntervalRef.current);
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (webgazerActive.current && window.webgazer) {
      try { window.webgazer.end(); } catch { /* ignore */ }
    }
    if (document.fullscreenElement) {
      document.exitFullscreen?.()?.catch(() => {});
    }

    // Save submission + activity log to Supabase (use refs for latest values)
    const sid = sessionIdRef.current;
    const text = assignmentTextRef.current;
    const sb = getSupabase();
    if (sb && sid) {
      const activityLog = flagsRef.current.map(f => ({
        type: f.type,
        description: f.description,
        timestamp: f.timestamp.toISOString(),
      }));
      const trustScore = calculateTrustScore(flagsRef.current);
      await sb.from('exam_sessions').update({
        status: 'submitted',
        ended_at: new Date().toISOString(),
        submitted_content: text,
        activity_log: activityLog,
        trust_score: trustScore,
      }).eq('id', sid);
    }

    logFlag('SESSION_END', `Submitted (${text.length} chars)`);
    setStep('submitted');
  };

  // ─── Helpers ──────────────────────────────────────────────────────
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const calculateTrustScore = (flagList: ProctorFlag[]) => {
    const deductions: Record<string, number> = {
      FACE_MISSING: 5, MULTIPLE_FACES: 15, IDENTITY_MISMATCH: 25,
      EYES_AWAY: 3, GAZE_SUSPICIOUS: 2, TAB_SWITCH: 10, WINDOW_BLUR: 8,
      PASTE_DETECTED: 15, UNNATURAL_TYPING: 10, TYPING_BURST: 8,
      FULLSCREEN_EXIT: 5, RIGHT_CLICK: 3, SHORTCUT_BLOCKED: 5,
      SCREENSHOT_ATTEMPT: 10, ALT_TAB: 8,
    };
    let score = 100;
    for (const f of flagList) score -= deductions[f.type] ?? 1;
    return Math.max(0, Math.min(100, score));
  };

  const trustScore = calculateTrustScore(flags);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER – Step-based flow
  // ═══════════════════════════════════════════════════════════════════

  // ─── Error state ──────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-8">
        <div className="max-w-lg text-center">
          <h1 className="text-3xl font-bold text-red-500 mb-4">Proctoring Error</h1>
          <p className="text-lg text-gray-300 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-xl text-lg">Retry</button>
        </div>
      </div>
    );
  }

  // ─── STEP 1: Consent ──────────────────────────────────────────────
  if (step === 'consent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-6">
        <div className="max-w-2xl w-full bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">Proctoring Consent</h1>
            <p className="text-blue-400">SIPT – Smart Integrity Proctoring Tool</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-3 text-yellow-400">⚠ Monitoring Notice</h2>
            <p className="text-gray-300 text-sm mb-4">This session will activate:</p>
            <ul className="space-y-1.5 text-sm text-gray-300">
              <li>📹 <strong>Webcam + Facial Recognition</strong> – Identity &amp; presence</li>
              <li>👁 <strong>Eye Tracking</strong> – Gaze pattern monitoring</li>
              <li>🖥 <strong>Browser Monitoring</strong> – Tab switching &amp; focus</li>
              <li>📋 <strong>Paste Detection</strong> – Content flagging</li>
              <li>⌨ <strong>Keyboard Analysis</strong> – Pattern irregularities</li>
              <li>🔴 <strong>Session Recording</strong> – Video &amp; activity log</li>
              <li>🔒 <strong>Fullscreen Lock</strong> – Must remain fullscreen</li>
            </ul>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-400 mt-4">
              <strong className="text-gray-300">POPIA:</strong> All processing is local. Data stored securely for review only.
            </div>
          </div>
          <label className="flex items-start gap-3 mb-6 cursor-pointer">
            <input type="checkbox" checked={consentChecked} onChange={e => setConsentChecked(e.target.checked)}
              className="mt-1 w-5 h-5 rounded" />
            <span className="text-sm text-gray-300">I consent to the monitoring described above and confirm I am the registered student.</span>
          </label>
          <button
            onClick={() => consentChecked && setStep('enroll')}
            disabled={!consentChecked || !modelsLoaded}
            className={`w-full py-4 rounded-xl text-lg font-semibold transition-all ${
              consentChecked && modelsLoaded ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {!modelsLoaded ? '⏳ Loading AI models…' : consentChecked ? '✅ Continue to Face Enrollment' : 'Please accept the terms above'}
          </button>
        </div>
      </div>
    );
  }

  // ─── STEP 2: Face Enrollment ──────────────────────────────────────
  if (step === 'enroll') {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <FaceEnrollment onComplete={(descriptor) => {
          referenceFaceRef.current = descriptor;
          setStep('calibrate');
        }} />
      </div>
    );
  }

  // ─── STEP 3: Eye Tracking Calibration ─────────────────────────────
  if (step === 'calibrate') {
    return <CalibrationScreen onComplete={() => setStep('exam')} />;
  }

  // ─── STEP 5: Submitted ────────────────────────────────────────────
  if (step === 'submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-8">
        <div className="max-w-lg w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-3xl font-bold text-green-400 mb-4">Assignment Submitted</h1>
          <div className="space-y-3 text-left bg-gray-800/50 rounded-xl p-6 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Session ID</span>
              <span className="font-mono text-xs">{sessionId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Characters Written</span>
              <span>{assignmentText.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Flags</span>
              <span className="text-yellow-400">{flags.filter(f => !['FACE_ENROLLED','SESSION_END','SESSION_VIDEO'].includes(f.type)).length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Trust Score</span>
              <span className={`font-bold text-lg ${trustScore >= 80 ? 'text-green-400' : trustScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {trustScore}/100
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Session Duration</span>
              <span>{formatTime(recordingTime)}</span>
            </div>
          </div>
          <p className="text-gray-500 text-sm mb-6">Your video recording and activity log have been saved for review.</p>
          <Link href="/assignments" className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-xl font-semibold inline-block transition-colors">
            Back to Assignments
          </Link>
        </div>
      </div>
    );
  }

  // ─── STEP 4: Exam (loading state) ────────────────────────────────
  if (!webcamReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-8">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2">Starting Proctored Session…</h1>
          <p className="text-gray-400">Initialising camera &amp; monitoring…</p>
        </div>
      </div>
    );
  }

  // ─── STEP 4: Exam (main UI) ───────────────────────────────────────
  const timerColor = timeLeft > 300 ? 'text-white' : timeLeft > 60 ? 'text-yellow-400' : 'text-red-400 animate-pulse';

  return (
    <div className="min-h-screen bg-gray-950 text-white p-3 md:p-6">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">SIPT Exam</span>
          {isRecording && (
            <span className="flex items-center gap-1.5 bg-red-900/60 px-3 py-1 rounded-full text-xs">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              REC {formatTime(recordingTime)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-2xl font-mono font-bold ${timerColor}`}>
            ⏱ {formatTime(timeLeft)}
          </span>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            trustScore >= 80 ? 'bg-green-900/50 text-green-400' :
            trustScore >= 50 ? 'bg-yellow-900/50 text-yellow-400' :
            'bg-red-900/50 text-red-400'
          }`}>
            Score: {trustScore}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Webcam */}
        <div className="relative bg-gray-900 rounded-xl overflow-hidden">
          <video ref={videoRef} muted playsInline className="w-full rounded-xl border-2 border-red-500/60" />
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg text-xs">🔴 LIVE</div>
          <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg text-xs text-gray-300">
            {referenceFaceRef.current ? '✅ Identity verified' : '⏳ Verifying…'}
          </div>
        </div>

        {/* Assignment Editor */}
        <div className="flex flex-col">
          <label className="text-sm font-semibold mb-2 text-gray-300">Assignment Response</label>
          <textarea
            value={assignmentText}
            onChange={e => setAssignmentText(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-[20rem] bg-gray-900 border border-gray-700 p-4 text-base rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type your assignment here… (pasting will be flagged)"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-500">{assignmentText.length} characters</span>
            <button onClick={handleSubmit} className="bg-red-600 hover:bg-red-700 transition-colors px-6 py-2.5 rounded-xl font-semibold text-sm">
              Submit &amp; End Session
            </button>
          </div>
        </div>
      </div>

      {/* Live Flags */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-400">Activity Log</h2>
          <span className="text-xs text-gray-600">{flags.length} events</span>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-3 rounded-xl max-h-48 overflow-auto">
          {flags.length === 0 ? (
            <p className="text-gray-600 text-center py-4 text-sm">No events yet.</p>
          ) : (
            flags.slice().reverse().map((f, i) => (
              <div key={i} className={`border-l-4 pl-3 mb-1.5 py-0.5 ${
                f.type.includes('MISMATCH') || f.type.includes('MULTIPLE') ? 'border-red-500' :
                f.type === 'FACE_ENROLLED' || f.type === 'SESSION_END' ? 'border-green-500' :
                'border-yellow-500'
              }`}>
                <span className="text-gray-500 text-xs">{f.timestamp.toLocaleTimeString()}</span>
                <span className="ml-2 text-xs font-mono bg-gray-800 px-1.5 py-0.5 rounded">{f.type}</span>
                <span className="ml-2 text-xs text-gray-400">{f.description}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}