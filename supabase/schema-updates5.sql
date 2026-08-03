-- Fix RLS policy on kpi_settings so privileged users (HR, Head, Executive, Developer) can update other users' settings
create policy "kpi_settings_manage_privileged" on public.kpi_settings
  for all using (public.my_kpi_role() in ('head','hr','executive','developer'));
