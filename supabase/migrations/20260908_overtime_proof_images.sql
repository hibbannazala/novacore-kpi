-- Migration: Overtime Proof Images & Storage Bucket
-- Description: Add proof_images array column to overtime_requests and setup storage bucket

-- 1. Add proof_images to overtime_requests
ALTER TABLE overtime_requests 
  ADD COLUMN IF NOT EXISTS proof_images TEXT[] DEFAULT '{}'::TEXT[];

-- 2. Create bucket overtime_proofs if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('overtime_proofs', 'overtime_proofs', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage bucket policies for overtime_proofs
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Access overtime_proofs'
  ) THEN
    CREATE POLICY "Public Access overtime_proofs" ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'overtime_proofs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow authenticated upload overtime_proofs'
  ) THEN
    CREATE POLICY "Allow authenticated upload overtime_proofs" ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'overtime_proofs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow authenticated update overtime_proofs'
  ) THEN
    CREATE POLICY "Allow authenticated update overtime_proofs" ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'overtime_proofs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow authenticated delete overtime_proofs'
  ) THEN
    CREATE POLICY "Allow authenticated delete overtime_proofs" ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'overtime_proofs');
  END IF;
END $$;
