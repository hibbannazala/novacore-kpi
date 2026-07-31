-- ============================================================
-- PAYROLL SYSTEM SCHEMA
-- Jalankan SQL ini di Supabase SQL Editor
-- ============================================================

-- 1. Tabel pengaturan staf payroll (jabatan kontrak, perusahaan, gaji default)
CREATE TABLE IF NOT EXISTS payroll_staff_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  contract_position TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT 'Nova' CHECK (company IN ('TNT', 'Hype', 'Nova')),
  default_base_salary BIGINT DEFAULT 0,
  default_mobility_allowance BIGINT DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel slip gaji bulanan
CREATE TABLE IF NOT EXISTS payrolls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL CHECK (year >= 2020),
  base_salary BIGINT DEFAULT 0,
  mobility_allowance BIGINT DEFAULT 0,
  performance_bonus BIGINT DEFAULT 0,
  overtime_pay BIGINT DEFAULT 0,
  deductions BIGINT DEFAULT 0,
  deduction_notes TEXT DEFAULT '',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

-- 3. RLS Policies
ALTER TABLE payroll_staff_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payrolls ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write (admin checks done in app)
DROP POLICY IF EXISTS "payroll_settings_all" ON payroll_staff_settings;
CREATE POLICY "payroll_settings_all" ON payroll_staff_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "payrolls_all" ON payrolls;
CREATE POLICY "payrolls_all" ON payrolls FOR ALL USING (true) WITH CHECK (true);

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_staff_settings_updated_at ON payroll_staff_settings;
CREATE TRIGGER payroll_staff_settings_updated_at
  BEFORE UPDATE ON payroll_staff_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS payrolls_updated_at ON payrolls;
CREATE TRIGGER payrolls_updated_at
  BEFORE UPDATE ON payrolls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
