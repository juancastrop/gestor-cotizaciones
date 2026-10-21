-- Endurecer RLS: solo usuarios autenticados pueden leer/escribir.
-- Ejecutar despues de supabase_setup.sql

drop policy if exists gc_issuer_profile_anon_all on public.gc_issuer_profile;
create policy gc_issuer_profile_auth_all
on public.gc_issuer_profile
for all
to authenticated
using (true)
with check (true);

drop policy if exists gc_clients_anon_all on public.gc_clients;
create policy gc_clients_auth_all
on public.gc_clients
for all
to authenticated
using (true)
with check (true);

drop policy if exists gc_quotes_anon_all on public.gc_quotes;
create policy gc_quotes_auth_all
on public.gc_quotes
for all
to authenticated
using (true)
with check (true);
