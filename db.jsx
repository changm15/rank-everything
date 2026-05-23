/* RankEverything — Supabase backend
   All database operations. Exposed on window as db*.
   Requires: @supabase/supabase-js loaded via CDN before this file. */

const _sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

/* ─────────────────────────── Auth ─────────────────────────── */

async function dbSignUp(email, password, displayName) {
  const name = (displayName || email.split("@")[0]).trim();
  const { data, error } = await _sb.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  return { data, error };
}

async function dbSignIn(email, password) {
  const { data, error } = await _sb.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function dbSignOut() {
  return _sb.auth.signOut();
}

async function dbGetSession() {
  const { data: { session } } = await _sb.auth.getSession();
  return session;
}

function dbOnAuthChange(callback) {
  return _sb.auth.onAuthStateChange(callback);
}

/* ─────────────────────────── Lists ─────────────────────────── */

async function dbGetUserLists(userId) {
  const { data, error } = await _sb
    .from("lists")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

async function dbGetPublicLists() {
  const { data, error } = await _sb
    .from("lists")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

async function dbGetListById(listId) {
  const { data, error } = await _sb
    .from("lists")
    .select("*")
    .eq("id", listId)
    .single();
  return { data, error };
}

async function dbUpsertList(list, userId) {
  const row = {
    id: list.id,
    name: list.name,
    items: list.items,
    owner_id: userId || list.ownerId || null,
    owner_name: list.ownerName || null,
    is_public: list.isPublic || false,
    created_at: new Date(list.createdAt || Date.now()).toISOString(),
  };
  const { data, error } = await _sb
    .from("lists")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  return { data, error };
}

async function dbDeleteList(listId) {
  return _sb.from("lists").delete().eq("id", listId);
}

/* ─────────────────────────── Collaborators ─────────────────────────── */

// Join a list as a collaborator (authenticated users only, not the owner).
async function dbJoinAsCollaborator(listId) {
  return _sb.rpc("join_as_collaborator", { p_list_id: listId });
}

// Add a new item to a list (owner or collaborator).
async function dbAddListItem(listId, item) {
  return _sb.rpc("add_list_item", { p_list_id: listId, p_item: item });
}

// Owner removes a collaborator.
async function dbRemoveCollaborator(listId, userId) {
  return _sb.rpc("remove_collaborator", { p_list_id: listId, p_user_id: userId });
}

// Fetch a batch of profiles by user ID array (for showing collaborator names).
async function dbGetProfiles(userIds) {
  if (!userIds || !userIds.length) return { data: [], error: null };
  const { data, error } = await _sb
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);
  return { data: data || [], error };
}

/* ─────────────────────────── Rankers ─────────────────────────── */

async function dbGetUserRankers(userId) {
  const { data, error } = await _sb
    .from("rankers")
    .select("*")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  return { data: data || [], error };
}

async function dbGetListRankers(listId) {
  const { data, error } = await _sb
    .from("rankers")
    .select("*")
    .eq("list_id", listId)
    .order("updated_at", { ascending: false });
  return { data: data || [], error };
}

async function dbGetRankerById(rankerId) {
  const { data, error } = await _sb
    .from("rankers")
    .select("*")
    .eq("id", rankerId)
    .single();
  return { data, error };
}

async function dbUpsertRanker(ranker, userId) {
  const row = {
    id: ranker.id,
    list_id: ranker.listId,
    owner_id: userId || ranker.ownerId || null,
    name: ranker.name || null,
    elos: ranker.elos || {},
    wins: ranker.wins || {},
    losses: ranker.losses || {},
    picks: ranker.picks || [],
    total_pairs: ranker.totalPairs || 0,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await _sb
    .from("rankers")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  return { data, error };
}

/* ─────────────────────────── Saved lists ─────────────────────────── */

async function dbGetSavedListIds(userId) {
  const { data, error } = await _sb
    .from("saved_lists")
    .select("list_id")
    .eq("user_id", userId);
  return { data: (data || []).map(r => r.list_id), error };
}

async function dbSaveList(userId, listId) {
  return _sb.from("saved_lists").upsert({ user_id: userId, list_id: listId });
}

async function dbUnsaveList(userId, listId) {
  return _sb.from("saved_lists").delete().eq("user_id", userId).eq("list_id", listId);
}

/* ─────────────────────────── Build store ─────────────────────────── */

// Convert a Supabase list row → app list object
function rowToList(r) {
  return {
    id: r.id,
    name: r.name,
    items: r.items,
    ownerId: r.owner_id,
    ownerName: r.owner_name,
    isPublic: r.is_public,
    createdAt: new Date(r.created_at).getTime(),
    collaboratorIds: r.collaborator_ids || [],
  };
}

// Convert a Supabase ranker row → app ranker object
function rowToRanker(r) {
  return {
    id: r.id,
    listId: r.list_id,
    ownerId: r.owner_id,
    name: r.name,
    elos: r.elos || {},
    wins: r.wins || {},
    losses: r.losses || {},
    picks: r.picks || [],
    totalPairs: r.total_pairs || 0,
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

// Fetch all data for a signed-in user and build the full store object.
async function dbLoadUserStore(supabaseUser) {
  const userId = supabaseUser.id;
  const displayName =
    supabaseUser.user_metadata?.display_name ||
    supabaseUser.email.split("@")[0];

  const user = {
    id: userId,
    email: supabaseUser.email,
    displayName,
    isGuest: false,
    createdAt: new Date(supabaseUser.created_at).getTime(),
  };

  const [
    { data: userListRows },
    { data: publicListRows },
    { data: rankerRows },
    { data: savedIds },
  ] = await Promise.all([
    dbGetUserLists(userId),
    dbGetPublicLists(),
    dbGetUserRankers(userId),
    dbGetSavedListIds(userId),
  ]);

  // Merge lists — public first, own lists overwrite on id collision
  const lists = {};
  for (const r of [...(publicListRows || []), ...(userListRows || [])]) {
    lists[r.id] = rowToList(r);
  }

  const rankers = {};
  const lastRanker = {};
  for (const r of (rankerRows || [])) {
    rankers[r.id] = rowToRanker(r);
    // Track the most recent ranker per (user, list) — keep latest by updated_at
    const key = lastRankerKey(userId, r.list_id);
    const existing = lastRanker[key];
    if (!existing || rankers[r.id].updatedAt > rankers[existing].updatedAt) {
      lastRanker[key] = r.id;
    }
  }

  return {
    ...DEFAULT_STATE,
    users: { [userId]: user },
    currentUserId: userId,
    lists,
    rankers,
    lastRanker,
    savedLists: { [userId]: savedIds || [] },
    seededFor: { [userId]: true }, // skip demo data for real accounts
  };
}

/* ─────────────────────────── Friends ─────────────────────────── */

async function dbGetFriends(userId) {
  const { data, error } = await _sb
    .from("friendships")
    .select("*, requester:profiles!requester_id(*), addressee:profiles!addressee_id(*)")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  return { data: data || [], error };
}

async function dbGetFriendRequests(userId) {
  const { data, error } = await _sb
    .from("friendships")
    .select("*, requester:profiles!requester_id(*), addressee:profiles!addressee_id(*)")
    .eq("status", "pending")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  return { data: data || [], error };
}

async function dbGetFriendshipBetween(userId, targetId) {
  const { data, error } = await _sb
    .from("friendships")
    .select("*")
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${userId})`)
    .maybeSingle();
  return { data, error };
}

async function dbSendFriendRequest(requesterId, addresseeId) {
  const { data, error } = await _sb
    .from("friendships")
    .insert({ requester_id: requesterId, addressee_id: addresseeId })
    .select().single();
  return { data, error };
}

async function dbAcceptFriendRequest(friendshipId) {
  const { data, error } = await _sb
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId)
    .select().single();
  return { data, error };
}

async function dbRemoveFriendship(friendshipId) {
  return _sb.from("friendships").delete().eq("id", friendshipId);
}

async function dbSearchUsers(query, currentUserId) {
  const { data, error } = await _sb
    .from("profiles")
    .select("*")
    .ilike("display_name", `%${query}%`)
    .neq("id", currentUserId)
    .limit(8);
  return { data: data || [], error };
}

async function dbGetUserProfile(userId) {
  const { data, error } = await _sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return { data, error };
}

async function dbGetUserPublicLists(userId) {
  const { data, error } = await _sb
    .from("lists")
    .select("*")
    .eq("owner_id", userId)
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

async function dbGetUserRankerCount(userId) {
  const { count } = await _sb
    .from("rankers")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);
  return count || 0;
}

Object.assign(window, {
  _sb,
  dbSignUp, dbSignIn, dbSignOut, dbGetSession, dbOnAuthChange,
  dbGetUserLists, dbGetPublicLists, dbGetListById, dbUpsertList, dbDeleteList,
  dbGetUserRankers, dbGetListRankers, dbGetRankerById, dbUpsertRanker,
  dbGetSavedListIds, dbSaveList, dbUnsaveList,
  dbLoadUserStore,
  rowToList, rowToRanker,
  dbGetFriends, dbGetFriendRequests, dbGetFriendshipBetween,
  dbSendFriendRequest, dbAcceptFriendRequest, dbRemoveFriendship,
  dbSearchUsers, dbGetUserProfile, dbGetUserPublicLists, dbGetUserRankerCount,
  dbJoinAsCollaborator, dbAddListItem, dbRemoveCollaborator, dbGetProfiles,
});
