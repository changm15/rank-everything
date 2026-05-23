-- RankEverything — Friends schema
-- Paste into Supabase → SQL Editor → Run

create table public.friendships (
  id           uuid default gen_random_uuid() primary key,
  requester_id uuid references public.profiles(id) on delete cascade not null,
  addressee_id uuid references public.profiles(id) on delete cascade not null,
  status       text check (status in ('pending', 'accepted')) default 'pending' not null,
  created_at   timestamptz default now() not null,
  unique (requester_id, addressee_id)
);

alter table public.friendships enable row level security;

create policy "View own friendships"     on public.friendships for select using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "Send friend requests"     on public.friendships for insert with check (requester_id = auth.uid());
create policy "Accept or reject request" on public.friendships for update using (addressee_id = auth.uid());
create policy "Remove friendship"        on public.friendships for delete using (requester_id = auth.uid() or addressee_id = auth.uid());
