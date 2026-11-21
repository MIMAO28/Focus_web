/* GitHub Pages 静态版的本地“后端”：账号、项目、专注记录都存在浏览器 localStorage。
   接口形状与 FastAPI 版保持一致，因此 app.js 无需改动即可复用。 */
(() => {
  const KEY = "focus.local.v1";
  const PALETTE = ["#FF3B2F", "#C6FF3D", "#FFD166", "#7BD389", "#8AB6FF", "#FF8FC7"];
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const ITERATIONS = 150000;

  const nowSec = () => Math.floor(Date.now() / 1000);

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* 损坏时重建 */
    }
    return { users: {}, current: null };
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      fail("浏览器存储失败（可能空间不足），请先导出备份再清理", 500);
    }
  }

  function fail(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    throw err;
  }

  function b64(bytes) {
    return btoa(String.fromCharCode(...bytes));
  }

  function unb64(text) {
    return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  }

  function randomSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return b64(bytes);
  }

  async function hashPassword(password, saltB64) {
    if (!(window.crypto && crypto.subtle)) {
      fail("当前环境不支持加密，请用 HTTPS 或本机地址打开", 500);
    }
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: unb64(saltB64), iterations: ITERATIONS, hash: "SHA-256" },
      key,
      256
    );
    return b64(new Uint8Array(bits));
  }

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }

  function startOfWeek() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const shift = (d.getDay() + 6) % 7; // 周一为起点
    d.setDate(d.getDate() - shift);
    return Math.floor(d.getTime() / 1000);
  }

  function projectsOf(user) {
    const today = startOfToday();
    return user.projects.map((p) => {
      const rows = user.sessions.filter((s) => s.project_id === p.id);
      const total = rows.reduce((sum, s) => sum + s.seconds, 0);
      const todaySum = rows.filter((s) => s.ended_at >= today).reduce((sum, s) => sum + s.seconds, 0);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        created_at: p.created_at,
        total,
        today: todaySum,
        count: rows.length,
      };
    });
  }

  function statsOf(user) {
    const today = startOfToday();
    const week = startOfWeek();
    let total = 0;
    let todaySum = 0;
    let weekSum = 0;
    user.sessions.forEach((s) => {
      total += s.seconds;
      if (s.ended_at >= today) todaySum += s.seconds;
      if (s.ended_at >= week) weekSum += s.seconds;
    });
    return { total, today: todaySum, week: weekSum, count: user.sessions.length };
  }

  function sessionsOf(user, limit) {
    const byId = {};
    user.projects.forEach((p) => (byId[p.id] = p));
    return user.sessions
      .slice()
      .sort((a, b) => b.ended_at - a.ended_at || b.id - a.id)
      .slice(0, limit)
      .map((s) => ({
        id: s.id,
        mode: s.mode,
        seconds: s.seconds,
        started_at: s.started_at,
        ended_at: s.ended_at,
        project: byId[s.project_id] ? byId[s.project_id].name : "已删除项目",
        color: byId[s.project_id] ? byId[s.project_id].color : "#FF3B2F",
      }));
  }

  function me(user) {
    return {
      email: user.email,
      created_at: user.created_at,
      stats: statsOf(user),
      projects: projectsOf(user),
    };
  }

  window.FocusLocalApi = async function (path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const body = options.body ? JSON.parse(options.body) : null;
    const state = load();
    const user = state.current ? state.users[state.current] : null;
    const need = () => (user ? user : fail("请先登录", 401));

    if (path === "/api/register" && method === "POST") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!EMAIL_RE.test(email)) fail("邮箱格式不正确");
      if (password.length < 6) fail("密码至少 6 位");
      if (state.users[email]) fail("该邮箱已注册，请直接登录", 409);
      const salt = randomSalt();
      const hash = await hashPassword(password, salt);
      state.users[email] = {
        email,
        salt,
        hash,
        created_at: nowSec(),
        nextProjectId: 2,
        nextSessionId: 1,
        projects: [{ id: 1, name: "默认项目", color: PALETTE[0], created_at: nowSec() }],
        sessions: [],
      };
      state.current = email;
      save(state);
      return me(state.users[email]);
    }

    if (path === "/api/login" && method === "POST") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const target = state.users[email];
      if (!target) fail("邮箱或密码不正确", 401);
      const hash = await hashPassword(password, target.salt);
      if (hash !== target.hash) fail("邮箱或密码不正确", 401);
      state.current = email;
      save(state);
      return me(target);
    }

    if (path === "/api/logout" && method === "POST") {
      state.current = null;
      save(state);
      return { ok: true };
    }

    if (path === "/api/password" && method === "POST") {
      need();
      const oldPwd = String(body.old_password || "");
      const newPwd = String(body.new_password || "");
      if (newPwd.length < 6) fail("新密码至少 6 位");
      const oldHash = await hashPassword(oldPwd, user.salt);
      if (oldHash !== user.hash) fail("当前密码不正确", 403);
      user.salt = randomSalt();
      user.hash = await hashPassword(newPwd, user.salt);
      save(state);
      return { ok: true };
    }

    if (path === "/api/me" && method === "GET") {
      need();
      return me(user);
    }

    if (path.startsWith("/api/projects")) {
      need();
    }

    if (path === "/api/projects" && method === "GET") {
      return { projects: projectsOf(user) };
    }

    if (path === "/api/projects" && method === "POST") {
      const name = String(body.name || "").trim();
      if (!name) fail("项目名称不能为空");
      if (name.length > 40) fail("项目名称不超过 40 个字");
      const color = PALETTE[user.projects.length % PALETTE.length];
      user.projects.push({ id: user.nextProjectId++, name, color, created_at: nowSec() });
      save(state);
      return { projects: projectsOf(user) };
    }

    const projectMatch = path.match(/^\/api\/projects\/(\d+)$/);
    if (projectMatch) {
      need();
      const id = Number(projectMatch[1]);
      const project = user.projects.find((p) => p.id === id);
      if (!project) fail("项目不存在", 404);
      if (method === "PATCH") {
        const name = String(body.name || "").trim();
        if (!name) fail("项目名称不能为空");
        project.name = name;
        save(state);
        return { projects: projectsOf(user) };
      }
      if (method === "DELETE") {
        if (user.projects.length <= 1) fail("至少保留一个项目");
        user.projects = user.projects.filter((p) => p.id !== id);
        user.sessions = user.sessions.filter((s) => s.project_id !== id);
        save(state);
        return { projects: projectsOf(user) };
      }
    }

    if (path.startsWith("/api/sessions") && method === "GET") {
      need();
      const params = new URLSearchParams(path.split("?")[1] || "");
      const limit = Math.max(1, Math.min(Number(params.get("limit") || 20), 100));
      return { sessions: sessionsOf(user, limit) };
    }

    if (path === "/api/stats" && method === "GET") {
      need();
      return {
        stats: statsOf(user),
        projects: projectsOf(user),
        sessions: sessionsOf(user, 20),
      };
    }

    if (path === "/api/focus" && method === "POST") {
      need();
      if (!["countdown", "countup"].includes(body.mode)) fail("计时模式不正确");
      const seconds = Number(body.seconds);
      if (!Number.isFinite(seconds) || seconds < 5) fail("低于 5 秒不记录");
      if (seconds > 86400) fail("单次时长异常");
      const project = user.projects.find((p) => p.id === Number(body.project_id));
      if (!project) fail("项目不存在", 404);
      const ended = nowSec();
      user.sessions.push({
        id: user.nextSessionId++,
        project_id: project.id,
        mode: body.mode,
        seconds,
        started_at: ended - seconds,
        ended_at: ended,
      });
      save(state);
      return {
        ok: true,
        project: project.name,
        projects: projectsOf(user),
        stats: statsOf(user),
        sessions: sessionsOf(user, 20),
      };
    }

    fail("接口不存在", 404);
  };

  window.FocusLocalApi.exportData = () => localStorage.getItem(KEY) || "";

  window.FocusLocalApi.importData = (text) => {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      fail("备份文件不是合法 JSON");
    }
    if (!data || typeof data.users !== "object" || !data.users) fail("备份内容不完整");
    const emails = Object.keys(data.users);
    if (!emails.length) fail("备份里没有账号");
    emails.forEach((email) => {
      const item = data.users[email];
      if (!item || !item.salt || !item.hash || !Array.isArray(item.projects) || !Array.isArray(item.sessions)) {
        fail("备份格式不正确");
      }
    });
    try {
      localStorage.setItem(KEY, text);
    } catch (e) {
      fail("导入失败：浏览器存储空间不足", 500);
    }
    return { ok: true, users: emails.length };
  };
})();
