-- ============================================================
-- Jalankan ini di Supabase SQL Editor (setelah schema.sql)
-- Trigger: auto-create public.users saat user pertama login via Google
-- ============================================================

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
declare
  v_name text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into public.users (id, name, email, kpi_role)
  values (new.id, v_name, new.email, 'tim')
  on conflict (id) do update
    set name  = excluded.name,
        email = excluded.email;

  return new;
end;
$$;

-- Drop trigger dulu jika sudah ada (aman untuk re-run)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
