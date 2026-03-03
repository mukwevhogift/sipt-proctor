'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { format } from 'date-fns';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  time_limit_minutes: number;
  due_date: string;
  created_at: string;
  created_by: string;
}

interface Profile {
  id: string;
  role: string;
  full_name: string;
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState(60);
  const [dueDate, setDueDate] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const load = async () => {
      const sb = getSupabase();
      if (!sb) { setLoading(false); return; }

      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
        setProfile(p);
      }

      const { data } = await sb.from('assignments').select('*').order('due_date', { ascending: false });
      setAssignments(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const sb = getSupabase();
    if (!sb) { setCreating(false); return; }

    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setCreating(false); alert('Session expired. Please log in again.'); return; }
    const { data, error } = await sb.from('assignments').insert({
      title,
      description: description || null,
      time_limit_minutes: timeLimit,
      due_date: new Date(dueDate).toISOString(),
      created_by: user?.id,
    }).select().single();

    if (error) {
      alert('Error creating assignment: ' + error.message);
    } else if (data) {
      setAssignments(prev => [data, ...prev]);
      setTitle('');
      setDescription('');
      setTimeLimit(60);
      setDueDate('');
      setShowCreate(false);
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Assignments</h1>
            <p className="text-gray-400 mt-1">
              {isAdmin ? 'Manage and create proctored assignments' : 'Select an assignment to begin your proctored session'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2.5 rounded-xl font-medium transition-colors"
            >
              {showCreate ? '✕ Cancel' : '+ Create Assignment'}
            </button>
          )}
        </div>

        {/* Create Assignment Form (Admin) */}
        {showCreate && isAdmin && (
          <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8 space-y-4">
            <h2 className="text-xl font-semibold mb-2">New Assignment</h2>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Software Engineering Midterm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description / Instructions</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Instructions for students…"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Time Limit (minutes)</label>
                <input
                  type="number"
                  value={timeLimit}
                  onChange={e => setTimeLimit(Number(e.target.value))}
                  min={5}
                  max={360}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Due Date</label>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 px-8 py-3 rounded-xl font-semibold transition-colors"
            >
              {creating ? 'Creating…' : 'Create Assignment'}
            </button>
          </form>
        )}

        {/* Assignment List */}
        {assignments.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <p className="text-gray-500 text-lg">No assignments available yet.</p>
            {isAdmin && <p className="text-gray-600 text-sm mt-2">Create one using the button above.</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map(a => {
              const isPastDue = a.due_date ? new Date(a.due_date) < new Date() : false;
              return (
                <div
                  key={a.id}
                  className={`bg-gray-900 border rounded-2xl p-6 transition-colors ${
                    isPastDue ? 'border-gray-800 opacity-60' : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{a.title}</h3>
                        {isPastDue && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400">Past Due</span>
                        )}
                      </div>
                      {a.description && <p className="text-gray-400 text-sm mb-3">{a.description}</p>}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>⏱ {a.time_limit_minutes} min</span>
                        <span>📅 Due: {a.due_date ? format(new Date(a.due_date), 'dd MMM yyyy, HH:mm') : 'No due date'}</span>
                      </div>
                    </div>
                    {!isPastDue && !isAdmin && (
                      <Link
                        href={`/exam?assignment=${a.id}&time=${a.time_limit_minutes}`}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors whitespace-nowrap ml-4"
                      >
                        Start Exam →
                      </Link>
                    )}
                    {isAdmin && (
                      <span className="text-xs text-gray-600 font-mono ml-4">{a.id.slice(0, 8)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
