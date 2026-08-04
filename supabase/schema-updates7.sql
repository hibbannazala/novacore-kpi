-- 1. Alter function recalculate_assignment_totals to be security definer
-- This allows standard users to trigger the update on kpi_assignments even though they don't have direct write RLS access to kpi_assignments
CREATE OR REPLACE FUNCTION public.recalculate_assignment_totals()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
  DECLARE
    v_assignment_id uuid;
    v_total         numeric;
    v_target        numeric;
  BEGIN
    v_assignment_id := COALESCE(NEW.assignment_id, OLD.assignment_id);
  
    SELECT COALESCE(SUM(value), 0)
    INTO   v_total
    from   public.daily_reports
    where  assignment_id = v_assignment_id;
  
    SELECT monthly_target
    into   v_target
    from   public.kpi_assignments
    where  id = v_assignment_id;
  
    UPDATE public.kpi_assignments
    SET
      actual_total           = v_total,
      achievement_percentage = CASE
        WHEN COALESCE(v_target, 0) > 0 THEN ROUND((v_total / v_target) * 100, 2)
        ELSE 0
      END
    WHERE id = v_assignment_id;
  
    RETURN COALESCE(NEW, OLD);
  END;
  $$;

-- 2. Recalculate all existing totals for kpi_assignments based on daily_reports
UPDATE public.kpi_assignments a
SET 
  actual_total = COALESCE((
    SELECT SUM(value) 
    FROM public.daily_reports r 
    WHERE r.assignment_id = a.id
  ), 0),
  achievement_percentage = CASE 
    WHEN COALESCE(a.monthly_target, 0) > 0 THEN 
      ROUND((COALESCE((
        SELECT SUM(value) 
        FROM public.daily_reports r 
        WHERE r.assignment_id = a.id
      ), 0) / a.monthly_target) * 100, 2)
    ELSE 0
  END;
