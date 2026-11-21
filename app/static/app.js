/* FOCUS! 前端逻辑：登录、项目、计时、统计。 */
const $ = (id) => document.getElementById(id);

let authMode = "login";
let user = null;
let projects = [];
let stats = { total: 0, today: 0, week: 0, count: 0 };
let sessions = [];

const timer = {
  mode: "countdown",
  target: 25 * 60,
  running: false,
  startAt: 0,
  base: 0,
  autoSaved: false,
  tick: null,
};

/* ---------------- 工具 ---------------- */
function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtDuration(sec) {
  sec = Math.floor(sec);
  if (sec <= 0) return "0 分";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${h} 小时 ${m} 分`;
  if (sec < 60) return `${sec} 秒`;
  return `${m} 分`;
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => (el.hidden = true), 220);
  }, 2400);
}

let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.07;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.28);
  } catch (e) {
    /* 静音环境忽略 */
  }
}

async function fetchApi(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    const detail = (data && data.detail) || `请求失败（${res.status}）`;
    throw new Error(detail);
  }
  return data;
}

/* 优先走 Supabase 云端；否则走浏览器本地存储；再否则走本机 FastAPI。 */
const api = (path, options) => {
  if (typeof window.FocusCloudApi === "function") return window.FocusCloudApi(path, options);
  if (typeof window.FocusLocalApi === "function") return window.FocusLocalApi(path, options);
  return fetchApi(path, options);
};

/* ---------------- 登录 ---------------- */
function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.authTab === mode);
  });
  $("authSubmit").textContent = mode === "login" ? "登录" : "注册并登录";
  $("authHint").classList.remove("error");
  $("authHint").textContent =
    mode === "login"
      ? "还没有账号？切到“注册”，用邮箱创建，数据按账号分开保存。"
      : "注册后自动登录；密码至少 6 位，只保存在这台电脑。";
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
}

document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
  btn.addEventListener("click", () => setAuthMode(btn.dataset.authTab));
});

$("showPwd").addEventListener("change", (e) => {
  $("password").type = e.target.checked ? "text" : "password";
});

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  const hint = $("authHint");
  hint.classList.remove("error");
  try {
    const data = await api(authMode === "login" ? "/api/login" : "/api/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    hint.textContent = "";
    enterApp(data);
    toast(authMode === "login" ? "欢迎回来" : "注册成功，已登录");
  } catch (err) {
    if (err.code === "EMAIL_CONFIRM") {
      setAuthMode("login");
      $("email").value = email;
      $("resendBtn").hidden = false;
      hint.classList.remove("error");
      hint.textContent = err.message;
      toast("验证邮件已发送，请先完成邮箱验证");
      return;
    }
    hint.textContent = err.message;
    hint.classList.add("error");
  }
});

function showAuth() {
  user = null;
  $("appView").hidden = true;
  $("authView").hidden = false;
  setAuthMode("login");
}

/* ---------------- 视图切换 ---------------- */
const VIEWS = ["timer", "stats"];

function currentView() {
  const name = (location.hash || "").replace("#", "");
  if (name === "projects") return "timer";
  return VIEWS.includes(name) ? name : "timer";
}

function showView(name, options = {}) {
  const view = VIEWS.includes(name) ? name : "timer";
  VIEWS.forEach((key) => {
    $("view-" + key).hidden = key !== view;
  });
  document.querySelectorAll(".nav a").forEach((a) => {
    const active = a.getAttribute("href") === "#" + view;
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (view === "stats") renderAnalytics();
  if (options.scroll !== false) window.scrollTo(0, 0);
}

window.addEventListener("hashchange", () => showView(currentView()));

function enterApp(me) {
  user = { email: me.email, created_at: me.created_at, createdAt: me.created_at };
  stats = me.stats || stats;
  projects = me.projects || [];
  $("authView").hidden = true;
  $("appView").hidden = false;
  $("userEmail").textContent = me.email;
  $("resendBtn").hidden = true;
  pickQuote();
  renderProjects();
  renderStats();
  loadSessions();
  restoreTimer();
  renderTimer();
  showView(currentView(), { scroll: false });
}

$("logoutBtn").addEventListener("click", async () => {
  resetTimer();
  clearTimerState();
  try {
    await api("/api/logout", { method: "POST" });
  } catch (e) {
    /* 忽略 */
  }
  showAuth();
  toast("已退出登录");
});

/* ---------------- 重新发送验证邮件 ---------------- */
$("resendBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  if (!email) {
    toast("先填写注册邮箱");
    return;
  }
  try {
    await api("/api/resend", { method: "POST", body: JSON.stringify({ email }) });
    toast("验证邮件已重新发送，请查收");
  } catch (err) {
    toast(err.message);
  }
});

/* ---------------- 项目 ---------------- */
function selectedProjectId() {
  return $("projectSelect").value || null;
}

function renderProjects(preferredId) {
  const grid = $("projectGrid");
  grid.textContent = "";
  const select = $("projectSelect");
  const keep = preferredId != null ? String(preferredId) : select.value;
  select.textContent = "";

  if (!projects.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "还没有项目，先添加一个。";
    grid.appendChild(empty);
  }

  projects.forEach((p) => {
    const option = document.createElement("option");
    option.value = String(p.id);
    option.textContent = p.name;
    select.appendChild(option);

    const card = document.createElement("article");
    card.className = "project-card";

    const title = document.createElement("h3");
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = p.color || "#FF3B2F";
    title.appendChild(dot);
    title.appendChild(document.createTextNode(p.name));

    const total = document.createElement("div");
    total.className = "project-total";
    total.textContent = fmtDuration(p.total);

    const meta = document.createElement("div");
    meta.className = "project-meta";
    const today = document.createElement("span");
    today.textContent = `今天 ${fmtDuration(p.today)}`;
    const count = document.createElement("span");
    count.textContent = `${p.count} 次`;
    meta.append(today, count);

    const actions = document.createElement("div");
    actions.className = "project-actions";
    const rename = document.createElement("button");
    rename.type = "button";
    rename.textContent = "改名";
    rename.addEventListener("click", () => openRename(p));
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "删除";
    del.addEventListener("click", () => deleteProject(p));
    actions.append(rename, del);

    card.append(title, total, meta, actions);
    grid.appendChild(card);
  });

  if (keep && projects.some((p) => String(p.id) === keep)) {
    select.value = keep;
  }
}

async function addProject() {
  const input = $("projectName");
  const name = input.value.trim();
  if (!name) {
    toast("先输入项目名称");
    return;
  }
  try {
    const data = await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    projects = data.projects;
    input.value = "";
    const created = projects[projects.length - 1];
    renderProjects(created ? created.id : null);
    toast(`已创建项目：${name}`);
  } catch (err) {
    toast(err.message);
  }
}

let renameTarget = null;

function openRename(project) {
  renameTarget = project;
  $("renameInput").value = project.name;
  $("renameModal").hidden = false;
  setTimeout(() => {
    $("renameInput").focus();
    $("renameInput").select();
  }, 0);
}

function closeRename() {
  renameTarget = null;
  $("renameModal").hidden = true;
}

async function commitRename() {
  if (!renameTarget) return;
  const name = $("renameInput").value.trim();
  if (!name || name === renameTarget.name) {
    closeRename();
    return;
  }
  try {
    const data = await api(`/api/projects/${renameTarget.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    projects = data.projects;
    renderProjects();
    closeRename();
    toast("已改名");
  } catch (err) {
    toast(err.message);
  }
}

$("renameCancel").addEventListener("click", closeRename);
$("renameSave").addEventListener("click", commitRename);
$("renameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") commitRename();
  if (e.key === "Escape") closeRename();
});
$("renameModal").addEventListener("click", (e) => {
  if (e.target.id === "renameModal") closeRename();
});

async function deleteProject(project) {
  if (!window.confirm(`删除“${project.name}”？该项目的专注记录也会一起删除。`)) return;
  try {
    const data = await api(`/api/projects/${project.id}`, { method: "DELETE" });
    projects = data.projects;
    renderProjects();
    renderStats();
    loadSessions();
    toast("已删除");
  } catch (err) {
    toast(err.message);
  }
}

$("addProject").addEventListener("click", addProject);
$("projectName").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addProject();
});

/* ---------------- 统计 ---------------- */
function renderStats() {
  $("todayTotal").textContent = fmtDuration(stats.today || 0);
  $("weekTotal").textContent = fmtDuration(stats.week || 0);
  $("allTotal").textContent = fmtDuration(stats.total || 0);
  $("countTotal").textContent = String(stats.count || 0);
}

async function loadSessions() {
  try {
    const data = await api("/api/sessions?limit=1000");
    sessions = data.sessions || [];
  } catch (err) {
    sessions = [];
  }
  renderSessionList();
  renderAnalytics();
}

function renderSessionList() {
  const list = $("sessionList");
  list.textContent = "";
  if (!sessions.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "还没有专注记录，开始第一段计时吧。";
    list.appendChild(li);
    return;
  }
  sessions.slice(0, 20).forEach((s) => {
    const li = document.createElement("li");
    const left = document.createElement("span");
    left.textContent = `${s.project} · ${fmtDuration(s.seconds)}`;
    const right = document.createElement("span");
    right.className = "muted";
    const d = new Date(s.ended_at * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    right.textContent = `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())} · ${
      s.mode === "countdown" ? "倒计时" : "正计时"
    }`;
    li.append(left, right);
    list.appendChild(li);
  });
}

/* ---------------- 分析图表 ---------------- */
function startOfLocalDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function weekSeries(items, nowMs) {
  const base = startOfLocalDay(nowMs);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    days.push({ date: d, seconds: 0 });
  }
  const index = new Map(days.map((x) => [dayKey(x.date), x]));
  items.forEach((s) => {
    const row = index.get(dayKey(new Date(s.ended_at * 1000)));
    if (row) row.seconds += s.seconds;
  });
  return days.map((x) => ({
    label: `${x.date.getMonth() + 1}/${x.date.getDate()}`,
    weekday: "日一二三四五六"[x.date.getDay()],
    minutes: Math.round(x.seconds / 60),
    today: dayKey(x.date) === dayKey(base),
  }));
}

function todayShare(items, nowMs) {
  const start = Math.floor(startOfLocalDay(nowMs).getTime() / 1000);
  const rows = items.filter((s) => s.ended_at >= start);
  const total = rows.reduce((sum, s) => sum + s.seconds, 0);
  const map = new Map();
  rows.forEach((s) => {
    const name = s.project || "未命名";
    const cur = map.get(name) || { name, color: s.color || "", seconds: 0 };
    cur.seconds += s.seconds;
    map.set(name, cur);
  });
  return {
    total,
    items: [...map.values()]
      .sort((a, b) => b.seconds - a.seconds)
      .map((x) => ({
        ...x,
        minutes: Math.round(x.seconds / 60),
        percent: total ? (x.seconds / total) * 100 : 0,
      })),
  };
}

function streakOf(items, nowMs) {
  const set = new Set(
    items.filter((s) => s.seconds > 0).map((s) => dayKey(new Date(s.ended_at * 1000)))
  );
  const today = startOfLocalDay(nowMs);
  const todayHas = set.has(dayKey(today));
  const cursor = new Date(today);
  if (!todayHas) cursor.setDate(cursor.getDate() - 1);
  let days = 0;
  while (set.has(dayKey(cursor))) {
    days += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { days, todayHas };
}

function heatmapOf(items, nowMs, createdAtSec) {
  const today = startOfLocalDay(nowMs);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const start = new Date(monday);
  start.setDate(monday.getDate() - 49);
  const map = new Map();
  items.forEach((s) => {
    const k = dayKey(new Date(s.ended_at * 1000));
    map.set(k, (map.get(k) || 0) + s.seconds);
  });
  const createdDay = createdAtSec ? startOfLocalDay(createdAtSec * 1000) : null;
  const cells = [];
  for (let i = 0; i < 56; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const future = d.getTime() > today.getTime();
    const before = createdDay && d.getTime() < createdDay.getTime();
    const minutes = Math.round((map.get(dayKey(d)) || 0) / 60);
    let level = 0;
    if (minutes >= 120) level = 4;
    else if (minutes >= 60) level = 3;
    else if (minutes >= 25) level = 2;
    else if (minutes > 0) level = 1;
    cells.push({ date: d, minutes, level, blank: !!future || !!before });
  }
  return cells;
}

function ghostWeek() {
  const box = document.createElement("div");
  box.className = "ghost-week";
  box.setAttribute("aria-hidden", "true");
  [26, 48, 32, 64, 40, 72, 30].forEach((h) => {
    const bar = document.createElement("i");
    bar.className = "ghost-bar";
    bar.style.setProperty("--h", h + "%");
    box.appendChild(bar);
  });
  return box;
}

function ghostShare() {
  const box = document.createElement("div");
  box.className = "ghost-share";
  box.setAttribute("aria-hidden", "true");
  [62, 38, 22].forEach((w) => {
    const row = document.createElement("div");
    row.className = "ghost-share-row";
    const dot = document.createElement("i");
    dot.className = "ghost-dot";
    const track = document.createElement("span");
    track.className = "ghost-track";
    const fill = document.createElement("i");
    fill.style.setProperty("--w", w + "%");
    track.appendChild(fill);
    row.append(dot, track);
    box.appendChild(row);
  });
  return box;
}

function emptyState(ghost, text) {
  const wrap = document.createElement("div");
  wrap.className = "empty-state";
  const p = document.createElement("p");
  p.textContent = text;
  const cta = document.createElement("a");
  cta.className = "link-cta";
  cta.href = "#timer";
  cta.textContent = "去计时";
  wrap.append(ghost, p, cta);
  return wrap;
}

function renderWeekChart(rows) {
  const box = $("weekChart");
  box.textContent = "";
  const max = Math.max(...rows.map((r) => r.minutes), 0);
  box.classList.toggle("is-empty", !max);
  if (!max) {
    box.appendChild(emptyState(ghostWeek(), "最近 7 天还没有记录"));
    return;
  }
  rows.forEach((r) => {
    const col = document.createElement("div");
    col.className = "bar-col" + (r.today ? " today" : "");
    col.tabIndex = 0;
    col.setAttribute("aria-label", `${r.label} ${r.minutes} 分钟`);
    const tip = document.createElement("span");
    tip.className = "bar-tip";
    tip.textContent = `${r.label} · ${r.minutes} 分钟`;
    const wrap = document.createElement("div");
    wrap.className = "bar-wrap";
    const bar = document.createElement("div");
    bar.className = "bar";
    const pct = r.minutes ? Math.max(4, Math.round((r.minutes / max) * 100)) : 0;
    bar.style.setProperty("--h", `${pct}%`);
    wrap.appendChild(bar);
    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = r.weekday;
    col.append(tip, wrap, label);
    box.appendChild(col);
  });
}

function renderTodayShare(share) {
  const box = $("todayShare");
  box.textContent = "";
  box.classList.toggle("is-empty", !share.items.length);
  if (!share.items.length) {
    box.appendChild(emptyState(ghostShare(), "今天还没有项目记录"));
    return;
  }
  share.items.forEach((it) => {
    const row = document.createElement("div");
    row.className = "share-row";
    const name = document.createElement("span");
    name.className = "share-name";
    name.textContent = it.name;
    const track = document.createElement("div");
    track.className = "share-track";
    const fill = document.createElement("div");
    fill.className = "share-fill";
    fill.style.width = `${Math.max(2, it.percent)}%`;
    if (it.color) fill.style.background = it.color;
    track.appendChild(fill);
    const val = document.createElement("span");
    val.className = "share-val";
    val.textContent = `${it.minutes} 分钟 · ${Math.round(it.percent)}%`;
    row.append(name, track, val);
    box.appendChild(row);
  });
}

function renderStreak(streak, cells) {
  $("streakDays").textContent = String(streak.days);
  $("streakNote").textContent = streak.todayHas
    ? "今天已打卡"
    : streak.days
    ? "今天还没开始"
    : "今天开始第一段吧";
  const months = $("heatMonths");
  months.textContent = "";
  let lastMonth = -1;
  for (let w = 0; w < 8; w++) {
    const span = document.createElement("span");
    const month = cells[w * 7].date.getMonth();
    if (month !== lastMonth) span.textContent = `${month + 1}月`;
    lastMonth = month;
    months.appendChild(span);
  }
  const active = cells.filter((c) => c.minutes > 0);
  $("heatDays").textContent = String(active.length);
  $("heatMinutes").textContent = String(cells.reduce((sum, c) => sum + c.minutes, 0));
  const box = $("heatmap");
  box.textContent = "";
  cells.forEach((c) => {
    const el = document.createElement("i");
    el.className = `heat-cell h${c.level}${c.blank ? " blank" : ""}`;
    if (!c.blank) {
      el.title = `${c.date.getMonth() + 1}/${c.date.getDate()} · ${c.minutes} 分钟`;
      el.setAttribute("aria-label", el.title);
    }
    box.appendChild(el);
  });
}

function renderAnalytics() {
  const now = Date.now();
  renderWeekChart(weekSeries(sessions, now));
  renderTodayShare(todayShare(sessions, now));
  renderStreak(streakOf(sessions, now), heatmapOf(sessions, now, user && user.createdAt));
}

window.FocusAnalytics = { weekSeries, todayShare, streakOf, heatmapOf };

/* ---------------- 计时 ---------------- */
function timerKey() {
  return user ? `focus.timer.v1:${user.email}` : null;
}

function persistTimer() {
  const key = timerKey();
  if (!key) return;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        mode: timer.mode,
        target: timer.target,
        running: timer.running,
        startAt: timer.startAt,
        base: timer.base,
        autoSaved: timer.autoSaved,
        projectId: selectedProjectId(),
      })
    );
  } catch (e) {
    /* 存储失败不影响计时 */
  }
}

function clearTimerState() {
  const key = timerKey();
  if (key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      /* 忽略 */
    }
  }
}

function restoreTimer() {
  const key = timerKey();
  if (!key) return;
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(key) || "null");
  } catch (e) {
    saved = null;
  }
  if (!saved || !["countdown", "countup"].includes(saved.mode)) return;

  timer.mode = saved.mode;
  timer.target = Math.min(Math.max(Number(saved.target) || 1500, 60), 86400);
  timer.base = Math.max(0, Number(saved.base) || 0);
  timer.running = !!saved.running;
  timer.startAt = Number(saved.startAt) || 0;
  timer.autoSaved = !!saved.autoSaved;

  document.querySelectorAll("#modeTabs [data-mode]").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === timer.mode);
  });
  $("presets").style.display = timer.mode === "countdown" ? "flex" : "none";
  if (saved.projectId && projects.some((p) => String(p.id) === String(saved.projectId))) {
    $("projectSelect").value = String(saved.projectId);
  }

  if (timer.running) {
    if (!timer.startAt) timer.startAt = Date.now();
    clearInterval(timer.tick);
    timer.tick = setInterval(tick, 200);
  }
  if (timer.mode === "countdown" && elapsed() >= timer.target) {
    clearInterval(timer.tick);
    timer.tick = null;
    timer.base = timer.target;
    timer.running = false;
    timer.autoSaved = true;
    toast("上次倒计时已结束，点“结束并保存”入账");
  }
  renderTimer();
}

function elapsed() {
  return timer.base + (timer.running ? (Date.now() - timer.startAt) / 1000 : 0);
}

function currentRemaining() {
  return Math.max(0, timer.target - elapsed());
}

function renderTimer() {
  const card = document.querySelector(".timer-card");
  card.classList.toggle("running", timer.running);
  if (timer.mode === "countdown") {
    $("digits").textContent = fmtClock(currentRemaining());
    const pct = timer.target ? Math.min(100, (elapsed() / timer.target) * 100) : 0;
    $("meterFill").style.width = `${pct}%`;
  } else {
    $("digits").textContent = fmtClock(elapsed());
    $("meterFill").style.width = "0%";
  }
  $("startBtn").textContent = timer.running ? "暂停" : elapsed() > 0 ? "继续" : "开始";
}

function tick() {
  renderTimer();
  if (timer.mode === "countdown" && !timer.autoSaved && elapsed() >= timer.target) {
    timer.autoSaved = true;
    stopTimer(true);
    beep();
    saveFocus(timer.target, true);
  }
}

function startTimer() {
  if (timer.running) {
    timer.base = elapsed();
    timer.running = false;
    clearInterval(timer.tick);
    timer.tick = null;
    renderTimer();
    persistTimer();
    return;
  }
  if (timer.mode === "countdown" && currentRemaining() <= 0) {
    resetTimer();
  }
  timer.running = true;
  timer.startAt = Date.now();
  clearInterval(timer.tick);
  timer.tick = setInterval(tick, 200);
  renderTimer();
  persistTimer();
}

function stopTimer(keepElapsed = true) {
  if (timer.running) {
    timer.base = elapsed();
  }
  timer.running = false;
  clearInterval(timer.tick);
  timer.tick = null;
  if (!keepElapsed) timer.base = 0;
  renderTimer();
}

function resetTimer() {
  stopTimer(false);
  timer.base = 0;
  timer.autoSaved = false;
  clearTimerState();
  renderTimer();
}

async function saveFocus(seconds, auto = false) {
  const projectId = selectedProjectId();
  if (!projectId) {
    toast("先选择一个项目");
    return;
  }
  if (seconds < 5) {
    if (!auto) toast("少于 5 秒不记录");
    return;
  }
  try {
    const data = await api("/api/focus", {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, mode: timer.mode, seconds }),
    });
    projects = data.projects;
    stats = data.stats;
    sessions = data.sessions;
    renderProjects();
    renderStats();
    loadSessions();
    resetTimer();
    toast(`${auto ? "倒计时结束" : "已保存"}：${fmtDuration(seconds)} → ${data.project}`);
  } catch (err) {
    toast(err.message);
  }
}

$("startBtn").addEventListener("click", startTimer);
$("resetBtn").addEventListener("click", resetTimer);
$("saveBtn").addEventListener("click", () => {
  const secs = Math.floor(timer.mode === "countdown" && timer.autoSaved ? timer.target : elapsed());
  if (secs < 5) {
    toast("先开始计时，满 5 秒后可保存");
    return;
  }
  saveFocus(secs, false);
});

document.querySelectorAll("#modeTabs [data-mode]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (timer.running) {
      toast("先暂停再切换模式");
      return;
    }
    const carried = Math.floor(elapsed());
    timer.mode = btn.dataset.mode;
    document.querySelectorAll("#modeTabs [data-mode]").forEach((b) => b.classList.toggle("active", b === btn));
    $("presets").style.display = timer.mode === "countdown" ? "flex" : "none";
    timer.base = carried;
    timer.target = carried + 25 * 60;
    timer.autoSaved = false;
    document.querySelectorAll("#presets [data-min]").forEach((b) => b.classList.toggle("active", b.dataset.min === "25"));
    clearInterval(timer.tick);
    timer.tick = null;
    persistTimer();
    renderTimer();
  });
});

document.querySelectorAll("#presets [data-min]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (timer.running) {
      toast("先暂停再改时长");
      return;
    }
    const carried = Math.floor(elapsed());
    const minutes = Number(btn.dataset.min);
    timer.base = carried;
    timer.target = carried + minutes * 60;
    timer.autoSaved = false;
    clearInterval(timer.tick);
    timer.tick = null;
    document.querySelectorAll("[data-min]").forEach((b) => b.classList.toggle("active", b === btn));
    persistTimer();
    renderTimer();
  });
});

$("projectSelect").addEventListener("change", persistTimer);
let pausedAway = false;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (timer.running) {
      stopTimer(true);
      pausedAway = true;
    }
    persistTimer();
    return;
  }
  if (pausedAway) {
    pausedAway = false;
    toast("已自动暂停（离开页面）");
  }
});
window.addEventListener("beforeunload", persistTimer);

document.addEventListener("keydown", (e) => {
  if ($("appView").hidden) return;
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea" || tag === "button") return;
  if (e.code === "Space") {
    e.preventDefault();
    startTimer();
  } else if (e.key === "r" || e.key === "R") {
    resetTimer();
  }
});

/* ---------------- 每日鸡汤 ---------------- */
const QUOTES = [
  "你不需要更多时间，你只需要更少分心。",
  "专注不是天赋，是一次次把注意力拿回来。",
  "今天的二十五分钟，胜过明天的三小时。",
  "慢一点没关系，别停下来。",
  "你不是在熬时间，你是在攒未来的底气。",
  "先把眼前这一句看完，再谈远方。",
  "注意力在哪，成果就在哪。",
  "别人刷到的是热闹，你练到的是本事。",
  "坐下来的那一刻，你已经赢了一半。",
  "不用等状态好，开始之后状态才来。",
  "每一段认真，都会在某天替你说话。",
  "把手机放远一点，把目标放近一点。",
  "今天的专注，是明天的从容。",
  "一次只做一件事，做完再做下一件。",
  "你现在的每一分钟，都在给未来投票。",
  "不用感动自己，要看见进度。",
  "学不进去的时候，先坐下来五分钟。",
  "把大目标拆成今天能做完的一小块。",
  "休息是为了走更远，不是放弃。",
  "专注的人，运气都不会太差。",
  "你缺的不是方法，是一次完整的开始。",
  "关掉通知，世界不会塌。",
  "今天的进度条，由你自己推进。",
  "把“等会儿”改成“现在”。",
  "认真做完一件小事，比空想十件大事强。",
  "每一次坐回书桌，都是在扳回一局。",
  "别和昨天比运气，和昨天比时长。",
  "专注不是绷紧，是心无旁骛。",
  "你现在偷的懒，都会变成以后的难。",
  "再坚持二十五分钟，就去休息。",
];

function pickQuote() {
  if (!QUOTES.length) return;
  let last = -1;
  try {
    const stored = Number(localStorage.getItem("focus.quote.last"));
    if (Number.isInteger(stored) && stored >= 0 && stored < QUOTES.length) last = stored;
  } catch (e) {
    /* 隐私模式忽略 */
  }
  let i = Math.floor(Math.random() * QUOTES.length);
  if (i === last) i = (i + 1) % QUOTES.length;
  $("quoteText").textContent = QUOTES[i];
  $("quoteNo").textContent = String(i + 1).padStart(2, "0") + " / " + String(QUOTES.length).padStart(2, "0");
  try {
    localStorage.setItem("focus.quote.last", String(i));
  } catch (e) {
    /* 忽略 */
  }
}

/* ---------------- 启动 ---------------- */
(async function boot() {
  setAuthMode("login");
  pickQuote();
  renderTimer();
  if (window.FocusCloudReady) {
    try {
      await window.FocusCloudReady;
    } catch (e) {
      /* 邮箱确认回跳失败时仍可手动登录 */
    }
  }
  try {
    const me = await api("/api/me");
    enterApp(me);
  } catch (err) {
    showAuth();
  }
})();
