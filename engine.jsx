/* ELO Ranker — engine
   Storage, ELO logic, share codes, bracket sim, route parsing.
   Exposed on window for cross-file <script> access. */

const STORAGE_KEY = "elo-ranker-v1";

const DEFAULT_STATE = {
  users: {},     // id -> { id, email, displayName, pwdHash, createdAt, isGuest }
  currentUserId: null,
  lists: {},     // id -> { id, name, items, createdAt, ownerId, ownerName, isPublic }
  rankers: {},   // id -> { id, listId, name, ownerId, elos, wins, losses, picks, totalPairs, updatedAt }
  lastRanker: {},// `${ownerId}:${listId}` -> rankerId
  savedLists: {},// userId -> [listId]
  theme: "light",
  seededFor: {}, // userId -> true (only seed demo once per user)
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch (e) {
    return { ...DEFAULT_STATE };
  }
}
function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

/* ---------- IDs ---------- */
function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

/* ---------- Auth (local-only, prototype) ----------
   Note: passwords are hashed with a simple, non-cryptographic digest because
   this is a static prototype with no server. Do not reuse a real password here. */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}
function hashPassword(pwd, salt) {
  return djb2(`${salt}:${pwd}:${salt}`);
}
function normalizeEmail(e) {
  return String(e || "").trim().toLowerCase();
}
function findUserByEmail(state, email) {
  const e = normalizeEmail(email);
  if (!e) return null;
  return Object.values(state.users).find(u => u.email === e) || null;
}
function createUser(state, { email, password, displayName }) {
  const e = normalizeEmail(email);
  if (!e) throw new Error("Email required");
  if (findUserByEmail(state, e)) throw new Error("An account with that email already exists.");
  if (!password || password.length < 4) throw new Error("Password must be at least 4 characters.");
  const id = uid("usr");
  const salt = id;
  const user = {
    id,
    email: e,
    displayName: (displayName || e.split("@")[0]).trim(),
    pwdHash: hashPassword(password, salt),
    pwdSalt: salt,
    isGuest: false,
    createdAt: Date.now(),
  };
  return user;
}
function verifyPassword(user, password) {
  if (!user) return false;
  return user.pwdHash === hashPassword(password, user.pwdSalt || user.id);
}
function createGuest() {
  const id = uid("gst");
  return {
    id,
    email: "",
    displayName: "Guest",
    pwdHash: "",
    pwdSalt: id,
    isGuest: true,
    createdAt: Date.now(),
  };
}

/* ---------- Share codes ---------- */
// base64url-encoded JSON { listId, listName }
function encodeShare(list) {
  const payload = JSON.stringify({ listId: list.id, listName: list.name });
  const b64 = btoa(unescape(encodeURIComponent(payload)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeShare(code) {
  try {
    let s = code.trim().replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const json = decodeURIComponent(escape(atob(s)));
    const parsed = JSON.parse(json);
    if (!parsed.listId) return null;
    return parsed;
  } catch (e) { return null; }
}

// Build a full URL that opens the join screen with this list pre-loaded.
function shareUrlFor(list) {
  const code = encodeShare(list);
  const base = window.location.origin + window.location.pathname;
  return `${base}#/join/${code}`;
}

/* ---------- Pairs ---------- */
function allPairs(items) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      out.push([items[i], items[j]]);
    }
  }
  return out;
}
function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- ELO ---------- */
const ELO_START = 1200;
const K = 32;

// Compute ELOs from a history of picks via 10 iterative passes.
// picks: [{ winner, loser }]  (skipped pairs are not included)
function computeElos(items, picks) {
  const elos = {};
  items.forEach(it => { elos[it] = ELO_START; });
  if (!picks.length) return elos;
  for (let pass = 0; pass < 10; pass++) {
    // reset each pass — iterative re-application of all results
    items.forEach(it => { elos[it] = ELO_START; });
    for (const p of picks) {
      if (elos[p.winner] === undefined || elos[p.loser] === undefined) continue;
      const Ew = 1 / (1 + Math.pow(10, (elos[p.loser] - elos[p.winner]) / 400));
      const El = 1 / (1 + Math.pow(10, (elos[p.winner] - elos[p.loser]) / 400));
      elos[p.winner] = elos[p.winner] + K * (1 - Ew);
      elos[p.loser]  = elos[p.loser]  + K * (0 - El);
    }
  }
  return elos;
}

function winProb(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

function recordFromPicks(items, picks) {
  const wins = {}, losses = {};
  items.forEach(it => { wins[it] = 0; losses[it] = 0; });
  for (const p of picks) {
    if (wins[p.winner] !== undefined) wins[p.winner]++;
    if (losses[p.loser] !== undefined) losses[p.loser]++;
  }
  return { wins, losses };
}

/* ---------- Bracket ---------- */
// Build a single-elim bracket seeded #1 vs last, #2 vs second-to-last, etc.
// Pads to next power of 2 with byes.
// Returns an array of rounds: each round = array of matches { a, b, seedA, seedB }
function buildBracket(rankedItems) {
  const n = rankedItems.length;
  if (n < 2) return [];
  let size = 1; while (size < n) size *= 2;
  // Seeds 1..size, with byes as null
  const seeds = [];
  for (let i = 0; i < size; i++) {
    seeds.push(i < n ? { name: rankedItems[i].name, elo: rankedItems[i].elo, seed: i + 1 } : null);
  }
  // Standard pairing: 1 vs size, 2 vs size-1 — but in bracket order so winners meet correctly.
  // Use the classic bracket interleaving so the top half can only meet the bottom half in the final.
  const bracketOrder = makeBracketOrder(size); // array of seed numbers (1-based) ordered
  const firstRound = [];
  for (let i = 0; i < size; i += 2) {
    const sA = bracketOrder[i];
    const sB = bracketOrder[i + 1];
    firstRound.push({
      a: seeds[sA - 1],
      b: seeds[sB - 1],
    });
  }
  return [firstRound];
}

// Returns an array of length `size` of seed numbers in bracket order.
// e.g. size 8 -> [1,8,4,5,3,6,2,7]
function makeBracketOrder(size) {
  let order = [1, 2];
  while (order.length < size) {
    const next = [];
    const sum = order.length * 2 + 1;
    for (const s of order) {
      next.push(s);
      next.push(sum - s);
    }
    order = next;
  }
  return order;
}

// Simulate the rest of the bracket given the first round.
// Returns rounds[]: each round is matches[]. Each match has { a, b, winner, prob } where
// prob is the win probability of a (the higher entry) over b. Byes auto-advance.
function simulateBracket(firstRound, rng = Math.random) {
  const rounds = [];
  let current = firstRound.map(m => simulateMatch(m.a, m.b, rng));
  rounds.push(current);
  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i].winner;
      const b = current[i + 1].winner;
      next.push(simulateMatch(a, b, rng));
    }
    rounds.push(next);
    current = next;
  }
  return rounds;
}

function simulateMatch(a, b, rng) {
  if (!a && !b) return { a: null, b: null, winner: null, prob: null, bye: true };
  if (!a) return { a, b, winner: b, prob: null, bye: true };
  if (!b) return { a, b, winner: a, prob: null, bye: true };
  const pA = winProb(a.elo, b.elo);
  const winner = rng() < pA ? a : b;
  return { a, b, winner, prob: pA, bye: false };
}

/* ---------- Route ---------- */
function parseRoute() {
  const h = window.location.hash || "#/";
  const path = h.replace(/^#/, "");
  // formats: /, /auth, /create, /join, /list/:id, /rank/:rankerId, /results/:rankerId, /view/:code
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "home" };
  if (parts[0] === "auth") return { name: "auth", mode: parts[1] || "signin" };
  if (parts[0] === "create") return { name: "create" };
  if (parts[0] === "explore") return { name: "explore", filter: parts[1] || "all" };
  if (parts[0] === "saved") return { name: "saved" };
  if (parts[0] === "stats" && parts[1]) return { name: "stats", listId: parts[1], tab: parts[2] || "rankings" };
  if (parts[0] === "join") return { name: "join", code: parts[1] || "" };
  if (parts[0] === "view" && parts[1]) return { name: "view", code: parts[1] };
  if (parts[0] === "rank" && parts[1]) return { name: "rank", rankerId: parts[1] };
  if (parts[0] === "results" && parts[1]) return { name: "results", rankerId: parts[1], tab: parts[2] || "rankings" };
  return { name: "home" };
}
function navigate(path) {
  window.location.hash = path.startsWith("#") ? path : "#" + path;
}

/* ---------- Demo seed (only once per user) ---------- */
function seedForUser(state, userId) {
  if (!userId) return state;
  if (state.seededFor && state.seededFor[userId]) return state;

  // 1) The user's own private starter list
  const ownListId = uid("lst");
  const ownList = {
    id: ownListId,
    name: "Pizza toppings",
    items: ["Pepperoni", "Mushroom", "Olives", "Pineapple", "Sausage", "Basil", "Anchovy", "Bell pepper"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    ownerId: userId,
    ownerName: "you",
    isPublic: false,
  };
  state = { ...state, lists: { ...state.lists, [ownListId]: ownList } };

  function fakeRanker(listId, items, displayName, prefOrder, hoursAgo, ownerId = null) {
    const id = uid("rk");
    const picks = simulatedPicksFor(items, prefOrder);
    const elos = computeElos(items, picks);
    const rec = recordFromPicks(items, picks);
    return {
      id, listId, name: displayName,
      ownerId,
      friendOf: ownerId ? null : userId,
      elos, wins: rec.wins, losses: rec.losses,
      picks,
      totalPairs: allPairs(items).length,
      updatedAt: Date.now() - 1000 * 60 * 60 * hoursAgo,
    };
  }

  const sam = fakeRanker(ownListId, ownList.items, "Sam",
    ["Pepperoni", "Sausage", "Basil", "Mushroom", "Bell pepper", "Olives", "Pineapple", "Anchovy"], 18);
  const pat = fakeRanker(ownListId, ownList.items, "Pat",
    ["Basil", "Mushroom", "Bell pepper", "Olives", "Anchovy", "Pepperoni", "Sausage", "Pineapple"], 5);

  // 2) Public community lists — shared across users on this device.
  // Already seeded? Don't duplicate.
  const hasCommunity = Object.values(state.lists).some(l => l.isPublic && l.ownerName === "Community");
  let communityRankers = {};
  let communityLists = {};

  if (!hasCommunity) {
    const presets = [
      {
        name: "Pixar movies",
        items: ["Toy Story", "Up", "Ratatouille", "WALL·E", "The Incredibles", "Finding Nemo", "Coco", "Inside Out", "Monsters Inc.", "Soul"],
        rankers: [
          { name: "Maya",  order: ["WALL·E", "Up", "Ratatouille", "Inside Out", "Coco", "Toy Story", "The Incredibles", "Finding Nemo", "Soul", "Monsters Inc."] },
          { name: "Jules", order: ["The Incredibles", "Toy Story", "Finding Nemo", "Monsters Inc.", "Up", "Ratatouille", "Inside Out", "WALL·E", "Coco", "Soul"] },
          { name: "Theo",  order: ["Coco", "Soul", "Inside Out", "Up", "Ratatouille", "WALL·E", "Toy Story", "Finding Nemo", "The Incredibles", "Monsters Inc."] },
        ],
        hoursAgo: 36,
      },
      {
        name: "Coffee orders",
        items: ["Espresso", "Flat white", "Cappuccino", "Cortado", "Latte", "Pour-over", "Cold brew", "Iced latte"],
        rankers: [
          { name: "Avery", order: ["Flat white", "Cortado", "Cappuccino", "Espresso", "Pour-over", "Latte", "Iced latte", "Cold brew"] },
          { name: "Robin", order: ["Iced latte", "Cold brew", "Latte", "Cappuccino", "Flat white", "Cortado", "Espresso", "Pour-over"] },
        ],
        hoursAgo: 12,
      },
      {
        name: "Breakfast foods",
        items: ["Pancakes", "Bacon", "Avocado toast", "Cereal", "Bagels", "Croissant", "Oatmeal", "Eggs benedict", "Fruit bowl", "Yogurt"],
        rankers: [
          { name: "Nico", order: ["Eggs benedict", "Croissant", "Pancakes", "Bacon", "Bagels", "Avocado toast", "Yogurt", "Oatmeal", "Fruit bowl", "Cereal"] },
          { name: "Lin",  order: ["Avocado toast", "Yogurt", "Fruit bowl", "Oatmeal", "Eggs benedict", "Croissant", "Pancakes", "Bagels", "Cereal", "Bacon"] },
          { name: "Kit",  order: ["Pancakes", "Bacon", "Eggs benedict", "Bagels", "Croissant", "Cereal", "Avocado toast", "Yogurt", "Oatmeal", "Fruit bowl"] },
          { name: "Sora", order: ["Croissant", "Pancakes", "Eggs benedict", "Bagels", "Avocado toast", "Yogurt", "Bacon", "Fruit bowl", "Oatmeal", "Cereal"] },
        ],
        hoursAgo: 4,
      },
      {
        name: "Beach activities",
        items: ["Swim", "Read a book", "Beach volleyball", "Build a sandcastle", "Surf", "Frisbee", "Snorkel", "Just nap"],
        rankers: [
          { name: "Em",   order: ["Snorkel", "Swim", "Read a book", "Just nap", "Build a sandcastle", "Frisbee", "Surf", "Beach volleyball"] },
          { name: "Tomi", order: ["Surf", "Swim", "Beach volleyball", "Frisbee", "Snorkel", "Build a sandcastle", "Read a book", "Just nap"] },
        ],
        hoursAgo: 60,
      },
    ];

    for (const p of presets) {
      const lid = uid("lst");
      communityLists[lid] = {
        id: lid,
        name: p.name,
        items: p.items,
        createdAt: Date.now() - 1000 * 60 * 60 * p.hoursAgo,
        ownerId: null,
        ownerName: "Community",
        isPublic: true,
      };
      for (let i = 0; i < p.rankers.length; i++) {
        const r = p.rankers[i];
        const ranker = fakeRanker(lid, p.items, r.name, r.order, Math.max(1, p.hoursAgo - i * 2));
        communityRankers[ranker.id] = ranker;
      }
    }
  }

  state = {
    ...state,
    rankers: { ...state.rankers, [sam.id]: sam, [pat.id]: pat, ...communityRankers },
    lists: { ...state.lists, ...communityLists },
    seededFor: { ...(state.seededFor || {}), [userId]: true },
  };
  return state;
}

function lastRankerKey(userId, listId) { return `${userId}:${listId}`; }

// For demo: generate full picks consistent with a preference ranking.
function simulatedPicksFor(items, preferredOrder) {
  const rank = {};
  preferredOrder.forEach((n, i) => { rank[n] = i; });
  const picks = [];
  for (const [a, b] of allPairs(items)) {
    const winner = rank[a] < rank[b] ? a : b;
    const loser = winner === a ? b : a;
    picks.push({ winner, loser });
  }
  return shuffle(picks);
}

/* ---------- Helpers ---------- */
function rankItemsByElo(items, elos) {
  return items
    .map(name => ({ name, elo: elos[name] ?? ELO_START }))
    .sort((x, y) => y.elo - x.elo);
}

/* ---------- Saved (favorites) ---------- */
function isListSaved(state, userId, listId) {
  const arr = state.savedLists && state.savedLists[userId];
  return Array.isArray(arr) && arr.indexOf(listId) !== -1;
}
function toggleSaved(state, userId, listId) {
  const current = (state.savedLists && state.savedLists[userId]) || [];
  const has = current.indexOf(listId) !== -1;
  const next = has ? current.filter(x => x !== listId) : [...current, listId];
  return { ...state, savedLists: { ...(state.savedLists || {}), [userId]: next } };
}
function savedListIds(state, userId) {
  return (state.savedLists && state.savedLists[userId]) || [];
}

/* ---------- Minimum to show meaningful results ----------
   Every item must have been in at least one matchup, so every ELO has moved
   off the 1200 default. That's enough to produce a useful ranking. */
function canShowResults(items, picks) {
  if (!picks || picks.length === 0) return false;
  const seen = new Set();
  for (const p of picks) { seen.add(p.winner); seen.add(p.loser); }
  for (const it of items) { if (!seen.has(it)) return false; }
  return true;
}
function minPicksForResults(items) {
  // ceil(n/2): tightest possible if every pick adds two fresh items.
  return Math.ceil((items.length || 0) / 2);
}

/* ---------- Combine: pool picks from multiple rankers ---------- */
function combinedFromRankers(items, rankers) {
  const picks = [];
  for (const r of rankers) {
    for (const p of (r.picks || [])) picks.push(p);
  }
  const elos = computeElos(items, picks);
  const { wins, losses } = recordFromPicks(items, picks);
  return { elos, wins, losses, picks };
}

/* ---------- Google Maps KML import ---------- */
// Parse a KML string and return an array of place names.
// Handles common Google Maps export formats: Placemark > name.
function parseKML(text) {
  if (!text) return [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) return [];
    const placemarks = Array.from(doc.getElementsByTagName("Placemark"));
    const names = [];
    for (const pm of placemarks) {
      // Skip Folder/Document level — we want leaf Placemarks
      const nameEl = pm.getElementsByTagName("name")[0];
      const raw = nameEl ? (nameEl.textContent || "").trim() : "";
      if (raw) names.push(raw);
    }
    // De-dupe in order
    const seen = new Set();
    return names.filter(n => { if (seen.has(n)) return false; seen.add(n); return true; });
  } catch (e) {
    return [];
  }
}

// Try to detect a list name from KML <Document><name> or <Folder><name>
function parseKMLListName(text) {
  if (!text) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "application/xml");
    const docEl = doc.getElementsByTagName("Document")[0] || doc.getElementsByTagName("Folder")[0];
    if (!docEl) return "";
    const nameEl = Array.from(docEl.children).find(c => c.tagName === "name");
    return nameEl ? (nameEl.textContent || "").trim() : "";
  } catch (e) {
    return "";
  }
}

// Parse a Google Takeout JSON ("Saved.json" / GeoJSON) and return names.
function parseGeoJSON(text) {
  try {
    const data = JSON.parse(text);
    const names = [];
    // Google Takeout "Saved Places.json" is GeoJSON: { features: [{ properties: { 'Google Maps URL': ..., Title: ..., Location: { 'Business Name': ... }}}] }
    if (data && Array.isArray(data.features)) {
      for (const f of data.features) {
        const p = f && f.properties;
        if (!p) continue;
        const name =
          (p.Location && (p.Location["Business Name"] || p.Location.Address)) ||
          p.Title || p.title || p.name;
        if (name) names.push(String(name).trim());
      }
    } else if (Array.isArray(data)) {
      for (const x of data) {
        const name = (x && (x.name || x.title)) || null;
        if (name) names.push(String(name).trim());
      }
    }
    const seen = new Set();
    return names.filter(n => { if (seen.has(n)) return false; seen.add(n); return true; });
  } catch (e) {
    return [];
  }
}
function formatRelTime(ms) {
  const d = Date.now() - ms;
  const s = Math.floor(d / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const days = Math.floor(h / 24);
  if (days < 7) return days + "d ago";
  return new Date(ms).toLocaleDateString();
}

/* expose */
Object.assign(window, {
  STORAGE_KEY, DEFAULT_STATE, loadState, saveState,
  uid, encodeShare, decodeShare, shareUrlFor,
  allPairs, shuffle,
  ELO_START, K, computeElos, winProb, recordFromPicks,
  buildBracket, simulateBracket, makeBracketOrder,
  parseRoute, navigate,
  seedForUser, lastRankerKey, rankItemsByElo, formatRelTime,
  combinedFromRankers, parseKML, parseKMLListName, parseGeoJSON,
  hashPassword, findUserByEmail, createUser, verifyPassword, createGuest, normalizeEmail,
  isListSaved, toggleSaved, savedListIds, canShowResults, minPicksForResults,
});
