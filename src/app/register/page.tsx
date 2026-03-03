'use client';
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const sb = getSupabase();
    if (!sb) { setError('Supabase not configured'); setLoading(false); return; }

    // Create auth user
    const { data: authData, error: authError } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: 'student' } },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Create profile record
    if (authData.user) {
      const { error: profileError } = await sb.from('profiles').insert({
        id: authData.user.id,
        full_name: fullName,
        student_number: studentNumber,
        role: 'student',
      });

      if (profileError) {
        console.warn('Profile creation error:', profileError.message);
        // Non-fatal – profile can be created later
      }
    }

    setSuccess(true);
    setLoading(false);

    // If email confirmation is disabled in Supabase, redirect directly
    if (authData.session) {
      router.push('/assignments');
      router.refresh();
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-6">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold mb-2">Registration Successful</h1>
          <p className="text-gray-400 mb-6">
            Check your email for a confirmation link, or{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300">sign in</Link>{' '}
            if email confirmation is disabled.
          </p>
          <Link href="/login" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors inline-block">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-6">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-600 rounded-xl mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Register for SIPT</h1>
          <p className="text-gray-400 text-sm mt-1">Create your proctoring account</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Student Number</label>
            <input
              type="text"
              value={studentNumber}
              onChange={e => setStudentNumber(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g. 202312345"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="you@university.ac.za"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Min 6 characters"
            />
          </div>
          {/* Students register here — admins are created via the API */}

          {error && <p className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg p-3">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
