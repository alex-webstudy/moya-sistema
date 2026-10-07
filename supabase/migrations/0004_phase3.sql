-- «Моя система»: phase 3 — health (days, measures), lists (shopping, books, films, purchases, trips, saved).
-- Same model as before: RLS on, no policies, all access through the app server.

create table if not exists public.days (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  workout boolean,
  workout_note text not null default '',
  water real not null default 0 check (water >= 0),
  food_ok boolean,
  food jsonb not null default '[]',
  ev_tasks boolean not null default false,
  ev_tomorrow boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.measures (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  weight real, waist real, arms real, chest real,
  created_at timestamptz not null default now()
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list text not null check (list in ('buy', 'books', 'films')),
  text text not null check (char_length(text) between 1 and 300),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  name text not null check (char_length(name) between 1 and 200),
  sum bigint not null check (sum > 0),
  items text[] not null default '{}',
  orig text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  city text not null default '',
  date date not null,
  date2 date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.saved (
  id uuid primary key default gen_random_uuid(),
  url text not null default '',
  title text not null check (char_length(title) between 1 and 300),
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.days enable row level security;
alter table public.measures enable row level security;
alter table public.list_items enable row level security;
alter table public.purchases enable row level security;
alter table public.trips enable row level security;
alter table public.saved enable row level security;
