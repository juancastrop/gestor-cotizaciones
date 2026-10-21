-- Supabase setup para Gestor de Cotizaciones
-- Ejecutar en SQL Editor de Supabase.

-- 1) Tablas
create table if not exists public.gc_issuer_profile (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.gc_clients (
  client_key text primary key,
  client_name text,
  attention_name text,
  client_company text,
  client_email text,
  client_phone text,
  updated_at timestamptz not null default now()
);

create table if not exists public.gc_quotes (
  quote_number text primary key,
  quote_sequence integer,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2) RLS ON
alter table public.gc_issuer_profile enable row level security;
alter table public.gc_clients enable row level security;
alter table public.gc_quotes enable row level security;

-- 3) Politicas RLS (modo rapido para app sin login)
-- ADVERTENCIA: estas politicas permiten acceso completo con la anon key.
-- Ideal para pruebas o uso interno. Luego puedes endurecer con auth.

drop policy if exists gc_issuer_profile_anon_all on public.gc_issuer_profile;
create policy gc_issuer_profile_anon_all
on public.gc_issuer_profile
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists gc_clients_anon_all on public.gc_clients;
create policy gc_clients_anon_all
on public.gc_clients
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists gc_quotes_anon_all on public.gc_quotes;
create policy gc_quotes_anon_all
on public.gc_quotes
for all
to anon, authenticated
using (true)
with check (true);

-- 4) Grants
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.gc_issuer_profile to anon, authenticated;
grant select, insert, update, delete on public.gc_clients to anon, authenticated;
grant select, insert, update, delete on public.gc_quotes to anon, authenticated;

-- 5) (Opcional) trigger de updated_at automatico
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_gc_issuer_profile_updated_at on public.gc_issuer_profile;
create trigger trg_gc_issuer_profile_updated_at
before update on public.gc_issuer_profile
for each row
execute function public.set_updated_at();

drop trigger if exists trg_gc_clients_updated_at on public.gc_clients;
create trigger trg_gc_clients_updated_at
before update on public.gc_clients
for each row
execute function public.set_updated_at();

drop trigger if exists trg_gc_quotes_updated_at on public.gc_quotes;
create trigger trg_gc_quotes_updated_at
before update on public.gc_quotes
for each row
execute function public.set_updated_at();
