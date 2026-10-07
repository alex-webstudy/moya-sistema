-- «Моя система»: phase 4 — content, goals, week reviews, password vault.
-- Same model as before: RLS on, no policies, all access through the app server. Safe to run again.

-- Content: the phase 1 ideas table grows into the content plan.
alter table public.ideas alter column platform drop not null;
alter table public.ideas alter column format set default '';
alter table public.ideas add column if not exists why text not null default '';
alter table public.ideas add column if not exists approved boolean not null default true;
alter table public.ideas add column if not exists status smallint not null default 0 check (status between 0 and 3);
alter table public.ideas add column if not exists date date;
alter table public.ideas add column if not exists reach integer;
alter table public.ideas add column if not exists leads integer;
alter table public.ideas add column if not exists script text not null default '';

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  horizon text not null default 'year' check (horizon in ('year', 'quarter', 'month')),
  start date not null default current_date,
  deadline date not null,
  start_val double precision not null default 0,
  target double precision not null,
  unit text not null default '',
  why text not null default '',
  kind text not null default '' check (kind in ('', 'savings')),
  hist jsonb not null default '[]',
  habits jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Goal steps are ordinary tasks linked to their goal.
alter table public.tasks add column if not exists goal_id uuid references public.goals (id) on delete set null;

create table if not exists public.weeks (
  id uuid primary key default gen_random_uuid(),
  week date not null unique,
  review text not null default '',
  focus text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Password vault: each row is encrypted in the browser (AES-GCM, key from the master password).
create table if not exists public.vault (
  id uuid primary key default gen_random_uuid(),
  data text not null,
  iv text not null,
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;
alter table public.weeks enable row level security;
alter table public.vault enable row level security;
