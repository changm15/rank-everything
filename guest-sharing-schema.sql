-- RankEverything — Guest sharing + open read policies
-- Run this in the Supabase SQL editor.

-- ── Lists: allow reading any list by its ID ──────────────────────────────────
-- The list ID is an unguessable random string, so knowing it IS the authorization
-- (same model as Google Docs / Figma "anyone with the link"). Writes are still
-- owner-only. This lets share links work for private lists without embedding data.

drop policy if exists "Public lists viewable by all" on public.lists;
create policy "Lists readable by anyone"
  on public.lists for select using (true);

-- ── Rankers: allow guest (null owner_id) inserts & updates ───────────────────
-- Guests don't have Supabase accounts, so their ranker's owner_id is null.
-- We still protect authenticated users' rankers from being overwritten.

drop policy if exists "Users can create rankers" on public.rankers;
create policy "Anyone can create rankers"
  on public.rankers for insert
  with check (owner_id = auth.uid() or owner_id is null);

drop policy if exists "Users can update own rankers" on public.rankers;
create policy "Users can update own rankers"
  on public.rankers for update
  using (owner_id = auth.uid() or owner_id is null);

-- ── Rankers: readable by anyone (ranker ID is the secret for results links) ──
drop policy if exists "Rankers viewable by owner or list owner" on public.rankers;
create policy "Rankers readable by anyone"
  on public.rankers for select using (true);
