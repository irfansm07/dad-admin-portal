-- ============================================================
-- S.M. Saida Political Website – Supabase Database Setup
-- Run this SQL in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- 1. CREATE applications TABLE
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  age INTEGER DEFAULT 0,
  gender TEXT DEFAULT '',
  mobile TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  email TEXT DEFAULT '',
  village TEXT DEFAULT '',
  mandal TEXT DEFAULT '',
  address TEXT DEFAULT '',
  role_id TEXT DEFAULT 'volunteer',
  role_name TEXT DEFAULT 'Volunteer',
  role_icon TEXT DEFAULT '🤝',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'appointed', 'fired')),
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  temp_id TEXT DEFAULT '',
  years_exp TEXT DEFAULT '',
  political_bg TEXT DEFAULT '',
  available_247 BOOLEAN DEFAULT false,
  aadhar_front TEXT,
  aadhar_back TEXT
);

-- 2. CREATE photos TABLE
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY CHECK (id >= 1 AND id <= 11),
  src TEXT DEFAULT '',
  caption_te TEXT DEFAULT '',
  caption_en TEXT DEFAULT '',
  tag_te TEXT DEFAULT '',
  tag_en TEXT DEFAULT ''
);

-- 3. INSERT default 11 empty photo slots (will not overwrite existing)
INSERT INTO photos (id) VALUES
  (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11)
ON CONFLICT (id) DO NOTHING;

-- 4. ENABLE Row Level Security (RLS) but allow all operations via service role key
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- 5. Create policies to allow public READ for photos (for the main website)
CREATE POLICY "Allow public read photos" ON photos
  FOR SELECT USING (true);

-- 6. Create policies to allow all operations via service role (for the admin backend)
CREATE POLICY "Allow service role all on applications" ON applications
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role all on photos" ON photos
  FOR ALL USING (true) WITH CHECK (true);

-- 7. Allow anonymous inserts for applications (from public website form)
CREATE POLICY "Allow anon insert applications" ON applications
  FOR INSERT WITH CHECK (true);

-- Verify setup
SELECT 'applications table' AS table_name, COUNT(*) AS row_count FROM applications
UNION ALL
SELECT 'photos table', COUNT(*) FROM photos;
