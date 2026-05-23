/* RankEverything — app root
   Router, header, Supabase session init, store sync. */

const { useState, useEffect, useRef, useCallback } = React;

function App() {
  const [store, setStoreState] = useState(() => loadState());
  const [route, setRoute] = useState(parseRoute());
  const [toast, setToast] = useState(null);
  const [appLoading, setAppLoading] = useState(true); // true while checking Supabase session

  // Keep a ref to the previous store so we can diff and sync only what changed
  const prevStoreRef = useRef(null);
  // Flag: suppress sync-to-DB during the initial load from DB
  const suppressSyncRef = useRef(false);

  /* ── Persist to localStorage (always, for offline / guest) ── */
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

  /* ── Supabase session bootstrap ── */
  useEffect(() => {
    let mounted = true;

    async function init() {
      // Check for an existing session (e.g. page refresh while logged in)
      const session = await dbGetSession();
      if (session && mounted) {
        suppressSyncRef.current = true;
        try {
          const newStore = await dbLoadUserStore(session.user);
          if (mounted) setStoreState(newStore);
        } catch (err) {
          console.error("[db] Failed to load user store:", err);
        } finally {
          suppressSyncRef.current = false;
        }
      }
      if (mounted) setAppLoading(false);
    }

    init();

    // Listen for sign-in / sign-out events
    const { data: { subscription } } = dbOnAuthChange(async (event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_IN" && session) {
        suppressSyncRef.current = true;
        try {
          const newStore = await dbLoadUserStore(session.user);
          if (mounted) {
            setStoreState(newStore);
            navigate("/");
          }
        } catch (err) {
          console.error("[db] Failed to load user store on sign-in:", err);
        } finally {
          suppressSyncRef.current = false;
        }
      } else if (event === "SIGNED_OUT") {
        if (mounted) {
          setStoreState({ ...DEFAULT_STATE });
          navigate("/auth");
        }
      }
    });

    return () => {
      mounted = false;
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
    if (!prev) return; // first render — nothing to diff

    const userId = currentUser.id;

    // Sync new / changed lists
    const prevLists = prev.lists || {};
    const nextLists = store.lists || {};
    for (const id of Object.keys(nextLists)) {
      if (nextLists[id].ownerId !== userId) continue; // only own lists
      if (
        !prevLists[id] ||
        prevLists[id].name !== nextLists[id].name ||
        prevLists[id].isPublic !== nextLists[id].isPublic ||
        JSON.stringify(prevLists[id].items) !== JSON.stringify(nextLists[id].items)
      ) {
        dbUpsertList(nextLists[id], userId).catch(console.error);
      }
    }

    // Sync new / changed rankers (debounce-free — picks save immediately)
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

  // Refresh public lists from Supabase whenever the user visits Explore
  useEffect(() => {
    if (route.name !== "explore") return;
    dbGetPublicLists().then(({ data }) => {
      if (!data) return;
      setStore(s => {
        const merged = { ...s.lists };
        for (const r of data) merged[r.id] = rowToList(r);
        return { ...s, lists: merged };
      });
    }).catch(console.error);
  }, [route.name]);

  function toggleTheme() {
    setStore(s => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" }));
  }

  async function signOut() {
    const currentUser = store.currentUserId ? store.users[store.currentUserId] : null;
    if (currentUser && !currentUser.isGuest) {
      await dbSignOut(); // triggers SIGNED_OUT event → resets store
    } else {
      setStore(s => ({ ...s, currentUserId: null }));
      navigate("/auth");
    }
  }

  const currentUser = store.currentUserId ? store.users[store.currentUserId] : null;

  // Stash pending join code for unauthenticated share links
  useEffect(() => {
    if (!currentUser && route.name === "join" && route.code) {
      try { sessionStorage.setItem("pendingJoinCode", route.code); } catch (_) {}
    }
  }, [currentUser, route.name, route.code]);

  // After auth, route to any pending join code
  useEffect(() => {
    if (!currentUser) return;
    try {
      const pending = sessionStorage.getItem("pendingJoinCode");
      if (pending && route.name === "home") {
        sessionStorage.removeItem("pendingJoinCode");
        navigate(`/join/${pending}`);
      }
    } catch (_) {}
  }, [currentUser, route.name]);

  // Bounce authenticated users away from /auth
  useEffect(() => {
    if (currentUser && route.name === "auth") navigate("/");
  }, [currentUser, route.name]);

  // Show a full-screen spinner while Supabase session is resolving
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
