-- «Моя система»: clients as a small accounting corner — contract terms, invoices, files.
-- Safe to run again.

alter table public.clients add column if not exists contract_no text not null default '';
alter table public.clients add column if not exists contract_from date;
alter table public.clients add column if not exists contract_until date;
alter table public.clients add column if not exists pay_day smallint check (pay_day between 1 and 31);

-- Счета-фактуры. An invoice counts as paid by the income rows that point at it.
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  no text not null check (char_length(no) between 1 and 40),
  date date not null default current_date,
  sum bigint not null check (sum > 0),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists invoices_client_idx on public.invoices (client_id);

alter table public.income add column if not exists invoice_id uuid references public.invoices (id) on delete set null;

-- Contract and invoice files; the bytes live in the private «docs» storage bucket.
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  kind text not null default 'other' check (kind in ('contract', 'invoice', 'other')),
  name text not null,
  path text not null unique,
  size integer not null default 0,
  type text not null default '',
  created_at timestamptz not null default now()
);

alter table public.invoices enable row level security;
alter table public.files enable row level security;

-- Private bucket, 50 MB per file; only the app server (service role) can reach it.
insert into storage.buckets (id, name, public, file_size_limit)
values ('docs', 'docs', false, 52428800)
on conflict (id) do nothing;
