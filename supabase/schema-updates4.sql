-- Tambahkan kolom notes pada tabel payrolls
ALTER TABLE public.payrolls ADD COLUMN IF NOT EXISTS notes text;
