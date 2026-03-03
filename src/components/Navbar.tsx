'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    sb.auth.getUser().then((res: any) => {
      setUser(res.data.user);
      if (res.data.user) {
        sb.from('profiles').select('*').eq('id', res.data.user.id).maybeSingle().then((r: any) => setProfile(r.data));
      }
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle().then((r: any) => setProfile(r.data));
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setUser(null);
    setProfile(null);
    router.push('/');
    router.refresh();
  };

  const isActive = (path: string) => pathname === path;

  // Don't show navbar during exam (avoid distractions)
  if (pathname.startsWith('/exam')) return null;

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">S</div>
            <span className="text-lg font-bold text-white">SIPT</span>
          </Link>

          {user && (
            <div className="hidden md:flex items-center gap-1">
              <Link
                href="/assignments"
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive('/assignments') ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Assignments
              </Link>
              {profile?.role === 'admin' && (
                <Link
                  href="/dashboard"
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    isActive('/dashboard') ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Dashboard
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden md:flex items-center gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  profile?.role === 'admin' ? 'bg-blue-900/50 text-blue-400' : 'bg-green-900/50 text-green-400'
                }`}>
                  {profile?.role === 'admin' ? 'Admin' : 'Student'}
                </span>
                <span className="text-gray-400">{profile?.full_name ?? user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600/80 hover:bg-red-600 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
              >
                Logout
              </button>
              {/* Mobile menu */}
              <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="text-gray-400 hover:text-white text-sm px-3 py-1.5 transition-colors">
                Sign In
              </Link>
              <Link href="/register" className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && user && (
        <div className="md:hidden border-t border-gray-800 px-4 py-3 space-y-2">
          <Link href="/assignments" onClick={() => setMenuOpen(false)} className="block text-gray-300 hover:text-white py-1">Assignments</Link>
          {profile?.role === 'admin' && (
            <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block text-gray-300 hover:text-white py-1">Dashboard</Link>
          )}
          <div className="text-xs text-gray-500 pt-2 border-t border-gray-800">
            {profile?.full_name} ({profile?.role === 'admin' ? profile?.staff_number : profile?.student_number})
          </div>
        </div>
      )}
    </nav>
  );
}
