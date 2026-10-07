-- «Моя система»: push reminders — the owner's devices and a log so each reminder is sent once.
-- Same model as before: RLS on, no policies, all access through the app server.

create table if not exists public.push_subs (
  endpoint text primary key check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  device text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.push_log (
  key text primary key,
  sent_at timestamptz not null default now()
);
create index if not exists push_log_sent_idx on public.push_log (sent_at);

alter table public.push_subs enable row level security;
alter table public.push_log enable row level security;

-- The schedule (pg_cron calling the app every 15 minutes) is set up from Settings → Напоминания,
-- where the app shows the ready SQL with its own access token.
