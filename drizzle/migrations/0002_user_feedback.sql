create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  message text not null,
  created_at timestamptz not null default now()
);

grant select, insert on public.feedback to authenticated;
grant all on public.feedback to service_role;

alter table public.feedback enable row level security;

create policy "Users can read their own feedback"
  on public.feedback for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own feedback"
  on public.feedback for insert to authenticated
  with check (auth.uid() = user_id);