-- «Моя система»: phase 2 — projects (folders), clients, meetings, finance, settings.
-- Same model as phase 1: RLS on, no policies, all access through the app server.

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.folders(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  project text,
  created_at timestamptz not null default now()
);

alter table public.notes add column if not exists folder_id uuid references public.folders(id) on delete cascade;
alter table public.notes alter column project drop not null;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  work text not null default '',
  contract smallint not null default 0 check (contract between 0 and 2),
  sum bigint not null default 0 check (sum >= 0),
  due date,
  paid boolean not null default false,
  last_contact date not null default current_date,
  waiting text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  date date not null default current_date,
  folder_id uuid references public.folders(id) on delete set null,
  summary text not null default '',
  points text[] not null default '{}',
  questions text[] not null default '{}',
  tasks text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  source text not null check (char_length(source) between 1 and 200),
  note text not null default '',
  sum bigint not null check (sum > 0),
  orig text not null default '',
  client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('credit', 'sub')),
  name text not null check (char_length(name) between 1 and 200),
  bank text not null default '',
  sum bigint not null check (sum > 0),
  day smallint not null check (day between 1 and 31),
  created_at timestamptz not null default now()
);

create table if not exists public.taxes (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  tax bigint not null check (tax >= 0),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.folders enable row level security;
alter table public.clients enable row level security;
alter table public.meetings enable row level security;
alter table public.income enable row level security;
alter table public.charges enable row level security;
alter table public.taxes enable row level security;
alter table public.settings enable row level security;

-- Starter folders, only on an empty table.
do $$
declare blog uuid;
begin
  if not exists (select 1 from public.folders) then
    insert into public.folders (name) values ('Личный бренд') returning id into blog;
    insert into public.folders (parent_id, name, project) values
      (blog, 'Instagram', 'Instagram'), (blog, 'YouTube', 'YouTube'), (blog, 'Telegram', 'Telegram');
    insert into public.folders (name, project) values
      ('Курсы', 'Курсы'), ('Клиентские проекты', 'Клиенты'), ('Личное', 'Личное'), ('Здоровье', 'Здоровье');
  end if;
end $$;
