-- Migration: Add Overtime Pay Calculation and Breakdown Columns
-- Description: Adds columns to support detailed overtime rate and pay calculation per session

ALTER TABLE overtime_requests
  ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS day_type TEXT DEFAULT 'weekday',
  ADD COLUMN IF NOT EXISTS hourly_base_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_hour_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_hour_pay NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subsequent_hour_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subsequent_hour_pay NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_overtime_pay NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calculation_breakdown JSONB DEFAULT '{}';

COMMENT ON COLUMN overtime_requests.day_type IS 'Type of day: weekday, weekend, or holiday';
COMMENT ON COLUMN overtime_requests.hourly_base_rate IS 'Standard hourly base rate calculated from salary';
COMMENT ON COLUMN overtime_requests.total_overtime_pay IS 'Total finalized overtime pay in IDR for this session';
