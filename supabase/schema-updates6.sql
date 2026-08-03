-- Rename column 'lead_hr_weight' to 'lead_tim_weight' in kpi_settings
ALTER TABLE public.kpi_settings RENAME COLUMN lead_hr_weight TO lead_tim_weight;

-- Remove the old check constraint for kpi type and add the new one with 'lead_tim'
ALTER TABLE public.kpis DROP CONSTRAINT IF EXISTS kpis_type_check;

-- Update existing kpis to use the new type
UPDATE public.kpis SET type = 'lead_tim' WHERE type = 'lead_hr';

ALTER TABLE public.kpis ADD CONSTRAINT kpis_type_check 
  CHECK (type IN ('result', 'activity', 'quality', 'lead_tim', 'hr'));
