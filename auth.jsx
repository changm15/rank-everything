/* RankEverything — Auth screen + user menu
   Uses Supabase Auth for real sign-up / sign-in. */

const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

function AuthScreen({ store, setStore, mode, onSessionLoaded }) {
  const [tab, setTab] = useStateA(mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useStateA("");
  const [pwd, setPwd] = useStateA("");
  const [accountName, setAccountName] = useStateA("");
  const [guestName, setGuestName] = useStateA("");
  const [err, setErr] = useStateA("");
  const [loading, setLoading] = useStateA(false);
  const [showAccount, setShowAccount] = useStateA(false);

  async function onSignin(e) {
    e.preventDefault();
    setErr(""); setLoading(true);
    const { data, error } = await dbSignIn(email, pwd);
    setLoading(false);
    if (error) { setErr(error.message); return; }
  }

  async function onSignup(e) {
    e.preventDefault();
    setErr(""); setLoading(true);
    const { data, error } = await dbSignUp(email, pwd, accountName || email.split("@")[0]);
    setLoading(false);
    if (error) { setErr(error.message); return; }
    if (data?.session) {
      // logged in immediately — onAuthStateChange handles it
    } else {
      setErr("Check your email to confirm your account, then sign in.");
      setTab("signin");
    }
  }

  // Guest mode — name is captured so their ranking shows up properly in results
  function onGuest() {
    const trimmed = guestName.trim();
    if (!trimmed) { document.getElementById("g-name")?.focus(); return; }
    const guest = { ...createGuest(), displayName: trimmed };
    const next = seedForUser(
      { ...store, users: { ...store.users, [guest.id]: guest }, currentUserId: guest.id },
      guest.id,
    );
    setStore(next);
    // Don't navigate — re-render on current route so share links land correctly.
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">R</span>
          <div>
            <div style={{ fontWeight: 500, fontSize: 18, letterSpacing: "-0.01em" }}>RankEverything</div>
            <div className="hint" style={{ marginTop: 2 }}>Finally settle what you actually think.</div>
          </div>
        </div>

        {/* ── Guest — primary path, no account needed ── */}
        <div className="stack" style={{ gap: 10 }}>
          <div className="field">
            <label className="label" htmlFor="g-name">Your name</label>
            <input id="g-name" className="input" placeholder="e.g. Alex" autoFocus
                   value={guestName} onChange={e => setGuestName(e.target.value)}
                   onKeyDown={e => { if (e.key === "Enter") onGuest(); }} />
          </div>
          <button className="btn primary" onClick={onGuest}>Start ranking →</button>
          <div className="hint" style={{ textAlign: "center" }}>No account needed. Your rankings are saved on this device.</div>
        </div>

        {/* ── Account — for saving to profile ── */}
        <div className="auth-divider">
          <button className="hint" style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline", color: "inherit" }}
                  onClick={() => setShowAccount(a => !a)}>
            {showAccount ? "hide" : "have an account? sign in"}
          </button>
        </div>

        {showAccount && (
          <>
            <div className="auth-tabs">
              <button className={`auth-tab ${tab === "signin" ? "active" : ""}`}
                      onClick={() => { setTab("signin"); setErr(""); }}>Sign in</button>
              <button className={`auth-tab ${tab === "signup" ? "active" : ""}`}
                      onClick={() => { setTab("signup"); setErr(""); }}>Create account</button>
            </div>

            {tab === "signin" ? (
              <form className="stack" style={{ gap: 14 }} onSubmit={onSignin}>
                <div className="field">
                  <label className="label" htmlFor="ai-email">Email</label>
                  <input id="ai-email" className="input" type="email" autoComplete="email"
                         value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="field">
                  <label className="label" htmlFor="ai-pwd">Password</label>
                  <input id="ai-pwd" className="input" type="password" autoComplete="current-password"
                         value={pwd} onChange={e => setPwd(e.target.value)} required />
                </div>
                {err && <div className="hint err">{err}</div>}
                <button type="submit" className="btn" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            ) : (
              <form className="stack" style={{ gap: 14 }} onSubmit={onSignup}>
                <div className="field">
                  <label className="label" htmlFor="au-name">Display name</label>
                  <input id="au-name" className="input" placeholder="e.g. Alex"
                         value={accountName} onChange={e => setAccountName(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="au-email">Email</label>
                  <input id="au-email" className="input" type="email" autoComplete="email"
                         value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="field">
                  <label className="label" htmlFor="au-pwd">Password</label>
                  <input id="au-pwd" className="input" type="password" autoComplete="new-password"
                         value={pwd} onChange={e => setPwd(e.target.value)} required minLength={6} />
                  <div className="hint">6+ characters.</div>
                </div>
                {err && <div className="hint err">{err}</div>}
                <button type="submit" className="btn" disabled={loading}>
                  {loading ? "Creating account…" : "Create account"}
                </button>
              </form>
            )}

            <div className="auth-note hint">
              An account saves all your rankings to a profile so you can access them from any device and compare with friends.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* User menu in header */
function UserMenu({ user, store, setStore, onSignOut }) {
  const [open, setOpen] = useStateA(false);
  const ref = useRefA(null);
  useEffectA(() => {
    if (!open) return;
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  const initial = (user.displayName || user.email || "?").trim().slice(0, 1).toUpperCase();

  return (
    <div className="user-menu" ref={ref}>
      <button className="avatar" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}>
        {initial}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <div className="menu-name">{user.displayName}</div>
            <div className="menu-sub mono">{user.isGuest ? "guest session" : user.email}</div>
          </div>
          {!user.isGuest && (
            <a className="menu-item" role="menuitem" href="#/profile" style={{ textDecoration: "none" }} onClick={() => setOpen(false)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
              My profile
            </a>
          )}
          {!user.isGuest && (
            <a className="menu-item" role="menuitem" href="#/friends" style={{ textDecoration: "none" }} onClick={() => setOpen(false)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Friends
            </a>
          )}
          <button className="menu-item" role="menuitem" onClick={() => { setOpen(false); onSignOut(); }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 11l3-3-3-3M13 8H6M9 13H4a1 1 0 01-1-1V4a1 1 0 011-1h5"/>
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { AuthScreen, UserMenu });
