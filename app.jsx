/* RankEverything — app root
   Router, header, Supabase session init, store sync. */

const { useState, useEffect, useRef, useCallback } = React;

function App() {
  const [store, setStoreState] = useState(() => loadState());
  const [route, setRoute] = useState(parseRoute());
  const [toast, setToast] = useState(null);
  const [appLoading, setAppLoading] = useState(true);

  const prevStoreRef   = useRef(null);
  const suppressSyncRef = useRef(false);
  // Set to true during an explicit sign-out so the SIGNED_IN event can't re-login
  const signingOutRef  = useRef(false);

  /* ── Persist to localStorage ── */
  useEffect(() => { saveState(store); }, [store]);

  /* ── Theme ── */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", store.theme || "light");
  }, [store.theme]);

  /* ── Hash router ── */
  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setStore = useCallback((updater) => {
    setStoreState(prev => typeof updater === "function" ? updater(prev) : updater);
  }, []);

  const showToast = useCallback((msg) => { setToast({ msg, key: Date.now() }); }, []);

  /* ── Fetch public lists on mount — no auth required ── */
  useEffect(() => {
    dbGetPublicLists().then(({ data, error }) => {
      if (error) { console.error("[db] Public list fetch error:", error); return; }
      if (!data || !data.length) return;
      setStoreState(s => {
        const lists = { ...s.lists };
        for (const r of data) lists[r.id] = rowToList(r);
        return { ...s, lists };
      });
    });
  }, []);

  /* ── Load a Supabase user into the store ── */
  async function loadUserIntoStore(supabaseUser) {
    suppressSyncRef.current = true;
    try {
      const newStore = await dbLoadUserStore(supabaseUser);
      setStoreState(newStore);
    } catch (err) {
      console.error("[db] Failed to load user store:", err);
    } finally {
      suppressSyncRef.current = false;
    }
  }

  /* ── Supabase session bootstrap ── */
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const session = await dbGetSession();
        if (session && mounted && !signingOutRef.current) {
          await loadUserIntoStore(session.user);
        }
      } catch (err) {
        console.error("[db] Session check failed:", err);
      } finally {
        if (mounted) setAppLoading(false);
      }
    }

    init();

    // Hard fallback — unblock the app after 5s even if Supabase hangs
    const timeout = setTimeout(() => { if (mounted) setAppLoading(false); }, 5000);

    const { data: { subscription } } = dbOnAuthChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_IN" && session) {
        // Ignore the SIGNED_IN event that fires right after an explicit sign-out
        if (signingOutRef.current) return;
        await loadUserIntoStore(session.user);
        if (mounted) navigate("/");
      }

      if (event === "SIGNED_OUT") {
        signingOutRef.current = false;
        if (mounted) {
          setStoreState({ ...DEFAULT_STATE });
          navigate("/auth");
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, []);

  /* ── Sync store changes → Supabase ── */
  useEffect(() => {
    if (suppressSyncRef.current) return;
    const currentUser = store.currentUserId ? store.users[store.currentUserId] : null;
    if (!currentUser || currentUser.isGuest) return;

    const prev = prevStoreRef.current;
    prevStoreRef.current = store;
    if (!prev) return;

    const userId = currentUser.id;

    // Sync changed lists
    const prevLists = prev.lists || {};
    const nextLists = store.lists || {};
    for (const id of Object.keys(nextLists)) {
      if (nextLists[id].ownerId !== userId) continue;
      if (
        !prevLists[id] ||
        prevLists[id].name !== nextLists[id].name ||
        prevLists[id].isPublic !== nextLists[id].isPublic ||
        JSON.stringify(prevLists[id].items) !== JSON.stringify(nextLists[id].items)
      ) {
        dbUpsertList(nextLists[id], userId).catch(console.error);
      }
    }

    // Sync changed rankers
    const prevRankers = prev.rankers || {};
    const nextRankers = store.rankers || {};
    for (const id of Object.keys(nextRankers)) {
      if (nextRankers[id].ownerId !== userId) continue;
      if (
        !prevRankers[id] ||
        prevRankers[id].picks?.length !== nextRankers[id].picks?.length
      ) {
        dbUpsertRanker(nextRankers[id], userId).catch(console.error);
      }
    }

    // Sync saved lists
    const prevSaved = new Set(prev.savedLists?.[userId] || []);
    const nextSaved = new Set(store.savedLists?.[userId] || []);
    for (const listId of nextSaved) {
      if (!prevSaved.has(listId)) dbSaveList(userId, listId).catch(console.error);
    }
    for (const listId of prevSaved) {
      if (!nextSaved.has(listId)) dbUnsaveList(userId, listId).catch(console.error);
    }
  }, [store]);

  /* ── Per-route data refresh ── */
  useEffect(() => {
    if (appLoading) return;

    const currentUser = store.currentUserId ? store.users[store.currentUserId] : null;
    const userId = currentUser && !currentUser.isGuest ? currentUser.id : null;

    async function refresh() {
      try {

        // Always refresh public lists on Explore — no auth required, no suppression
        if (route.name === "explore") {
          const { data: publicLists, error } = await dbGetPublicLists();
          if (error) { console.error("[db] dbGetPublicLists error:", error); return; }
          setStoreState(s => {
            const lists = { ...s.lists };
            for (const r of (publicLists || [])) lists[r.id] = rowToList(r);
            return { ...s, lists };
          });
          return;
        }

        suppressSyncRef.current = true;

        // Remaining routes need a signed-in user
        if (!userId) return;

        if (route.name === "home") {
          const [{ data: userLists }, { data: rankerRows }] = await Promise.all([
            dbGetUserLists(userId),
            dbGetUserRankers(userId),
          ]);
          setStoreState(s => {
            const lists = { ...s.lists };
            for (const r of (userLists || [])) lists[r.id] = rowToList(r);
            const rankers = { ...s.rankers };
            const lastRanker = { ...s.lastRanker };
            for (const r of (rankerRows || [])) {
              rankers[r.id] = rowToRanker(r);
              const key = lastRankerKey(userId, r.list_id);
              const cur = lastRanker[key];
              if (!cur || rankers[r.id].updatedAt > (rankers[cur]?.updatedAt || 0)) {
                lastRanker[key] = r.id;
              }
            }
            return { ...s, lists, rankers, lastRanker };
          });
        }

        if (route.name === "saved") {
          const [{ data: savedIds }, { data: publicLists }] = await Promise.all([
            dbGetSavedListIds(userId),
            dbGetPublicLists(),
          ]);
          setStoreState(s => {
            const lists = { ...s.lists };
            for (const r of (publicLists || [])) lists[r.id] = rowToList(r);
            return { ...s, lists, savedLists: { ...s.savedLists, [userId]: savedIds || [] } };
          });
        }

        if (route.name === "stats" && route.listId) {
          const { data: listRankers } = await dbGetListRankers(route.listId);
          setStoreState(s => {
            const rankers = { ...s.rankers };
            for (const r of (listRankers || [])) rankers[r.id] = rowToRanker(r);
            return { ...s, rankers };
          });
        }

        if (route.name === "results" && route.rankerId) {
          const myRanker = store.rankers[route.rankerId];
          if (myRanker?.listId) {
            const { data: listRankers } = await dbGetListRankers(myRanker.listId);
            setStoreState(s => {
              const rankers = { ...s.rankers };
              for (const r of (listRankers || [])) rankers[r.id] = rowToRanker(r);
              return { ...s, rankers };
            });
          }
        }

      } catch (err) {
        console.error("[db] Route refresh failed:", err);
      } finally {
        suppressSyncRef.current = false;
      }
    }

    refresh();
  }, [route.name, route.listId, route.rankerId, appLoading]);

  /* ── Sign out ── */
  async function signOut() {
    signingOutRef.current = true;
    // Clear local state immediately so the UI reacts right away
    setStoreState({ ...DEFAULT_STATE });
    navigate("/auth");
    // Then tell Supabase to clear the session (fires SIGNED_OUT event which we also handle)
    try { await dbSignOut(); } catch (err) { console.error("[db] Sign out error:", err); }
  }

  const currentUser = store.currentUserId ? store.users[store.currentUserId] : null;

  // Auto-create a guest session when someone follows a share link without an account.
  // Their rankings are saved to localStorage — no sign-up needed.
  useEffect(() => {
    if (appLoading) return;
    if (currentUser) return;
    if (route.name === "join" && route.code) {
      const guest = createGuest();
      setStoreState(s => ({
        ...s,
        users: { ...s.users, [guest.id]: guest },
        currentUserId: guest.id,
      }));
    }
  }, [appLoading, route.name, route.code, currentUser]);

  // Bounce authenticated users away from /auth
  useEffect(() => {
    if (currentUser && route.name === "auth") navigate("/");
  }, [currentUser, route.name]);

  if (appLoading) {
    return (
      <div style={{
        position: "fixed", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "var(--bg, #fff)", color: "var(--muted, #999)",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", fontSize: 14,
      }}>
        Loading…
      </div>
    );
  }

  let screen;
  if (!currentUser) {
    screen = <AuthScreen store={store} setStore={setStore} mode={route.mode || "signin"} />;
  } else {
    switch (route.name) {
      case "home":
        screen = <HomeScreen store={store} setStore={setStore} currentUser={currentUser} showToast={showToast} />;
        break;
      case "create":
        screen = <CreateScreen store={store} setStore={setStore} currentUser={currentUser} />;
        break;
      case "explore":
        screen = <ExploreScreen store={store} setStore={setStore} currentUser={currentUser} filter={route.filter} showToast={showToast} />;
        break;
      case "saved":
        screen = <SavedScreen store={store} setStore={setStore} currentUser={currentUser} showToast={showToast} />;
        break;
      case "stats":
        screen = <ListStatsScreen store={store} setStore={setStore} currentUser={currentUser} listId={route.listId} tab={route.tab || "rankings"} showToast={showToast} />;
        break;
      case "join":
        screen = <JoinScreen store={store} setStore={setStore} currentUser={currentUser} initialCode={route.code} />;
        break;
      case "rank":
        screen = <RankingScreen store={store} setStore={setStore} currentUser={currentUser} rankerId={route.rankerId} showToast={showToast} />;
        break;
      case "results":
        screen = <ResultsScreen store={store} setStore={setStore} currentUser={currentUser} rankerId={route.rankerId} tab={route.tab || "rankings"} showToast={showToast} />;
        break;
      case "friends":
        screen = <FriendsScreen store={store} setStore={setStore} currentUser={currentUser} showToast={showToast} />;
        break;
      case "profile":
        screen = <ProfileScreen store={store} setStore={setStore} currentUser={currentUser} profileUserId={route.profileUserId} showToast={showToast} />;
        break;
      default:
        screen = <HomeScreen store={store} setStore={setStore} currentUser={currentUser} showToast={showToast} />;
    }
  }

  return (
    <ThemedShell store={store} toggleTheme={toggleTheme}
                 currentUser={currentUser} setStore={setStore} onSignOut={signOut}>
      {screen}
      {toast && <Toast key={toast.key} msg={toast.msg} onDone={() => setToast(null)} />}
    </ThemedShell>
  );

  function toggleTheme() {
    setStore(s => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" }));
  }
}

function ThemedShell({ store, toggleTheme, currentUser, setStore, onSignOut, children }) {
  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <a className="brand" href="#/" style={{ textDecoration: "none" }}>
            <span className="brand-mark">R</span>
            <span className="brand-name">RankEverything</span>
          </a>
          <div className="header-actions">
            {currentUser && (
              <a className="icon-btn" href="#/explore" aria-label="Explore" title="Explore">
                <Compass />
              </a>
            )}
            {currentUser && (
              <a className="icon-btn" href="#/saved" aria-label="Saved lists" title="Saved lists">
                <StarIcon filled={false} />
              </a>
            )}
            {currentUser && !currentUser.isGuest && (
              <a className="icon-btn" href="#/friends" aria-label="Friends" title="Friends">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </a>
            )}
            {currentUser && !currentUser.isGuest && (
              <a className="icon-btn" href="#/profile" aria-label="My profile" title="My profile">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              </a>
            )}
            <button className="icon-btn" aria-label="Toggle theme" onClick={toggleTheme} title="Toggle theme">
              {store.theme === "dark" ? <Sun /> : <Moon />}
            </button>
            {currentUser && <UserMenu user={currentUser} store={store} setStore={setStore} onSignOut={onSignOut} />}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
