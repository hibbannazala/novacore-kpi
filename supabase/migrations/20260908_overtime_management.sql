-- Migration: Overtime Management System
-- Description: Create overtime_requests table and add overtime rate/duration columns to payrolls

CREATE TABLE IF NOT EXISTS overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  overtime_date DATE NOT NULL,
  
  -- 1. Requested by Staff
  requested_start_time TIME NOT NULL,
  requested_end_time TIME NOT NULL,
  requested_duration_minutes INT NOT NULL,
  tasks JSONB NOT NULL DEFAULT '[]', -- [{ id, task, target, note }]
  staff_notes TEXT,

  -- 2. Approval HR
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'reported', 'finalized', 'cancelled'
  approved_start_time TIME,
  approved_end_time TIME,
  approved_duration_minutes INT,
  approved_by UUID REFERENCES users(id),
  approval_date TIMESTAMPTZ,
  approval_notes TEXT,
  rejection_reason TEXT,

  -- 3. Execution & Report
  actual_start_time TIME,
  actual_end_time TIME,
  actual_duration_minutes INT,
  report_submitted_at TIMESTAMPTZ,
  task_reports JSONB, -- [{ id, task, target, actual_result, progress, status, note }]
  staff_report_notes TEXT,

  -- 4. Final Decision HR
  final_duration_minutes INT,
  finalized_by UUID REFERENCES users(id),
  finalized_date TIMESTAMPTZ,
  final_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overtime_user_date ON overtime_requests(user_id, overtime_date);
CREATE INDEX IF NOT EXISTS idx_overtime_status ON overtime_requests(status);
CREATE INDEX IF NOT EXISTS idx_overtime_date ON overtime_requests(overtime_date);

ALTER TABLE payrolls 
  ADD COLUMN IF NOT EXISTS system_overtime_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payroll_overtime_minutes INT,
  ADD COLUMN IF NOT EXISTS overtime_rate NUMERIC DEFAULT 0;

ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'overtime_requests' AND policyname = 'Allow authenticated read and write'
  ) THEN
    CREATE POLICY "Allow authenticated read and write" ON overtime_requests
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
