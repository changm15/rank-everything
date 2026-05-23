-- RankEverything — Collaborators schema
-- Paste into Supabase → SQL Editor → Run

-- 1. Add collaborator_ids column to lists
ALTER TABLE public.lists ADD COLUMN IF NOT EXISTS collaborator_ids uuid[] DEFAULT '{}';

-- 2. RPC: any authenticated user can join a list as collaborator (not the owner)
CREATE OR REPLACE FUNCTION join_as_collaborator(p_list_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.lists
  SET collaborator_ids = array_append(COALESCE(collaborator_ids, '{}'), auth.uid())
  WHERE id = p_list_id
    AND owner_id IS DISTINCT FROM auth.uid()
    AND NOT (auth.uid() = ANY(COALESCE(collaborator_ids, '{}')));
END;
$$;

-- 3. RPC: add an item to a list (owner or collaborator only)
CREATE OR REPLACE FUNCTION add_list_item(p_list_id text, p_item text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.lists
    WHERE id = p_list_id
      AND (owner_id = auth.uid() OR auth.uid() = ANY(COALESCE(collaborator_ids, '{}')))
  ) THEN
    RAISE EXCEPTION 'Not authorized to add items to this list';
  END IF;
  UPDATE public.lists
  SET items = array_append(items, p_item)
  WHERE id = p_list_id
    AND NOT (p_item = ANY(items));
END;
$$;

-- 4. RPC: owner removes a collaborator
CREATE OR REPLACE FUNCTION remove_collaborator(p_list_id text, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.lists WHERE id = p_list_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the list owner can remove collaborators';
  END IF;
  UPDATE public.lists
  SET collaborator_ids = array_remove(COALESCE(collaborator_ids, '{}'), p_user_id)
  WHERE id = p_list_id;
END;
$$;
