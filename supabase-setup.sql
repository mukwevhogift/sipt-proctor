-- SIPT Supabase Setup
-- Run this in your Supabase SQL Editor (https://supabase.com → SQL Editor)

-- 1. Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create proctor_logs table
CREATE TABLE IF NOT EXISTS proctor_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL,
  description TEXT,
  video_url TEXT
);

-- 3. Create index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_proctor_logs_session_id ON proctor_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_proctor_logs_timestamp ON proctor_logs (timestamp DESC);

-- 4. Enable Row Level Security (optional – disable for demo simplicity)
-- ALTER TABLE proctor_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for demo" ON proctor_logs FOR ALL USING (true);

-- 5. Create storage bucket for session videos (run separately or via Dashboard → Storage)
-- Go to Supabase Dashboard → Storage → New Bucket → Name: "proctor-videos" → Public: ON (for demo)

-- Done! Your SIPT backend is ready.
