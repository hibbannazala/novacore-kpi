-- Migration: Add overtime_detail JSONB column to payrolls table
-- Description: Stores snapshot of overtime sessions (dates, hours, pay) for payslip display

ALTER TABLE payrolls 
  ADD COLUMN IF NOT EXISTS overtime_detail JSONB DEFAULT '[]'::jsonb;
