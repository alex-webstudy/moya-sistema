-- Instalments have a first and a last payment; subscriptions leave both empty.
alter table public.charges add column if not exists start date;
alter table public.charges add column if not exists until date;
