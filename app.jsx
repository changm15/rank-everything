/* RankEverything — app root
   Router, header, store + theme + auth gating. */

const { useState, useEffect, useRef, useCallback } = React;

function App() {
  const [store, setStoreState] = useState(() => loadState());
  const [route, setRoute] = useState(parseRoute());
  const [toast, setToast] = useState(null);

  // Persist whenever store changes
  useEffect(() => { saveState(store); }, [store]);

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", store.theme || "light");
  }, [store.theme]);

  // Hash-based router
  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setStore = useCallback((updater) => {
    setStoreState(prev => typeof updater === "function" ? updater(prev) : updater);
  }, []);

  const showToast = useCallback((msg) => { setToast({ msg, key: Date.now() }); }, []);

  function toggleTheme() {
    setStore(s => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" }));
  }
  function signOut() {
    setStore(s => ({ ...s, currentUserId: null }));
    navigate("/auth");
  }

  const currentUser = store.currentUserId ? store.users[store.currentUserId] : null;

  // If a share link landed an unauthenticated user, stash the code so we can
  // route to /join/<code> after they sign in.
  useEffect(() => {
    if (!currentUser && route.name === "join" && route.code) {
      try { sessionStorage.setItem("pendingJoinCode", route.code); } catch (_) {}
    }
  }, [currentUser, route.name, route.code]);

  // After auth, route to any pending join code.
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

  // If signed in and the route is /auth, bounce home.
  useEffect(() => {
    if (currentUser && route.name === "auth") navigate("/");
  }, [currentUser, route.name]);

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
      case "auth":
        // bounced to home above
        screen = <HomeScreen store={store} setStore={setStore} currentUser={currentUser} showToast={showToast} />;
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
