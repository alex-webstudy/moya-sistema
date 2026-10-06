-- «Моя система»: phase 1 tables. Single owner; all access goes through the app's server
-- with the service role key, so RLS is enabled with no policies (anon/authenticated see nothing).

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 500),
  project text not null default 'Личное',
  due date not null default current_date,
  time text check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tasks_due_idx on public.tasks (due);

create table if not exists public.thoughts (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  project text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  platform text not null check (platform in ('tg', 'ig', 'yt')),
  format text not null,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
alter table public.thoughts enable row level security;
alter table public.notes enable row level security;
alter table public.ideas enable row level security;
