'use client';
import { useEffect, useState, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

// Dynamic import of jsPDF to avoid SSR issues
const exportPDF = async (session: ExamSession, logs: LogEntry[]) => {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(20);
  doc.text('SIPT Exam Session Report', pageW / 2, 20, { align: 'center' });

  // Session info
  doc.setFontSize(11);
  let y = 35;
  const lines = [
    `Student: ${session.student_name ?? session.student_id ?? 'N/A'}`,
    `Session ID: ${session.id}`,
    `Assignment: ${session.assignment_title ?? session.assignment_id ?? 'General'}`,
    `Started: ${session.started_at ? format(new Date(session.started_at), 'PPpp') : 'N/A'}`,
    `Ended: ${session.ended_at ? format(new Date(session.ended_at), 'PPpp') : 'In progress'}`,
    `Status: ${session.status}`,
    `Trust Score: ${session.trust_score ?? 'N/A'}/100`,
  ];
  for (const line of lines) {
    doc.text(line, 14, y);
    y += 7;
  }

  // Violation table
  y += 5;
  doc.setFontSize(14);
  doc.text('Violation Log', 14, y);
  y += 5;

  const rows = logs.map(l => [
    l.timestamp ? format(new Date(l.timestamp), 'HH:mm:ss') : '',
    l.violation_type,
    `${l.severity ?? '-'}`,
    (l.description ?? '').substring(0, 60),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Time', 'Type', 'Severity', 'Description']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175] },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  doc.save(`SIPT-Report-${session.id.substring(0, 8)}.pdf`);
};

// Types
interface ExamSession {
  id: string;
  assignment_id: string | null;
  student_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  trust_score: number | null;
  status: string;
  video_url: string | null;
  activity_log: any;
  submitted_content: string | null;
  student_name?: string;
  student_number?: string;
  staff_number?: string;
  assignment_title?: string;
}

interface LogEntry {
  id: string;
  session_id: string;
  timestamp: string;
  violation_type: string;
  description: string;
  severity: number | null;
}

const CHART_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

function getTrustColor(score: number | null): string {
  if (score === null || score === undefined) return 'text-gray-400';
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

function getTrustBg(score: number | null): string {
  if (score === null || score === undefined) return 'bg-gray-900/50';
  if (score >= 80) return 'bg-green-900/30';
  if (score >= 50) return 'bg-yellow-900/30';
  return 'bg-red-900/30';
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreFilter, setScoreFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // ─── Fetch all sessions + logs ────────────────────────────────────
  const fetchData = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setError('Supabase not configured');
      setLoading(false);
      return;
    }

    try {
      // Fetch exam sessions
      const { data: sessionData, error: sessionErr } = await sb
        .from('exam_sessions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(200);

      if (sessionErr) throw sessionErr;

      // Enrich sessions with profile names
      const studentIds = [...new Set((sessionData ?? []).map((s: any) => s.student_id).filter(Boolean))];
      let profileMap: Record<string, { full_name: string; student_number: string; staff_number: string }> = {};

      if (studentIds.length > 0) {
        const { data: profiles } = await sb
          .from('profiles')
          .select('id, full_name, student_number, staff_number')
          .in('id', studentIds);
        for (const p of profiles ?? []) {
          profileMap[p.id] = { full_name: p.full_name, student_number: p.student_number, staff_number: p.staff_number };
        }
      }

      // Enrich with assignment titles
      const assignmentIds = [...new Set((sessionData ?? []).map((s: any) => s.assignment_id).filter(Boolean))];
      let assignmentMap: Record<string, string> = {};

      if (assignmentIds.length > 0) {
        const { data: assignments } = await sb
          .from('assignments')
          .select('id, title')
          .in('id', assignmentIds);
        for (const a of assignments ?? []) {
          assignmentMap[a.id] = a.title;
        }
      }

      const enrichedSessions: ExamSession[] = (sessionData ?? []).map((s: any) => ({
        ...s,
        student_name: profileMap[s.student_id]?.full_name ?? null,
        student_number: profileMap[s.student_id]?.student_number ?? null,
        staff_number: profileMap[s.student_id]?.staff_number ?? null,
        assignment_title: assignmentMap[s.assignment_id] ?? null,
      }));

      setSessions(enrichedSessions);

      // Fetch all proctor logs
      const { data: logData, error: logErr } = await sb
        .from('proctor_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(5000);

      if (logErr) throw logErr;
      setLogs((logData ?? []) as LogEntry[]);
    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Derived data ─────────────────────────────────────────────────
  const filteredSessions = sessions.filter(s => {
    const matchesSearch = !searchTerm ||
      (s.student_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.student_number ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.id.toLowerCase().includes(searchTerm.toLowerCase());

    const score = s.trust_score;
    const matchesFilter =
      scoreFilter === 'all' ? true :
      scoreFilter === 'high' ? (score !== null && score >= 80) :
      scoreFilter === 'medium' ? (score !== null && score >= 50 && score < 80) :
      (score !== null && score < 50);

    return matchesSearch && matchesFilter;
  });

  const selectedSessionData = sessions.find(s => s.id === selectedSession);
  const sessionLogs = selectedSession
    ? logs.filter(l => l.session_id === selectedSession).sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  // ─── Chart data ───────────────────────────────────────────────────
  const violationTypeCounts: Record<string, number> = {};
  for (const l of logs) {
    const t = l.violation_type;
    if (t && !['SESSION_END', 'SESSION_VIDEO', 'FACE_ENROLLED'].includes(t)) {
      violationTypeCounts[t] = (violationTypeCounts[t] ?? 0) + 1;
    }
  }
  const violationBarData = Object.entries(violationTypeCounts)
    .map(([name, count]) => ({ name: name.replace(/_/g, ' '), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const trustBuckets = { 'High (80-100)': 0, 'Medium (50-79)': 0, 'Low (0-49)': 0, 'No Score': 0 };
  for (const s of sessions) {
    const score = s.trust_score;
    if (score === null || score === undefined) trustBuckets['No Score']++;
    else if (score >= 80) trustBuckets['High (80-100)']++;
    else if (score >= 50) trustBuckets['Medium (50-79)']++;
    else trustBuckets['Low (0-49)']++;
  }
  const trustPieData = Object.entries(trustBuckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6b7280'];

  // ─── Stats ────────────────────────────────────────────────────────
  const totalSessions = sessions.length;
  const scoredSessions = sessions.filter(s => s.trust_score !== null && s.trust_score !== undefined);
  const avgScore = scoredSessions.length > 0
    ? Math.round(scoredSessions.reduce((a, b) => a + (b.trust_score ?? 0), 0) / scoredSessions.length)
    : 0;
  const highRiskCount = sessions.filter(s => s.trust_score !== null && s.trust_score < 50).length;
  const activeSessions = sessions.filter(s => s.status === 'in_progress').length;

  // ═══════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-12">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <button onClick={fetchData} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm transition-colors">
            ↻ Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 p-4 rounded-xl mb-6">{error}</div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-500 mb-1">Total Sessions</p>
            <p className="text-3xl font-bold">{totalSessions}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-500 mb-1">Avg Trust Score</p>
            <p className={`text-3xl font-bold ${getTrustColor(avgScore)}`}>{avgScore || '—'}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-500 mb-1">High Risk</p>
            <p className="text-3xl font-bold text-red-400">{highRiskCount}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-500 mb-1">Active Now</p>
            <p className="text-3xl font-bold text-blue-400">{activeSessions}</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Violation Type Bar Chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-400 mb-4">Violations by Type</h2>
            {violationBarData.length === 0 ? (
              <p className="text-gray-600 text-center py-12 text-sm">No violation data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={violationBarData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-45} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Trust Score Pie Chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-400 mb-4">Trust Score Distribution</h2>
            {totalSessions === 0 ? (
              <p className="text-gray-600 text-center py-12 text-sm">No sessions yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={trustPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {trustPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Search student name, number, or session ID…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-1">
            {(['all', 'high', 'medium', 'low'] as const).map(f => (
              <button
                key={f}
                onClick={() => setScoreFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  scoreFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {f === 'all' ? 'All' : f === 'high' ? '≥80' : f === 'medium' ? '50-79' : '<50'}
              </button>
            ))}
          </div>
        </div>

        {/* Sessions + Detail Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Session List */}
          <div className="lg:col-span-1">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">
              Sessions ({filteredSessions.length})
            </h2>
            <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
              {filteredSessions.length === 0 ? (
                <p className="text-gray-600 text-center py-8 text-sm">No sessions found.</p>
              ) : (
                filteredSessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSession(s.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedSession === s.id
                        ? 'bg-blue-900/30 border-blue-500 ring-1 ring-blue-500/50'
                        : `${getTrustBg(s.trust_score)} border-gray-800 hover:border-gray-600`
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate max-w-[60%]">
                        {s.student_name ?? s.student_number ?? s.id.substring(0, 8)}
                      </span>
                      <span className={`text-lg font-bold ${getTrustColor(s.trust_score)}`}>
                        {s.trust_score ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{s.started_at ? format(new Date(s.started_at), 'MMM d, HH:mm') : 'N/A'}</span>
                      <span className={`px-2 py-0.5 rounded-full ${
                        s.status === 'submitted' ? 'bg-green-900/40 text-green-400' :
                        s.status === 'in_progress' ? 'bg-blue-900/40 text-blue-400' :
                        'bg-gray-800 text-gray-400'
                      }`}>
                        {s.status === 'in_progress' ? 'Active' : s.status}
                      </span>
                    </div>
                    {s.assignment_title && (
                      <p className="text-xs text-gray-600 mt-1 truncate">{s.assignment_title}</p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Session Detail */}
          <div className="lg:col-span-2">
            {!selectedSessionData ? (
              <div className="flex items-center justify-center h-64 bg-gray-900 border border-gray-800 rounded-xl">
                <p className="text-gray-600 text-sm">Select a session to view details</p>
              </div>
            ) : (
              <div>
                {/* Session header card */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold">{selectedSessionData.student_name ?? 'Student'}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {(selectedSessionData.student_number || selectedSessionData.staff_number) && `#${selectedSessionData.student_number || selectedSessionData.staff_number} · `}
                        {selectedSessionData.id.substring(0, 8)}
                      </p>
                      {selectedSessionData.assignment_title && (
                        <p className="text-sm text-blue-400 mt-1">{selectedSessionData.assignment_title}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-4xl font-bold ${getTrustColor(selectedSessionData.trust_score)}`}>
                        {selectedSessionData.trust_score ?? '—'}
                      </p>
                      <p className="text-xs text-gray-500">Trust Score</p>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-4 text-xs text-gray-400 mb-4">
                    <span>⏱ Start: {selectedSessionData.started_at ? format(new Date(selectedSessionData.started_at), 'PPpp') : '—'}</span>
                    <span>🏁 End: {selectedSessionData.ended_at ? format(new Date(selectedSessionData.ended_at), 'PPpp') : 'Active'}</span>
                    <span>📋 Violations: {sessionLogs.length}</span>
                    <span>📝 Chars: {selectedSessionData.submitted_content?.length ?? 0}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {selectedSessionData.video_url && (
                      <a
                        href={selectedSessionData.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                      >
                        🎥 Watch Recording
                      </a>
                    )}
                    <button
                      onClick={() => exportPDF(selectedSessionData, sessionLogs)}
                      className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                    >
                      📄 Export PDF
                    </button>
                  </div>
                </div>

                {/* Violation breakdown badges */}
                {sessionLogs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Object.entries(
                      sessionLogs.reduce<Record<string, number>>((acc, l) => {
                        acc[l.violation_type] = (acc[l.violation_type] ?? 0) + 1;
                        return acc;
                      }, {})
                    ).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                      <span key={type} className={`text-xs px-3 py-1 rounded-full ${
                        type.includes('MISMATCH') || type.includes('MULTIPLE') ? 'bg-red-900/40 text-red-400' :
                        ['SESSION_END', 'SESSION_VIDEO', 'FACE_ENROLLED'].includes(type) ? 'bg-green-900/40 text-green-400' :
                        'bg-yellow-900/40 text-yellow-400'
                      }`}>
                        {type.replace(/_/g, ' ')}: {count}
                      </span>
                    ))}
                  </div>
                )}

                {/* Event timeline */}
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Activity Timeline ({sessionLogs.length})</h3>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 max-h-[45vh] overflow-auto">
                  {sessionLogs.length === 0 ? (
                    <p className="text-gray-600 text-center py-6 text-sm">No events recorded.</p>
                  ) : (
                    sessionLogs.map((l, i) => (
                      <div key={l.id ?? i} className={`border-l-4 pl-4 mb-2 py-1.5 ${
                        (l.severity ?? 0) >= 3 ? 'border-red-500' :
                        (l.severity ?? 0) >= 2 ? 'border-yellow-500' :
                        'border-gray-600'
                      }`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-gray-500">
                            {l.timestamp ? format(new Date(l.timestamp), 'HH:mm:ss') : ''}
                          </span>
                          <span className="text-xs font-mono bg-gray-800 px-2 py-0.5 rounded">
                            {l.violation_type}
                          </span>
                          {l.severity && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              l.severity >= 3 ? 'bg-red-900/50 text-red-400' :
                              l.severity >= 2 ? 'bg-yellow-900/50 text-yellow-400' :
                              'bg-gray-800 text-gray-500'
                            }`}>
                              Sev {l.severity}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{l.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
