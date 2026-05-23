/* RankEverything — Social screens
   ProfileScreen: own profile + other users' profiles
   FriendsScreen: friends list, requests, search */

const {
  useState: useStateS,
  useEffect: useEffectS,
  useRef: useRefS,
  useCallback: useCallbackS,
} = React;

/* ─────────────────────────── Shared helpers ─────────────────────────── */

function Avatar({ name, size = 40 }) {
  const initial = (name || "?").trim().slice(0, 1).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "var(--surface-2)", border: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 600, fontSize: size * 0.38, flexShrink: 0,
      color: "var(--fg)", fontFamily: "var(--font-sans)",
    }}>
      {initial}
    </div>
  );
}

function ListCard({ list }) {
  return (
    <a href={`#/stats/${list.id}`} style={{ textDecoration: "none" }}>
      <div className="card" style={{ padding: "12px 16px", cursor: "pointer" }}>
        <div style={{ fontWeight: 500, fontSize: 15 }}>{list.name}</div>
        <div className="hint" style={{ marginTop: 3, fontSize: 12 }}>
          {list.items.length} items
          {list.isPublic
            ? <span style={{ marginLeft: 8, color: "var(--green, #00c853)" }}>● Public</span>
            : <span style={{ marginLeft: 8, color: "var(--muted, #888)" }}>○ Private</span>}
        </div>
      </div>
    </a>
  );
}

/* ─────────────────────────── ProfileScreen ─────────────────────────── */

function ProfileScreen({ store, setStore, currentUser, profileUserId, showToast }) {
  const isOwn = !profileUserId || profileUserId === currentUser.id;
  const targetId = isOwn ? currentUser.id : profileUserId;

  const [profile, setProfile] = useStateS(null);
  const [lists, setLists] = useStateS([]);
  const [rankerCount, setRankerCount] = useStateS(0);
  const [friendship, setFriendship] = useStateS(null); // {id, status, isRequester}
  const [loading, setLoading] = useStateS(true);
  const [friendLoading, setFriendLoading] = useStateS(false);

  useEffectS(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [{ data: prof }, { data: userLists }, count] = await Promise.all([
          dbGetUserProfile(targetId),
          isOwn ? dbGetUserLists(targetId) : dbGetUserPublicLists(targetId),
          dbGetUserRankerCount(targetId),
        ]);
        if (cancelled) return;
        setProfile(prof);
        setLists((userLists || []).map(rowToList));
        setRankerCount(count);

        if (!isOwn) {
          const { data: fr } = await dbGetFriendshipBetween(currentUser.id, targetId);
          if (!cancelled) {
            setFriendship(fr ? { ...fr, isRequester: fr.requester_id === currentUser.id } : null);
          }
        }
      } catch (err) {
        console.error("[profile] Load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [targetId]);

  async function handleFriendAction() {
    setFriendLoading(true);
    try {
      if (!friendship) {
        // Send request
        const { data, error } = await dbSendFriendRequest(currentUser.id, targetId);
        if (error) { showToast("Couldn't send request"); return; }
        setFriendship({ ...data, isRequester: true });
        showToast("Friend request sent!");
      } else if (friendship.status === "pending" && !friendship.isRequester) {
        // Accept incoming request
        const { data, error } = await dbAcceptFriendRequest(friendship.id);
        if (error) { showToast("Couldn't accept request"); return; }
        setFriendship({ ...friendship, status: "accepted" });
        showToast("You're now friends!");
      } else if (friendship.status === "accepted") {
        // Remove friend
        await dbRemoveFriendship(friendship.id);
        setFriendship(null);
        showToast("Removed from friends");
      } else if (friendship.status === "pending" && friendship.isRequester) {
        // Cancel outgoing request
        await dbRemoveFriendship(friendship.id);
        setFriendship(null);
        showToast("Request cancelled");
      }
    } finally {
      setFriendLoading(false);
    }
  }

  function friendBtnLabel() {
    if (!friendship) return "Add Friend";
    if (friendship.status === "accepted") return "Friends ✓";
    if (friendship.status === "pending" && friendship.isRequester) return "Request Sent";
    if (friendship.status === "pending" && !friendship.isRequester) return "Accept Request";
    return "Add Friend";
  }

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  const publicLists = lists.filter(l => l.isPublic);
  const privateLists = lists.filter(l => !l.isPublic);

  if (loading) return (
    <div className="container page" style={{ paddingTop: 60, textAlign: "center", color: "var(--fg-muted)" }}>
      Loading profile…
    </div>
  );

  if (!profile) return (
    <div className="container page" style={{ paddingTop: 60, textAlign: "center", color: "var(--fg-muted)" }}>
      Profile not found.
    </div>
  );

  return (
    <div className="container page" style={{ maxWidth: 560 }}>
      {/* Back */}
      <div className="crumb" style={{ marginBottom: 20 }}>
        <a href="#/" style={{ textDecoration: "none" }}>← Home</a>
        {!isOwn && <> / <a href="#/friends" style={{ textDecoration: "none" }}>Friends</a></>}
        {" "}/ Profile
      </div>

      {/* Profile header */}
      <div className="card" style={{ padding: "24px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar name={profile.display_name} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 20 }}>{profile.display_name}</div>
            {joinedDate && <div className="hint" style={{ marginTop: 2 }}>Joined {joinedDate}</div>}
            <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
              <span className="hint"><strong style={{ color: "var(--fg)" }}>{publicLists.length}</strong> public list{publicLists.length !== 1 ? "s" : ""}</span>
              <span className="hint"><strong style={{ color: "var(--fg)" }}>{rankerCount}</strong> ranking{rankerCount !== 1 ? "s" : ""} done</span>
            </div>
          </div>
          {!isOwn && (
            <button
              className={`btn${friendship?.status === "accepted" ? "" : " primary"}`}
              onClick={handleFriendAction}
              disabled={friendLoading}
              style={{ flexShrink: 0 }}
            >
              {friendBtnLabel()}
            </button>
          )}
        </div>
      </div>

      {/* Lists */}
      {isOwn ? (
        <>
          {publicLists.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Public lists</div>
              <div className="stack" style={{ gap: 8 }}>
                {publicLists.map(l => <ListCard key={l.id} list={l} />)}
              </div>
            </section>
          )}
          {privateLists.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Private lists</div>
              <div className="stack" style={{ gap: 8 }}>
                {privateLists.map(l => <ListCard key={l.id} list={l} />)}
              </div>
            </section>
          )}
          {lists.length === 0 && (
            <div className="hint" style={{ textAlign: "center", padding: "32px 0" }}>
              No lists yet. <a href="#/create">Create one →</a>
            </div>
          )}
        </>
      ) : (
        <>
          {publicLists.length > 0 ? (
            <section>
              <div className="section-label" style={{ marginBottom: 10 }}>Public lists</div>
              <div className="stack" style={{ gap: 8 }}>
                {publicLists.map(l => <ListCard key={l.id} list={l} />)}
              </div>
            </section>
          ) : (
            <div className="hint" style={{ textAlign: "center", padding: "32px 0" }}>
              No public lists yet.
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── FriendsScreen ─────────────────────────── */

function FriendsScreen({ store, setStore, currentUser, showToast }) {
  const [friends, setFriends] = useStateS([]);
  const [requests, setRequests] = useStateS([]);
  const [searchQ, setSearchQ] = useStateS("");
  const [searchResults, setSearchResults] = useStateS([]);
  const [searchLoading, setSearchLoading] = useStateS(false);
  const [loading, setLoading] = useStateS(true);
  const [pendingActions, setPendingActions] = useStateS({}); // id → true while loading
  const debounceRef = useRefS(null);

  useEffectS(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [{ data: fr }, { data: req }] = await Promise.all([
        dbGetFriends(currentUser.id),
        dbGetFriendRequests(currentUser.id),
      ]);
      setFriends(fr || []);
      setRequests(req || []);
    } finally {
      setLoading(false);
    }
  }

  // Search users as they type
  useEffectS(() => {
    clearTimeout(debounceRef.current);
    if (!searchQ.trim() || searchQ.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      const { data } = await dbSearchUsers(searchQ.trim(), currentUser.id);
      setSearchResults(data || []);
      setSearchLoading(false);
    }, 350);
  }, [searchQ]);

  function setPending(id, val) {
    setPendingActions(p => ({ ...p, [id]: val }));
  }

  // Helper: get the "other" profile from a friendship row
  function otherProfile(friendship) {
    return friendship.requester_id === currentUser.id
      ? friendship.addressee
      : friendship.requester;
  }

  async function sendRequest(targetId) {
    setPending(targetId, true);
    const { data, error } = await dbSendFriendRequest(currentUser.id, targetId);
    setPending(targetId, false);
    if (error) { showToast("Couldn't send request"); return; }
    showToast("Friend request sent!");
    setSearchResults(r => r.filter(u => u.id !== targetId));
    setRequests(r => [...r, { ...data, requester: { id: currentUser.id, display_name: currentUser.displayName }, addressee: searchResults.find(u => u.id === targetId), isNew: true }]);
  }

  async function acceptRequest(friendship) {
    setPending(friendship.id, true);
    const { data, error } = await dbAcceptFriendRequest(friendship.id);
    setPending(friendship.id, false);
    if (error) { showToast("Couldn't accept"); return; }
    showToast("You're now friends! 🎉");
    setRequests(r => r.filter(f => f.id !== friendship.id));
    setFriends(f => [...f, { ...data, requester: friendship.requester, addressee: friendship.addressee }]);
  }

  async function declineRequest(friendshipId) {
    setPending(friendshipId, true);
    await dbRemoveFriendship(friendshipId);
    setPending(friendshipId, false);
    setRequests(r => r.filter(f => f.id !== friendshipId));
  }

  async function removeFriend(friendshipId) {
    setPending(friendshipId, true);
    await dbRemoveFriendship(friendshipId);
    setPending(friendshipId, false);
    setFriends(f => f.filter(fr => fr.id !== friendshipId));
    showToast("Removed from friends");
  }

  const incomingRequests = requests.filter(r => r.addressee_id === currentUser.id);
  const outgoingRequests = requests.filter(r => r.requester_id === currentUser.id);

  // Filter search results to exclude existing friends / pending requests
  const friendIds = new Set([
    ...friends.map(f => f.requester_id === currentUser.id ? f.addressee_id : f.requester_id),
    ...requests.map(r => r.requester_id === currentUser.id ? r.addressee_id : r.requester_id),
  ]);
  const filteredResults = searchResults.filter(u => !friendIds.has(u.id));

  return (
    <div className="container page" style={{ maxWidth: 560 }}>
      <div className="page-head">
        <div className="crumb"><a href="#/" style={{ textDecoration: "none" }}>← Home</a> / Friends</div>
        <h1>Friends</h1>
        <p className="lede">See what your friends are ranking.</p>
      </div>

      {/* Search */}
      <div className="card" style={{ padding: "16px", marginBottom: 24 }}>
        <div className="field">
          <label className="label" htmlFor="friend-search">Find people by name</label>
          <input
            id="friend-search"
            className="input"
            type="text"
            placeholder="Search display name…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            autoComplete="off"
          />
        </div>
        {searchLoading && <div className="hint" style={{ marginTop: 8 }}>Searching…</div>}
        {filteredResults.length > 0 && (
          <div className="stack" style={{ gap: 8, marginTop: 12 }}>
            {filteredResults.map(user => (
              <div key={user.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={user.display_name} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{user.display_name}</div>
                </div>
                <button
                  className="btn primary"
                  style={{ fontSize: 13, padding: "5px 12px" }}
                  disabled={!!pendingActions[user.id]}
                  onClick={() => sendRequest(user.id)}
                >
                  {pendingActions[user.id] ? "…" : "Add"}
                </button>
              </div>
            ))}
          </div>
        )}
        {!searchLoading && searchQ.trim().length >= 2 && filteredResults.length === 0 && (
          <div className="hint" style={{ marginTop: 8 }}>No users found.</div>
        )}
      </div>

      {/* Incoming requests */}
      {incomingRequests.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>
            Requests ({incomingRequests.length})
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {incomingRequests.map(fr => {
              const other = otherProfile(fr);
              return (
                <div key={fr.id} className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar name={other?.display_name} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{other?.display_name}</div>
                    <div className="hint" style={{ fontSize: 12 }}>wants to be friends</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="btn primary" style={{ fontSize: 13, padding: "5px 12px" }}
                      disabled={!!pendingActions[fr.id]} onClick={() => acceptRequest(fr)}>
                      Accept
                    </button>
                    <button className="btn" style={{ fontSize: 13, padding: "5px 12px" }}
                      disabled={!!pendingActions[fr.id]} onClick={() => declineRequest(fr.id)}>
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Friends list */}
      <section style={{ marginBottom: 24 }}>
        <div className="section-label" style={{ marginBottom: 10 }}>
          Your Friends {friends.length > 0 && `(${friends.length})`}
        </div>
        {loading ? (
          <div className="hint">Loading…</div>
        ) : friends.length === 0 ? (
          <div className="hint" style={{ padding: "24px 0", textAlign: "center" }}>
            No friends yet — search above to add people.
          </div>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {friends.map(fr => {
              const other = otherProfile(fr);
              return (
                <div key={fr.id} className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <a href={`#/profile/${other?.id}`} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, textDecoration: "none", color: "inherit", minWidth: 0 }}>
                    <Avatar name={other?.display_name} size={36} />
                    <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {other?.display_name}
                    </div>
                  </a>
                  <button className="btn" style={{ fontSize: 12, padding: "4px 10px", color: "var(--fg-muted)", flexShrink: 0 }}
                    disabled={!!pendingActions[fr.id]}
                    onClick={() => removeFriend(fr.id)}>
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Outgoing requests */}
      {outgoingRequests.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Sent Requests</div>
          <div className="stack" style={{ gap: 8 }}>
            {outgoingRequests.map(fr => {
              const other = otherProfile(fr);
              return (
                <div key={fr.id} className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar name={other?.display_name} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{other?.display_name}</div>
                    <div className="hint" style={{ fontSize: 12 }}>request pending</div>
                  </div>
                  <button className="btn" style={{ fontSize: 12, padding: "4px 10px", color: "var(--fg-muted)" }}
                    disabled={!!pendingActions[fr.id]}
                    onClick={() => declineRequest(fr.id)}>
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

Object.assign(window, { ProfileScreen, FriendsScreen });
