/* ELO Ranker — screens
   Home, CreateList, JoinList, Ranking, Results (Rankings/Bracket/Compare)
   Consumes globals from engine.jsx and app.jsx (StoreCtx). */

const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* ---------- Small UI helpers ---------- */
function Toast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  return <div className="toast">{msg}</div>;
}

function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
  } catch (_) {}
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch (_) {}
  document.body.removeChild(ta);
  return Promise.resolve();
}

/* ---------- Home ---------- */
function HomeScreen({ store, setStore, currentUser, showToast }) {
  const lists = Object.values(store.lists)
    .filter(l => l.ownerId === currentUser.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  function rankerForList(listId) {
    const key = lastRankerKey(currentUser.id, listId);
    const localId = store.lastRanker?.[key];
    if (localId && store.rankers[localId]) return store.rankers[localId];
    return Object.values(store.rankers).find(r => r.listId === listId && r.ownerId === currentUser.id) || null;
  }

  function openList(list) {
    let ranker = rankerForList(list.id);
    if (!ranker) {
      const r = {
        id: uid("rk"),
        listId: list.id,
        ownerId: currentUser.id,
        name: currentUser.displayName || "You",
        elos: {}, wins: {}, losses: {},
        picks: [],
        totalPairs: allPairs(list.items).length,
        updatedAt: Date.now(),
      };
      setStore(s => ({
        ...s,
        rankers: { ...s.rankers, [r.id]: r },
        lastRanker: { ...s.lastRanker, [lastRankerKey(currentUser.id, list.id)]: r.id },
      }));
      navigate(`/rank/${r.id}`);
      return;
    }
    const done = ranker.picks.length >= ranker.totalPairs;
    if (done) navigate(`/results/${ranker.id}`);
    else navigate(`/rank/${ranker.id}`);
  }

  function deleteList(id) {
    if (!confirm("Delete this list and all rankings on it?")) return;
    setStore(s => {
      const lists = { ...s.lists }; delete lists[id];
      const rankers = { ...s.rankers };
      Object.values(rankers).forEach(r => { if (r.listId === id) delete rankers[r.id]; });
      const lastRanker = { ...s.lastRanker };
      delete lastRanker[lastRankerKey(currentUser.id, id)];
      return { ...s, lists, rankers, lastRanker };
    });
  }

  return (
    <div className="container page" data-screen-label="01 Home">
      <div className="page-head">
        <div className="crumb">My lists</div>
        <h1>What are you undecided about?</h1>
        <p className="lede">Pick between two things at a time — no overthinking. We figure out your real ranking from your gut reactions, then you can see how your opinions stack up against friends.</p>
      </div>

      <div className="row" style={{ marginBottom: 20 }}>
        <button className="btn primary" onClick={() => navigate("/create")}>
          <Plus /> New list
        </button>
        <button className="btn" onClick={() => navigate("/explore")}>
          <Compass /> Explore
        </button>
        <button className="btn" onClick={() => navigate("/saved")}>
          <StarIcon filled={false} /> Saved lists
        </button>
        <button className="btn" onClick={() => navigate("/join")}>
          <Link2 /> Join via code
        </button>
      </div>

      <div className="section-title">
        <h2>My lists</h2>
        <span className="hint">{lists.length} {lists.length === 1 ? "list" : "lists"}</span>
      </div>

      {lists.length === 0 ? (
        <div className="empty">
          No lists yet. Create one to get started.
        </div>
      ) : (
        <div className="stack">
          {lists.map(list => {
            const ranker = rankerForList(list.id);
            const played = ranker ? ranker.picks.length : 0;
            const total = allPairs(list.items).length;
            const done = ranker && played >= total;
            return (
              <button key={list.id} className="list-row" onClick={() => openList(list)}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="name">{list.name}</div>
                  <div className="meta">
                    {list.items.length} items · {played}/{total} matchups · {formatRelTime(list.createdAt)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {done && <span className="medal medal-1" title="Complete">✓</span>}
                  <span className="btn sm" onClick={(e) => { e.stopPropagation(); deleteList(list.id); }} role="button" aria-label="Delete">
                    <Trash />
                  </span>
                  <span className="hint mono">→</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Create list ---------- */
function CreateScreen({ store, setStore, currentUser }) {
  const [name, setName] = useState("");
  const [items, setItems] = useState("");
  const [err, setErr] = useState("");
  const [importNote, setImportNote] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const fileRef = useRef(null);

  const parsed = useMemo(() => {
    return items.split("\n").map(s => s.trim()).filter(Boolean);
  }, [items]);

  function handleFile(e) {
    setErr(""); setImportNote("");
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const isJson = /\.json$/i.test(file.name) || file.type.includes("json");
      const names = isJson ? parseGeoJSON(text) : parseKML(text);
      if (!names.length) {
        setErr("Couldn't find any places in that file. Make sure it's a KML or GeoJSON from a Google Maps list.");
        return;
      }
      const detectedName = isJson ? "" : parseKMLListName(text);
      // Merge with existing items, de-duped
      const current = items.split("\n").map(s => s.trim()).filter(Boolean);
      const merged = Array.from(new Set([...current, ...names]));
      const capped = merged.slice(0, 200);
      setItems(capped.join("\n"));
      if (!name && detectedName) setName(detectedName);
      setImportNote(`Imported ${names.length} place${names.length === 1 ? "" : "s"}.`);
    };
    reader.onerror = () => setErr("Could not read that file.");
    reader.readAsText(file);
    // Allow re-selecting the same file later
    e.target.value = "";
  }

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setErr("Give your list a name."); return; }
    const uniq = Array.from(new Set(parsed));
    if (uniq.length < 4) { setErr("Add at least 4 items (one per line)."); return; }
    if (uniq.length > 200) { setErr("Keep it under 200 items."); return; }
    const list = {
      id: uid("lst"),
      name: name.trim(),
      items: uniq,
      createdAt: Date.now(),
      ownerId: currentUser.id,
      ownerName: currentUser.displayName || "you",
      isPublic,
    };
    const ranker = {
      id: uid("rk"),
      listId: list.id,
      ownerId: currentUser.id,
      name: currentUser.displayName || "You",
      elos: {}, wins: {}, losses: {},
      picks: [],
      totalPairs: allPairs(list.items).length,
      updatedAt: Date.now(),
    };
    setStore(s => ({
      ...s,
      lists: { ...s.lists, [list.id]: list },
      rankers: { ...s.rankers, [ranker.id]: ranker },
      lastRanker: { ...s.lastRanker, [lastRankerKey(currentUser.id, list.id)]: ranker.id },
    }));
    navigate(`/rank/${ranker.id}`);
  }

  return (
    <div className="container page" data-screen-label="02 Create">
      <div className="page-head">
        <div className="crumb"><a href="#/" style={{ textDecoration: "none" }}>← Lists</a> / New</div>
        <h1>New list</h1>
        <p className="lede">What are you undecided about? Add your options — pizza toppings, restaurants, whatever — and we&rsquo;ll put them head-to-head until the answer is obvious.</p>
      </div>

      <form className="card" onSubmit={submit}>
        <div className="stack" style={{ gap: 18 }}>
          <div className="field">
            <label className="label" htmlFor="name">List name</label>
            <input id="name" className="input" placeholder="Pizza toppings, best Pixar movies…"
                   value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>

          <div className="field">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <label className="label" htmlFor="items">Items (one per line)</label>
              <button type="button" className="btn sm" onClick={() => fileRef.current && fileRef.current.click()}>
                <MapPin /> Import Google Maps list
              </button>
              <input ref={fileRef} type="file" accept=".kml,.json,application/vnd.google-earth.kml+xml,application/json"
                     style={{ display: "none" }} onChange={handleFile} />
            </div>
            <textarea id="items" className="textarea" placeholder={"Pepperoni\nMushroom\nOlives\nPineapple"}
                      value={items} onChange={e => setItems(e.target.value)} />
            <div className="hint">
              {parsed.length} item{parsed.length === 1 ? "" : "s"} · {parsed.length >= 2 ? allPairs(parsed).length : 0} pairs to rank
              {importNote ? <> · <span style={{ color: "var(--win-fg)" }}>{importNote}</span></> : null}
            </div>
            <details style={{ marginTop: 2 }}>
              <summary className="hint" style={{ cursor: "pointer" }}>How to export from Google Maps</summary>
              <div className="hint" style={{ marginTop: 6, lineHeight: 1.6 }}>
                On the Google Maps app or web, open a saved list → <span className="kbd">Share</span> → <em>Download as KML</em>.
                Or from Google Takeout, select <em>Maps (your places)</em> and upload the resulting <span className="mono">.json</span>.
              </div>
            </details>
          </div>

          <div className="visibility-toggle">
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Visibility</div>
              <div className="hint" style={{ marginTop: 2 }}>
                {isPublic
                  ? "Public — anyone on Explore can find and rank this list."
                  : "Private — only you can see and share this list (via code or link)."}
              </div>
            </div>
            <div className="seg" role="radiogroup" aria-label="Visibility">
              <button type="button" role="radio" aria-checked={!isPublic}
                      className={`seg-opt ${!isPublic ? "on" : ""}`} onClick={() => setIsPublic(false)}>
                <LockIcon /> Private
              </button>
              <button type="button" role="radio" aria-checked={isPublic}
                      className={`seg-opt ${isPublic ? "on" : ""}`} onClick={() => setIsPublic(true)}>
                <GlobeIcon /> Public
              </button>
            </div>
          </div>

          {err && <div className="hint err">{err}</div>}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn ghost" onClick={() => navigate("/")}>Cancel</button>
            <button type="submit" className="btn primary">Start ranking →</button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ---------- Join via code ---------- */
function JoinScreen({ store, setStore, currentUser, initialCode }) {
  const [code, setCode] = useState(initialCode || "");
  const [displayName, setDisplayName] = useState(currentUser?.displayName || "");
  const [err, setErr] = useState("");

  const preview = useMemo(() => {
    if (!code.trim()) return null;
    return decodeShare(code.trim());
  }, [code]);

  const list = preview && store.lists[preview.listId];

  function submit(e) {
    e.preventDefault();
    setErr("");
    if (!preview) { setErr("That code doesn't look right."); return; }
    if (!displayName.trim()) { setErr("Add a display name."); return; }
    if (!list) {
      setErr("List not found on this device. Open it on the device that created it first, or paste the full link.");
      return;
    }
    const ranker = {
      id: uid("rk"),
      listId: list.id,
      ownerId: currentUser.id,
      name: displayName.trim(),
      elos: {}, wins: {}, losses: {},
      picks: [],
      totalPairs: allPairs(list.items).length,
      updatedAt: Date.now(),
    };
    setStore(s => ({
      ...s,
      rankers: { ...s.rankers, [ranker.id]: ranker },
      lastRanker: { ...s.lastRanker, [lastRankerKey(currentUser.id, list.id)]: ranker.id },
    }));
    navigate(`/rank/${ranker.id}`);
  }

  return (
    <div className="container page" data-screen-label="05 Join">
      <div className="page-head">
        <div className="crumb"><a href="#/" style={{ textDecoration: "none" }}>← Lists</a> / Join</div>
        <h1>Join a list</h1>
        <p className="lede">Got a link from a friend? Settle the debate — your picks are yours, theirs are theirs. See who actually has better taste.</p>
      </div>

      <form className="card" onSubmit={submit}>
        <div className="stack" style={{ gap: 18 }}>
          <div className="field">
            <label className="label" htmlFor="code">Share code</label>
            <input id="code" className="input mono" placeholder="paste code here"
                   value={code} onChange={e => setCode(e.target.value)} autoFocus />
            {preview && list && <div className="hint">Found list: <strong>{list.name}</strong> · {list.items.length} items</div>}
            {preview && !list && <div className="hint err">List ID <span className="mono">{preview.listId}</span> isn&rsquo;t on this device.</div>}
          </div>
          <div className="field">
            <label className="label" htmlFor="dn">Your display name</label>
            <input id="dn" className="input" placeholder="e.g. Sam"
                   value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
          {err && <div className="hint err">{err}</div>}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn ghost" onClick={() => navigate("/")}>Cancel</button>
            <button type="submit" className="btn primary">Start ranking →</button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ---------- Explore (popular public lists) ---------- */
function ExploreScreen({ store, setStore, currentUser, filter, showToast }) {
  const activeFilter = filter || "all";

  const enriched = useMemo(() => {
    return Object.values(store.lists)
      .filter(l => l.isPublic)
      .map(l => {
        const allRankersList = Object.values(store.rankers).filter(r => r.listId === l.id && r.picks.length > 0);
        const myRanker = Object.values(store.rankers).find(r => r.listId === l.id && r.ownerId === currentUser.id);
        const saved = isListSaved(store, currentUser.id, l.id);
        // Community top picks (combined ELO across other rankers)
        let topPicks = [];
        const others = allRankersList.filter(r => r.ownerId !== currentUser.id);
        if (others.length > 0) {
          const combined = combinedFromRankers(l.items, others);
          topPicks = rankItemsByElo(l.items, combined.elos).slice(0, 3);
        }
        return { ...l, rankerCount: allRankersList.length, myRanker, allRankers: allRankersList, saved, topPicks };
      });
  }, [store.lists, store.rankers, store.savedLists, currentUser.id]);

  const filtered = useMemo(() => {
    let arr = enriched;
    if (activeFilter === "ranked") arr = arr.filter(l => l.myRanker && l.myRanker.picks.length > 0);
    else if (activeFilter === "unranked") arr = arr.filter(l => !l.myRanker || l.myRanker.picks.length === 0);
    else if (activeFilter === "saved") arr = arr.filter(l => l.saved);
    return arr.slice().sort((a, b) => b.rankerCount - a.rankerCount || b.createdAt - a.createdAt);
  }, [enriched, activeFilter]);

  function startRanking(list, e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (list.myRanker) {
      const ready = canShowResults(list.items, list.myRanker.picks);
      const done = list.myRanker.picks.length >= list.myRanker.totalPairs;
      if (done) navigate(`/results/${list.myRanker.id}`);
      else navigate(`/rank/${list.myRanker.id}`);
      return;
    }
    const ranker = {
      id: uid("rk"),
      listId: list.id,
      ownerId: currentUser.id,
      name: currentUser.displayName || "You",
      elos: {}, wins: {}, losses: {},
      picks: [],
      totalPairs: allPairs(list.items).length,
      updatedAt: Date.now(),
    };
    setStore(s => ({
      ...s,
      rankers: { ...s.rankers, [ranker.id]: ranker },
      lastRanker: { ...s.lastRanker, [lastRankerKey(currentUser.id, list.id)]: ranker.id },
    }));
    navigate(`/rank/${ranker.id}`);
  }

  function toggleSave(list, e) {
    e.stopPropagation();
    e.preventDefault();
    setStore(s => toggleSaved(s, currentUser.id, list.id));
    showToast(list.saved ? "Removed from Saved lists" : "Added to Saved lists");
  }

  return (
    <div className="container page" data-screen-label="06 Explore">
      <div className="page-head">
        <div className="crumb"><a href="#/" style={{ textDecoration: "none" }}>← Lists</a> / Explore</div>
        <h1>Explore</h1>
        <p className="lede">Topics other people are ranking. Jump in, figure out your take, and see where your opinion lands.</p>
      </div>

      <ExploreFilters active={activeFilter} counts={{
        all: enriched.length,
        ranked: enriched.filter(l => l.myRanker && l.myRanker.picks.length > 0).length,
        unranked: enriched.filter(l => !l.myRanker || l.myRanker.picks.length === 0).length,
        saved: enriched.filter(l => l.saved).length,
      }} />

      {filtered.length === 0 ? (
        <div className="empty">
          {activeFilter === "saved"
            ? <>Nothing saved yet. Tap the star on any list to save it here.</>
            : activeFilter === "ranked"
              ? <>You haven&rsquo;t ranked any public lists yet.</>
              : <>No lists match this filter.</>}
        </div>
      ) : (
        <div className="stack">
          {filtered.map(list => {
            const myDone = list.myRanker && list.myRanker.picks.length >= list.myRanker.totalPairs;
            const myReady = list.myRanker && canShowResults(list.items, list.myRanker.picks);
            const myProgress = list.myRanker
              ? `${list.myRanker.picks.length}/${list.myRanker.totalPairs}`
              : null;
            const ctaLabel = !list.myRanker
              ? "Rank it →"
              : (myDone ? "See results →" : myReady ? "Resume →" : "Continue →");
            return (
              <a key={list.id} href={`#/stats/${list.id}`} className="explore-row explore-row-link">
                <div className="explore-main">
                  <div className="explore-title">
                    <button className={`star-btn ${list.saved ? "on" : ""}`}
                            onClick={(e) => toggleSave(list, e)}
                            aria-pressed={list.saved}
                            aria-label={list.saved ? "Unsave" : "Save"}
                            title={list.saved ? "Remove from Saved lists" : "Save to Saved lists"}>
                      <StarIcon filled={list.saved} />
                    </button>
                    <span style={{ fontWeight: 500 }}>{list.name}</span>
                    <span className="hint mono"> · by {list.ownerName || "anonymous"}</span>
                  </div>
                  <div className="meta" style={{ marginTop: 4 }}>
                    {list.items.length} items · {list.rankerCount} ranker{list.rankerCount === 1 ? "" : "s"}
                    {myProgress && <> · <span style={{ color: "var(--gold-fg)" }}>you: {myProgress}{myDone ? " ✓" : ""}</span></>}
                  </div>
                  {list.topPicks.length > 0 && (
                    <div className="explore-top">
                      <span className="hint">Community favorites:</span>
                      <span className="top-picks">
                        {list.topPicks.map((t, i) => (
                          <span key={t.name} className="top-pick">
                            <span className="top-pick-rank mono">{i + 1}</span>{t.name}
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                  <div className="explore-peek">
                    {list.items.slice(0, 5).map((it, i) => (
                      <span key={i} className="peek-pill">{it}</span>
                    ))}
                    {list.items.length > 5 && <span className="peek-more">+{list.items.length - 5}</span>}
                  </div>
                </div>
                <button className="btn primary" onClick={(e) => startRanking(list, e)}>{ctaLabel}</button>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExploreFilters({ active, counts }) {
  const options = [
    ["all", "All", counts.all],
    ["unranked", "Unranked", counts.unranked],
    ["ranked", "Ranked", counts.ranked],
    ["saved", "Saved", counts.saved],
  ];
  return (
    <div className="filter-row">
      {options.map(([key, label, count]) => (
        <a key={key}
           href={`#/explore${key === "all" ? "" : "/" + key}`}
           className={`filter-chip ${active === key ? "on" : ""}`}>
          {label}
          <span className="filter-count mono">{count}</span>
        </a>
      ))}
    </div>
  );
}

/* ---------- Saved lists (community lists you've starred + shared with you) ---------- */
function SavedScreen({ store, setStore, currentUser, showToast }) {
  const ids = savedListIds(store, currentUser.id);
  const enriched = useMemo(() => {
    return ids.map(id => store.lists[id]).filter(Boolean).map(l => {
      const allRankersList = Object.values(store.rankers).filter(r => r.listId === l.id && r.picks.length > 0);
      const myRanker = Object.values(store.rankers).find(r => r.listId === l.id && r.ownerId === currentUser.id);
      return { ...l, rankerCount: allRankersList.length, myRanker };
    });
  }, [ids, store.lists, store.rankers, currentUser.id]);

  function unsave(listId, e) {
    e.stopPropagation();
    e.preventDefault();
    setStore(s => toggleSaved(s, currentUser.id, listId));
    showToast("Removed from Saved lists");
  }
  function rankIt(list, e) {
    e.stopPropagation();
    e.preventDefault();
    if (list.myRanker) {
      const done = list.myRanker.picks.length >= list.myRanker.totalPairs;
      const ready = canShowResults(list.items, list.myRanker.picks);
      if (done) navigate(`/results/${list.myRanker.id}`);
      else if (ready) navigate(`/rank/${list.myRanker.id}`);
      else navigate(`/rank/${list.myRanker.id}`);
      return;
    }
    const ranker = {
      id: uid("rk"),
      listId: list.id,
      ownerId: currentUser.id,
      name: currentUser.displayName || "You",
      elos: {}, wins: {}, losses: {},
      picks: [],
      totalPairs: allPairs(list.items).length,
      updatedAt: Date.now(),
    };
    setStore(s => ({
      ...s,
      rankers: { ...s.rankers, [ranker.id]: ranker },
      lastRanker: { ...s.lastRanker, [lastRankerKey(currentUser.id, list.id)]: ranker.id },
    }));
    navigate(`/rank/${ranker.id}`);
  }

  return (
    <div className="container page" data-screen-label="07 Saved lists">
      <div className="page-head">
        <div className="crumb"><a href="#/" style={{ textDecoration: "none" }}>← Home</a> / Saved lists</div>
        <h1>Saved lists</h1>
        <p className="lede">Topics you&rsquo;ve saved to come back to. Rank when you&rsquo;re ready — or just browse how others voted.</p>
      </div>

      {enriched.length === 0 ? (
        <div className="empty">
          Nothing saved yet. <a href="#/explore">Browse topics</a> and star anything you want to weigh in on.
        </div>
      ) : (
        <div className="stack">
          {enriched.map(list => {
            const myDone = list.myRanker && list.myRanker.picks.length >= list.myRanker.totalPairs;
            const myReady = list.myRanker && canShowResults(list.items, list.myRanker.picks);
            const myProgress = list.myRanker
              ? `${list.myRanker.picks.length}/${list.myRanker.totalPairs}`
              : null;
            const ctaLabel = !list.myRanker
              ? "Rank it →"
              : (myDone ? "See results →" : myReady ? "Resume →" : "Continue →");
            return (
              <a key={list.id} href={`#/stats/${list.id}`} className="explore-row explore-row-link">
                <div className="explore-main">
                  <div className="explore-title">
                    <button className="star-btn on" onClick={(e) => unsave(list.id, e)} aria-label="Unsave" title="Remove from Saved lists">
                      <StarIcon filled />
                    </button>
                    <span style={{ fontWeight: 500 }}>{list.name}</span>
                    <span className="hint mono"> · by {list.ownerName || "anonymous"}</span>
                  </div>
                  <div className="meta" style={{ marginTop: 4 }}>
                    {list.items.length} items · {list.rankerCount} ranker{list.rankerCount === 1 ? "" : "s"}
                    {myProgress && <> · <span style={{ color: "var(--gold-fg)" }}>you: {myProgress}{myDone ? " ✓" : ""}</span></>}
                  </div>
                </div>
                <button className="btn primary" onClick={(e) => rankIt(list, e)}>{ctaLabel}</button>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- List Stats (community view, no commitment to rank) ---------- */
function ListStatsScreen({ store, setStore, currentUser, listId, tab, showToast }) {
  const list = store.lists[listId];
  if (!list) {
    return <div className="container page"><div className="empty">List not found.</div></div>;
  }

  const allRankers = useMemo(
    () => Object.values(store.rankers).filter(r => r.listId === list.id && r.picks.length > 0),
    [store.rankers, list.id]
  );
  const myRanker = Object.values(store.rankers).find(r => r.listId === list.id && r.ownerId === currentUser.id);
  const saved = isListSaved(store, currentUser.id, list.id);

  // Synthetic "Community" ranker pooled from everyone who has picks.
  const combined = useMemo(
    () => allRankers.length ? combinedFromRankers(list.items, allRankers) : null,
    [list.items, allRankers]
  );
  const ranked = useMemo(
    () => combined ? rankItemsByElo(list.items, combined.elos) : rankItemsByElo(list.items, {}),
    [list.items, combined]
  );
  const syntheticRanker = combined ? {
    id: "community",
    listId: list.id,
    name: "Community",
    picks: combined.picks,
    elos: combined.elos,
    wins: combined.wins,
    losses: combined.losses,
    totalPairs: allPairs(list.items).length,
  } : null;

  const shareUrl = useMemo(() => shareUrlFor(list), [list]);
  const [showConfetti, setShowConfetti] = useState(false);

  function setTab(t) { navigate(`/stats/${list.id}/${t}`); }

  function rankIt() {
    if (myRanker) {
      const ready = canShowResults(list.items, myRanker.picks);
      const done = myRanker.picks.length >= myRanker.totalPairs;
      if (done) navigate(`/results/${myRanker.id}`);
      else navigate(`/rank/${myRanker.id}`);
      return;
    }
    const r = {
      id: uid("rk"),
      listId: list.id,
      ownerId: currentUser.id,
      name: currentUser.displayName || "You",
      elos: {}, wins: {}, losses: {},
      picks: [],
      totalPairs: allPairs(list.items).length,
      updatedAt: Date.now(),
    };
    setStore(s => ({
      ...s,
      rankers: { ...s.rankers, [r.id]: r },
      lastRanker: { ...s.lastRanker, [lastRankerKey(currentUser.id, list.id)]: r.id },
    }));
    navigate(`/rank/${r.id}`);
  }

  function toggleStar() {
    setStore(s => toggleSaved(s, currentUser.id, list.id));
    showToast(saved ? "Removed from Saved lists" : "Added to Saved lists");
  }

  const myProgress = myRanker
    ? `${myRanker.picks.length}/${myRanker.totalPairs}`
    : null;
  const myDone = myRanker && myRanker.picks.length >= myRanker.totalPairs;
  const ctaLabel = !myRanker ? "Rank it yourself →" : (myDone ? "See your results →" : "Resume ranking →");

  return (
    <div className="container page" data-screen-label="08 List Stats">
      <div className="page-head">
        <div className="crumb">
          <a href={list.isPublic ? "#/explore" : "#/"} style={{ textDecoration: "none" }}>← Back</a> / Stats
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button className={`star-btn ${saved ? "on" : ""}`}
                  onClick={toggleStar}
                  aria-pressed={saved}
                  aria-label={saved ? "Remove from Saved lists" : "Save to Saved lists"}
                  title={saved ? "Remove from Saved lists" : "Save to Saved lists"}>
            <StarIcon filled={saved} />
          </button>
          <h1 style={{ margin: 0 }}>{list.name}</h1>
        </div>
        <p className="lede">
          {list.ownerName ? <>by <strong>{list.ownerName}</strong> · </> : null}
          {list.items.length} items · {allRankers.length} ranker{allRankers.length === 1 ? "" : "s"}
          {myProgress && <> · <span style={{ color: "var(--gold-fg)" }}>you: {myProgress}{myDone ? " ✓" : ""}</span></>}
        </p>
      </div>

      <div className="share-card" style={{ marginBottom: 18 }}>
        <div className="share-head">
          <div>
            <div style={{ fontWeight: 500 }}>{combined ? "Community verdict so far" : "No one has weighed in yet — be the first"}</div>
            <div className="hint">
              {combined
                ? <>ELOs pooled from {allRankers.length} ranker{allRankers.length === 1 ? "" : "s"}. Your picks would add to this.</>
                : <>No one has ranked this list yet. Once you do, your scores show up here.</>}
            </div>
          </div>
          <button className="btn primary" onClick={rankIt}>{ctaLabel}</button>
        </div>
      </div>

      {combined ? (
        <>
          <div className="tabs" role="tablist">
            <button role="tab" className={`tab ${tab === "rankings" ? "active" : ""}`} onClick={() => setTab("rankings")}>Rankings</button>
            <button role="tab" className={`tab ${tab === "bracket" ? "active" : ""}`} onClick={() => setTab("bracket")}>Bracket</button>
            <button role="tab" className={`tab ${tab === "compare" ? "active" : ""}`} onClick={() => setTab("compare")}>
              Compare {allRankers.length > 0 ? <span className="mono" style={{ opacity: 0.6, marginLeft: 4 }}>({allRankers.length})</span> : null}
            </button>
          </div>

          {tab === "rankings" && <RankingsTab ranker={syntheticRanker} ranked={ranked} />}
          {tab === "bracket" && <BracketTab ranked={ranked} onChampion={() => setShowConfetti(true)} confettiShown={showConfetti} />}
          {tab === "compare" && <CompareTab list={list} myRankerId={myRanker ? myRanker.id : null} allRankers={allRankers} />}
        </>
      ) : (
        <div className="empty">No rankings yet — click <strong>Rank it yourself</strong> above to start.</div>
      )}

      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
    </div>
  );
}

/* ---------- Ranking ---------- */
function RankingScreen({ store, setStore, currentUser, rankerId, showToast }) {
  const ranker = store.rankers[rankerId];
  const list = ranker && store.lists[ranker.listId];

  // The session queue is APPEND-ONLY: pairs you've shown stay in it so undo can
  // walk back, and refills append a fresh shuffled allPairs() when the cursor
  // reaches the end. cursor = next pair index.
  const [queue, setQueue] = useState(() => buildQueue(list, ranker));
  const [cursor, setCursor] = useState(0);
  const milestoneShownRef = useRef(false);

  // Re-init when switching to a different ranker.
  useEffect(() => {
    setQueue(buildQueue(list, ranker));
    setCursor(0);
    milestoneShownRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankerId]);

  if (!list || !ranker) {
    return <div className="container page"><div className="empty">Ranker not found.</div></div>;
  }

  const totalPairs = ranker.totalPairs || allPairs(list.items).length;
  const completedPicks = ranker.picks.length;
  const inBonus = completedPicks >= totalPairs;
  const currentPair = cursor < queue.length ? queue[cursor] : null;
  const showResultsReady = canShowResults(list.items, ranker.picks);
  const minPicks = minPicksForResults(list.items);

  // Safety refill: if the queue is somehow empty (e.g. session resumed mid-flow),
  // rebuild it adaptively from current state.
  useEffect(() => {
    if (!currentPair && completedPicks > 0) {
      setQueue(q => [...q, ...adaptiveSort(allPairs(list.items), ranker.elos || {}, ranker.picks)]);
    }
  }, [currentPair, completedPicks]);

  function pick(winner, loser) {
    const newPicks = [...ranker.picks, { winner, loser }];
    const { wins, losses } = recordFromPicks(list.items, newPicks);
    const elos = computeElos(list.items, newPicks);
    setStore(s => ({
      ...s,
      rankers: {
        ...s.rankers,
        [ranker.id]: { ...s.rankers[ranker.id], picks: newPicks, wins, losses, elos, updatedAt: Date.now() },
      },
    }));
    const newCursor = cursor + 1;
    setQueue(q => {
      const shown     = q.slice(0, newCursor);       // already displayed — keep in place for undo
      const remaining = q.slice(newCursor);           // not yet shown
      if (remaining.length === 0) {
        // Bonus round: adaptively pick from all pairs using updated ELOs
        const bonus = adaptiveSort(allPairs(list.items), elos, newPicks);
        return [...shown, ...bonus];
      }
      // Re-sort the unseen tail with updated ELO knowledge
      return [...shown, ...adaptiveSort(remaining, elos, newPicks)];
    });
    setCursor(newCursor);
    if (!milestoneShownRef.current && newPicks.length === totalPairs) {
      milestoneShownRef.current = true;
      showToast("You've weighed in on every matchup! Keep going to sharpen it, or hit Done to see your verdict.");
    }
  }
  function skip() {
    if (!currentPair) return;
    setQueue(q => {
      const next = q.slice();
      const [moved] = next.splice(cursor, 1);
      next.push(moved);
      return next;
    });
  }
  function undo() {
    if (cursor === 0 || ranker.picks.length === 0) return;
    const newPicks = ranker.picks.slice(0, -1);
    const { wins, losses } = recordFromPicks(list.items, newPicks);
    const elos = computeElos(list.items, newPicks);
    setStore(s => ({
      ...s,
      rankers: {
        ...s.rankers,
        [ranker.id]: { ...s.rankers[ranker.id], picks: newPicks, wins, losses, elos, updatedAt: Date.now() },
      },
    }));
    setCursor(c => Math.max(0, c - 1));
  }

  const progressNum = inBonus ? totalPairs : completedPicks;
  const pct = Math.round((progressNum / totalPairs) * 100);
  const bonusCount = Math.max(0, completedPicks - totalPairs);

  return (
    <div className="container page rank-page" data-screen-label="03 Ranking">
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div className="crumb"><a href="#/" style={{ textDecoration: "none" }}>← Lists</a> / Ranking</div>
        <h1>{list.name}</h1>
        <p className="lede">
          {inBonus
            ? <>You&rsquo;ve seen every matchup — keep going to sharpen your ranking, or hit <strong>Done</strong> if you&rsquo;re satisfied.</>
            : <>Just go with your gut. No overthinking — if you genuinely can&rsquo;t choose, skip it and we&rsquo;ll come back.</>}
        </p>
      </div>

      <div className="progress" aria-label={`${pct}% complete`}>
        <span className="mono">
          {inBonus
            ? <>{totalPairs}/{totalPairs} <span style={{ color: "var(--gold-fg)" }}>+{bonusCount}</span></>
            : <>{completedPicks}/{totalPairs}</>}
        </span>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${Math.min(100, pct)}%` }} />
          {!inBonus && (() => {
            const thresholdPct = Math.min(98, (minPicks / totalPairs) * 100);
            return (
              <div
                className="progress-threshold"
                style={{ left: `${thresholdPct}%` }}
                title={`${minPicks} matchups minimum to unlock results`}
              >
                {!showResultsReady && (
                  <div className="progress-threshold-label">min</div>
                )}
              </div>
            );
          })()}
        </div>
        <span className="mono">{inBonus ? "100%+" : `${pct}%`}</span>
      </div>

      {!showResultsReady && (
        <div className="hint" style={{ textAlign: "center" }}>
          {minPicks - ranker.picks.length > 0
            ? <>{minPicks - ranker.picks.length} more to go before your verdict is ready.</>
            : <>Almost there — keep going to get a clear verdict.</>}
        </div>
      )}

      {currentPair ? (
        <div className="matchup-wrap">
          <button className="pick" onClick={() => pick(currentPair[0], currentPair[1])}>
            <div className="seed">Option A</div>
            <div>{currentPair[0]}</div>
          </button>
          <div className="vs">VS</div>
          <button className="pick" onClick={() => pick(currentPair[1], currentPair[0])}>
            <div className="seed">Option B</div>
            <div>{currentPair[1]}</div>
          </button>
        </div>
      ) : (
        <div className="empty">Loading more matchups…</div>
      )}

      <div className="rank-foot">
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost" onClick={() => navigate("/")} title="Save & exit">
            Save & exit
          </button>
          <button className="btn ghost sm" onClick={undo} disabled={cursor === 0 || completedPicks === 0} title="Undo last pick">
            <UndoIcon /> Undo
          </button>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {showResultsReady && (
            <button className="btn primary" onClick={() => navigate(`/results/${ranker.id}`)}>
              {inBonus ? "Done →" : "See results so far →"}
            </button>
          )}
          <button className="btn" onClick={skip} disabled={!currentPair}>Skip →</button>
        </div>
      </div>
    </div>
  );
}
function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/* ── Adaptive pair scoring ────────────────────────────────────────────
   Each candidate pair gets a priority score. Higher = shown sooner.

   Components:
   1. Uncertainty   – how close to 50/50? Peaks at 0.5 when ELOs are equal.
                      Falls as the gap widens. This ensures we compare items
                      that are genuinely competitive with each other.
   2. Undefeated    – items with 0 losses haven't been beaten yet. Matching
                      them against each other quickly settles the top tier
                      without wasting matchups on obvious mismatches.
   3. Low-exposure  – items that have appeared in fewer matchups get a small
                      boost so no item gets forgotten early on.
   4. Noise         – tiny random jitter keeps the queue from feeling robotic.
*/
function pairScore([a, b], elos, lossMap, exposureMap) {
  const eloA = elos[a] || ELO_START;
  const eloB = elos[b] || ELO_START;
  const prob  = winProb(eloA, eloB);

  // 1. Uncertainty: 0.5 when perfectly even, 0 when one side is a near-certain winner
  const uncertainty = 0.5 - Math.abs(prob - 0.5);

  // 2. Undefeated bonus
  const aLosses = lossMap[a] || 0;
  const bLosses = lossMap[b] || 0;
  const undefeatedBonus = (aLosses === 0 && bLosses === 0) ? 0.55
                        : (aLosses === 0 || bLosses === 0) ? 0.20
                        : 0;

  // 3. Low-exposure bonus (items seen in fewer matchups get slight priority)
  const minExposure = Math.min(exposureMap[a] || 0, exposureMap[b] || 0);
  const exposureBonus = Math.max(0, 0.15 - minExposure * 0.03);

  // 4. Tiny random noise to prevent identical pairs from always ranking the same
  const noise = Math.random() * 0.04;

  return uncertainty + undefeatedBonus + exposureBonus + noise;
}

function adaptiveSort(pairs, elos, picks) {
  // Build loss + exposure maps from current picks
  const lossMap     = {};
  const exposureMap = {};
  for (const p of picks) {
    lossMap[p.loser]       = (lossMap[p.loser]       || 0) + 1;
    exposureMap[p.winner]  = (exposureMap[p.winner]  || 0) + 1;
    exposureMap[p.loser]   = (exposureMap[p.loser]   || 0) + 1;
  }
  return pairs
    .map(pair => ({ pair, score: pairScore(pair, elos, lossMap, exposureMap) }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.pair);
}

function buildQueue(list, ranker) {
  if (!list || !ranker) return [];
  const seen = new Set();
  for (const p of ranker.picks) seen.add(pairKey(p.winner, p.loser));
  const remaining = allPairs(list.items).filter(([a, b]) => !seen.has(pairKey(a, b)));
  // Use adaptive sort from the start; falls back to near-random when ELOs are equal
  return adaptiveSort(remaining, ranker.elos || {}, ranker.picks);
}

/* On mobile, the matchup-wrap stacks; we still need the VS in the middle. Render order: A, VS, B. */

/* ---------- Results ---------- */
function ResultsScreen({ store, setStore, currentUser, rankerId, tab, showToast }) {
  const ranker = store.rankers[rankerId];
  const list = ranker && store.lists[ranker.listId];
  if (!ranker || !list) {
    return <div className="container page"><div className="empty">Ranker not found.</div></div>;
  }

  const ranked = useMemo(() => rankItemsByElo(list.items, ranker.elos || {}), [list.items, ranker.elos]);
  const allRankersForList = useMemo(
    () => Object.values(store.rankers).filter(r => r.listId === list.id && r.picks.length > 0),
    [store.rankers, list.id]
  );

  const totalPairs = ranker.totalPairs || allPairs(list.items).length;
  const done = ranker.picks.length >= totalPairs;
  const shareCode = useMemo(() => encodeShare(list), [list]);
  const shareUrl = useMemo(() => shareUrlFor(list), [list]);

  const [showConfetti, setShowConfetti] = useState(false);

  function setTab(t) { navigate(`/results/${rankerId}/${t}`); }
  function reRank() {
    if (!confirm("Reset your picks and rank again?")) return;
    setStore(s => ({
      ...s,
      rankers: {
        ...s.rankers,
        [ranker.id]: { ...s.rankers[ranker.id], picks: [], elos: {}, wins: {}, losses: {}, updatedAt: Date.now() },
      },
    }));
    navigate(`/rank/${ranker.id}`);
  }

  async function nativeShare() {
    const payload = {
      title: `RankEverything · ${list.name}`,
      text: `Help me rank "${list.name}" on RankEverything`,
      url: shareUrl,
    };
    if (navigator.share) {
      try { await navigator.share(payload); return; }
      catch (e) { /* user cancelled, ignore */ if (e && e.name === "AbortError") return; }
    }
    copyToClipboard(shareUrl).then(() => showToast("Link copied"));
  }

  return (
    <div className="container page" data-screen-label="04 Results">
      <div className="page-head">
        <div className="crumb"><a href="#/" style={{ textDecoration: "none" }}>← Lists</a> / Results</div>
        <h1>{list.name}</h1>
        <p className="lede">
          {done
            ? <>{ranker.picks.length} head-to-heads later, here&rsquo;s what <strong>{ranker.name}</strong> actually thinks.</>
            : <>Still deciding — {ranker.picks.length} of {totalPairs} matchups in. Keep going to get a clearer verdict.</>}
        </p>
      </div>

      <div className="share-card" style={{ marginBottom: 18 }}>
        <div className="share-head">
          <div>
            <div style={{ fontWeight: 500 }}>Share this list</div>
            <div className="hint">Friends can rank it and you&rsquo;ll see results side by side.</div>
          </div>
          <button className="btn primary" onClick={nativeShare}>
            <ShareIcon /> Share
          </button>
        </div>
        <div className="share-row">
          <span className="hint" style={{ width: 38 }}>Link</span>
          <span className="code" title={shareUrl}>{shareUrl}</span>
          <button className="btn sm" onClick={() => copyToClipboard(shareUrl).then(() => showToast("Link copied"))}>Copy</button>
        </div>
        <div className="share-row">
          <span className="hint" style={{ width: 38 }}>Code</span>
          <span className="code">{shareCode}</span>
          <button className="btn sm" onClick={() => copyToClipboard(shareCode).then(() => showToast("Code copied"))}>Copy</button>
        </div>
        {list.ownerId === currentUser.id && (
          <div className="share-row" style={{ paddingTop: 4 }}>
            <span className="hint" style={{ width: 38 }}>Privacy</span>
            <div className="seg" role="radiogroup" aria-label="Visibility" style={{ flex: 1 }}>
              <button type="button" role="radio" aria-checked={!list.isPublic}
                      className={`seg-opt ${!list.isPublic ? "on" : ""}`}
                      onClick={() => {
                        setStore(s => ({ ...s, lists: { ...s.lists, [list.id]: { ...s.lists[list.id], isPublic: false } } }));
                        showToast("List is now private");
                      }}>
                <LockIcon /> Private
              </button>
              <button type="button" role="radio" aria-checked={!!list.isPublic}
                      className={`seg-opt ${list.isPublic ? "on" : ""}`}
                      onClick={() => {
                        setStore(s => ({ ...s, lists: { ...s.lists, [list.id]: { ...s.lists[list.id], isPublic: true } } }));
                        showToast("List is now public");
                      }}>
                <GlobeIcon /> Public
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" className={`tab ${tab === "rankings" ? "active" : ""}`} onClick={() => setTab("rankings")}>Rankings</button>
        <button role="tab" className={`tab ${tab === "bracket" ? "active" : ""}`} onClick={() => setTab("bracket")}>Bracket</button>
        <button role="tab" className={`tab ${tab === "compare" ? "active" : ""}`} onClick={() => setTab("compare")}>
          Compare {allRankersForList.length > 1 ? <span className="mono" style={{ opacity: 0.6, marginLeft: 4 }}>({allRankersForList.length})</span> : null}
        </button>
      </div>

      {tab === "rankings" && <RankingsTab ranker={ranker} ranked={ranked} />}
      {tab === "bracket" && <BracketTab ranked={ranked} onChampion={() => setShowConfetti(true)} confettiShown={showConfetti} />}
      {tab === "compare" && <CompareTab list={list} myRankerId={ranker.id} allRankers={allRankersForList} />}

      <div className="row" style={{ marginTop: 24, justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <button className="btn ghost" onClick={() => navigate("/")}>Done</button>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => navigate(`/rank/${ranker.id}`)}>
            {done ? "Keep ranking →" : "Resume ranking →"}
          </button>
          <button className="btn ghost" onClick={reRank} title="Reset all picks and start fresh">↺ Rank again</button>
        </div>
      </div>

      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
    </div>
  );
}

/* ---------- Tier helpers ---------- */
const TIER_DEFS = [
  { name: "S", color: "#e0a526" },
  { name: "A", color: "#00c853" },
  { name: "B", color: "#2979ff" },
  { name: "C", color: "#9e9e9e" },
  { name: "D", color: "#ff9800" },
  { name: "F", color: "#f45531" },
];

function assignTiers(ranked) {
  if (ranked.length < 2) return ranked.map(r => ({ ...r, tier: "S" }));
  const elos = ranked.map(r => r.elo);
  const mean = elos.reduce((a, b) => a + b, 0) / elos.length;
  const std = Math.sqrt(elos.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / elos.length);
  if (std < 1) return ranked.map(r => ({ ...r, tier: "B" }));
  return ranked.map(r => {
    const z = (r.elo - mean) / std;
    if (z >= 1.5)  return { ...r, tier: "S" };
    if (z >= 0.5)  return { ...r, tier: "A" };
    if (z >= -0.5) return { ...r, tier: "B" };
    if (z >= -1.5) return { ...r, tier: "C" };
    if (z >= -2.5) return { ...r, tier: "D" };
    return { ...r, tier: "F" };
  });
}

/* ---------- Rankings tab ---------- */
function RankingsTab({ ranker, ranked }) {
  if (!ranked.length) return <div className="empty">No data yet.</div>;
  const maxElo = Math.max(...ranked.map(r => r.elo));
  const minElo = Math.min(...ranked.map(r => r.elo));
  const span = Math.max(40, maxElo - minElo);
  const tiered = assignTiers(ranked);

  let lastTier = null;
  return (
    <div className="rank-table">
      {tiered.map((r, i) => {
        const pct = ((r.elo - minElo) / span) * 100;
        const wins = (ranker.wins && ranker.wins[r.name]) || 0;
        const losses = (ranker.losses && ranker.losses[r.name]) || 0;
        const isChamp = i === 0;
        const tierDef = TIER_DEFS.find(t => t.name === r.tier);
        const showTierHeader = r.tier !== lastTier;
        lastTier = r.tier;
        return (
          <React.Fragment key={r.name}>
            {showTierHeader && (
              <div className="tier-header" style={{ "--tier-color": tierDef.color }}>
                <span className="tier-badge" style={{ background: tierDef.color }}>{r.tier}</span>
                <div className="tier-line" />
              </div>
            )}
            <div className={`rank-item ${isChamp ? "gold" : ""}`}>
              <div className="pos">
                {i < 3
                  ? <span className={`medal medal-${i + 1}`}>{i + 1}</span>
                  : <span className="mono">{i + 1}</span>}
              </div>
              <div>
                <div className="name">{r.name}</div>
                <div className="bar"><span style={{ width: `${Math.max(4, pct)}%` }} /></div>
              </div>
              <div className="record mono">{wins}W · {losses}L</div>
              <div className="elo">{Math.round(r.elo)}</div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ---------- Bracket tab ---------- */
function BracketTab({ ranked, onChampion, confettiShown }) {
  const [seed, setSeed] = useState(0);
  const firstRound = useMemo(() => buildBracket(ranked)[0] || [], [ranked]);

  // deterministic rng per seed so re-render is stable until "re-simulate"
  const rng = useMemo(() => mulberry32(seed * 9301 + 49297), [seed]);

  const rounds = useMemo(() => simulateBracket(firstRound, rng), [firstRound, rng]);
  const champion = rounds.length ? rounds[rounds.length - 1][0]?.winner : null;

  const firedRef = useRef(false);
  useEffect(() => {
    if (champion && !firedRef.current && !confettiShown) {
      firedRef.current = true;
      // small delay so they see the result first
      const t = setTimeout(() => onChampion(), 250);
      return () => clearTimeout(t);
    }
  }, [champion, confettiShown, onChampion]);

  function resim() {
    firedRef.current = false;
    setSeed(s => s + 1);
  }

  if (ranked.length < 2) return <div className="empty">Need at least 2 items to bracket.</div>;

  const roundNames = roundLabels(rounds.length);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="hint">Seeded by ELO. Win probabilities and outcomes are simulated — upsets happen.</div>
        <button className="btn sm" onClick={resim}>↻ Re-simulate</button>
      </div>

      <div className="bracket-wrap">
        <div className="bracket-scroll">
          {rounds.map((matches, ri) => (
            <div key={ri} className="bracket-col">
              <div className="col-title">{roundNames[ri]}</div>
              {matches.map((m, mi) => <MatchCell key={mi} m={m} isFinal={ri === rounds.length - 1} />)}
            </div>
          ))}
        </div>
      </div>

      {champion && (
        <div className="champ-card">
          <div className="crown">Champion</div>
          <div className="who">{champion.name}</div>
        </div>
      )}
    </>
  );
}

function MatchCell({ m, isFinal }) {
  const aWon = m.winner && m.a && m.winner.name === m.a.name;
  const bWon = m.winner && m.b && m.winner.name === m.b.name;
  const probA = m.prob != null ? Math.round(m.prob * 100) : null;
  const probB = m.prob != null ? 100 - probA : null;
  const championCls = isFinal && m.winner ? "champ" : "";
  return (
    <div className="match">
      <div className={`slot ${!m.a ? "bye" : ""} ${aWon ? (isFinal ? "champ" : "win") : (bWon ? "lose" : "")}`}>
        <span className="sd">{m.a ? `#${m.a.seed}` : ""}</span>
        <span className="nm">{m.a ? m.a.name : "— bye —"}</span>
        <span className="prob">{probA != null && m.a && m.b ? `${probA}%` : ""}</span>
      </div>
      <div className={`slot ${!m.b ? "bye" : ""} ${bWon ? (isFinal ? "champ" : "win") : (aWon ? "lose" : "")}`}>
        <span className="sd">{m.b ? `#${m.b.seed}` : ""}</span>
        <span className="nm">{m.b ? m.b.name : "— bye —"}</span>
        <span className="prob">{probB != null && m.a && m.b ? `${probB}%` : ""}</span>
      </div>
    </div>
  );
}

function roundLabels(count) {
  // last is "Final", second-to-last is "Semifinal", before "Quarterfinal", "Round of 16", etc.
  const names = [];
  for (let i = 0; i < count; i++) {
    const fromEnd = count - 1 - i;
    if (fromEnd === 0) names.push("Final");
    else if (fromEnd === 1) names.push("Semifinal");
    else if (fromEnd === 2) names.push("Quarterfinal");
    else names.push(`Round of ${Math.pow(2, fromEnd + 1)}`);
  }
  return names;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Compare tab ---------- */
function CompareTab({ list, myRankerId, allRankers }) {
  // selection state for combining — defaults to all rankers selected
  const [selected, setSelected] = useState(() => new Set(allRankers.map(r => r.id)));

  // Keep selection in sync if rankers come and go
  useEffect(() => {
    setSelected(prev => {
      const next = new Set();
      for (const r of allRankers) if (prev.has(r.id)) next.add(r.id);
      // If selection became empty (e.g. all rankers were new), seed with all
      if (next.size === 0) for (const r of allRankers) next.add(r.id);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRankers.map(r => r.id).join(",")]);

  if (allRankers.length < 2) {
    return (
      <div className="empty">
        Only one person has ranked this list so far. Share the code at the top with a friend to compare side by side.
      </div>
    );
  }

  // Sort columns: me first, then by updatedAt desc
  const sorted = allRankers.slice().sort((a, b) => {
    if (a.id === myRankerId) return -1;
    if (b.id === myRankerId) return 1;
    return b.updatedAt - a.updatedAt;
  });

  const me = sorted.find(r => r.id === myRankerId) || sorted[0];
  const myRanked = rankItemsByElo(list.items, me.elos || {});
  const myPos = {};
  myRanked.forEach((r, i) => { myPos[r.name] = i; });

  // Combined ranker (synthetic) from currently-selected rankers
  const selectedRankers = sorted.filter(r => selected.has(r.id));
  const showCombined = selectedRankers.length >= 2;
  const combined = useMemo(
    () => showCombined ? combinedFromRankers(list.items, selectedRankers) : null,
    [list.items, selected, allRankers]
  );

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAll() { setSelected(new Set(allRankers.map(r => r.id))); }
  function selectOnlyMe() { setSelected(new Set([myRankerId])); }

  const combinedLabel = selectedRankers.map(r => r.id === myRankerId ? "you" : r.name).join(" + ");
  const combinedTotalPicks = selectedRankers.reduce((n, r) => n + r.picks.length, 0);

  // The combined column drives diff highlighting when shown; otherwise fall back to "me"
  const referenceRanked = combined
    ? rankItemsByElo(list.items, combined.elos)
    : myRanked;
  const refPos = {};
  referenceRanked.forEach((r, i) => { refPos[r.name] = i; });

  return (
    <>
      <div className="combine-bar" role="group" aria-label="Combine rankings">
        <div className="combine-label">Combine ELOs from:</div>
        <div className="combine-chips">
          {sorted.map(r => {
            const on = selected.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                className={`chip ${on ? "on" : ""}`}
                onClick={() => toggle(r.id)}
                aria-pressed={on}
              >
                <span className="chip-check" aria-hidden="true">{on ? "✓" : ""}</span>
                {r.id === myRankerId ? "You" : r.name}
              </button>
            );
          })}
        </div>
        <div className="combine-actions">
          <button type="button" className="btn sm ghost" onClick={selectAll}>All</button>
          <button type="button" className="btn sm ghost" onClick={selectOnlyMe}>Just me</button>
        </div>
      </div>
      <div className="hint" style={{ margin: "0 0 12px" }}>
        {showCombined
          ? <>Combined column pools {combinedTotalPicks} matchup{combinedTotalPicks === 1 ? "" : "s"} from <strong>{combinedLabel}</strong> and re-runs the ELO. Rows shaded green/red show where each person diverges from the combined consensus by 3+ positions.</>
          : <>Pick 2+ people above to generate a pooled "Combined" ranking. Right now, divergence is measured against your own ranking.</>
        }
      </div>

      <div className="compare-grid">
        {showCombined && (
          <div className="compare-col combined-col">
            <div className="head">
              <div className="nm">Combined</div>
              <div className="sub">{combinedLabel} · {combinedTotalPicks} matchups pooled</div>
            </div>
            <ol>
              {referenceRanked.map((item, i) => (
                <li key={item.name}>
                  <span className="p">{i + 1}</span>
                  <span className="nm">{item.name}</span>
                  <span className="e">{Math.round(item.elo)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {sorted.map(r => {
          const ranked = rankItemsByElo(list.items, r.elos || {});
          const isMuted = !selected.has(r.id);
          return (
            <div key={r.id} className={`compare-col ${isMuted ? "muted" : ""}`}>
              <div className="head">
                <div className="nm">
                  {r.name}{r.id === myRankerId ? " (you)" : ""}
                  {isMuted && <span className="hint" style={{ marginLeft: 6 }}>excluded</span>}
                </div>
                <div className="sub">{r.picks.length} matchups · {formatRelTime(r.updatedAt)}</div>
              </div>
              <ol>
                {ranked.map((item, i) => {
                  let diffClass = "";
                  // Compare each ranker to the reference (combined if shown, else "me")
                  const refIdx = refPos[item.name];
                  if (refIdx != null && r.id !== (combined ? null : me.id)) {
                    const delta = refIdx - i; // negative: this ranker rated it higher than the reference
                    if (Math.abs(delta) >= 3) diffClass = delta < 0 ? "diff-up" : "diff-down";
                  }
                  return (
                    <li key={item.name} className={diffClass}>
                      <span className="p">{i + 1}</span>
                      <span className="nm">{item.name}</span>
                      <span className="e">{Math.round(item.elo)}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Confetti ---------- */
function Confetti({ onDone }) {
  const pieces = useMemo(() => {
    const colors = ["#854F0B", "#F4D08A", "#378ADD", "#3B6D11", "#EAF3DE", "#FAEEDA", "#111111"];
    return Array.from({ length: 80 }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      dur: 1.6 + Math.random() * 1.4,
      color: colors[i % colors.length],
      rot: Math.random() * 360,
      drift: (Math.random() - 0.5) * 80,
    }));
  }, []);
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map(p => (
        <i key={p.key} style={{
          left: `${p.left}%`,
          background: p.color,
          animationDuration: `${p.dur}s`,
          animationDelay: `${p.delay}s`,
          transform: `rotate(${p.rot}deg) translateX(${p.drift}px)`,
        }} />
      ))}
    </div>
  );
}

/* ---------- Tiny icons (stroke-only, no AI-slop SVGs) ---------- */
function Plus() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7 2v10M2 7h10"/></svg>;
}
function Link2() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6.5 9.5l3-3M5 8L3.5 9.5a2.5 2.5 0 003.5 3.5L8.5 11.5M11 8l1.5-1.5a2.5 2.5 0 00-3.5-3.5L7.5 4.5"/></svg>;
}
function Trash() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.5 9h6l.5-9M7 6.5v5M9 6.5v5"/></svg>;
}
function Sun() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M3.3 12.7l1.1-1.1M11.6 4.4l1.1-1.1"/></svg>;
}
function Moon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 9.5A5.5 5.5 0 116.5 2.5a4.5 4.5 0 007 7z"/></svg>;
}
function MapPin() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 14s-5-4.5-5-8a5 5 0 0110 0c0 3.5-5 8-5 8z"/><circle cx="8" cy="6" r="1.6"/></svg>;
}
function ShareIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8.5M5.5 4.5L8 2l2.5 2.5M3 9v3a1 1 0 001 1h8a1 1 0 001-1V9"/></svg>;
}
function LockIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="7" width="9" height="6.5" rx="1.2"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>;
}
function GlobeIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5c1.6 1.6 2.5 3.5 2.5 5.5s-.9 3.9-2.5 5.5M8 2.5C6.4 4.1 5.5 6 5.5 8s.9 3.9 2.5 5.5"/></svg>;
}
function Compass() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><path d="M10.5 5.5L9 9l-3.5 1.5L7 7z"/></svg>;
}
function UndoIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5L2.5 7.5 5 10M2.5 7.5h7.5a3.5 3.5 0 010 7H8"/></svg>;
}
function StarIcon({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
      <path d="M8 2l1.85 3.95 4.15.55-3 3 .8 4.2L8 11.8 4.2 13.7 5 9.5l-3-3 4.15-.55L8 2z"/>
    </svg>
  );
}

Object.assign(window, {
  HomeScreen, CreateScreen, JoinScreen, RankingScreen, ResultsScreen, ExploreScreen, SavedScreen, ListStatsScreen,
  Toast, Sun, Moon, Compass, StarIcon,
});
