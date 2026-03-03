-- ════════════════════════════════════════════════════════════════════
-- SIPT v2 – Full Production Schema
-- Run this in Supabase SQL Editor (Project → SQL Editor → New Query)
-- ════════════════════════════════════════════════════════════════════

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────────────
-- 1. DROP old tables (safe for fresh setup – remove these lines if migrating)
-- ────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS proctor_logs CASCADE;
DROP TABLE IF EXISTS exam_sessions CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ────────────────────────────────────────────────────────────────────
-- 2. PROFILES – one row per auth.users entry
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  student_number TEXT,                 -- for students
  staff_number TEXT,                   -- for admins/lecturers
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  face_descriptor JSONB,              -- Float32Array as JSON array
  reference_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON profiles (role);
CREATE INDEX idx_profiles_student_number ON profiles (student_number);
CREATE INDEX idx_profiles_staff_number ON profiles (staff_number);

-- ────────────────────────────────────────────────────────────────────
-- 3. ASSIGNMENTS – created by admins
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  time_limit_minutes INT NOT NULL DEFAULT 60,
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assignments_due ON assignments (due_date DESC);

-- ────────────────────────────────────────────────────────────────────
-- 4. EXAM SESSIONS – one per student per assignment attempt
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE exam_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES assignments(id),
  student_id UUID REFERENCES profiles(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  trust_score INT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'flagged')),
  video_url TEXT,
  activity_log JSONB,                 -- Array of {type, description, timestamp}
  submitted_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exam_sessions_student ON exam_sessions (student_id);
CREATE INDEX idx_exam_sessions_assignment ON exam_sessions (assignment_id);
CREATE INDEX idx_exam_sessions_status ON exam_sessions (status);

-- ────────────────────────────────────────────────────────────────────
-- 5. PROCTOR LOGS – individual violation events
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE proctor_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  violation_type TEXT NOT NULL,
  description TEXT,
  severity INT DEFAULT 1 CHECK (severity BETWEEN 1 AND 5)
);

CREATE INDEX idx_proctor_logs_session ON proctor_logs (session_id);
CREATE INDEX idx_proctor_logs_timestamp ON proctor_logs (timestamp DESC);
CREATE INDEX idx_proctor_logs_type ON proctor_logs (violation_type);

-- ────────────────────────────────────────────────────────────────────
-- 6. HELPER FUNCTION (avoids infinite recursion in RLS policies)
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ────────────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────────

-- 7a. Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin());

-- 7b. Assignments
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read assignments"
  ON assignments FOR SELECT
  USING (true);

CREATE POLICY "Admins can create assignments"
  ON assignments FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update assignments"
  ON assignments FOR UPDATE
  USING (public.is_admin());

-- 7c. Exam sessions
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can create own sessions"
  ON exam_sessions FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own sessions"
  ON exam_sessions FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "Students can read own sessions"
  ON exam_sessions FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Admins can read all sessions"
  ON exam_sessions FOR SELECT
  USING (public.is_admin());

-- 7d. Proctor logs
ALTER TABLE proctor_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session owner can insert logs"
  ON proctor_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_sessions
      WHERE exam_sessions.id = proctor_logs.session_id
        AND exam_sessions.student_id = auth.uid()
    )
  );

CREATE POLICY "Session owner can read own logs"
  ON proctor_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM exam_sessions
      WHERE exam_sessions.id = proctor_logs.session_id
        AND exam_sessions.student_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all logs"
  ON proctor_logs FOR SELECT
  USING (public.is_admin());

-- ────────────────────────────────────────────────────────────────────
-- 7. STORAGE
-- ────────────────────────────────────────────────────────────────────
-- Create bucket via Dashboard → Storage → New Bucket:
--   Name: proctor-videos
--   Public: ON (for demo, turn OFF in production)
--
-- Or via SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('proctor-videos', 'proctor-videos', true);

-- ────────────────────────────────────────────────────────────────────
-- DONE! Schema ready for SIPT v2.
-- ────────────────────────────────────────────────────────────────────
