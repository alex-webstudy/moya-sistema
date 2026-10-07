-- «Моя система»: confirmed payments, debts paid down in parts, income to the card.
-- Safe to run again.

-- The date of the last payment he confirmed; this month's total drops it once confirmed.
alter table public.charges add column if not exists paid_to date;

-- Income goes either to the ИП settlement account (taxed) or to the personal card.
alter table public.income add column if not exists account text not null default 'rs' check (account in ('rs', 'card'));

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  note text not null default '',
  total bigint not null check (total > 0),
  payments jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table public.debts enable row level security;

-- His two debts live here now, not among the monthly charges.
insert into public.debts (name, note, total)
select v.name, v.note, v.total from (values
  ('Долг за квартиры, июнь–сентябрь',        '2 квартиры × 4 месяца × 5 000 000', 40000000),
  ('Долг за солнечные панели, июль–сентябрь', '3 месяца × 1 800 000',               5400000)
) as v(name, note, total)
where not exists (select 1 from public.debts d where d.name = v.name);
delete from public.charges
where name in ('Долг за квартиры, июнь–сентябрь', 'Долг за солнечные панели, июль–сентябрь');
