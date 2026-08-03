-- Hapus constraint type lama pada tabel kpis (jika ada)
ALTER TABLE public.kpis DROP CONSTRAINT IF EXISTS kpis_type_check;

-- Buat ulang constraint dengan menambahkan 'lead_tim' dan 'hr'
ALTER TABLE public.kpis ADD CONSTRAINT kpis_type_check 
  CHECK (type IN ('result', 'activity', 'quality', 'lead_tim', 'hr'));
