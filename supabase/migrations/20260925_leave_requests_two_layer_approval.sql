-- Migration: 2-Layer Approval for Leave Requests (Executive -> HR)
-- Description: Add executive and HR approval/rejection columns, notes, approver metadata, and update process_leave_request RPC

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS executive_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS executive_approved_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS executive_approved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS executive_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS executive_notes TEXT,
  ADD COLUMN IF NOT EXISTS hr_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS hr_approved_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS hr_approved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS hr_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hr_notes TEXT,
  ADD COLUMN IF NOT EXISTS rejection_stage TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_by TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Backfill legacy records
UPDATE public.leave_requests
SET 
  executive_status = 'approved',
  hr_status = 'approved',
  executive_approved_by_name = COALESCE(processed_by, 'Admin'),
  executive_approved_at = processed_at,
  hr_approved_by_name = COALESCE(processed_by, 'Admin'),
  hr_approved_at = processed_at
WHERE status = 'approved' AND (executive_status IS NULL OR executive_status = 'pending');

UPDATE public.leave_requests
SET 
  executive_status = 'rejected',
  rejection_stage = 'executive',
  rejected_by = COALESCE(processed_by, 'Admin'),
  rejected_at = processed_at
WHERE status = 'rejected' AND (executive_status IS NULL OR executive_status = 'pending');

-- ─── RPC: process_leave_request ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_leave_request(
  p_request_id uuid,
  p_layer      text,   -- 'executive' | 'hr'
  p_action     text,   -- 'approve' | 'reject'
  p_admin_id   uuid,
  p_admin_name text,
  p_notes      text DEFAULT NULL,
  p_reason     text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req    public.leave_requests%ROWTYPE;
  v_days   int;
  v_dsick  int := 0;
  v_dleave int := 0;
BEGIN
  SELECT * INTO v_req FROM public.leave_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  IF v_req.status IN ('rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Request has already been %', v_req.status;
  END IF;

  -- 1. EXECUTIVE LAYER
  IF p_layer = 'executive' THEN
    IF p_action = 'approve' THEN
      UPDATE public.leave_requests
      SET status                     = 'approved_executive',
          executive_status           = 'approved',
          executive_approved_by      = p_admin_id,
          executive_approved_by_name = p_admin_name,
          executive_approved_at      = now(),
          executive_notes            = p_notes
      WHERE id = p_request_id;

      INSERT INTO public.absensi_logs (actor, action, target_user_id, details)
      VALUES (
        p_admin_name,
        'executive_approve_leave',
        v_req.user_id,
        v_req.type || ' approved by Executive (Notes: ' || COALESCE(p_notes, '-') || '): ' || array_to_string(v_req.dates, ', ')
      );
    ELSE -- reject
      UPDATE public.leave_requests
      SET status           = 'rejected',
          executive_status = 'rejected',
          rejection_stage  = 'executive',
          rejection_reason = p_reason,
          rejected_by      = p_admin_name,
          rejected_at      = now()
      WHERE id = p_request_id;

      INSERT INTO public.absensi_logs (actor, action, target_user_id, details)
      VALUES (
        p_admin_name,
        'executive_reject_leave',
        v_req.user_id,
        v_req.type || ' rejected by Executive (Reason: ' || COALESCE(p_reason, '-') || '): ' || array_to_string(v_req.dates, ', ')
      );
    END IF;

  -- 2. HR LAYER (FINAL APPROVAL)
  ELSIF p_layer = 'hr' THEN
    IF p_action = 'approve' THEN
      -- Deduct quotas only on final approval
      IF v_req.type IN ('sick', 'leave') THEN
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

      -- If executive approval wasn't recorded (e.g. executive directly did final approval), set executive fields too
      UPDATE public.leave_requests
      SET status                = 'approved',
          hr_status             = 'approved',
          hr_approved_by        = p_admin_id,
          hr_approved_by_name   = p_admin_name,
          hr_approved_at        = now(),
          hr_notes              = p_notes,
          processed_by          = p_admin_name,
          processed_at          = now(),
          deducted_sick         = v_dsick,
          deducted_leave        = v_dleave,
          executive_status      = 'approved',
          executive_approved_by_name = COALESCE(v_req.executive_approved_by_name, p_admin_name),
          executive_approved_at = COALESCE(v_req.executive_approved_at, now())
      WHERE id = p_request_id;

      INSERT INTO public.absensi_logs (actor, action, target_user_id, details)
      VALUES (
        p_admin_name,
        'hr_approve_leave',
        v_req.user_id,
        v_req.type || ' final approved by HR (Notes: ' || COALESCE(p_notes, '-') || '): ' || array_to_string(v_req.dates, ', ')
      );
    ELSE -- reject
      UPDATE public.leave_requests
      SET status           = 'rejected',
          hr_status        = 'rejected',
          rejection_stage  = 'hr',
          rejection_reason = p_reason,
          rejected_by      = p_admin_name,
          rejected_at      = now()
      WHERE id = p_request_id;

      INSERT INTO public.absensi_logs (actor, action, target_user_id, details)
      VALUES (
        p_admin_name,
        'hr_reject_leave',
        v_req.user_id,
        v_req.type || ' rejected by HR (Reason: ' || COALESCE(p_reason, '-') || '): ' || array_to_string(v_req.dates, ', ')
      );
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid layer: %', p_layer;
  END IF;
END $$;
