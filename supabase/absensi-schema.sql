-- ============================================================
-- ABSENSI SCHEMA — Jalankan di Supabase SQL Editor
-- Satu kali saja, idempotent (aman dijalankan ulang)
-- ============================================================

-- ─── 1. Extend public.users dengan kolom absensi ─────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS absensi_role   text NOT NULL DEFAULT 'staff'
    CHECK (absensi_role IN ('staff','admin')),
  ADD COLUMN IF NOT EXISTS absensi_status text NOT NULL DEFAULT 'pending'
    CHECK (absensi_status IN ('active','pending','rejected','resigned','deleted')),
  ADD COLUMN IF NOT EXISTS leave_quota    int  NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS sick_quota     int  NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS is_hidden      bool NOT NULL DEFAULT false;


-- ─── 2. Tabel attendance ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attendance (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date               date        NOT NULL,
  check_in           time,
  check_out          time,
  status             text        NOT NULL DEFAULT 'on_time'
                       CHECK (status IN ('on_time','late','very_late','auto_checkout')),
  type               text        NOT NULL DEFAULT 'WFO' CHECK (type IN ('WFO','WFA')),
  location_in        jsonb,
  location_status    text,
  late_fine          int         NOT NULL DEFAULT 0,
  late_reason        text        NOT NULL DEFAULT '',
  late_reason_status text        CHECK (late_reason_status IN ('pending','accepted','rejected')),
  radius_penalty     int         NOT NULL DEFAULT 0,
  early_checkout     bool        NOT NULL DEFAULT false,
  early_reason       text        NOT NULL DEFAULT '',
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);


-- ─── 3. Tabel leave_requests ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type                   text        NOT NULL CHECK (type IN ('leave','sick','wfa')),
  dates                  text[]      NOT NULL DEFAULT '{}',
  reason                 text        NOT NULL DEFAULT '',
  status                 text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','approved','rejected','cancelled')),
  processed_by           text,
  processed_at           timestamptz,
  deducted_sick          int         NOT NULL DEFAULT 0,
  deducted_leave         int         NOT NULL DEFAULT 0,
  cancellation_requested bool        NOT NULL DEFAULT false,
  cancellation_reason    text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);


-- ─── 4. Tabel holidays ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.holidays (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date        date        NOT NULL UNIQUE,
  description text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ─── 5. Tabel absensi_settings (single-row) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.absensi_settings (
  id              int         PRIMARY KEY DEFAULT 1,
  work_start      text        NOT NULL DEFAULT '08:00',
  work_end        text        NOT NULL DEFAULT '18:00',
  max_late        text        NOT NULL DEFAULT '08:15',
  max_time_sick   text        NOT NULL DEFAULT '12:00',
  max_time_leave  text        NOT NULL DEFAULT '23:59',
  max_time_wfa    text        NOT NULL DEFAULT '12:00',
  office_lat      float8      NOT NULL DEFAULT -6.241586,
  office_lng      float8      NOT NULL DEFAULT 106.628055,
  office_radius   int         NOT NULL DEFAULT 100,
  last_sync_date  date,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Pastikan selalu ada satu baris
INSERT INTO public.absensi_settings DEFAULT VALUES ON CONFLICT DO NOTHING;


-- ─── 6. Tabel absensi_logs ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.absensi_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor          text        NOT NULL DEFAULT 'SYSTEM',
  action         text        NOT NULL,
  target_user_id uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  details        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);


-- ─── 7. Triggers updated_at ──────────────────────────────────────────────────
-- (reuse fungsi set_updated_at() yang sudah ada dari KPI app)

DROP TRIGGER IF EXISTS trg_attendance_updated_at ON public.attendance;
CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER trg_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─── 8. Helper function RLS ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_absensi_admin() RETURNS bool
  LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT absensi_role = 'admin' FROM public.users WHERE id = auth.uid()
$$;


-- ─── 9. RLS Policies ─────────────────────────────────────────────────────────

ALTER TABLE public.attendance       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absensi_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absensi_logs     ENABLE ROW LEVEL SECURITY;

-- attendance
DROP POLICY IF EXISTS "attendance_select" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert" ON public.attendance;
DROP POLICY IF EXISTS "attendance_update" ON public.attendance;
DROP POLICY IF EXISTS "attendance_delete" ON public.attendance;

CREATE POLICY "attendance_select" ON public.attendance FOR SELECT
  USING (user_id = auth.uid() OR public.is_absensi_admin());
CREATE POLICY "attendance_insert" ON public.attendance FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_absensi_admin());
CREATE POLICY "attendance_update" ON public.attendance FOR UPDATE
  USING (user_id = auth.uid() OR public.is_absensi_admin());
CREATE POLICY "attendance_delete" ON public.attendance FOR DELETE
  USING (public.is_absensi_admin());

-- leave_requests
DROP POLICY IF EXISTS "lr_select" ON public.leave_requests;
DROP POLICY IF EXISTS "lr_insert" ON public.leave_requests;
DROP POLICY IF EXISTS "lr_update" ON public.leave_requests;

CREATE POLICY "lr_select" ON public.leave_requests FOR SELECT
  USING (user_id = auth.uid() OR public.is_absensi_admin());
CREATE POLICY "lr_insert" ON public.leave_requests FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_absensi_admin());
CREATE POLICY "lr_update" ON public.leave_requests FOR UPDATE
  USING (user_id = auth.uid() OR public.is_absensi_admin());

-- holidays (semua bisa baca, admin bisa ubah)
DROP POLICY IF EXISTS "holidays_read"  ON public.holidays;
DROP POLICY IF EXISTS "holidays_write" ON public.holidays;

CREATE POLICY "holidays_read"  ON public.holidays FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "holidays_write" ON public.holidays FOR ALL   USING (public.is_absensi_admin());

-- absensi_settings
DROP POLICY IF EXISTS "settings_read"  ON public.absensi_settings;
DROP POLICY IF EXISTS "settings_write" ON public.absensi_settings;

CREATE POLICY "settings_read"  ON public.absensi_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "settings_write" ON public.absensi_settings FOR UPDATE USING (public.is_absensi_admin());

-- absensi_logs
DROP POLICY IF EXISTS "logs_select" ON public.absensi_logs;
DROP POLICY IF EXISTS "logs_insert" ON public.absensi_logs;

CREATE POLICY "logs_select" ON public.absensi_logs FOR SELECT USING (public.is_absensi_admin());
CREATE POLICY "logs_insert" ON public.absensi_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ─── 10. Enable Realtime ─────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─── 11. RPC: process_leave_request ──────────────────────────────────────────
-- Approve / reject cuti + update kuota secara atomik

CREATE OR REPLACE FUNCTION public.process_leave_request(
  p_request_id uuid,
  p_action     text,   -- 'approve' | 'reject'
  p_admin_name text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req    public.leave_requests%ROWTYPE;
  v_days   int;
  v_dsick  int := 0;
  v_dleave int := 0;
BEGIN
  SELECT * INTO v_req FROM public.leave_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status != 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  IF p_action = 'approve' AND v_req.type IN ('sick','leave') THEN
    v_days := array_length(v_req.dates, 1);
    IF v_req.type = 'sick' THEN
      SELECT LEAST(v_days, sick_quota) INTO v_dsick FROM public.users WHERE id = v_req.user_id;
      v_dleave := GREATEST(0, v_days - v_dsick);
    ELSE
      v_dleave := v_days;
    END IF;
    UPDATE public.users
      SET sick_quota  = sick_quota  - v_dsick,
          leave_quota = leave_quota - v_dleave
      WHERE id = v_req.user_id;
  END IF;

  UPDATE public.leave_requests
    SET status         = CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
        processed_by   = p_admin_name,
        processed_at   = now(),
        deducted_sick  = v_dsick,
        deducted_leave = v_dleave
    WHERE id = p_request_id;

  INSERT INTO public.absensi_logs (actor, action, target_user_id, details)
    VALUES (
      p_admin_name,
      p_action || '_leave',
      v_req.user_id,
      v_req.type || ': ' || array_to_string(v_req.dates, ', ')
    );
END $$;


-- ─── 12. RPC: process_leave_cancellation ─────────────────────────────────────
-- Approve / reject pembatalan cuti + refund kuota secara atomik

CREATE OR REPLACE FUNCTION public.process_leave_cancellation(
  p_request_id uuid,
  p_action     text,   -- 'approve' | 'reject'
  p_admin_name text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req public.leave_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.leave_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  IF p_action = 'approve' THEN
    -- Refund kuota
    UPDATE public.users
      SET sick_quota  = sick_quota  + v_req.deducted_sick,
          leave_quota = leave_quota + v_req.deducted_leave
      WHERE id = v_req.user_id;
    UPDATE public.leave_requests
      SET status = 'cancelled', cancellation_requested = false
      WHERE id = p_request_id;
  ELSE
    -- Tolak pembatalan: kembalikan status "approved", hapus flag
    UPDATE public.leave_requests
      SET cancellation_requested = false
      WHERE id = p_request_id;
  END IF;

  INSERT INTO public.absensi_logs (actor, action, target_user_id, details)
    VALUES (
      p_admin_name,
      'cancellation_' || p_action,
      v_req.user_id,
      v_req.type || ': ' || array_to_string(v_req.dates, ', ')
    );
END $$;


-- ─── SELESAI ──────────────────────────────────────────────────────────────────
-- Cek hasilnya:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'users' AND column_name LIKE 'absensi%';
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'a%';
