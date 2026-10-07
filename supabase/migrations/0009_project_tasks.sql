-- «Моя система»: tasks inside a specific project folder, and when each task was done (for monthly reports).
alter table public.tasks add column if not exists folder_id uuid references public.folders(id) on delete set null;
alter table public.tasks add column if not exists done_at timestamptz;
create index if not exists tasks_folder_idx on public.tasks (folder_id);
-- Tasks already done count as done on their date.
update public.tasks set done_at = (due::timestamp at time zone 'Asia/Tashkent') where done and done_at is null;
