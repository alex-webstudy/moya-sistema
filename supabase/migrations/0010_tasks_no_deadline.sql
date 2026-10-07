-- «Моя система»: a task may have no deadline; it is no longer put on tomorrow by default.
alter table public.tasks alter column due drop not null;
alter table public.tasks alter column due drop default;
