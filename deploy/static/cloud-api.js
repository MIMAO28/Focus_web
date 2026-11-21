/* Supabase 云端后端：邮箱账号 + 跨设备同步。
   依赖 window.FOCUS_SUPABASE = { url, key }（构建时注入）。
   接口形状与 local-api.js / FastAPI 版一致，app.js 无需感知。 */
(() => {
  const cfg = window.FOCUS_SUPABASE;
  if (!cfg || !cfg.url || !cfg.key) return;

  const URL = cfg.url.replace(/\/$/, "");
  const KEY = cfg.key;
  const SKEY = "focus.cloud.session.v1";
  const PALETTE = ["#FF3B2F", "#C6FF3D", "#FFD166", "#7BD389", "#8AB6FF", "#FF8FC7"];

  function fail(message, status = 400, code = "") {
    const err = new Error(message);
    err.status = status;
    if (code) err.code = code;
    throw err;
  }

  function mapMessage(msg) {
    const text = String(msg || "");
    if (/Email not confirmed/i.test(text)) return "邮箱还没验证，请先点确认邮件里的链接";
    if (/Invalid login credentials/i.test(text)) return "邮箱或密码不正确";
    if (/User already registered/i.test(text)) return "该邮箱已注册，请直接登录";
    if (/Password should be at least/i.test(text)) return "密码至少 6 位";
    if (/rate limit/i.test(text)) return "邮件发送太频繁，请稍后再试";
    if (/relation .* does not exist/i.test(text) || /Could not find the table/i.test(text)) {
      return "云端数据表还没创建，请先在 Supabase 运行建表脚本";
    }
    return text || "云端请求失败";
  }

  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(SKEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function saveSession(session) {
    if (session) localStorage.setItem(SKEY, JSON.stringify(session));
    else localStorage.removeItem(SKEY);
  }

  function currentUser() {
    const session = loadSession();
    return session && session.user ? session.user : null;
  }

  async function raw(path, options = {}) {
    const { method = "GET", body, token, headers = {} } = options;
    const res = await fetch(URL + path, {
      method,
      headers: {
        apikey: KEY,
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || KEY}`,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = null;
    }
    if (!res.ok) {
      const message = (data && (data.msg || data.error_description || data.message || data.error)) || `请求失败（${res.status}）`;
      fail(mapMessage(message), res.status, (data && (data.error_code || data.code)) || "");
    }
    return data;
  }

  async function refreshSession() {
    const session = loadSession();
    if (!session || !session.refresh_token) return null;
    const data = await raw("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: session.refresh_token },
    });
    const next = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: data.user || session.user,
    };
    saveSession(next);
    return next;
  }

  async function authed(path, options = {}) {
    let session = loadSession();
    if (!session || !session.access_token) fail("请先登录", 401);
    try {
      return await raw(path, { ...options, token: session.access_token });
    } catch (err) {
      if (err.status !== 401) throw err;
      const next = await refreshSession();
      if (!next) {
        saveSession(null);
        fail("登录已过期，请重新登录", 401);
      }
      return raw(path, { ...options, token: next.access_token });
    }
  }

  async function storeSession(data) {
    saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: data.user,
    });
  }

  async function fetchAll() {
    const [projects, sessions] = await Promise.all([
      authed("/rest/v1/focus_projects?select=id,name,color,created_at&order=created_at.asc"),
      authed("/rest/v1/focus_sessions?select=id,project_id,mode,seconds,started_at,ended_at&order=ended_at.desc&limit=5000"),
    ]);
    if (!projects.length) {
      await authed("/rest/v1/focus_projects", {
        method: "POST",
        body: { user_id: currentUser().id, name: "默认项目", color: PALETTE[0] },
        headers: { Prefer: "return=representation" },
      });
      return fetchAll();
    }
    return { projects, sessions };
  }

  function toEpoch(iso) {
    const value = Date.parse(iso);
    return Number.isFinite(value) ? Math.floor(value / 1000) : 0;
  }

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }

  function startOfWeek() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return Math.floor(d.getTime() / 1000);
  }

  function projectStats(projects, sessions) {
    const today = startOfToday();
    return projects.map((p) => {
      const rows = sessions.filter((s) => s.project_id === p.id);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        created_at: toEpoch(p.created_at),
        total: rows.reduce((sum, s) => sum + s.seconds, 0),
        today: rows.filter((s) => toEpoch(s.ended_at) >= today).reduce((sum, s) => sum + s.seconds, 0),
        count: rows.length,
      };
    });
  }

  function userStats(sessions) {
    const today = startOfToday();
    const week = startOfWeek();
    let total = 0;
    let todaySum = 0;
    let weekSum = 0;
    sessions.forEach((s) => {
      const ended = toEpoch(s.ended_at);
      total += s.seconds;
      if (ended >= today) todaySum += s.seconds;
      if (ended >= week) weekSum += s.seconds;
    });
    return { total, today: todaySum, week: weekSum, count: sessions.length };
  }

  function recentSessions(projects, sessions, limit) {
    const byId = {};
    projects.forEach((p) => (byId[p.id] = p));
    return sessions.slice(0, limit).map((s) => ({
      id: s.id,
      mode: s.mode,
      seconds: s.seconds,
      started_at: toEpoch(s.started_at),
      ended_at: toEpoch(s.ended_at),
      project: byId[s.project_id] ? byId[s.project_id].name : "已删除项目",
      color: byId[s.project_id] ? byId[s.project_id].color : "#FF3B2F",
    }));
  }

  async function payload() {
    const user = currentUser();
    if (!user) fail("请先登录", 401);
    const { projects, sessions } = await fetchAll();
    return {
      email: user.email,
      created_at: toEpoch(user.created_at) || Math.floor(Date.now() / 1000),
      stats: userStats(sessions),
      projects: projectStats(projects, sessions),
      sessions,
    };
  }

  window.FocusCloudApi = async function (path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const body = options.body ? JSON.parse(options.body) : null;

    if (path === "/api/register" && method === "POST") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail("邮箱格式不正确");
      if (password.length < 6) fail("密码至少 6 位");
      const redirect = encodeURIComponent(location.origin + location.pathname);
      // 即使 Supabase 返回了会话，也不直接登录：必须先点邮件里的验证链接。
      await raw(`/auth/v1/signup?redirect_to=${redirect}`, {
        method: "POST",
        body: { email, password },
      });
      saveSession(null);
      fail(`验证邮件已发送到 ${email}，请点邮件里的链接完成注册，然后回来登录`, 409, "EMAIL_CONFIRM");
    }

    if (path === "/api/resend" && method === "POST") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) fail("请先填写注册邮箱");
      const redirect = encodeURIComponent(location.origin + location.pathname);
      await raw(`/auth/v1/resend?redirect_to=${redirect}`, {
        method: "POST",
        body: { type: "signup", email },
      });
      return { ok: true };
    }

    if (path === "/api/login" && method === "POST") {
      const data = await raw("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: { email: String(body.email || "").trim().toLowerCase(), password: String(body.password || "") },
      });
      await storeSession(data);
      return payload();
    }

    if (path === "/api/logout" && method === "POST") {
      const session = loadSession();
      if (session && session.access_token) {
        try {
          await raw("/auth/v1/logout", { method: "POST", token: session.access_token });
        } catch (e) {
          /* 已过期也允许退出 */
        }
      }
      saveSession(null);
      return { ok: true };
    }

    if (path === "/api/me" && method === "GET") {
      return payload();
    }

    const data = await payload();
    if (path === "/api/projects" && method === "GET") return { projects: data.projects };
    if (path === "/api/stats" && method === "GET") return {
      stats: data.stats,
      projects: data.projects,
      sessions: recentSessions(data.projects, data.sessions, 20),
    };
    if (path.startsWith("/api/sessions") && method === "GET") {
      const params = new URLSearchParams(path.split("?")[1] || "");
      const limit = Math.max(1, Math.min(Number(params.get("limit") || 20), 100));
      return { sessions: recentSessions(data.projects, data.sessions, limit) };
    }

    if (path === "/api/projects" && method === "POST") {
      const name = String(body.name || "").trim();
      if (!name) fail("项目名称不能为空");
      if (name.length > 40) fail("项目名称不超过 40 个字");
      const color = PALETTE[data.projects.length % PALETTE.length];
      await authed("/rest/v1/focus_projects", {
        method: "POST",
        body: { user_id: currentUser().id, name, color },
        headers: { Prefer: "return=representation" },
      });
      const next = await payload();
      return { projects: next.projects };
    }

    const match = path.match(/^\/api\/projects\/([^/]+)$/);
    if (match) {
      const id = match[1];
      const exists = data.projects.some((p) => String(p.id) === id);
      if (!exists) fail("项目不存在", 404);
      if (method === "PATCH") {
        const name = String(body.name || "").trim();
        if (!name) fail("项目名称不能为空");
        await authed(`/rest/v1/focus_projects?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: { name },
          headers: { Prefer: "return=representation" },
        });
        const next = await payload();
        return { projects: next.projects };
      }
      if (method === "DELETE") {
        if (data.projects.length <= 1) fail("至少保留一个项目");
        await authed(`/rest/v1/focus_projects?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
        const next = await payload();
        return { projects: next.projects };
      }
    }

    if (path === "/api/focus" && method === "POST") {
      if (!["countdown", "countup"].includes(body.mode)) fail("计时模式不正确");
      const seconds = Number(body.seconds);
      if (!Number.isFinite(seconds) || seconds < 5) fail("低于 5 秒不记录");
      if (seconds > 86400) fail("单次时长异常");
      const project = data.projects.find((p) => String(p.id) === String(body.project_id));
      if (!project) fail("项目不存在", 404);
      const ended = new Date();
      const started = new Date(ended.getTime() - seconds * 1000);
      await authed("/rest/v1/focus_sessions", {
        method: "POST",
        body: {
          user_id: currentUser().id,
          project_id: project.id,
          mode: body.mode,
          seconds,
          started_at: started.toISOString(),
          ended_at: ended.toISOString(),
        },
        headers: { Prefer: "return=representation" },
      });
      const next = await payload();
      return {
        ok: true,
        project: project.name,
        projects: next.projects,
        stats: next.stats,
        sessions: recentSessions(next.projects, next.sessions, 20),
      };
    }

    fail("接口不存在", 404);
  };

  window.FocusCloudApi.isCloud = true;

  /* 邮箱验证链接回跳时，URL hash 会带 access_token / refresh_token：
     读取后写入会话，随后 app.js 会自动进入应用。 */
  window.FocusCloudReady = (async () => {
    if (!location.hash || location.hash.indexOf("access_token") === -1) return;
    const params = new URLSearchParams(location.hash.slice(1));
    const access = params.get("access_token");
    const refresh = params.get("refresh_token");
    if (!access || !refresh) return;
    try {
      const me = await raw("/auth/v1/user", { token: access });
      saveSession({ access_token: access, refresh_token: refresh, user: me });
      history.replaceState(null, "", location.pathname + location.search);
    } catch (e) {
      /* 链接失效时保持登录页，让用户手动登录 */
    }
  })();
})();
