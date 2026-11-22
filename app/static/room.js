/* 好友自习室：基于 Supabase Realtime Presence。
   房间用 6 位邀请码作为频道名，不依赖数据库表；房间在有人在线时保持。 */
(() => {
  const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
  const $ = (id) => document.getElementById(id);
  const cfg = window.FOCUS_SUPABASE;

  let client = null;
  let channel = null;
  let roomCode = "";
  let roomName = "";
  let memberKey = "";
  let heartbeat = null;
  let lastTrackAt = 0;
  let lastRunning = null;

  function toast(message) {
    if (typeof window.FocusToast === "function") window.FocusToast(message);
  }

  function nickname() {
    const text = ($("userEmail") && $("userEmail").textContent.trim()) || "";
    return text || "同学";
  }

  function avatar() {
    const text = ($("navAvatar") && $("navAvatar").textContent.trim()) || "";
    return text || "🙂";
  }

  function projectName() {
    const text = ($("pickerName") && $("pickerName").textContent.trim()) || "";
    return text === "先新建一个项目" ? "" : text;
  }

  function fmtDuration(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    if (sec <= 0) return "0 分";
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    if (h > 0) return `${h} 小时 ${m} 分`;
    if (sec < 60) return `${sec} 秒`;
    return `${m} 分`;
  }

  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function timerState() {
    const state = window.FocusTimerState || {};
    return {
      running: !!state.running,
      seconds: Math.max(0, Number(state.seconds) || 0),
      today: Math.max(0, Number(state.today) || 0),
    };
  }

  function meta() {
    const state = timerState();
    return {
      name: nickname(),
      avatar: avatar(),
      project: projectName(),
      status: state.running ? "focus" : "rest",
      seconds: state.seconds,
      today: state.today,
      room: roomName,
      at: Date.now(),
    };
  }

  function setNote(text) {
    const note = $("roomNote");
    if (!note) return;
    note.textContent = text;
    note.hidden = false;
  }

  function setView(inRoom) {
    $("roomEntry").hidden = inRoom;
    $("roomLive").hidden = !inRoom;
    if (inRoom) {
      $("roomTitle").textContent = roomName || "自习室";
      $("roomCodeShow").textContent = roomCode;
    }
  }

  async function ensureClient() {
    if (!cfg || !cfg.url || !cfg.key) throw new Error("自习室需要云端模式（当前为本地模式）");
    if (client) return client;
    const { createClient } = await import(CDN);
    client = createClient(cfg.url, cfg.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return client;
  }

  function newCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join("");
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function teardown(notify) {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (channel) {
      try {
        await channel.untrack();
      } catch (e) {
        /* 忽略 */
      }
      try {
        if (client) await client.removeChannel(channel);
      } catch (e) {
        /* 忽略 */
      }
      channel = null;
    }
    roomCode = "";
    roomName = "";
    memberKey = "";
    lastTrackAt = 0;
    setView(false);
    $("roomNote").hidden = true;
    renderMembers([]);
    if (notify) toast("已离开自习室");
  }

  async function enterRoom(code, name, create) {
    if (!cfg || !cfg.url) {
      setNote("自习室需要云端模式（Supabase），当前是本地模式，无法联机。");
      return;
    }
    const sb = await ensureClient();
    await teardown(false);
    roomCode = code;
    roomName = name;
    memberKey = `${nickname()}-${Math.random().toString(36).slice(2, 8)}`;

    channel = sb.channel(`focus-room-${code}`, {
      config: { presence: { key: memberKey } },
    });
    channel.on("presence", { event: "sync" }, renderMembers);
    channel.on("presence", { event: "join" }, renderMembers);
    channel.on("presence", { event: "leave" }, renderMembers);

    const status = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve("TIMED_OUT"), 8000);
      channel.subscribe((state) => {
        if (state === "SUBSCRIBED" || state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          clearTimeout(timer);
          resolve(state);
        }
      });
    });
    if (status !== "SUBSCRIBED") {
      await teardown(false);
      setNote("连接自习室失败，请检查网络后重试。");
      return;
    }

    if (!create) {
      let others = [];
      for (let i = 0; i < 5; i += 1) {
        await wait(400);
        others = Object.values(channel.presenceState()).flat();
        if (others.length) break;
      }
      if (!others.length) {
        await teardown(false);
        setNote("没有找到这个房间，邀请码可能已失效（房间需要有人在里面）。");
        return;
      }
      roomName = others[0].room || "自习室";
    }

    setView(true);
    $("roomNote").hidden = true;
    await trackNow(true);
    lastRunning = timerState().running;
    heartbeat = setInterval(() => trackNow(false), 4000);

    if (create) toast(`房间已创建，邀请码 ${roomCode}`);
    else toast("已加入自习室");
  }

  async function trackNow(force) {
    if (!channel) return;
    const now = Date.now();
    if (!force && now - lastTrackAt < 1500) return;
    lastTrackAt = now;
    try {
      await channel.track(meta());
    } catch (e) {
      /* 网络波动时忽略，下一次心跳继续 */
    }
  }

  function renderMembers() {
    const box = $("roomMembers");
    if (!box) return;
    box.textContent = "";
    if (!channel) return;

    const rows = [];
    const states = channel.presenceState();
    Object.entries(states).forEach(([key, list]) => {
      const item = (list && list[list.length - 1]) || {};
      rows.push({
        key,
        name: item.name || "同学",
        avatar: item.avatar || "🙂",
        project: item.project || "",
        status: item.status === "focus" ? "focus" : "rest",
        seconds: Number(item.seconds) || 0,
        today: Number(item.today) || 0,
      });
    });

    if (!rows.length) {
      const p = document.createElement("p");
      p.className = "room-empty";
      p.textContent = "等待朋友加入…把邀请码发出去吧。";
      box.appendChild(p);
      return;
    }

    rows.sort((a, b) => {
      if (a.status !== b.status) return a.status === "focus" ? -1 : 1;
      return b.today - a.today;
    });

    rows.forEach((row) => {
      const card = document.createElement("article");
      card.className = "member-card";

      const head = document.createElement("div");
      head.className = "member-head";
      const avatar = document.createElement("span");
      avatar.className = "member-avatar";
      avatar.textContent = row.avatar;
      const name = document.createElement("strong");
      name.className = "member-name";
      name.textContent = row.name + (row.key === memberKey ? "（我）" : "");
      const pill = document.createElement("span");
      pill.className = `status-pill ${row.status}`;
      pill.textContent = row.status === "focus" ? "专注中" : "休息中";
      head.append(avatar, name, pill);

      const stats = document.createElement("div");
      stats.className = "member-stats";
      const cur = document.createElement("span");
      cur.textContent = `本次 ${fmtClock(row.seconds)}`;
      const today = document.createElement("span");
      today.textContent = `今日 ${fmtDuration(row.today)}`;
      stats.append(cur, today);

      card.append(head, stats);
      if (row.project) {
        const project = document.createElement("div");
        project.className = "member-project";
        project.textContent = `项目 · ${row.project}`;
        card.appendChild(project);
      }
      box.appendChild(card);
    });
  }

  function bind() {
    const create = $("roomCreate");
    const join = $("roomJoin");
    if (!create || !join) return;

    create.addEventListener("click", async () => {
      const input = $("roomName").value.trim();
      roomName = input || `${nickname()}的自习室`;
      const code = newCode();
      create.disabled = true;
      create.textContent = "创建中…";
      try {
        await enterRoom(code, roomName, true);
      } catch (e) {
        setNote(e.message || "创建失败，请稍后重试");
      } finally {
        create.disabled = false;
        create.textContent = "创建房间";
      }
    });

    join.addEventListener("click", async () => {
      const code = $("roomCode").value.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) {
        setNote("邀请码是 6 位字母或数字，请检查后重试。");
        return;
      }
      join.disabled = true;
      join.textContent = "加入中…";
      try {
        await enterRoom(code, "自习室", false);
      } catch (e) {
        setNote(e.message || "加入失败，请稍后重试");
      } finally {
        join.disabled = false;
        join.textContent = "加入房间";
      }
    });

    $("roomCode").addEventListener("keydown", (e) => {
      if (e.key === "Enter") join.click();
    });
    $("roomName").addEventListener("keydown", (e) => {
      if (e.key === "Enter") create.click();
    });

    $("roomLeave").addEventListener("click", () => teardown(true));

    $("roomCopy").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(roomCode);
        toast("邀请码已复制");
      } catch (e) {
        toast(`邀请码：${roomCode}`);
      }
    });

    window.addEventListener("focus-timer", () => {
      const running = timerState().running;
      if (running !== lastRunning) {
        lastRunning = running;
        trackNow(true);
      }
    });
    window.addEventListener("focus-logout", () => teardown(false));
    window.addEventListener("focus-profile", () => trackNow(true));
    window.addEventListener("pagehide", () => {
      if (channel) channel.untrack();
    });

    if (!cfg || !cfg.url) {
      setNote("自习室需要云端模式（Supabase）。当前为本地模式，创建与加入会不可用。");
      create.disabled = true;
      join.disabled = true;
    } else {
      $("roomNote").hidden = true;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
