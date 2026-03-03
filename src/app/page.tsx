'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-6">
      <div className="max-w-2xl w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 md:p-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Smart Integrity Proctoring Tool
          </h1>
          <p className="text-blue-400 text-lg font-medium mb-1">SIPT</p>
          <p className="text-gray-500 text-sm">AI-powered academic integrity for the modern classroom</p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {[
            { icon: '📹', title: 'Facial Recognition', desc: 'Identity verification & presence monitoring' },
            { icon: '👁', title: 'Eye Tracking', desc: 'WebGazer-powered gaze pattern analysis' },
            { icon: '🖥', title: 'Browser Monitoring', desc: 'Tab switching & focus detection' },
            { icon: '⌨', title: 'Keystroke Analysis', desc: 'Typing pattern anomaly detection' },
            { icon: '🔴', title: 'Session Recording', desc: 'Video & activity log for review' },
            { icon: '📊', title: 'Trust Scoring', desc: 'Real-time integrity score calculation' },
          ].map((f, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 flex items-start gap-3">
              <span className="text-xl">{f.icon}</span>
              <div>
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-xs text-gray-400">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Auth Buttons */}
        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full text-center py-4 rounded-xl text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="block w-full text-center py-4 rounded-xl text-lg font-semibold bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 transition-colors"
          >
            Create Account
          </Link>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-600">POPIA-compliant · All processing local · Data encrypted at rest</p>
        </div>
      </div>
    </div>
  );
}
