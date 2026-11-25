/* FOCUS! 前端逻辑：登录、项目、计时、统计。 */
const $ = (id) => document.getElementById(id);

let authMode = "login";
let user = null;
let projects = [];
let stats = { total: 0, today: 0, week: 0, count: 0 };
let sessions = [];
let todos = [];
let currentProjectId = null;
const AVATARS = ["🙂", "🐱", "🐶", "🦊", "🐼", "🦁", "🐸", "🐧", "🦉", "🐨", "🐯", "🦄"];
let profile = { username: "", avatar: "🙂", avatarUrl: "", bio: "", goalMinutes: 0, defaultMinutes: 25 };
let pendingAvatar = ""; // 待上传的照片（data URL）
let removeAvatar = false; // 保存时是否删除已上传的照片

const timer = {
  mode: "countdown",
  target: 25 * 60,
  running: false,
  startAt: 0,
  base: 0,
  autoSaved: false,
  tick: null,
  projectId: null,
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

window.FocusToast = toast;
window.FocusTimerState = { running: false, seconds: 0, today: 0 };

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
  $("usernameField").hidden = mode !== "register";
  $("authHint").classList.remove("error");
  $("authHint").textContent =
    mode === "login"
      ? "还没有账号？切到“注册”，用邮箱创建，数据按账号分开保存。"
      : "注册时设置用户名，会显示在右上角；密码至少 6 位。";
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
  const username = $("username").value.trim();
  const hint = $("authHint");
  hint.classList.remove("error");
  if (authMode === "register" && (username.length < 2 || username.length > 20)) {
    hint.textContent = "用户名请填 2-20 个字符";
    hint.classList.add("error");
    return;
  }
  try {
    const data = await api(authMode === "login" ? "/api/login" : "/api/register", {
      method: "POST",
      body: JSON.stringify({ email, password, username }),
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
  exitFull();
  closePip();
  window.dispatchEvent(new Event("focus-logout"));
  user = null;
  $("appView").hidden = true;
  $("authView").hidden = false;
  if (window.FocusAuthScene) window.FocusAuthScene.setActive(true);
  setAuthMode("login");
}

/* ---------------- 视图切换 ---------------- */
const VIEWS = ["timer", "sound", "todo", "room", "stats", "profile", "feedback"];

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
  if (options.scroll !== false) {
    const hash = (location.hash || "").replace("#", "");
    if (view === "timer" && hash === "projects") $("projects").scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
  }
}

window.addEventListener("hashchange", () => showView(currentView()));

/* ---------------- 全屏专注 ---------------- */
let fullActive = false;

function syncFullButton() {
  const btn = $("fullBtn");
  if (!btn) return;
  btn.setAttribute("aria-label", fullActive ? "退出全屏" : "进入全屏专注");
  btn.title = btn.getAttribute("aria-label");
}

async function enterFull() {
  fullActive = true;
  $("focusFull").hidden = false;
  document.body.classList.add("is-full");
  syncFullButton();
  renderTimer();
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  } catch (e) {
    /* 浏览器拒绝原生全屏时仍使用覆盖层 */
  }
}

function exitFull() {
  fullActive = false;
  $("focusFull").hidden = true;
  document.body.classList.remove("is-full");
  syncFullButton();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

$("fullBtn").addEventListener("click", () => (fullActive ? exitFull() : enterFull()));
$("fullExit").addEventListener("click", exitFull);
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && fullActive) exitFull();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && fullActive) exitFull();
});

/* ---------------- 悬浮计时窗 ---------------- */
let pipWin = null;
let pipStyle = null;

function pipCss() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  const ink = v("--ink", "#1a160a");
  const paper = v("--paper", "#f3e9e0");
  const cream = v("--cream", "#fff");
  const red = v("--red", "#e8442e");

  return `
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; }
    body {
      position: relative;
      background: ${paper};
      color: ${ink};
      font-family: "Changa One", "Inter", system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
      user-select: none;
    }
    .time {
      font-size: 50px;
      line-height: .9;
      letter-spacing: -2px;
      font-variant-numeric: tabular-nums;
    }
    .row {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 8px;
      display: flex;
      justify-content: center;
      gap: 8px;
      opacity: 0;
      transition: opacity .15s ease;
    }
    body:hover .row,
    body:focus-within .row { opacity: 1; }
    button {
      font-family: "Inter", system-ui, sans-serif;
      font-size: 12px;
      font-weight: 800;
      padding: 5px 15px;
      border-radius: 999px;
      border: 2px solid ${ink};
      background: transparent;
      color: ${ink};
      cursor: pointer;
    }
    button:disabled { opacity: .35; cursor: default; }
    #pipToggle { background: ${ink}; color: ${cream}; }
    #pipEnd { border-color: ${red}; color: ${red}; }
  `;
}

function applyPipTheme() {
  if (!pipWin || pipWin.closed || !pipStyle) return;
  pipStyle.textContent = pipCss();
}

function closePip() {
  if (pipWin && !pipWin.closed) pipWin.close();
  pipWin = null;
  pipStyle = null;
}

async function openPip() {
  if (!("documentPictureInPicture" in window)) {
    toast("当前浏览器不支持悬浮窗，请使用 Edge 或 Chrome");
    return;
  }
  if (pipWin && !pipWin.closed) {
    pipWin.focus();
    return;
  }
  try {
    pipWin = await window.documentPictureInPicture.requestWindow({ width: 240, height: 118 });
  } catch (e) {
    toast("悬浮窗打开失败，请检查浏览器权限");
    return;
  }
  const doc = pipWin.document;
  doc.title = "FOCUS! 计时";
  const font = doc.createElement("link");
  font.rel = "stylesheet";
  font.href = "https://fonts.googleapis.com/css2?family=Changa+One&family=Inter:wght@700;800&display=swap";
  doc.head.appendChild(font);
  pipStyle = doc.createElement("style");
  doc.head.appendChild(pipStyle);
  applyPipTheme();

  doc.body.innerHTML = `
    <div class="time" id="pipTime">25:00</div>
    <div class="row">
      <button id="pipToggle" type="button">暂停</button>
      <button id="pipEnd" type="button">结束</button>
    </div>`;

  doc.getElementById("pipToggle").addEventListener("click", startTimer);
  doc.getElementById("pipEnd").addEventListener("click", async () => {
    const secs = Math.floor(timer.mode === "countdown" && timer.autoSaved ? timer.target : elapsed());
    if (secs < 5) {
      toast("先开始计时，满 5 秒后可保存");
      return;
    }
    const saved = await saveFocus(secs, false);
    if (saved) closePip();
  });
  pipWin.addEventListener("pagehide", () => {
    pipWin = null;
    pipStyle = null;
  });
  try {
    pipWin.resizeTo(240, 118);
  } catch (e) {
    /* 部分浏览器不允许脚本调整悬浮窗尺寸 */
  }
  renderTimer();
}

$("pipBtn").addEventListener("click", openPip);
window.addEventListener("focus-theme", applyPipTheme);

function enterApp(me) {
  user = {
    email: me.email,
    username: me.username || "",
    created_at: me.created_at,
    createdAt: me.created_at,
  };
  profile = {
    username: me.username || "",
    avatar: me.avatar || "🙂",
    avatarUrl: me.avatarUrl || "",
    bio: me.bio || "",
    goalMinutes: Number(me.goalMinutes) || 0,
    defaultMinutes: Number(me.defaultMinutes) || 25,
  };
  pendingAvatar = "";
  removeAvatar = false;
  stats = me.stats || stats;
  projects = me.projects || [];
  $("authView").hidden = true;
  $("appView").hidden = false;
  if (window.FocusAuthScene) window.FocusAuthScene.setActive(false);
  renderUserChip();
  renderProfile();
  $("resendBtn").hidden = true;
  pickQuote();
  renderProjects();
  renderStats();
  loadTodos();
  renderTodos();
  loadSessions();
  restoreTimer();
  renderTimer();
  applyDefaultDuration();
  showView(currentView(), { scroll: false });
}

/* ---------------- 个人资料 ---------------- */
function paintAvatar(el, url, emoji) {
  if (!el) return;
  el.textContent = "";
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "头像";
    el.appendChild(img);
    el.classList.add("has-photo");
  } else {
    el.textContent = emoji || "🙂";
    el.classList.remove("has-photo");
  }
}

function renderUserChip() {
  const name = profile.username || (user && user.email ? user.email.split("@")[0] : "");
  paintAvatar($("navAvatar"), profile.avatarUrl, profile.avatar);
  $("userEmail").textContent = name;
  $("userEmail").title = user ? user.email : "";
  window.FocusProfile = { name, avatar: profile.avatar || "🙂", avatarUrl: profile.avatarUrl || "" };
}

function renderProfile() {
  if (!user) return;
  const name = profile.username || user.email.split("@")[0];
  paintAvatar($("profileAvatarBig"), profile.avatarUrl, profile.avatar);
  $("avatarRemoveBtn").hidden = !profile.avatarUrl;
  $("profileNamePreview").textContent = name;
  $("profileEmail").textContent = user.email;
  $("profileEmailText").textContent = user.email;
  const created = user.createdAt || user.created_at;
  $("profileCreated").textContent = created ? new Date(created * 1000).toLocaleDateString("zh-CN") : "-";
  $("profileTotal").textContent = fmtDuration(stats.total || 0);
  $("profileToday").textContent = fmtDuration(stats.today || 0);
  $("profileName").value = name;
  $("profileBio").value = profile.bio || "";
  $("profileGoal").value = profile.goalMinutes || "";
  $("profileDefault").value = profile.defaultMinutes || "";

  const picker = $("avatarPicker");
  picker.textContent = "";
  AVATARS.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "avatar-option" + (!profile.avatarUrl && emoji === (profile.avatar || "🙂") ? " active" : "");
    btn.textContent = emoji;
    btn.setAttribute("aria-label", `选择头像 ${emoji}`);
    btn.addEventListener("click", () => {
      if (profile.avatarUrl) removeAvatar = true;
      pendingAvatar = "";
      profile.avatarUrl = "";
      profile.avatar = emoji;
      renderProfile();
    });
    picker.appendChild(btn);
  });
  renderUserChip();
}

/* 读取照片并居中裁成 192×192 的 JPEG（体积小，便于云端与本地保存） */
function readAvatarFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) {
      reject(new Error("请选择图片文件"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("图片不能超过 5MB"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("图片格式无法识别"));
      img.onload = () => {
        try {
          const size = Math.min(img.width, img.height);
          const sx = Math.floor((img.width - size) / 2);
          const sy = Math.floor((img.height - size) / 2);
          const canvas = document.createElement("canvas");
          canvas.width = 192;
          canvas.height = 192;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, 192, 192);
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 192, 192);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } catch (e) {
          reject(new Error("图片处理失败，请换一张试试"));
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

$("avatarUploadBtn").addEventListener("click", () => $("avatarFile").click());
$("avatarFile").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const dataUrl = await readAvatarFile(file);
    pendingAvatar = dataUrl;
    removeAvatar = false;
    profile.avatarUrl = dataUrl;
    profile.avatar = profile.avatar || "🙂";
    renderProfile();
    toast("照片已选好，记得点保存资料");
  } catch (err) {
    toast(err.message);
  }
});
$("avatarRemoveBtn").addEventListener("click", () => {
  pendingAvatar = "";
  removeAvatar = true;
  profile.avatarUrl = "";
  renderProfile();
  toast("已移除照片，保存后生效");
});

async function saveProfile() {
  const name = $("profileName").value.trim();
  if (name.length < 2 || name.length > 20) {
    toast("昵称请填 2-20 个字符");
    return;
  }
  const goalMinutes = Number($("profileGoal").value) || 0;
  const defaultMinutes = Number($("profileDefault").value) || 25;
  if (goalMinutes < 0 || goalMinutes > 1440) {
    toast("每日目标请填 0-1440 分钟");
    return;
  }
  if (defaultMinutes < 1 || defaultMinutes > 600) {
    toast("默认专注请填 1-600 分钟");
    return;
  }
  const bio = $("profileBio").value.trim().slice(0, 80);
  const btn = $("profileSave");
  btn.disabled = true;
  btn.textContent = "保存中…";
  try {
    const data = await api("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({
        username: name,
        avatar: profile.avatar,
        avatarData: pendingAvatar || undefined,
        removeAvatar: removeAvatar || undefined,
        bio,
        goalMinutes,
        defaultMinutes,
      }),
    });
    profile = {
      username: data.username || name,
      avatar: data.avatar || profile.avatar,
      avatarUrl: data.avatarUrl || "",
      bio: data.bio || "",
      goalMinutes: Number(data.goalMinutes) || 0,
      defaultMinutes: Number(data.defaultMinutes) || 25,
    };
    pendingAvatar = "";
    removeAvatar = false;
    if (data.email) user.email = data.email;
    if (data.stats) stats = data.stats;
    renderProfile();
    renderStats();
    if (!timer.running && timer.base === 0 && profile.defaultMinutes) {
      timer.target = profile.defaultMinutes * 60;
      timer.autoSaved = false;
      $("customMin").value = profile.defaultMinutes;
      document.querySelectorAll("#presets [data-min]").forEach((b) => {
        b.classList.toggle("active", Number(b.dataset.min) === profile.defaultMinutes);
      });
      renderTimer();
      persistTimer();
    }
    window.dispatchEvent(new Event("focus-profile"));
    toast("资料已保存");
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "保存资料";
  }
}

function applyDefaultDuration() {
  const key = timerKey();
  if (!key || localStorage.getItem(key)) return;
  if (timer.running || timer.base > 0) return;
  const minutes = Number(profile.defaultMinutes) || 0;
  if (minutes < 1) return;
  timer.target = minutes * 60;
  timer.autoSaved = false;
  $("customMin").value = minutes;
  document.querySelectorAll("#presets [data-min]").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.min) === minutes);
  });
  renderTimer();
}

$("profileSave").addEventListener("click", saveProfile);
$("profileChip").addEventListener("click", () => {
  location.hash = "profile";
});

$("logoutBtn").addEventListener("click", async () => {
  exitFull();
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
  return currentProjectId || null;
}

const ARCHIVE_PREFIX = "已归档 · ";
const isArchived = (p) => p.name.startsWith(ARCHIVE_PREFIX);
const activeProjects = () => projects.filter((p) => !isArchived(p));

function projectAction(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function renderProjects(preferredId) {
  const grid = $("projectGrid");
  grid.textContent = "";
  const actives = activeProjects();

  if (!actives.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "还没有进行中的项目，先添加一个。";
    grid.appendChild(empty);
  }

  actives.forEach((p) => {
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
    actions.append(
      projectAction("详情", () => openDetail(p)),
      projectAction("改名", () => openRename(p)),
      projectAction("归档", () => archiveProject(p))
    );

    card.append(title, total, meta, actions);
    grid.appendChild(card);
  });

  const archived = projects.filter(isArchived);
  const list = $("archivedList");
  list.textContent = "";
  $("archivedBox").hidden = !archived.length;
  archived.forEach((p) => {
    const card = document.createElement("article");
    card.className = "archived-card";
    const name = document.createElement("strong");
    name.textContent = p.name;
    const meta = document.createElement("span");
    meta.textContent = `总时长 ${fmtDuration(p.total)} · ${p.count} 次`;
    const actions = document.createElement("div");
    actions.className = "archived-actions";
    actions.append(
      projectAction("详情", () => openDetail(p)),
      projectAction("恢复", () => restoreProject(p))
    );
    card.append(name, meta, actions);
    list.appendChild(card);
  });

  const ids = actives.map((p) => String(p.id));
  let next = preferredId != null ? String(preferredId) : currentProjectId;
  if (timer.projectId && (timer.running || timer.base > 0) && ids.includes(String(timer.projectId))) {
    next = String(timer.projectId);
  }
  if (!next || !ids.includes(next)) next = ids[0] || null;
  currentProjectId = next;
  renderPicker();
}

/* ---------------- 项目选择器 ---------------- */
function renderPicker() {
  const actives = activeProjects();
  if (!actives.some((p) => String(p.id) === String(currentProjectId))) {
    currentProjectId = actives.length ? String(actives[0].id) : null;
  }
  const cur = actives.find((p) => String(p.id) === String(currentProjectId));
  $("pickerName").textContent = cur ? cur.name : "先新建一个项目";
  $("pickerDot").style.background = cur ? cur.color || "#FF3B2F" : "transparent";

  const menu = $("projectMenu");
  menu.textContent = "";
  if (!actives.length) {
    const li = document.createElement("li");
    li.className = "picker-empty";
    li.textContent = "还没有进行中的项目";
    menu.appendChild(li);
    return;
  }
  actives.forEach((p) => {
    const selected = String(p.id) === String(currentProjectId);
    const item = document.createElement("li");
    item.className = "picker-item" + (selected ? " active" : "");
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", selected ? "true" : "false");
    item.tabIndex = 0;

    const dot = document.createElement("span");
    dot.className = "picker-dot";
    dot.style.background = p.color || "#FF3B2F";
    const name = document.createElement("span");
    name.className = "picker-name";
    name.textContent = p.name;
    const check = document.createElement("span");
    check.className = "picker-check";
    check.textContent = selected ? "✓" : "";

    item.append(dot, name, check);
    item.addEventListener("click", () => chooseProject(p.id));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        chooseProject(p.id);
      }
    });
    menu.appendChild(item);
  });
}

function openPicker() {
  $("projectMenu").hidden = false;
  $("projectPickerBtn").setAttribute("aria-expanded", "true");
}

function closePicker() {
  $("projectMenu").hidden = true;
  $("projectPickerBtn").setAttribute("aria-expanded", "false");
}

$("projectPickerBtn").addEventListener("click", () => {
  if ($("projectMenu").hidden) openPicker();
  else closePicker();
});
document.addEventListener("click", (e) => {
  if (!$("projectPicker").contains(e.target)) closePicker();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("projectMenu").hidden) closePicker();
});

async function chooseProject(nextId) {
  nextId = nextId == null ? null : String(nextId);
  closePicker();
  if (!nextId || nextId === String(currentProjectId)) return;

  const bound = timer.projectId;
  const pending = timer.running || elapsed() > 0;
  if (!pending || !bound) {
    currentProjectId = nextId;
    renderPicker();
    persistTimer();
    return;
  }

  const boundProject = projects.find((p) => String(p.id) === String(bound));
  const ok = await askConfirm({
    title: "切换项目",
    message: `当前计时绑定在「${boundProject ? boundProject.name : "原项目"}」。\n切换项目会先结束并保存这条记录。`,
    okText: "结束并切换",
  });
  if (!ok) return;

  const secs = Math.floor(timer.mode === "countdown" && timer.autoSaved ? timer.target : elapsed());
  stopTimer(true);
  if (secs < 5) {
    timer.base = 0;
    timer.autoSaved = false;
    timer.projectId = nextId;
    currentProjectId = nextId;
    clearTimerState();
    renderPicker();
    renderTimer();
    persistTimer();
    toast("记录不足 5 秒，未保存");
    return;
  }
  const saved = await saveFocus(secs, false, bound, nextId);
  if (!saved) {
    timer.projectId = bound;
    currentProjectId = bound;
    renderPicker();
    persistTimer();
  }
}

const PROJECT_COLORS = ["#FF3B2F", "#C6FF3D", "#FFD166", "#7BD389", "#8AB6FF", "#FF8FC7"];
let projectDraftColor = PROJECT_COLORS[0];

function renderProjectColorGrid() {
  const grid = $("projectColorGrid");
  grid.textContent = "";
  PROJECT_COLORS.forEach((color) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "color-swatch" + (color === projectDraftColor ? " active" : "");
    btn.style.background = color;
    btn.setAttribute("aria-label", `选择项目颜色 ${color}`);
    btn.addEventListener("click", () => {
      projectDraftColor = color;
      renderProjectColorGrid();
    });
    grid.appendChild(btn);
  });
}

function openProjectModal() {
  projectDraftColor = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
  $("projectModalName").value = "";
  renderProjectColorGrid();
  $("projectModal").hidden = false;
  setTimeout(() => $("projectModalName").focus(), 0);
}

function closeProjectModal() {
  $("projectModal").hidden = true;
}

async function createProjectFromModal() {
  const input = $("projectModalName");
  const name = input.value.trim();
  if (!name) {
    toast("先输入项目名称");
    input.focus();
    return;
  }
  const btn = $("projectModalCreate");
  btn.disabled = true;
  btn.textContent = "创建中…";
  try {
    const data = await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, color: projectDraftColor }),
    });
    projects = data.projects;
    const created = projects[projects.length - 1];
    renderProjects(created ? created.id : null);
    closeProjectModal();
    toast(`已创建项目：${name}`);
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "创建项目";
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
    loadSessions();
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

/* ---------------- 站内确认框 ---------------- */
let confirmResolve = null;

function askConfirm({ title = "确认操作", message = "", okText = "确定", danger = false } = {}) {
  $("confirmTitle").textContent = title;
  $("confirmText").textContent = message;
  $("confirmOk").textContent = okText;
  $("confirmOk").classList.toggle("danger", !!danger);
  $("confirmModal").hidden = false;
  $("confirmOk").focus();
  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
}

function closeConfirm(result) {
  if (!confirmResolve) return;
  const resolve = confirmResolve;
  confirmResolve = null;
  $("confirmModal").hidden = true;
  resolve(result);
}

$("confirmOk").addEventListener("click", () => closeConfirm(true));
$("confirmCancel").addEventListener("click", () => closeConfirm(false));
$("confirmModal").addEventListener("click", (e) => {
  if (e.target.id === "confirmModal") closeConfirm(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("confirmModal").hidden) {
    e.stopImmediatePropagation();
    closeConfirm(false);
  }
});

async function archiveProject(project) {
  if (isArchived(project)) return;
  if ((timer.running || timer.base > 0) && String(timer.projectId) === String(project.id)) {
    toast("当前计时绑定该项目，请先结束计时");
    return;
  }
  if (activeProjects().length <= 1) {
    toast("至少保留一个进行中的项目");
    return;
  }
  if (!project.count) {
    const remove = await askConfirm({
      title: "删除项目",
      message: `“${project.name}”还没有专注记录，直接删除？`,
      okText: "删除",
      danger: true,
    });
    if (remove) deleteProject(project, true);
    return;
  }
  const ok = await askConfirm({
    title: "归档项目",
    message: `“${project.name}”有 ${project.count} 次记录（共 ${fmtDuration(project.total)}）。\n归档后项目从列表隐藏，记录会保留在统计里。`,
    okText: "归档",
  });
  if (!ok) return;
  try {
    const data = await api(`/api/projects/${project.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: (ARCHIVE_PREFIX + project.name).slice(0, 40) }),
    });
    projects = data.projects;
    closeDetail();
    renderProjects();
    loadSessions();
    toast("已归档，记录已保留");
  } catch (err) {
    toast(err.message);
  }
}

async function restoreProject(project) {
  if (!isArchived(project)) return;
  const name = project.name.slice(ARCHIVE_PREFIX.length).trim() || "未命名项目";
  try {
    const data = await api(`/api/projects/${project.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    projects = data.projects;
    closeDetail();
    renderProjects();
    loadSessions();
    toast("已恢复项目");
  } catch (err) {
    toast(err.message);
  }
}

async function deleteProject(project, skipConfirm = false) {
  if ((timer.running || timer.base > 0) && String(timer.projectId) === String(project.id)) {
    toast("当前计时绑定该项目，请先结束计时");
    return;
  }
  if (!skipConfirm) {
    const extra = project.count ? `\n该项目的 ${project.count} 次记录会一并清除，且无法恢复。` : "";
    const ok = await askConfirm({
      title: "彻底删除项目",
      message: `确定删除“${project.name}”？${extra}`,
      okText: "删除并清除",
      danger: true,
    });
    if (!ok) return;
  }
  try {
    const data = await api(`/api/projects/${project.id}`, { method: "DELETE" });
    projects = data.projects;
    closeDetail();
    renderProjects();
    renderStats();
    loadSessions();
    toast("已删除");
  } catch (err) {
    toast(err.message);
  }
}

/* ---------------- 项目详情 ---------------- */
let detailTarget = null;

function startOfLocalWeek(ms) {
  const d = startOfLocalDay(ms);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function openDetail(project) {
  detailTarget = project;
  $("detailModal").hidden = false;
  renderDetail();
}

function closeDetail() {
  detailTarget = null;
  $("detailModal").hidden = true;
}

function renderDetail() {
  const p = detailTarget;
  if (!p) return;
  const archived = isArchived(p);
  const own = sessions.filter((s) => s.project === p.name);
  const weekStart = Math.floor(startOfLocalWeek(Date.now()).getTime() / 1000);
  const weekSec = own.filter((s) => s.ended_at >= weekStart).reduce((sum, s) => sum + s.seconds, 0);

  $("detailTitle").textContent = p.name;
  $("detailState").textContent = archived
    ? "已归档 · 记录仍保留在统计中，可随时恢复"
    : `共 ${p.count} 次专注`;
  $("detailTotal").textContent = fmtDuration(p.total);
  $("detailToday").textContent = fmtDuration(p.today);
  $("detailWeek").textContent = fmtDuration(weekSec);
  $("detailCount").textContent = String(p.count);
  $("detailShare").textContent = stats.total ? `${Math.round((p.total / stats.total) * 100)}%` : "0%";
  renderWeekChart($("detailWeekChart"), weekSeries(own, Date.now()), { compact: true });

  const list = $("detailList");
  list.textContent = "";
  if (!own.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "还没有专注记录。";
    list.appendChild(li);
  } else {
    own.slice(0, 10).forEach((s) => list.appendChild(sessionItem(s, true)));
  }

  $("detailArchive").hidden = archived;
  $("detailRestore").hidden = !archived;
  $("detailArchive").disabled = !archived && activeProjects().length <= 1;
  $("detailArchive").title = $("detailArchive").disabled ? "至少保留一个进行中的项目" : "";
}

$("detailClose").addEventListener("click", closeDetail);
$("detailModal").addEventListener("click", (e) => {
  if (e.target.id === "detailModal") closeDetail();
});
$("detailArchive").addEventListener("click", () => detailTarget && archiveProject(detailTarget));
$("detailRestore").addEventListener("click", () => detailTarget && restoreProject(detailTarget));
$("detailDelete").addEventListener("click", () => detailTarget && deleteProject(detailTarget));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("confirmModal").hidden && !$("detailModal").hidden) closeDetail();
});

$("openProjectModal").addEventListener("click", openProjectModal);
$("projectModalCancel").addEventListener("click", closeProjectModal);
$("projectModalCreate").addEventListener("click", createProjectFromModal);
$("projectModalName").addEventListener("keydown", (e) => {
  if (e.key === "Enter") createProjectFromModal();
  if (e.key === "Escape") closeProjectModal();
});
$("projectModal").addEventListener("click", (e) => {
  if (e.target.id === "projectModal") closeProjectModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("projectModal").hidden) closeProjectModal();
  else if (!$("todoModal").hidden) closeTodoModal();
  else if (!$("presetModal").hidden) closePresetModal();
});

/* ---------------- 待办清单 ---------------- */
function todoKey() {
  return user ? `focus.todos.v1:${user.email}` : null;
}

function loadTodos() {
  const key = todoKey();
  todos = [];
  if (!key) return;
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(data)) {
      todos = data
        .filter((t) => t && typeof t.text === "string" && t.text.trim())
        .map((t) => ({ text: t.text, done: !!t.done, important: !!t.important }));
    }
  } catch (e) {
    todos = [];
  }
}

function saveTodos() {
  const key = todoKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(todos));
  } catch (e) {
    /* 存储失败不影响当前操作 */
  }
}

function renderTodos() {
  const list = $("todoList");
  list.textContent = "";
  $("todoEmpty").hidden = todos.length > 0;
  todos.forEach((todo, index) => {
    const card = document.createElement("article");
    card.className = "todo-card" + (todo.done ? " done" : "");

    const head = document.createElement("div");
    head.className = "todo-card-head";

    const label = document.createElement("label");
    label.className = "todo-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = todo.done;
    input.setAttribute("aria-label", todo.done ? "标记为未完成" : "标记为已完成");
    input.addEventListener("change", () => {
      todos[index].done = input.checked;
      saveTodos();
      renderTodos();
    });
    const box = document.createElement("span");
    box.className = "todo-box";
    label.append(input, box);

    const text = document.createElement("h3");
    text.className = "todo-text";
    text.textContent = todo.text;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "todo-del";
    del.textContent = "×";
    del.setAttribute("aria-label", "删除待办");
    del.addEventListener("click", () => {
      todos.splice(index, 1);
      saveTodos();
      renderTodos();
    });

    head.append(label, text, del);

    const meta = document.createElement("div");
    meta.className = "todo-meta";
    if (todo.important && !todo.done) {
      const badge = document.createElement("span");
      badge.className = "todo-badge";
      badge.textContent = "重要";
      meta.appendChild(badge);
    }
    meta.appendChild(document.createTextNode(todo.done ? "已完成" : "未完成"));

    card.append(head, meta);
    list.appendChild(card);
  });
}

function openTodoModal() {
  $("todoModalText").value = "";
  $("todoModalImportant").checked = false;
  $("todoModal").hidden = false;
  setTimeout(() => $("todoModalText").focus(), 0);
}

function closeTodoModal() {
  $("todoModal").hidden = true;
}

function addTodoFromModal() {
  const input = $("todoModalText");
  const text = input.value.trim();
  if (!text) {
    toast("先写点内容");
    input.focus();
    return;
  }
  todos.push({ text, done: false, important: $("todoModalImportant").checked });
  saveTodos();
  renderTodos();
  closeTodoModal();
}

$("openTodoModal").addEventListener("click", openTodoModal);
$("todoModalCancel").addEventListener("click", closeTodoModal);
$("todoModalSave").addEventListener("click", addTodoFromModal);
$("todoModalText").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTodoFromModal();
  if (e.key === "Escape") closeTodoModal();
});
$("todoModal").addEventListener("click", (e) => {
  if (e.target.id === "todoModal") closeTodoModal();
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
  if (detailTarget) renderDetail();
}

function sessionItem(s, withoutProject = false) {
  const li = document.createElement("li");
  const left = document.createElement("span");
  left.textContent = withoutProject ? fmtDuration(s.seconds) : `${s.project} · ${fmtDuration(s.seconds)}`;
  const right = document.createElement("span");
  right.className = "muted";
  const d = new Date(s.ended_at * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  right.textContent = `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())} · ${
    s.mode === "countdown" ? "倒计时" : "正计时"
  }`;
  li.append(left, right);
  return li;
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
  sessions.slice(0, 20).forEach((s) => list.appendChild(sessionItem(s)));
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

function renderWeekChart(box, rows, options = {}) {
  box.textContent = "";
  const max = Math.max(...rows.map((r) => r.minutes), 0);
  box.classList.toggle("is-empty", !max && !options.compact);
  if (!max) {
    if (options.compact) {
      const p = document.createElement("p");
      p.className = "detail-empty";
      p.textContent = "最近 7 天还没有记录。";
      box.appendChild(p);
    } else {
      box.appendChild(emptyState(ghostWeek(), "最近 7 天还没有记录"));
    }
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
  renderWeekChart($("weekChart"), weekSeries(sessions, now));
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
        projectId: timer.projectId || selectedProjectId(),
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
  $("presetRow").style.display = timer.mode === "countdown" ? "flex" : "none";
  if (saved.projectId && projects.some((p) => String(p.id) === String(saved.projectId))) {
    timer.projectId = String(saved.projectId);
    if (activeProjects().some((p) => String(p.id) === timer.projectId)) currentProjectId = timer.projectId;
    renderPicker();
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
  let text;
  if (timer.mode === "countdown") {
    text = fmtClock(currentRemaining());
    const pct = timer.target ? Math.min(100, (elapsed() / timer.target) * 100) : 0;
    $("meterFill").style.width = `${pct}%`;
  } else {
    text = fmtClock(elapsed());
    $("meterFill").style.width = "0%";
  }
  $("digits").textContent = text;
  $("fullDigits").textContent = text;
  $("startBtn").textContent = timer.running ? "暂停" : elapsed() > 0 ? "继续" : "开始";
  $("pipBtn").disabled = elapsed() < 5;
  $("pipBtn").title = $("pipBtn").disabled ? "开始计时后可用" : "在桌面悬浮显示计时";
  const seconds = Math.floor(elapsed());
  const prevState = window.FocusTimerState;
  if (!prevState || prevState.running !== timer.running || prevState.seconds !== seconds) {
    window.FocusTimerState = {
      running: timer.running,
      seconds,
      today: (stats.today || 0) + seconds,
    };
    window.dispatchEvent(new CustomEvent("focus-timer", { detail: window.FocusTimerState }));
  }
  if (pipWin && !pipWin.closed) {
    const doc = pipWin.document;
    const time = doc.getElementById("pipTime");
    if (time) time.textContent = text;
    const toggle = doc.getElementById("pipToggle");
    if (toggle) toggle.textContent = timer.running ? "暂停" : elapsed() > 0 ? "继续" : "开始";
    const end = doc.getElementById("pipEnd");
    if (end) end.disabled = elapsed() < 5;
  }
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
  if (!timer.projectId) {
    const pid = selectedProjectId();
    if (!pid) {
      toast("先选择一个项目");
      return;
    }
    timer.projectId = pid;
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
  timer.projectId = null;
  clearTimerState();
  renderTimer();
}

async function saveFocus(seconds, auto = false, projectId = timer.projectId || selectedProjectId(), nextProjectId = null) {
  if (!projectId) {
    toast("先选择一个项目");
    return false;
  }
  if (seconds < 5) {
    if (!auto) toast("少于 5 秒不记录");
    return false;
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
    if (nextProjectId) {
      timer.projectId = String(nextProjectId);
      currentProjectId = timer.projectId;
      renderPicker();
      persistTimer();
    }
    toast(`${auto ? "倒计时结束" : "已保存"}：${fmtDuration(seconds)} → ${data.project}`);
    return true;
  } catch (err) {
    toast(err.message);
    return false;
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
    $("presetRow").style.display = timer.mode === "countdown" ? "flex" : "none";
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
    document.querySelectorAll("#presets [data-min]").forEach((b) => b.classList.toggle("active", b === btn));
    persistTimer();
    renderTimer();
  });
});

function applyCustomMinutes() {
  if (timer.running) {
    toast("先暂停再改时长");
    return;
  }
  const minutes = Number($("customMin").value);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) {
    toast("请输入 1-600 分钟");
    return;
  }
  const carried = Math.floor(elapsed());
  timer.base = carried;
  timer.target = carried + Math.round(minutes) * 60;
  timer.autoSaved = false;
  clearInterval(timer.tick);
  timer.tick = null;
  document.querySelectorAll("#presets [data-min]").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.min) === Math.round(minutes));
  });
  persistTimer();
  renderTimer();
  toast(`已设为 ${Math.round(minutes)} 分钟`);
}

$("customApply").addEventListener("click", applyCustomMinutes);
$("customMin").addEventListener("keydown", (e) => {
  if (e.key === "Enter") applyCustomMinutes();
});

document.addEventListener("visibilitychange", persistTimer);
window.addEventListener("beforeunload", persistTimer);

document.addEventListener("keydown", (e) => {
  if ($("appView").hidden || !$("confirmModal").hidden) return;
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

/* ---------------- 学习环境音 ---------------- */
const AUDIO_BASE = window.FOCUS_AUDIO_BASE || "/static/audio/";
const SOUNDS = [
  { id: "rain-indoor", name: "室内雨声", layer: "底噪", file: "rain-indoor.mp3", meta: "13:52 · 雨声" },
  { id: "rain-thunder", name: "远处雷雨", layer: "场景", file: "rain-thunder.mp3", meta: "2:04 · 雷雨" },
  { id: "cafe-murmur", name: "咖啡馆人声", layer: "场景", file: "cafe-murmur.mp3", meta: "2:17 · 人声" },
  { id: "cafe-cups", name: "咖啡馆杯碟", layer: "场景", file: "cafe-cups.mp3", meta: "1:57 · 杯碟" },
  { id: "library-chatter", name: "图书馆人声", layer: "场景", file: "library-chatter.mp3", meta: "2:09 · 低语" },
  { id: "library-roomtone", name: "图书馆底噪", layer: "底噪", file: "library-roomtone.mp3", meta: "0:11 · 空间" },
  { id: "fireplace", name: "壁炉柴火", layer: "场景", file: "fireplace.mp3", meta: "1:49 · 柴火" },
  { id: "keyboard", name: "机械键盘", layer: "细节", file: "keyboard.mp3", meta: "0:31 · 键盘" },
  { id: "forest-birds", name: "森林鸟鸣", layer: "底噪", file: "forest-birds.mp3", meta: "5:28 · 森林" },
  { id: "ocean-waves", name: "海浪", layer: "底噪", file: "ocean-waves.mp3", meta: "2:19 · 海浪" },
  { id: "stream", name: "溪流", layer: "细节", file: "stream.mp3", meta: "0:34 · 水流" },
  { id: "wind", name: "风声", layer: "细节", file: "wind.mp3", meta: "0:19 · 微风" },
  { id: "train-interior", name: "火车站内", layer: "场景", file: "train-interior.mp3", meta: "0:49 · 车站" },
  { id: "crickets", name: "夏夜虫鸣", layer: "细节", file: "crickets.mp3", meta: "0:10 · 虫鸣" },
  { id: "page-turn", name: "翻书页", layer: "细节", file: "page-turn.mp3", meta: "0:27 · 纸张" },
];
const SOUND_LAYERS = [
  { key: "底噪", desc: "持续铺底，撑起整个空间" },
  { key: "场景", desc: "把耳朵带到某个地方" },
  { key: "细节", desc: "少量点缀，增加真实感" },
];
const SOUND_PRESETS = [
  {
    id: "rain-cafe",
    name: "雨天咖啡馆",
    mix: { "rain-indoor": 45, "cafe-murmur": 12 },
  },
  {
    id: "night-library",
    name: "深夜图书馆",
    mix: { "library-roomtone": 40, "library-chatter": 12 },
  },
  {
    id: "forest-study",
    name: "森林自习",
    mix: { stream: 40, "forest-birds": 13 },
  },
  {
    id: "fireplace-read",
    name: "壁炉夜读",
    mix: { "rain-indoor": 40, fireplace: 14 },
  },
  {
    id: "seaside",
    name: "海边放空",
    mix: { "ocean-waves": 45, wind: 9 },
  },
];
const SOUND_MAP = SOUNDS.reduce((map, s) => {
  map[s.id] = s;
  return map;
}, {});
const SOUND_KEYS = {
  mix: "focus.sound.mix.v3",
  custom: "focus.sound.custom.v3",
};

const soundAudios = {};
let soundBuilt = false;
let soundSaveTimer = null;
let soundLastRunning = false;
let soundBlockedWarned = false;
let soundState = {
  mix: { ...SOUND_PRESETS[0].mix },
  master: 70,
  autoplay: false,
  presetId: SOUND_PRESETS[0].id,
  custom: [],
};

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function sanitizeSoundMix(raw) {
  const mix = {};
  if (!raw || typeof raw !== "object") return mix;
  SOUNDS.forEach((s) => {
    const value = clampPercent(raw[s.id]);
    if (value > 0) mix[s.id] = value;
  });
  return mix;
}

function loadSoundState() {
  let hasStoredMix = false;
  try {
    const saved = JSON.parse(localStorage.getItem(SOUND_KEYS.mix) || "null");
    if (saved && typeof saved === "object") {
      if (saved.mix && typeof saved.mix === "object") {
        soundState.mix = sanitizeSoundMix(saved.mix);
        hasStoredMix = true;
      }
      if (Number.isFinite(Number(saved.master))) soundState.master = clampPercent(saved.master);
      soundState.autoplay = !!saved.autoplay;
      soundState.presetId = typeof saved.presetId === "string" ? saved.presetId : "";
    }
    const custom = JSON.parse(localStorage.getItem(SOUND_KEYS.custom) || "[]");
    if (Array.isArray(custom)) {
      soundState.custom = custom
        .filter((p) => p && typeof p.id === "string" && typeof p.name === "string" && p.mix)
        .map((p) => ({
          id: p.id,
          name: String(p.name).slice(0, 12),
          mix: sanitizeSoundMix(p.mix),
        }));
    }
  } catch (e) {
    /* 隐私模式下忽略 */
  }
  if (!hasStoredMix) soundState.mix = { ...SOUND_PRESETS[0].mix };
}

function persistSoundState() {
  try {
    localStorage.setItem(
      SOUND_KEYS.mix,
      JSON.stringify({
        mix: soundState.mix,
        master: soundState.master,
        autoplay: soundState.autoplay,
        presetId: soundState.presetId,
      })
    );
    localStorage.setItem(SOUND_KEYS.custom, JSON.stringify(soundState.custom));
  } catch (e) {
    /* 忽略容量不足 */
  }
}

function scheduleSoundSave() {
  if (soundSaveTimer) clearTimeout(soundSaveTimer);
  soundSaveTimer = setTimeout(() => {
    soundSaveTimer = null;
    persistSoundState();
  }, 250);
}

function soundTargetVolume(id) {
  return ((soundState.mix[id] || 0) / 100) * (soundState.master / 100);
}

function clearSoundFade(audio) {
  if (audio._fade) {
    clearInterval(audio._fade);
    audio._fade = null;
  }
}

function fadeSound(audio, target, ms, done) {
  clearSoundFade(audio);
  const start = audio.volume;
  const diff = target - start;
  if (Math.abs(diff) < 0.01) {
    audio.volume = target;
    if (done) done();
    return;
  }
  const steps = Math.max(1, Math.round(ms / 40));
  let i = 0;
  audio._fade = setInterval(() => {
    i += 1;
    audio.volume = Math.min(1, Math.max(0, start + (diff * i) / steps));
    if (i >= steps) {
      clearSoundFade(audio);
      audio.volume = Math.min(1, Math.max(0, target));
      if (done) done();
    }
  }, 40);
}

function ensureSoundAudio(id) {
  if (soundAudios[id]) return soundAudios[id];
  const sound = SOUND_MAP[id];
  if (!sound) return null;
  const audio = new Audio();
  audio.src = AUDIO_BASE + sound.file;
  audio.loop = true;
  audio.preload = "none";
  audio.volume = 0;
  audio.addEventListener("play", syncSoundUI);
  audio.addEventListener("pause", syncSoundUI);
  audio.addEventListener("playing", () => {
    soundBlockedWarned = false;
  });
  audio.addEventListener("error", () => toast(`「${sound.name}」加载失败，请检查网络`));
  soundAudios[id] = audio;
  return audio;
}

function playSound(id, options = {}) {
  const audio = ensureSoundAudio(id);
  if (!audio) return;
  const target = soundTargetVolume(id);
  if (target <= 0) return;
  if (audio.paused) {
    audio.volume = 0;
    const started = audio.play();
    if (started && typeof started.catch === "function") {
      started.catch(() => {
        clearSoundFade(audio);
        if (!soundBlockedWarned) {
          soundBlockedWarned = true;
          toast("浏览器拦截了自动播放，点一下播放按钮再试");
        }
      });
    }
    fadeSound(audio, target, options.fade || 500);
  } else {
    fadeSound(audio, target, 220);
  }
}

function pauseSound(id, options = {}) {
  const audio = soundAudios[id];
  if (!audio) return;
  if (audio.paused) {
    audio.volume = 0;
    syncSoundUI();
    return;
  }
  fadeSound(audio, 0, options.fade || 300, () => audio.pause());
}

function soundIsPlaying(id) {
  const audio = soundAudios[id];
  return !!audio && !audio.paused;
}

function soundPresetSummary(mix) {
  const parts = Object.keys(mix)
    .filter((id) => mix[id] > 0 && SOUND_MAP[id])
    .sort((a, b) => mix[b] - mix[a])
    .map((id) => SOUND_MAP[id].name);
  if (!parts.length) return "空混音";
  return parts.slice(0, 4).join(" · ") + (parts.length > 4 ? ` 等 ${parts.length} 个` : "");
}

function buildSoundGroups() {
  const box = $("soundGroups");
  box.textContent = "";
  SOUND_LAYERS.forEach((layer) => {
    const group = document.createElement("div");
    group.className = "sound-group";

    const head = document.createElement("div");
    head.className = "sound-group-head";
    const tag = document.createElement("span");
    tag.className = "sound-layer";
    tag.textContent = layer.key;
    const desc = document.createElement("span");
    desc.className = "sound-group-desc";
    desc.textContent = layer.desc;
    head.append(tag, desc);
    group.appendChild(head);

    SOUNDS.filter((s) => s.layer === layer.key).forEach((sound) => {
      const row = document.createElement("div");
      row.className = "sound-row";
      row.dataset.id = sound.id;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "sound-toggle";
      toggle.textContent = "▶";
      toggle.setAttribute("aria-label", `播放或暂停 ${sound.name}`);
      toggle.setAttribute("aria-pressed", "false");
      toggle.addEventListener("click", () => {
        if (soundIsPlaying(sound.id)) {
          pauseSound(sound.id);
          return;
        }
        if (!soundState.mix[sound.id]) soundState.mix[sound.id] = 40;
        playSound(sound.id);
        scheduleSoundSave();
        syncSoundUI();
      });

      const name = document.createElement("div");
      name.className = "sound-name";
      name.textContent = sound.name;
      const meta = document.createElement("small");
      meta.textContent = sound.meta;
      name.appendChild(meta);

      const range = document.createElement("input");
      range.type = "range";
      range.min = "0";
      range.max = "100";
      range.step = "1";
      range.value = String(soundState.mix[sound.id] || 0);
      range.setAttribute("aria-label", `${sound.name} 音量`);
      range.addEventListener("input", () => {
        const value = clampPercent(range.value);
        soundState.mix[sound.id] = value;
        soundState.presetId = "";
        if (value > 0) playSound(sound.id);
        else pauseSound(sound.id);
        scheduleSoundSave();
        syncSoundUI();
        markActiveSoundPreset();
      });

      const vol = document.createElement("strong");
      vol.className = "sound-vol";
      vol.textContent = `${soundState.mix[sound.id] || 0}%`;

      row.append(toggle, name, range, vol);
      group.appendChild(row);
    });
    box.appendChild(group);
  });
}

function renderSoundPresets() {
  const box = $("soundPresets");
  if (!box) return;
  box.textContent = "";
  const items = [
    ...SOUND_PRESETS.map((p) => ({ ...p, custom: false })),
    ...soundState.custom.map((p) => ({ ...p, custom: true })),
  ];
  items.forEach((preset) => {
    const card = document.createElement("article");
    card.className = "sound-preset-card";
    card.dataset.id = preset.id;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `使用预设 ${preset.name}`);

    const top = document.createElement("div");
    top.className = "sound-preset-top";
    const title = document.createElement("span");
    title.className = "sound-preset-name";
    title.textContent = preset.name;
    const tag = document.createElement("span");
    tag.className = "sound-preset-tag";
    tag.textContent = preset.custom ? "我的" : "内置";
    top.append(title, tag);

    const summary = document.createElement("p");
    summary.className = "sound-preset-mix";
    summary.textContent = soundPresetSummary(preset.mix);

    const actions = document.createElement("div");
    actions.className = "sound-preset-actions";
    const use = document.createElement("button");
    use.type = "button";
    use.className = "ghost small";
    use.textContent = "使用";
    use.addEventListener("click", (e) => {
      e.stopPropagation();
      applySoundPreset(preset);
    });
    actions.appendChild(use);
    if (preset.custom) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "ghost small sound-preset-del";
      del.textContent = "删除";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSoundPreset(preset.id);
      });
      actions.appendChild(del);
    }

    card.append(top, summary, actions);
    card.addEventListener("click", () => applySoundPreset(preset));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        applySoundPreset(preset);
      }
    });
    box.appendChild(card);
  });
  markActiveSoundPreset();
}

function markActiveSoundPreset() {
  document.querySelectorAll(".sound-preset-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.id === soundState.presetId);
  });
}

function applySoundPreset(preset, options = {}) {
  soundState.mix = { ...preset.mix };
  soundState.presetId = preset.id;
  SOUNDS.forEach((sound) => {
    if (soundState.mix[sound.id] > 0) playSound(sound.id, { fade: 700 });
    else pauseSound(sound.id, { fade: 250 });
  });
  scheduleSoundSave();
  syncSoundUI();
  markActiveSoundPreset();
  if (options.toast !== false) toast(`已切换：${preset.name}`);
}

function deleteSoundPreset(id) {
  soundState.custom = soundState.custom.filter((p) => p.id !== id);
  if (soundState.presetId === id) soundState.presetId = "";
  persistSoundState();
  renderSoundPresets();
  syncSoundUI();
  toast("已删除预设");
}

function syncSoundUI() {
  if (!soundBuilt) return;
  document.querySelectorAll(".sound-row").forEach((row) => {
    const id = row.dataset.id;
    const playing = soundIsPlaying(id);
    const toggle = row.querySelector(".sound-toggle");
    if (toggle) {
      toggle.classList.toggle("playing", playing);
      toggle.textContent = playing ? "❚❚" : "▶";
      toggle.setAttribute("aria-pressed", playing ? "true" : "false");
    }
    const range = row.querySelector('input[type="range"]');
    if (range && document.activeElement !== range) {
      range.value = String(soundState.mix[id] || 0);
    }
    const vol = row.querySelector(".sound-vol");
    if (vol) vol.textContent = `${soundState.mix[id] || 0}%`;
  });
  const count = Object.keys(soundAudios).filter((id) => soundIsPlaying(id)).length;
  if ($("soundPlayingCount")) $("soundPlayingCount").textContent = String(count);
  if ($("soundMaster")) $("soundMaster").value = String(soundState.master);
  if ($("soundMasterValue")) $("soundMasterValue").textContent = `${soundState.master}%`;
  if ($("soundAutoplay")) $("soundAutoplay").checked = soundState.autoplay;
}

function openPresetModal() {
  const box = $("presetModalMix");
  box.textContent = "";
  const active = SOUNDS.filter((s) => (soundState.mix[s.id] || 0) > 0).sort(
    (a, b) => (soundState.mix[b.id] || 0) - (soundState.mix[a.id] || 0)
  );
  if (!active.length) {
    const empty = document.createElement("p");
    empty.className = "preset-mix-empty";
    empty.textContent = "当前还没有声音，先调高至少一个音量再保存。";
    box.appendChild(empty);
  } else {
    active.forEach((sound) => {
      const row = document.createElement("div");
      row.className = "preset-mix-row";
      const name = document.createElement("span");
      name.textContent = sound.name;
      const vol = document.createElement("strong");
      vol.textContent = `${soundState.mix[sound.id]}%`;
      row.append(name, vol);
      box.appendChild(row);
    });
  }
  $("presetModalName").value = "";
  $("presetModal").hidden = false;
  setTimeout(() => $("presetModalName").focus(), 0);
}

function closePresetModal() {
  $("presetModal").hidden = true;
}

function savePresetFromModal() {
  const input = $("presetModalName");
  const name = input.value.trim().slice(0, 12);
  const mix = {};
  SOUNDS.forEach((sound) => {
    if ((soundState.mix[sound.id] || 0) > 0) mix[sound.id] = soundState.mix[sound.id];
  });
  if (!name) {
    toast("先给这套环境起个名字");
    input.focus();
    return;
  }
  if (!Object.keys(mix).length) {
    toast("先把至少一个声音的音量调高");
    return;
  }
  const existing = soundState.custom.find((p) => p.name === name);
  if (existing) {
    existing.mix = { ...mix };
    soundState.presetId = existing.id;
    toast(`已更新预设：${name}`);
  } else {
    const id = `custom-${Date.now()}`;
    soundState.custom.push({ id, name, mix });
    soundState.presetId = id;
    toast(`已保存预设：${name}`);
  }
  input.value = "";
  closePresetModal();
  persistSoundState();
  renderSoundPresets();
  markActiveSoundPreset();
}

function bindSoundControls() {
  $("soundPlayAll").addEventListener("click", () => {
    const hasVolume = SOUNDS.some((s) => (soundState.mix[s.id] || 0) > 0);
    if (!hasVolume) {
      applySoundPreset(SOUND_PRESETS[0]);
      return;
    }
    SOUNDS.forEach((sound) => {
      if ((soundState.mix[sound.id] || 0) > 0) playSound(sound.id, { fade: 600 });
    });
    syncSoundUI();
    toast("开始播放环境音");
  });

  $("soundStopAll").addEventListener("click", () => {
    SOUNDS.forEach((sound) => pauseSound(sound.id));
    syncSoundUI();
    toast("已暂停环境音");
  });

  $("soundMaster").addEventListener("input", (e) => {
    soundState.master = clampPercent(e.target.value);
    SOUNDS.forEach((sound) => {
      const audio = soundAudios[sound.id];
      if (!audio) return;
      clearSoundFade(audio);
      audio.volume = soundTargetVolume(sound.id);
    });
    syncSoundUI();
    scheduleSoundSave();
  });

  $("soundAutoplay").addEventListener("change", (e) => {
    soundState.autoplay = !!e.target.checked;
    scheduleSoundSave();
    toast(soundState.autoplay ? "计时开始时会自动播放当前混音" : "已关闭计时自动播放");
  });

  $("openPresetModal").addEventListener("click", openPresetModal);
  $("presetModalCancel").addEventListener("click", closePresetModal);
  $("presetModalSave").addEventListener("click", savePresetFromModal);
  $("presetModalName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") savePresetFromModal();
    if (e.key === "Escape") closePresetModal();
  });
  $("presetModal").addEventListener("click", (e) => {
    if (e.target.id === "presetModal") closePresetModal();
  });

  window.addEventListener("focus-timer", () => {
    const running = !!(window.FocusTimerState && window.FocusTimerState.running);
    if (running && !soundLastRunning && soundState.autoplay) {
      const hasVolume = SOUNDS.some((s) => (soundState.mix[s.id] || 0) > 0);
      if (hasVolume) {
        SOUNDS.forEach((sound) => {
          if ((soundState.mix[sound.id] || 0) > 0) playSound(sound.id, { fade: 900 });
        });
        syncSoundUI();
      }
    }
    soundLastRunning = running;
  });

  window.addEventListener("focus-logout", () => {
    SOUNDS.forEach((sound) => pauseSound(sound.id, { fade: 120 }));
  });
}

function initSound() {
  if (soundBuilt || !$("soundGroups")) return;
  soundBuilt = true;
  loadSoundState();
  buildSoundGroups();
  renderSoundPresets();
  bindSoundControls();
  syncSoundUI();
  soundLastRunning = !!(window.FocusTimerState && window.FocusTimerState.running);
}

/* ---------------- 意见反馈 ---------------- */
const FEEDBACK_EMAIL = "maom68758@gmail.com";
const FEEDBACK_ENDPOINT = `https://formsubmit.co/ajax/${encodeURIComponent(FEEDBACK_EMAIL)}`;
const FEEDBACK_LABELS = {
  timer: "计时",
  sound: "环境音",
  todo: "待办",
  room: "自习室",
  stats: "统计",
  profile: "我的",
  feedback: "网站",
};

let feedbackType = "功能建议";
let feedbackFromView = "timer";
let feedbackSending = false;

function setFeedbackType(type) {
  feedbackType = type;
  document.querySelectorAll("#feedbackType button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
}

function feedbackMailto() {
  const text = $("feedbackText").value.trim();
  const page = $("feedbackPage").value || "网站";
  const account = user && user.email ? user.email : "未登录";
  const body = [
    `类型：${feedbackType}`,
    `页面：${page}`,
    `账号：${account}`,
    `内容：${text}`,
  ].join("\n");
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(`FOCUS! ${feedbackType}`)}&body=${encodeURIComponent(body)}`;
}

function setFeedbackStatus(message) {
  const box = $("feedbackStatus");
  box.hidden = false;
  box.textContent = "";
  const text = document.createElement("span");
  text.textContent = message;
  const link = document.createElement("a");
  link.href = feedbackMailto();
  link.textContent = "直接发邮件";
  box.append(text, link);
}

function prepareFeedback() {
  $("feedbackForm").hidden = false;
  $("feedbackDone").hidden = true;
  $("feedbackStatus").hidden = true;
  $("feedbackPage").value = FEEDBACK_LABELS[feedbackFromView] || "网站";
}

function openFeedback() {
  const current = currentView();
  feedbackFromView = current === "feedback" ? "timer" : current;
  $("feedbackText").value = "";
  $("feedbackHoney").value = "";
  $("feedbackCount").textContent = "0 / 1000";
  setFeedbackType("功能建议");
  prepareFeedback();
  location.hash = "feedback";
  setTimeout(() => $("feedbackText").focus(), 0);
}

function leaveFeedback() {
  location.hash = feedbackFromView || "timer";
}

function showFeedbackDone() {
  feedbackSending = false;
  $("feedbackSubmit").disabled = false;
  $("feedbackSubmit").textContent = "发送反馈";
  $("feedbackForm").hidden = true;
  $("feedbackDone").hidden = false;
  toast("反馈已发送，谢谢！");
}

function showFeedbackError(message) {
  feedbackSending = false;
  $("feedbackSubmit").disabled = false;
  $("feedbackSubmit").textContent = "发送反馈";
  setFeedbackStatus(message);
}

async function submitFeedback(e) {
  e.preventDefault();
  if (feedbackSending) return;
  const text = $("feedbackText").value.trim();
  if (text.length < 5) {
    toast("再多写几句吧，至少 5 个字");
    $("feedbackText").focus();
    return;
  }
  if ($("feedbackHoney").value) {
    showFeedbackDone();
    return;
  }
  let last = 0;
  try {
    last = Number(localStorage.getItem("focus.feedback.last")) || 0;
  } catch (err) {
    last = 0;
  }
  if (Date.now() - last < 30000) {
    toast("刚提交过，稍等半分钟再试");
    return;
  }
  const page = $("feedbackPage").value || "网站";
  const account = user && user.email ? user.email : "未登录";
  feedbackSending = true;
  $("feedbackSubmit").disabled = true;
  $("feedbackSubmit").textContent = "发送中…";
  $("feedbackStatus").hidden = true;
  try {
    const res = await fetch(FEEDBACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: `FOCUS! ${feedbackType}`,
        _template: "table",
        _captcha: "false",
        类型: feedbackType,
        内容: text,
        账号: account,
        页面: page,
        提交时间: new Date().toLocaleString("zh-CN"),
      }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      data = null;
    }
    const ok = data && (data.success === true || data.success === "true");
    if (res.ok && ok) {
      try {
        localStorage.setItem("focus.feedback.last", String(Date.now()));
      } catch (err) {
        /* 隐私模式忽略 */
      }
      showFeedbackDone();
      return;
    }
    const raw = (data && (data.message || data.error)) || `发送失败（${res.status}）`;
    if (/activat|confirm|激活|确认/i.test(raw)) {
      showFeedbackError("反馈通道还在激活中，激活邮件已发到站长邮箱；你也可以");
    } else {
      showFeedbackError(`发送没有成功：${raw}；你也可以`);
    }
  } catch (err) {
    showFeedbackError("网络连接失败，你也可以");
  }
}

$("feedbackOpen").addEventListener("click", openFeedback);
$("feedbackBack").addEventListener("click", leaveFeedback);
$("feedbackDoneBack").addEventListener("click", leaveFeedback);
$("feedbackForm").addEventListener("submit", submitFeedback);
document.querySelectorAll("#feedbackType button").forEach((btn) => {
  btn.addEventListener("click", () => setFeedbackType(btn.dataset.type));
});
$("feedbackText").addEventListener("input", () => {
  $("feedbackCount").textContent = `${$("feedbackText").value.length} / 1000`;
});

/* ---------------- 启动 ---------------- */
(async function boot() {
  setAuthMode("login");
  pickQuote();
  renderTimer();
  initSound();
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
