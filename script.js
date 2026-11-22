/* ==========================================================
   MindMetrics: js/script.js
   Front-end only (no backend). Shared by every page; each feature
   starts only if its elements exist on the current page.
   Data (accounts, check-ins, deadlines, favourites, messages) lives in
   this browser's localStorage. The login is a demo, not real security.
   Written in ES6+: const/let, arrow functions, template literals,
   destructuring, spread, optional chaining, array methods, async/await.
   ========================================================== */

/* ---------- Page info ---------- */
const PAGE = document.body.dataset.page || "home";
const PROTECTED_PAGES = ["dashboard", "timer", "checkin"];
const NEXT_WHITELIST = ["dashboard.html", "timer.html", "checkin.html", "tips.html"];
const SESSION_KEY = "mm_session";

/* ---------- Small helpers ---------- */
const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const pad = (n) => String(n).padStart(2, "0");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const loadJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};
const saveJSON = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
};
const removeKey = (key) => {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
};

/* Tiny DOM builder: el("li", { class: "x", text: "hi", on: { click: fn } }, child1, child2) */
const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  const { class: cls, text, dataset, attrs, on, ...rest } = props;
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  if (dataset) Object.assign(node.dataset, dataset);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (on) Object.entries(on).forEach(([evt, fn]) => node.addEventListener(evt, fn));
  Object.assign(node, rest);
  children.flat().forEach((c) => {
    if (c === null || c === undefined || c === false) return;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  });
  return node;
};

/* ---------- Dates ---------- */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7)); // Monday start
const shortDate = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

/* ============================================================
   TOASTS (notification system)
   ============================================================ */
const toast = (message, type = "success") => {
  let root = $("toast-root");
  if (!root) {
    root = el("div", { class: "toast-root", id: "toast-root", attrs: { "aria-live": "polite", role: "status" } });
    document.body.append(root);
  }
  const icon = { success: "✓", error: "!", info: "i" }[type] ?? "i";
  const node = el("div", { class: `toast ${type}` }, el("span", { class: "toast-icon", text: icon }), el("span", { text: message }));
  root.append(node);
  requestAnimationFrame(() => node.classList.add("show"));
  setTimeout(() => {
    node.classList.remove("show");
    setTimeout(() => node.remove(), 350);
  }, 3600);
};

/* ============================================================
   AUTH (front-end demo)
   ============================================================ */
const getSession = () => loadJSON(SESSION_KEY, null);
const userKey = (name) => `mm_u_${getSession()?.email ?? "guest"}_${name}`;

/* Protected pages send visitors to the login page and remember where they were going */
if (PROTECTED_PAGES.includes(PAGE) && !getSession()) {
  window.location.replace(`login.html?next=${encodeURIComponent(`${PAGE}.html`)}`);
}

const hashPassword = async (pw, salt) => {
  const text = `${salt}:${pw}`;
  if (window.crypto?.subtle && window.TextEncoder) {
    const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 5381; // fallback for very old browsers
  for (const ch of text) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return `x${(h >>> 0).toString(16)}`;
};

const initials = (name) => {
  const parts = name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (parts[0][0] + last).toUpperCase();
};

const logout = () => {
  removeKey(SESSION_KEY);
  window.location.replace("index.html");
};

const nextTarget = () => {
  const next = new URLSearchParams(window.location.search).get("next");
  return NEXT_WHITELIST.includes(next) ? next : "dashboard.html";
};

/* Header: avatar + log out when signed in, Log in / Sign up when not. Also toggles guest/auth-only blocks. */
const renderUserArea = () => {
  const session = getSession();
  $$("[data-auth-only]").forEach((n) => { n.hidden = !session; });
  $$("[data-guest-only]").forEach((n) => { n.hidden = !!session; });

  const area = $("user-area");
  if (!area) return;
  area.replaceChildren();
  if (session) {
    area.append(
      el("div", { class: "avatar", text: initials(session.name), title: `${session.name} (${session.email})` }),
      el("span", { class: "user-name", text: session.name.split(" ")[0] }),
      el("button", { type: "button", class: "btn small white", text: "Log out", on: { click: logout } })
    );
  } else if (PAGE !== "login") {
    area.append(
      el("a", { class: "btn small white", href: "login.html", text: "Log in" }),
      el("a", { class: "btn small sun", href: "login.html#signup", text: "Sign up" })
    );
  }
};

const initAuthForms = () => {
  const loginForm = $("login-form");
  if (!loginForm) return;
  if (getSession()) { window.location.replace(nextTarget()); return; }

  const signupForm = $("signup-form");
  const errBox = $("auth-error");
  const showError = (msg) => { errBox.textContent = msg; errBox.hidden = !msg; };
  $$(".tab-btn").forEach((b) => b.addEventListener("click", () => showError("")));

  loginForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    showError("");
    const email = $("login-email").value.trim().toLowerCase();
    const pw = $("login-password").value;
    const user = loadJSON("mm_users", {})[email];
    if (!user) return showError("No account found for that email. Open the Sign up tab to create one.");
    if ((await hashPassword(pw, user.salt)) !== user.hash) return showError("Incorrect password. Check it and try again.");
    removeKey("mm_new_user");
    saveJSON(SESSION_KEY, { email, name: user.name });
    window.location.replace(nextTarget());
  });

  signupForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    showError("");
    const name = $("signup-name").value.trim();
    const email = $("signup-email").value.trim().toLowerCase();
    const pw = $("signup-password").value;
    const pw2 = $("signup-confirm").value;
    const users = loadJSON("mm_users", {});

    if (name.length < 2) return showError("Enter your name (at least 2 characters).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError("Enter a valid email address, like name@example.com.");
    if (pw.length < 6) return showError("Use a password with at least 6 characters.");
    if (pw !== pw2) return showError("The two passwords do not match.");
    if (users[email]) return showError("An account with this email already exists. Open the Log in tab instead.");

    const salt = uid();
    users[email] = { name, salt, hash: await hashPassword(pw, salt) };
    saveJSON("mm_users", users);
    saveJSON("mm_new_user", email); // dashboard says "Welcome", later visits say "Welcome back"
    saveJSON(SESSION_KEY, { email, name });
    window.location.replace(nextTarget());
  });
};

/* ============================================================
   NAVIGATION + TABS
   ============================================================ */
const initNav = () => {
  const header = document.querySelector(".site-header");
  const toggle = $("nav-toggle");
  if (!header || !toggle) return;
  const setOpen = (open) => {
    header.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => setOpen(!header.classList.contains("open")));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  $$(".site-nav a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
};

const activateTab = (group, name) => {
  $$(".tab-btn", group).forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", String(on));
    const panel = $(`panel-${b.dataset.tab}`);
    if (panel) panel.hidden = !on;
  });
};

const initTabs = () => {
  $$(".tabs").forEach((group) => {
    $$(".tab-btn", group).forEach((b) => b.addEventListener("click", () => activateTab(group, b.dataset.tab)));
  });
  if (PAGE === "login" && window.location.hash === "#signup") {
    const group = document.querySelector(".tabs");
    if (group) activateTab(group, "signup");
  }
};

/* ============================================================
   STRESS SCORE ENGINE (used by check-in + dashboard)
   ============================================================ */
const MOOD_LABEL = { calm: "Calm 😌", moderate: "Moderate 😐", overwhelmed: "Overwhelmed 😣" };
const CAT_LABEL = { calm: "Low stress", moderate: "Moderate stress", overwhelmed: "High stress" };
const CAT_HINT = {
  calm: "You're doing well. Keep your routine going.",
  moderate: "Try a focus session and take real breaks.",
  overwhelmed: "Slow down. Talk to a friend, mentor or campus counsellor."
};
const RING_CLASS = { calm: "low", moderate: "mid", overwhelmed: "high" };

const categoryOf = (score) => (score < 34 ? "calm" : score < 67 ? "moderate" : "overwhelmed");

/* Score is 0 (very relaxed) to 100 (very stressed).
   Weights: stress 30, mood 20, sleep 20, workload 15, energy 15, minus up to 5 for exercise. */
const computeScore = ({ mood, stress, sleep, workload, energy, exercise }) => {
  const moodVal = { calm: 0, moderate: 0.5, overwhelmed: 1 }[mood];
  const parts = [
    { name: "Stress level", max: 30, points: 30 * ((stress - 1) / 9) },
    { name: "Mood", max: 20, points: 20 * moodVal },
    { name: "Sleep", max: 20, points: 20 * clamp((8 - sleep) / 5, 0, 1) },
    { name: "Workload", max: 15, points: 15 * ((workload - 1) / 9) },
    { name: "Energy", max: 15, points: 15 * ((10 - energy) / 9) }
  ];
  const raw = parts.reduce((sum, p) => sum + p.points, 0);
  const bonus = (Math.min(exercise, 30) / 30) * 5;
  return { score: Math.round(clamp(raw - bonus, 0, 100)), parts, bonus };
};

const withScore = (entry) => ({ ...entry, score: computeScore(entry).score });
const getEntries = () => loadJSON(userKey("entries"), {});
const setEntries = (e) => saveJSON(userKey("entries"), e);

const makePill = (score) => {
  const cat = categoryOf(score);
  return el("span", { class: `pill ${cat}`, text: { calm: "Low", moderate: "Moderate", overwhelmed: "High" }[cat] });
};

/* ============================================================
   DASHBOARD
   ============================================================ */
const statsFor = (entries, startDate, endDate) => {
  const [a, b] = [todayKey(startDate), todayKey(endDate)];
  const inRange = Object.entries(entries).filter(([k]) => k >= a && k <= b).map(([, e]) => e);
  if (!inRange.length) return { count: 0, score: null, sleep: null, study: null, stress: null };
  const avg = (key) => inRange.reduce((s, e) => s + e[key], 0) / inRange.length;
  return { count: inRange.length, score: Math.round(avg("score")), sleep: avg("sleep"), study: avg("study"), stress: avg("stress") };
};

const fmt = (v, d) => (v === null ? "–" : v.toFixed(d));

const paintScore = (prefix, st, emptyHint) => {
  const circle = $(`${prefix}-score`);
  circle.classList.remove("low", "mid", "high");
  if (st.score === null) {
    circle.textContent = "--";
    $(`${prefix}-label`).textContent = "No data yet";
    $(`${prefix}-hint`).textContent = emptyHint;
    return;
  }
  const cat = categoryOf(st.score);
  circle.textContent = st.score;
  circle.classList.add(RING_CLASS[cat]);
  $(`${prefix}-label`).textContent = CAT_LABEL[cat];
  $(`${prefix}-hint`).textContent = CAT_HINT[cat];
};

const paintBars = (container, items) => {
  container.replaceChildren(
    ...items.map(({ label, score, title }) => {
      const bar = el("div", { class: "bar" });
      if (score !== null) {
        bar.classList.add(categoryOf(score));
        bar.style.height = `${Math.max(8, score * 1.05)}px`;
        bar.title = `${title}: ${score}/100`;
      } else {
        bar.title = `${title}: no check-in`;
      }
      return el("div", { class: "bar-col" }, bar, label);
    })
  );
};

const paintTiles = (container, st) => {
  const tiles = [
    ["Check-ins", st.count],
    ["Avg sleep", st.sleep === null ? "–" : `${fmt(st.sleep, 1)} h`],
    ["Avg study", st.study === null ? "–" : `${fmt(st.study, 1)} h`],
    ["Avg stress", st.stress === null ? "–" : `${fmt(st.stress, 1)}/10`]
  ];
  container.replaceChildren(
    ...tiles.map(([label, value]) =>
      el("div", { class: "tile" }, el("div", { class: "tile-val", text: String(value) }), el("div", { class: "tile-label", text: label }))
    )
  );
};

const changeCell = (cur, prev) => {
  if (cur === null || prev === null) return el("span", { class: "change flat", text: "–" });
  const diff = cur - prev;
  if (diff < 0) return el("span", { class: "change good", text: `▼ ${Math.abs(diff)}`, title: "Lower than before (better)" });
  if (diff > 0) return el("span", { class: "change bad", text: `▲ ${diff}`, title: "Higher than before" });
  return el("span", { class: "change flat", text: "▬ 0" });
};

const fillTable = (tbody, rows) => {
  let prevScore = null;
  tbody.replaceChildren(
    ...rows.map(({ label, st }, i) => {
      const none = st.score === null;
      const tr = el(
        "tr",
        { class: i === rows.length - 1 ? "current-row" : "" },
        el("td", { text: label }),
        el("td", { class: "num", text: String(st.count) }),
        el("td", { class: "num", text: none ? "–" : String(st.score) }),
        el("td", {}, none ? "–" : makePill(st.score)),
        el("td", { class: "num", text: none ? "–" : `${fmt(st.sleep, 1)} h` }),
        el("td", { class: "num", text: none ? "–" : `${fmt(st.study, 1)} h` }),
        el("td", {}, changeCell(st.score, prevScore))
      );
      if (!none) prevScore = st.score;
      return tr;
    })
  );
};

const renderDashboard = () => {
  if (!$("w-score")) return;
  const entries = getEntries();
  const now = new Date();

  /* Weekly (Mon–Sun, current week) */
  const ws = startOfWeek(now);
  const wst = statsFor(entries, ws, addDays(ws, 6));
  paintScore("w", wst, "Do a daily check-in to see your weekly stress score.");
  paintBars(
    $("w-bars"),
    Array.from({ length: 7 }, (_, i) => {
      const d = addDays(ws, i);
      return { label: DAYS[d.getDay()], score: entries[todayKey(d)]?.score ?? null, title: shortDate(d) };
    })
  );
  paintTiles($("w-stats"), wst);
  fillTable(
    $("week-table-body"),
    [4, 3, 2, 1, 0].map((w) => {
      const s = addDays(ws, -7 * w);
      return { label: `${shortDate(s)} – ${shortDate(addDays(s, 6))}${w === 0 ? " (this week)" : ""}`, st: statsFor(entries, s, addDays(s, 6)) };
    })
  );

  /* Monthly (current calendar month) */
  const [y, mo] = [now.getFullYear(), now.getMonth()];
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const mst = statsFor(entries, new Date(y, mo, 1), new Date(y, mo, daysInMonth));
  paintScore("m", mst, "Do daily check-ins to see your monthly stress score.");
  const mBars = $("m-bars");
  paintBars(
    mBars,
    Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(y, mo, i + 1);
      return { label: i === 0 || (i + 1) % 5 === 0 ? String(i + 1) : " ", score: entries[todayKey(d)]?.score ?? null, title: shortDate(d) };
    })
  );
  mBars.classList.add("month-bars");
  paintTiles($("m-stats"), mst);
  fillTable(
    $("month-table-body"),
    [2, 1, 0].map((m) => {
      const a = new Date(y, mo - m, 1);
      const b = new Date(y, mo - m + 1, 0);
      return { label: `${MONTHS[a.getMonth()]} ${a.getFullYear()}${m === 0 ? " (this month)" : ""}`, st: statsFor(entries, a, b) };
    })
  );
};

/* ---- Demo data tools ---- */
const loadDemoData = () => {
  if (Object.keys(getEntries()).length && !confirm("This replaces your current check-ins with sample data. Continue?")) return;
  const entries = {};
  const now = new Date();
  for (let i = 0; i < 110; i++) {
    if (Math.random() < 0.15) continue;
    const wave = Math.sin(i / 6);
    const stress = clamp(Math.round(5 + 2.2 * wave + (Math.random() * 3 - 1.5)), 1, 10);
    const workload = clamp(Math.round(5 + 2 * wave + (Math.random() * 2 - 1)), 1, 10);
    entries[todayKey(addDays(now, -i))] = withScore({
      mood: stress <= 4 ? "calm" : stress <= 7 ? "moderate" : "overwhelmed",
      stress,
      energy: clamp(Math.round(6 - (stress - 5) * 0.5 + (Math.random() * 2 - 1)), 1, 10),
      workload,
      sleep: clamp(Math.round((7 - (stress - 5) * 0.35 + (Math.random() * 2 - 1)) * 2) / 2, 3, 10),
      study: clamp(Math.round((4 + (workload - 5) * 0.5 + Math.random() * 2) * 2) / 2, 0, 14),
      exercise: Math.random() < 0.4 ? 0 : Math.round(Math.random() * 8) * 5
    });
  }
  setEntries(entries);
  renderDashboard();
  toast("Sample data loaded", "info");
};

const clearData = () => {
  if (!confirm("Delete all your check-in data? This cannot be undone.")) return;
  setEntries({});
  renderDashboard();
  toast("Check-in data cleared", "info");
};

const initDemoTools = () => {
  $("demo-load-btn")?.addEventListener("click", loadDemoData);
  $("demo-clear-btn")?.addEventListener("click", clearData);
};

/* ---- Deadlines (add / remove / tick) ---- */
const defaultDeadlines = () => {
  const now = new Date();
  return [
    { id: uid(), title: "Python lab evaluation", date: todayKey(addDays(now, 3)), done: false },
    { id: uid(), title: "Calculus assignment", date: todayKey(addDays(now, 8)), done: false },
    { id: uid(), title: "Web Development mini-project demo", date: todayKey(addDays(now, 14)), done: false }
  ];
};
const getDeadlines = () => {
  let list = loadJSON(userKey("deadlines"), null);
  if (list === null) { list = defaultDeadlines(); saveJSON(userKey("deadlines"), list); }
  return list;
};
const setDeadlines = (list) => saveJSON(userKey("deadlines"), list);

const dueInfo = ({ date, done }) => {
  if (!date) return { text: "No date", overdue: false };
  const diff = Math.round((parseKey(date) - parseKey(todayKey())) / 86400000);
  if (diff < 0) return { text: `Overdue by ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "day" : "days"}`, overdue: !done };
  if (diff === 0) return { text: "Due today", overdue: false };
  if (diff === 1) return { text: "Due tomorrow", overdue: false };
  return { text: `Due in ${diff} days`, overdue: false };
};

const renderDeadlines = () => {
  const list = $("deadline-list");
  if (!list) return;
  const items = [...getDeadlines()].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.date || "9999") < (b.date || "9999") ? -1 : 1;
  });

  const rows = items.map((dl) => {
    const info = dueInfo(dl);
    const cb = el("input", {
      type: "checkbox", id: `dl-${dl.id}`, checked: dl.done,
      on: {
        change: (e) => {
          setDeadlines(getDeadlines().map((x) => (x.id === dl.id ? { ...x, done: e.target.checked } : x)));
          renderDeadlines();
        }
      }
    });
    return el(
      "li",
      { class: dl.done ? "done" : "" },
      cb,
      el("label", { attrs: { for: cb.id }, text: dl.title }),
      el("span", { class: `due${info.overdue ? " overdue" : ""}`, text: info.text }),
      el("button", {
        type: "button", class: "icon-btn", title: "Remove deadline", text: "✕",
        attrs: { "aria-label": `Remove deadline: ${dl.title}` },
        on: {
          click: () => {
            setDeadlines(getDeadlines().filter((x) => x.id !== dl.id));
            renderDeadlines();
            toast("Deadline removed", "info");
          }
        }
      })
    );
  });

  list.replaceChildren(...(rows.length ? rows : [el("li", { class: "empty-note", text: "No deadlines yet. Add one below." })]));
  const count = $("deadline-count");
  if (count) count.textContent = `${items.filter((d) => !d.done).length} open`;
};

const initDeadlines = () => {
  const form = $("deadline-form");
  if (!form) return;
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const titleEl = $("dl-title");
    const title = titleEl.value.trim();
    if (!title) { titleEl.focus(); toast("Type a deadline name first", "error"); return; }
    setDeadlines([...getDeadlines(), { id: uid(), title, date: $("dl-date").value, done: false }]);
    form.reset();
    renderDeadlines();
    toast("Deadline added");
  });
  renderDeadlines();
};

/* ============================================================
   TIPS (bank flattened once, used by dashboard card + library page)
   ============================================================ */
const allTips = () => {
  if (typeof TIP_BANK === "undefined") return [];
  return Object.entries(TIP_BANK).flatMap(([theme, list]) => list.map((text, i) => ({ id: `${theme}-${i}`, theme, text })));
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast("Tip copied");
  } catch {
    const ta = el("textarea", { value: text });
    document.body.append(ta);
    ta.select();
    try { document.execCommand("copy"); toast("Tip copied"); } catch { toast("Copy is not available here", "error"); }
    ta.remove();
  }
};

/* Dashboard card: one random tip, never the same twice in a row */
const initDashboardTip = () => {
  const textEl = $("tip-text");
  const tips = allTips();
  if (!textEl || !tips.length) return;
  const pick = () => {
    const last = loadJSON("mm_lastTip", -1);
    let i;
    do { i = Math.floor(Math.random() * tips.length); } while (i === last && tips.length > 1);
    saveJSON("mm_lastTip", i);
    textEl.textContent = tips[i].text;
    $("tip-theme").textContent = tips[i].theme;
  };
  const note = $("tip-count");
  if (note) note.textContent = `${tips.length} tips in the bank. A new one shows on every visit.`;
  $("new-tip-btn")?.addEventListener("click", pick);
  pick();
};

/* Tips library page: search + theme filter + favourites + show more */
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlight = (text, query) => {
  if (!query) return [text];
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
  return parts.map((p) => (p.toLowerCase() === query.toLowerCase() ? el("mark", { text: p }) : p));
};

const initTipsLibrary = () => {
  const grid = $("tips-grid");
  const tips = allTips();
  if (!grid || !tips.length) return;

  const PAGE_SIZE = 12;
  const themes = [...new Set(tips.map((t) => t.theme))];
  const state = { query: "", theme: "All", favsOnly: false, shown: PAGE_SIZE };
  let favs = new Set(loadJSON(userKey("favTips"), []));
  const saveFavs = () => saveJSON(userKey("favTips"), [...favs]);

  const chipBox = $("theme-chips");
  const chips = ["All", ...themes].map((name) =>
    el("button", {
      type: "button", class: `theme-chip${name === "All" ? " active" : ""}`, text: name, dataset: { theme: name },
      attrs: { "aria-pressed": String(name === "All") },
      on: { click: () => { state.theme = name; state.shown = PAGE_SIZE; render(); } }
    })
  );
  chipBox.replaceChildren(...chips);

  const favBtn = $("fav-toggle");
  const moreBtn = $("tips-more");
  const emptyBox = $("tips-empty");

  const filtered = () => {
    const q = state.query.toLowerCase();
    return tips.filter(
      (t) =>
        (state.theme === "All" || t.theme === state.theme) &&
        (!state.favsOnly || favs.has(t.id)) &&
        (!q || t.text.toLowerCase().includes(q) || t.theme.toLowerCase().includes(q))
    );
  };

  const card = (tip) => {
    const isFav = favs.has(tip.id);
    return el(
      "li",
      { class: "tip-card" },
      el("span", { class: "tip-theme", text: tip.theme }),
      el("p", { class: "tip-card-text" }, ...highlight(tip.text, state.query.trim())),
      el(
        "div",
        { class: "tip-actions" },
        el("button", {
          type: "button", class: `icon-toggle${isFav ? " on" : ""}`, text: isFav ? "♥ Saved" : "♡ Save",
          attrs: { "aria-pressed": String(isFav), "aria-label": `${isFav ? "Remove from" : "Add to"} favourites: ${tip.text}` },
          on: {
            click: () => {
              favs.has(tip.id) ? favs.delete(tip.id) : favs.add(tip.id);
              saveFavs();
              toast(favs.has(tip.id) ? "Saved to favourites" : "Removed from favourites", favs.has(tip.id) ? "success" : "info");
              render();
            }
          }
        }),
        el("button", { type: "button", class: "icon-toggle", text: "Copy", on: { click: () => copyText(tip.text) } })
      )
    );
  };

  const render = () => {
    const list = filtered();
    const visible = list.slice(0, state.shown);
    chips.forEach((c) => {
      const on = c.dataset.theme === state.theme;
      c.classList.toggle("active", on);
      c.setAttribute("aria-pressed", String(on));
    });
    favBtn.classList.toggle("on", state.favsOnly);
    favBtn.setAttribute("aria-pressed", String(state.favsOnly));
    favBtn.textContent = `♥ Favourites (${favs.size})`;

    grid.replaceChildren(...visible.map(card));
    $("tips-count").textContent = list.length
      ? `Showing ${visible.length} of ${list.length} ${list.length === 1 ? "tip" : "tips"}`
      : "No tips match";
    emptyBox.hidden = list.length > 0;
    grid.hidden = list.length === 0;
    moreBtn.hidden = visible.length >= list.length;
    moreBtn.textContent = `Show ${Math.min(PAGE_SIZE, list.length - visible.length)} more`;
  };

  let timer;
  $("tip-search").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.query = e.target.value.trim(); state.shown = PAGE_SIZE; render(); }, 150);
  });
  favBtn.addEventListener("click", () => { state.favsOnly = !state.favsOnly; state.shown = PAGE_SIZE; render(); });
  moreBtn.addEventListener("click", () => { state.shown += PAGE_SIZE; render(); });
  $("tips-reset").addEventListener("click", () => {
    Object.assign(state, { query: "", theme: "All", favsOnly: false, shown: PAGE_SIZE });
    $("tip-search").value = "";
    render();
  });
  render();
};

const initWelcome = () => {
  const nameEl = $("welcome-name");
  const session = getSession();
  if (!nameEl || !session) return;
  nameEl.textContent = session.name.split(" ")[0];
  // First visit right after signing up says "Welcome"; every later visit says "Welcome back".
  const prefix = $("welcome-prefix");
  if (prefix && loadJSON("mm_new_user", null) === session.email) {
    prefix.textContent = "Welcome";
    removeKey("mm_new_user");
  }
};

/* ============================================================
   FOCUS TIMER (SVG progress ring)
   ============================================================ */
const initTimer = () => {
  const display = $("clock-display");
  if (!display) return;

  const modeLabel = $("mode-label");
  const ring = $("ring-fg");
  const countEl = $("session-count");
  const msg = $("timer-msg");
  const presets = $$(".preset-btn");
  const circumference = 2 * Math.PI * Number(ring.getAttribute("r"));
  ring.style.strokeDasharray = circumference;

  let focusMin = loadJSON(userKey("focusMin"), 25);
  let mode = "focus";
  let totalSeconds = focusMin * 60;
  let remaining = totalSeconds;
  let intervalId = null;
  let endTime = 0;

  let sessions = loadJSON(userKey("sessions"), { date: todayKey(), count: 0, minutes: 0 });
  if (sessions.date !== todayKey()) sessions = { date: todayKey(), count: 0, minutes: 0 };

  const render = () => {
    const text = `${pad(Math.floor(remaining / 60))}:${pad(remaining % 60)}`;
    display.textContent = text;
    document.title = `${text} · MindMetrics`;
    ring.style.strokeDashoffset = circumference * (1 - (totalSeconds - remaining) / totalSeconds);
    countEl.textContent = `Focus sessions today: ${sessions.count} · ${sessions.minutes} min focused`;
    presets.forEach((p) => p.classList.toggle("active", Number(p.dataset.min) === focusMin));
  };

  const stop = () => {
    if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
  };

  const setTimer = (kind, minutes) => {
    stop();
    mode = kind;
    totalSeconds = Math.round(minutes * 60);
    remaining = totalSeconds;
    const isBreak = kind === "break";
    modeLabel.textContent = isBreak ? (minutes >= 15 ? "Long break" : "Short break") : `Focus time · ${minutes} min`;
    modeLabel.classList.toggle("break", isBreak);
    ring.classList.toggle("break", isBreak);
    msg.textContent = "";
    render();
  };

  const beep = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      gain.gain.value = 0.08;
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch { /* audio not available */ }
  };

  const complete = () => {
    stop();
    beep();
    if (mode === "focus") {
      sessions.count++;
      sessions.minutes += focusMin;
      saveJSON(userKey("sessions"), sessions);
      const brk = focusMin >= 90 ? 15 : focusMin >= 50 ? 10 : 5;
      setTimer("break", brk);
      msg.textContent = `Focus session complete. A ${brk}-minute break is ready. Press Start.`;
      toast("Focus session complete", "success");
    } else {
      setTimer("focus", focusMin);
      msg.textContent = "Break over. Ready for another focus block?";
      toast("Break over", "info");
    }
  };

  const tick = () => {
    remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    render();
    if (remaining === 0) complete();
  };

  const chooseFocus = (min) => {
    focusMin = min;
    saveJSON(userKey("focusMin"), min);
    setTimer("focus", min);
  };

  $("start-btn").addEventListener("click", () => {
    if (intervalId !== null || remaining <= 0) return;
    endTime = Date.now() + remaining * 1000;
    intervalId = setInterval(tick, 500);
  });
  $("pause-btn").addEventListener("click", stop);
  $("reset-btn").addEventListener("click", () => setTimer(mode, mode === "focus" ? focusMin : totalSeconds / 60));
  $("break-btn").addEventListener("click", () => setTimer("break", 5));
  $("long-break-btn").addEventListener("click", () => setTimer("break", 15));
  presets.forEach((p) => p.addEventListener("click", () => chooseFocus(Number(p.dataset.min))));
  $("custom-set-btn").addEventListener("click", () => {
    const v = parseInt($("custom-min").value, 10);
    if (Number.isNaN(v) || v < 1 || v > 180) {
      msg.textContent = "Enter a number between 1 and 180 minutes.";
      toast("Custom length must be 1–180 minutes", "error");
      return;
    }
    chooseFocus(v);
  });

  setTimer("focus", focusMin);
};

/* ============================================================
   CHECK-IN (quantitative)
   ============================================================ */
const ADVICE = {
  calm: {
    title: "Nice. Keep the momentum 🌱",
    tips: [
      "Use this clear headspace for your hardest subject first.",
      "Plan tomorrow's top 3 tasks so the calm continues.",
      "Note what helped today, such as sleep, food or a walk, and repeat it."
    ]
  },
  moderate: {
    title: "A bit loaded. That's normal ⚖️",
    tips: [
      "Do one focus block on the task you are avoiding.",
      "Take a 10-minute walk away from your screen.",
      "Write down everything on your mind, then circle just one thing to do next."
    ]
  },
  overwhelmed: {
    title: "Pause. You're not alone 💙",
    tips: [
      "Try box breathing: in for 4, hold 4, out for 4, hold 4. Repeat 4 times.",
      "Drink water and eat something. A hungry brain exaggerates stress.",
      "Message a friend or call family. Saying it out loud helps.",
      "If this feeling lasts for days, please reach out to your campus counsellor."
    ]
  }
};

const buildAdvice = (entry) => {
  const cat = categoryOf(entry.score);
  const tips = [...ADVICE[cat].tips];
  if (entry.sleep < 6) tips.push(`You slept ${entry.sleep} h. Aim for 7–9 h tonight; sleep is the fastest stress reducer.`);
  if (entry.exercise === 0) tips.push("No movement today. Even a 10-minute walk helps your mood.");
  if (entry.study >= 9) tips.push(`That was a long study day (${entry.study} h). Add proper breaks and stop on time.`);
  if (entry.workload >= 8) tips.push("Workload feels heavy. List everything, then finish just one thing first.");
  return { title: ADVICE[cat].title, tips };
};

const renderHistory = () => {
  const list = $("history-list");
  if (!list) return;
  const entries = getEntries();
  const keys = Object.keys(entries).sort().reverse().slice(0, 7);
  if (!keys.length) {
    list.replaceChildren(el("li", { class: "empty-note", text: "No check-ins yet. Fill in the form to start." }));
    return;
  }
  list.replaceChildren(
    ...keys.map((k) => {
      const e = entries[k];
      return el(
        "li",
        {},
        el("span", { text: shortDate(parseKey(k)) }),
        el("span", { text: MOOD_LABEL[e.mood] }),
        el("span", {}, `${e.score}  `, makePill(e.score))
      );
    })
  );
};

const showResult = (entry) => {
  const { parts, bonus } = computeScore(entry);
  const cat = categoryOf(entry.score);

  $("result-empty").hidden = true;
  $("result-box").hidden = false;

  const circle = $("res-score");
  circle.textContent = entry.score;
  circle.classList.remove("low", "mid", "high");
  circle.classList.add(RING_CLASS[cat]);
  $("res-label").textContent = CAT_LABEL[cat];
  $("res-sub").textContent =
    entry.mood === cat
      ? "Your numbers match how you said you feel. Nice self-awareness."
      : `You said you feel “${entry.mood}”, but your numbers point to “${CAT_LABEL[cat].toLowerCase()}”. Worth noticing.`;

  const row = (name, pts, max, isBonus) =>
    el(
      "div",
      { class: "break-row" },
      el("span", { text: name }),
      el("div", { class: "break-track" }, el("div", { class: `break-fill${isBonus ? " bonus" : ""}`, style: `width:${clamp((pts / max) * 100, 0, 100)}%` })),
      el("span", { class: "break-pts", text: `${isBonus ? "−" : "+"}${Math.round(pts)}` })
    );
  $("res-breakdown").replaceChildren(
    ...parts.map((p) => row(p.name, p.points, p.max, false)),
    ...(bonus > 0 ? [row("Exercise", bonus, 5, true)] : [])
  );

  const { title, tips } = buildAdvice(entry);
  const advBox = $("dynamic-advice-box");
  advBox.replaceChildren(el("h3", { text: title }), el("ul", {}, ...tips.map((t) => el("li", { text: t }))));
  advBox.classList.add("show");
};

const initCheckin = () => {
  const form = $("mood-form");
  if (!form) return;
  const buttons = $$(".mood-btn", form);
  const errEl = $("ci-error");
  let selectedMood = null;
  form.addEventListener("submit", (e) => e.preventDefault()); // Enter key must not reload the page

  const syncSlider = (inp) => {
    const pct = ((inp.value - inp.min) / (inp.max - inp.min)) * 100;
    inp.style.setProperty("--pct", `${pct}%`);
    inp.closest(".slider-row").querySelector(".slider-val").textContent = `${inp.value}${inp.dataset.unit ?? ""}`;
  };
  $$("input[type='range']", form).forEach((inp) => {
    syncSlider(inp);
    inp.addEventListener("input", () => syncSlider(inp));
  });

  const selectMood = (m) => {
    selectedMood = m;
    buttons.forEach((b) => {
      b.classList.toggle("selected", b.dataset.mood === m);
      b.setAttribute("aria-pressed", String(b.dataset.mood === m));
    });
  };
  buttons.forEach((b) => b.addEventListener("click", () => { selectMood(b.dataset.mood); errEl.hidden = true; }));

  const fields = ["stress", "energy", "workload", "sleep", "study", "exercise"];
  const today = getEntries()[todayKey()];
  if (today) {
    selectMood(today.mood);
    fields.forEach((k) => { const inp = $(`ci-${k}`); inp.value = today[k]; syncSlider(inp); });
    showResult(today);
  }

  $("save-checkin").addEventListener("click", () => {
    if (!selectedMood) {
      errEl.textContent = "Tap how you feel (Calm, Moderate or Overwhelmed) before saving.";
      errEl.hidden = false;
      toast("Choose a mood first", "error");
      return;
    }
    errEl.hidden = true;
    const entry = withScore({ mood: selectedMood, ...Object.fromEntries(fields.map((k) => [k, Number($(`ci-${k}`).value)])) });
    setEntries({ ...getEntries(), [todayKey()]: entry });
    showResult(entry);
    renderHistory();
    toast("Check-in saved");
  });

  renderHistory();
};

/* ============================================================
   CONTACT FORM (validation + localStorage, nothing is sent anywhere)
   ============================================================ */
const initContact = () => {
  const form = $("contact-form");
  if (!form) return;

  const MESSAGES_KEY = "mm_contact_messages";
  const rules = {
    "c-name": (v) => (v.trim().length >= 2 ? "" : "Enter your name (at least 2 characters)."),
    "c-email": (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Enter a valid email address, like name@example.com."),
    "c-topic": (v) => (v ? "" : "Choose a topic so we know where this belongs."),
    "c-message": (v) => (v.trim().length < 10 ? "Write at least 10 characters." : v.length > 500 ? "Keep it under 500 characters." : "")
  };

  const setError = (id, msg) => {
    const input = $(id);
    $(`err-${id}`).textContent = msg;
    input.setAttribute("aria-invalid", String(!!msg));
  };
  const validate = (id) => { const msg = rules[id]($(id).value); setError(id, msg); return !msg; };

  Object.keys(rules).forEach((id) => {
    $(id).addEventListener("blur", () => validate(id));
    $(id).addEventListener("input", () => { if ($(id).getAttribute("aria-invalid") === "true") validate(id); });
  });

  const counter = $("msg-count");
  $("c-message").addEventListener("input", (e) => { counter.textContent = `${e.target.value.length} / 500`; });

  const renderSent = () => {
    const box = $("sent-card");
    const list = $("sent-list");
    const msgs = loadJSON(MESSAGES_KEY, []);
    box.hidden = msgs.length === 0;
    list.replaceChildren(
      ...msgs.slice(0, 3).map((m) =>
        el("li", {}, el("strong", { text: `${m.topic} · ${new Date(m.at).toLocaleDateString()}` }), m.message.length > 90 ? `${m.message.slice(0, 90)}…` : m.message)
      )
    );
  };

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const results = Object.keys(rules).map(validate); // validate all, so every error shows at once
    if (results.includes(false)) {
      toast("Fix the highlighted fields", "error");
      form.querySelector("[aria-invalid='true']")?.focus();
      return;
    }
    const saved = loadJSON(MESSAGES_KEY, []);
    saveJSON(MESSAGES_KEY, [
      { name: $("c-name").value.trim(), email: $("c-email").value.trim(), topic: $("c-topic").value, message: $("c-message").value.trim(), at: Date.now() },
      ...saved
    ]);
    form.reset();
    counter.textContent = "0 / 500";
    $("contact-form-wrap").hidden = true;
    $("contact-success").hidden = false;
    renderSent();
    toast("Message saved");
  });

  $("send-another").addEventListener("click", () => {
    $("contact-success").hidden = true;
    $("contact-form-wrap").hidden = false;
    $("c-name").focus();
  });
  $("sent-clear").addEventListener("click", () => { removeKey(MESSAGES_KEY); renderSent(); toast("Saved messages cleared", "info"); });
  renderSent();
};

/* ============================================================
   HOME: preview carousel
   ============================================================ */
const initCarousel = () => {
  const slides = $$(".preview-slide");
  const dotBox = $("preview-dots");
  if (!slides.length || !dotBox) return;
  let index = 0;
  let auto = null;

  const dots = slides.map((_, i) =>
    el("button", { type: "button", class: "preview-dot", attrs: { "aria-label": `Show preview ${i + 1} of ${slides.length}` }, on: { click: () => { show(i); restart(); } } })
  );
  dotBox.replaceChildren(...dots);

  const show = (i) => {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, n) => s.classList.toggle("active", n === index));
    dots.forEach((d, n) => d.classList.toggle("active", n === index));
  };
  const restart = () => {
    clearInterval(auto);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) auto = setInterval(() => show(index + 1), 6000);
  };

  $("preview-next").addEventListener("click", () => { show(index + 1); restart(); });
  const wrap = document.querySelector(".hero-preview");
  wrap.addEventListener("mouseenter", () => clearInterval(auto));
  wrap.addEventListener("mouseleave", restart);
  wrap.addEventListener("focusin", () => clearInterval(auto));
  show(0);
  restart();
};

/* ============================================================
   BOOT: each feature is isolated so one failure never breaks the page
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (PROTECTED_PAGES.includes(PAGE) && !getSession()) return; // redirecting to login
  [
    renderUserArea, initNav, initTabs, initAuthForms, initWelcome, renderDashboard, initDemoTools,
    initDeadlines, initDashboardTip, initTipsLibrary, initTimer, initCheckin, initContact, initCarousel
  ].forEach((fn) => {
    try { fn(); } catch (err) { console.error(`MindMetrics: ${fn.name} failed`, err); }
  });
});
