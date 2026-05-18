/* RankEverything — Auth screen + user menu
   Local-only auth (no backend). Honest disclaimer surfaced to the user. */

const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

function AuthScreen({ store, setStore, mode, sharePreview }) {
  // mode: "signin" | "signup"
  const [tab, setTab] = useStateA(mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useStateA("");
  const [pwd, setPwd] = useStateA("");
  const [name, setName] = useStateA("");
  const [err, setErr] = useStateA("");

  // If the URL pointed us here via a share link, surface that.
  // (No-op for now; share routes don't gate on auth.)

  function finalizeLogin(user, baseState) {
    const next = seedForUser({ ...baseState, currentUserId: user.id }, user.id);
    setStore(next);
    navigate("/");
  }

  function onSignin(e) {
    e.preventDefault(); setErr("");
    const user = findUserByEmail(store, email);
    if (!user || user.isGuest) { setErr("No account with that email."); return; }
    if (!verifyPassword(user, pwd)) { setErr("Wrong password."); return; }
    finalizeLogin(user, store);
  }
  function onSignup(e) {
    e.preventDefault(); setErr("");
    try {
      const user = createUser(store, { email, password: pwd, displayName: name || email.split("@")[0] });
      const next = { ...store, users: { ...store.users, [user.id]: user } };
      finalizeLogin(user, next);
    } catch (ex) {
      setErr(ex.message || "Could not create that account.");
    }
  }
  function onGuest() {
    const guest = createGuest();
    const next = { ...store, users: { ...store.users, [guest.id]: guest } };
    finalizeLogin(guest, next);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">R</span>
          <div>
            <div style={{ fontWeight: 500, fontSize: 18, letterSpacing: "-0.01em" }}>RankEverything</div>
            <div className="hint" style={{ marginTop: 2 }}>Pick favorites, see what wins.</div>
          </div>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === "signin" ? "active" : ""}`} onClick={() => { setTab("signin"); setErr(""); }}>Sign in</button>
          <button className={`auth-tab ${tab === "signup" ? "active" : ""}`} onClick={() => { setTab("signup"); setErr(""); }}>Create account</button>
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
            <button type="submit" className="btn primary">Sign in</button>
          </form>
        ) : (
          <form className="stack" style={{ gap: 14 }} onSubmit={onSignup}>
            <div className="field">
              <label className="label" htmlFor="au-name">Display name</label>
              <input id="au-name" className="input" placeholder="e.g. Alex"
                     value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="au-email">Email</label>
              <input id="au-email" className="input" type="email" autoComplete="email"
                     value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="au-pwd">Password</label>
              <input id="au-pwd" className="input" type="password" autoComplete="new-password"
                     value={pwd} onChange={e => setPwd(e.target.value)} required minLength={4} />
              <div className="hint">4+ characters.</div>
            </div>
            {err && <div className="hint err">{err}</div>}
            <button type="submit" className="btn primary">Create account</button>
          </form>
        )}

        <div className="auth-divider"><span>or</span></div>
        <button className="btn" onClick={onGuest}>Continue as guest</button>

        <div className="auth-note hint">
          <strong>Heads up:</strong> RankEverything runs entirely in your browser — accounts and lists are stored locally on this device. Use a throwaway password.
        </div>
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
          <button className="menu-item" role="menuitem" onClick={() => { setOpen(false); onSignOut(); }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10 11l3-3-3-3M13 8H6M9 13H4a1 1 0 01-1-1V4a1 1 0 011-1h5"/></svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { AuthScreen, UserMenu });
