-- RankEverything — Supabase schema
-- Paste this entire file into: Supabase Dashboard → SQL Editor → New query → Run

-- ─────────────────────────── Tables ───────────────────────────

create table public.profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  display_name text not null,
  created_at   timestamptz default now() not null
);

create table public.lists (
  id         text primary key,
  name       text not null,
  items      text[] not null,
  owner_id   uuid references public.profiles(id) on delete set null,
  owner_name text,
  is_public  boolean default false not null,
  created_at timestamptz default now() not null
);

create table public.rankers (
  id          text primary key,
  list_id     text references public.lists(id) on delete cascade not null,
  owner_id    uuid references public.profiles(id) on delete cascade,
  name        text,
  elos        jsonb default '{}'::jsonb not null,
  wins        jsonb default '{}'::jsonb not null,
  losses      jsonb default '{}'::jsonb not null,
  picks       jsonb default '[]'::jsonb not null,
  total_pairs integer default 0 not null,
  updated_at  timestamptz default now() not null
);

create table public.saved_lists (
  user_id uuid references public.profiles(id) on delete cascade,
  list_id text references public.lists(id) on delete cascade,
  primary key (user_id, list_id)
);

-- ─────────────────────────── Row-level security ───────────────────────────

alter table public.profiles   enable row level security;
alter table public.lists       enable row level security;
alter table public.rankers     enable row level security;
alter table public.saved_lists enable row level security;

-- Profiles
create policy "Profiles viewable by everyone"   on public.profiles for select using (true);
create policy "Users can insert own profile"    on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"    on public.profiles for update using (auth.uid() = id);

-- Lists
create policy "Public lists viewable by all"   on public.lists for select using (is_public = true or owner_id = auth.uid());
create policy "Users can create lists"         on public.lists for insert with check (owner_id = auth.uid());
create policy "Users can update own lists"     on public.lists for update using (owner_id = auth.uid());
create policy "Users can delete own lists"     on public.lists for delete using (owner_id = auth.uid());

-- Rankers
create policy "Rankers viewable by owner or list owner" on public.rankers for select using (
  owner_id = auth.uid() or
  exists (
    select 1 from public.lists l
    where l.id = list_id and (l.is_public = true or l.owner_id = auth.uid())
  )
);
create policy "Users can create rankers"       on public.rankers for insert with check (owner_id = auth.uid());
create policy "Users can update own rankers"   on public.rankers for update using (owner_id = auth.uid());
create policy "Users can delete own rankers"   on public.rankers for delete using (owner_id = auth.uid());

-- Saved lists
create policy "Users manage own saved lists"   on public.saved_lists for all using (user_id = auth.uid());

-- ─────────────────────────── Auto-create profile on signup ───────────────────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
