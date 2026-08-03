-- Tambahan kolom untuk bobot kpi personality (Lead HR & HR)
-- Asumsinya: 
-- 1. result_weight, activity_weight, quality_weight totalnya harus 100% (untuk grup Performance 70%)
-- 2. lead_tim_weight, hr_weight totalnya harus 100% (untuk grup Personality 30%)

ALTER TABLE public.kpi_settings
ADD COLUMN IF NOT EXISTS lead_tim_weight numeric NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS hr_weight numeric NOT NULL DEFAULT 50;

-- Optional: reset bobot lama agar defaultnya masuk akal (misal: result 50, activity 30, quality 20)
-- UPDATE public.kpi_settings SET result_weight = 50, activity_weight = 30, quality_weight = 20 WHERE true;
