/* FOCUS! 登录页左侧：Crispe《Begging for Likes on Instagram》的 Rive 场景
   原作：Crispe / Chris Phillips，CC BY 4.0
   - 静态图先出现，空闲后加载 Rive 运行时；失败时保持静态图
   - 爱心跟随鼠标，点击后沿弧线飞进杯子，到达时画面轻顿一下
   - 登录后暂停，避免后台继续渲染 */
(() => {
  const scene = document.getElementById("authScene");
  const poster = document.getElementById("authPoster");
  const art = document.getElementById("sceneArt");
  if (!scene || !poster || !art) return;
  const canvas = document.getElementById("posterCanvas");
  const hint = document.getElementById("posterSceneHint");
  const cursorHeart = document.getElementById("sceneHeart");
  const heartHTML = cursorHeart ? cursorHeart.innerHTML : "";
  const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const conn = navigator.connection || null;
  const saveData = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")));
  const scriptSrc = document.currentScript ? document.currentScript.src : location.href;
  const DPR_MAX = 2; // 高分屏最多按 2x 渲染，保证清晰度
  function dprCap() {
    return Math.min(window.devicePixelRatio || 1, DPR_MAX);
  }
  const TRACK_GAP = 130; // 跟踪触发间隔
  const FLIGHT_MS = 620; // 爱心飞行时长
  const MAX_FLIGHTS = 3; // 同时飞行的爱心上限
  const CUP = { x: 0.572, y: 0.462 }; // 杯口中心（场景百分比，已按画面校准）
  const STATIC_ONLY = false; // 保留 Rive 动画

  let instance = null;
  let inputs = [];
  let loading = false;
  let loaded = false;
  let active = true;
  let destroyed = false;
  let rafId = 0;
  let resizeObserver = null;
  let layoutObserver = null;
  let pointer = null;
  let heartShown = false;
  const heartPos = { x: 0, y: 0 };
  let trackPending = false;
  let lastTrack = 0;
  let flights = [];
  let tosses = 0;
  let landed = 0;
  let tracks = 0;

  function setHint(text) {
    if (hint) hint.textContent = text;
  }

  // 爱心落到杯口时画面轻顿一下
  let bumpTimer = 0;
  function bump() {
    if (reduceMotion) return;
    scene.classList.add("is-bump");
    clearTimeout(bumpTimer);
    bumpTimer = setTimeout(() => scene.classList.remove("is-bump"), 340);
  }

  // 场景顶边贴住标题下方：把标题底边的位置写入 --scene-top
  const head = poster.querySelector(".poster-head");
  function syncSceneTop() {
    if (destroyed || !head) return;
    const posterRect = poster.getBoundingClientRect();
    if (!posterRect.height) return;
    const headRect = head.getBoundingClientRect();
    const top = Math.round(headRect.bottom - posterRect.top + 14);
    const max = Math.max(0, posterRect.height - 120);
    poster.style.setProperty("--scene-top", Math.max(0, Math.min(top, max)) + "px");
  }

  function fire(name) {
    const input = inputs.find((item) => item.name === name);
    if (!input || typeof input.fire !== "function") return;
    input.fire();
    if (name === "Tracking Trigger") tracks += 1;
  }

  function baseUrl() {
    return new URL("character/", scriptSrc);
  }

  // 运行时资源（2MB 的 wasm 等）放进 Cache Storage：10 分钟后就过期重新下载太慢，
  // 这里按构建版本缓存，第二次打开直接命中本地缓存，动画几乎立刻开始
  const CACHE_NAME = "focus-rive-assets";
  const assetVersion = new URLSearchParams(scriptSrc.split("?")[1] || "").get("v") || "";

  function assetUrl(name) {
    const url = new URL(name, baseUrl());
    if (assetVersion) url.searchParams.set("v", assetVersion);
    return url.href;
  }

  async function loadAsset(url) {
    if (!("caches" in window)) return fetch(url);
    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(url);
      if (hit) return hit;
      const res = await fetch(url);
      if (res.ok) cache.put(url, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      return fetch(url);
    }
  }

  async function loadAssets() {
    const urls = [assetUrl("rive.js"), assetUrl("rive.wasm"), assetUrl("crispe-scene.riv")];
    const [jsRes, wasmRes, rivRes] = await Promise.all(urls.map(loadAsset));
    if (!jsRes.ok || !wasmRes.ok || !rivRes.ok) throw new Error("资源加载失败");
    const [jsText, wasmBuf, rivBuf] = await Promise.all([jsRes.text(), wasmRes.arrayBuffer(), rivRes.arrayBuffer()]);
    // 清掉旧版本构建留下的缓存，避免越攒越多
    if ("caches" in window) {
      caches
        .open(CACHE_NAME)
        .then(async (cache) => {
          const keys = await cache.keys();
          keys.forEach((req) => {
            if (!urls.includes(req.url)) cache.delete(req);
          });
        })
        .catch(() => {});
    }
    return { jsText, wasmBuf, rivBuf };
  }

  function boot(assets) {
    if (destroyed || instance) return;
    try {
      if (!window.rive) {
        const script = document.createElement("script");
        script.textContent = assets.jsText;
        document.head.appendChild(script);
      }
      window.rive.RuntimeLoader.setWasmBinary(assets.wasmBuf);
      instance = new window.rive.Rive({
        buffer: assets.rivBuf,
        canvas,
        autoplay: true,
        artboard: "BFL_AB_InteractionMain",
        stateMachines: "SM BFL Main",
        layout: new window.rive.Layout({
          fit: window.rive.Fit.Cover,
          alignment: window.rive.Alignment.Center,
        }),
        onLoad: () => {
          try {
            instance.resizeDrawingSurfaceToCanvas(dprCap());
            inputs = instance.stateMachineInputs("SM BFL Main") || [];
            loaded = true;
            scene.classList.add("is-live");
            setHint("点击左侧画面投一颗赞");
            if (resizeObserver) resizeObserver.disconnect();
            resizeObserver = new ResizeObserver(() => {
              if (instance) instance.resizeDrawingSurfaceToCanvas(dprCap());
            });
            resizeObserver.observe(art);
            if (!active || document.hidden) instance.pause();
          } catch (err) {
            setHint("点击左侧画面投一颗赞");
          }
        },
        onLoadError: () => {
          loading = false;
          setHint("动态场景加载失败，当前为静态画面");
        },
      });
    } catch (err) {
      loading = false;
      setHint("动态场景加载失败，当前为静态画面");
    }
  }

  async function loadRuntime() {
    if (STATIC_ONLY || instance || loading || destroyed || reduceMotion || saveData) return;
    loading = true;
    try {
      const assets = await loadAssets();
      if (destroyed) {
        loading = false;
        return;
      }
      boot(assets);
    } catch (err) {
      loading = false;
      setHint("动态场景加载失败，当前为静态画面");
    }
  }

  function sceneRect() {
    return scene.getBoundingClientRect();
  }

  function showHeart(x, y) {
    if (!cursorHeart || reduceMotion) return;
    heartPos.x = x;
    heartPos.y = y;
    cursorHeart.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    cursorHeart.classList.add("is-visible");
    poster.classList.add("has-heart");
    heartShown = true;
  }

  function hideHeart() {
    if (!cursorHeart) return;
    cursorHeart.classList.remove("is-visible");
    poster.classList.remove("has-heart");
    heartShown = false;
  }

  function makeFlight() {
    let flight = flights.find((item) => item.done);
    if (!flight && flights.length >= MAX_FLIGHTS) {
      flight = flights.reduce((oldest, item) => (item.t0 <= oldest.t0 ? item : oldest), flights[0]);
    }
    if (!flight) {
      const el = document.createElement("div");
      el.className = "scene-heart is-flight";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = heartHTML;
      scene.appendChild(el);
      flight = {
        el,
        done: true,
        t0: 0,
        start: { x: 0, y: 0 },
        ctrl: { x: 0, y: 0 },
        end: { x: 0, y: 0 },
      };
      flights.push(flight);
    }
    return flight;
  }

  function toss(from) {
    tosses += 1;
    if (reduceMotion) return;
    const rect = sceneRect();
    const artRect = art.getBoundingClientRect();
    const artX = artRect.left - rect.left;
    const artY = artRect.top - rect.top;
    const start = from || { x: artX + artRect.width / 2, y: artY + artRect.height * 0.72 };
    const end = { x: artX + artRect.width * CUP.x, y: artY + artRect.height * CUP.y };
    const ctrl = {
      x: (start.x + end.x) / 2,
      y: Math.min(start.y, end.y) - Math.max(60, rect.height * 0.22),
    };
    const flight = makeFlight();
    flight.start = start;
    flight.ctrl = ctrl;
    flight.end = end;
    flight.t0 = performance.now();
    flight.done = false;
    flight.el.style.opacity = "1";
    flight.el.style.transform = `translate3d(${start.x}px, ${start.y}px, 0) scale(1)`;
    flight.el.classList.add("is-visible");
    if (!instance) loadRuntime();
  }

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    if (heartShown && pointer && cursorHeart) {
      heartPos.x += (pointer.x - heartPos.x) * 0.3;
      heartPos.y += (pointer.y - heartPos.y) * 0.3;
      cursorHeart.style.transform = `translate3d(${heartPos.x}px, ${heartPos.y}px, 0)`;
    }
    if (trackPending) {
      trackPending = false;
      if (instance && now - lastTrack >= TRACK_GAP) {
        lastTrack = now;
        fire("Tracking Trigger");
      }
    }
    for (let i = 0; i < flights.length; i += 1) {
      const flight = flights[i];
      if (flight.done) continue;
      const t = Math.min(1, (now - flight.t0) / FLIGHT_MS);
      const u = 1 - t;
      const x = u * u * flight.start.x + 2 * u * t * flight.ctrl.x + t * t * flight.end.x;
      const y = u * u * flight.start.y + 2 * u * t * flight.ctrl.y + t * t * flight.end.y;
      const scale = 1 - 0.45 * t;
      const rotate = (t - 0.5) * 18;
      flight.el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rotate}deg)`;
      flight.el.style.opacity = t > 0.82 ? String(Math.max(0, (1 - t) / 0.18)) : "1";
      if (t >= 1) {
        flight.done = true;
        flight.el.classList.remove("is-visible");
        bump();
        landed += 1;
      }
    }
  }

  function startTick() {
    if (!rafId && !reduceMotion) rafId = requestAnimationFrame(tick);
  }

  function stopTick() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function onEnter(e) {
    if (reduceMotion) return;
    const rect = sceneRect();
    pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    showHeart(pointer.x, pointer.y);
    if (!instance) loadRuntime();
    else if (performance.now() - lastTrack >= TRACK_GAP) {
      lastTrack = performance.now();
      fire("Tracking Trigger");
    }
  }

  function onMove(e) {
    if (reduceMotion) return;
    const rect = sceneRect();
    pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (!heartShown) showHeart(pointer.x, pointer.y);
    trackPending = true;
    if (!instance) loadRuntime();
  }

  function onLeave() {
    pointer = null;
    hideHeart();
  }

  function isControl(target) {
    return !!(target && target.closest && target.closest("button, a, input, label, select, textarea"));
  }

  function onDown(e) {
    if (reduceMotion || isControl(e.target)) return;
    const rect = sceneRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (!heartShown) showHeart(x, y);
    toss({ x: heartPos.x, y: heartPos.y });
    if (e.pointerType === "touch") {
      pointer = null;
      setTimeout(hideHeart, 220);
    }
    e.preventDefault();
  }

  function onKey(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    toss(null);
  }

  function onVisibility() {
    if (!instance) return;
    if (document.hidden) instance.pause();
    else if (active) instance.play();
  }

  function setActive(value) {
    active = !!value;
    if (instance) {
      if (active && !document.hidden) instance.play();
      else instance.pause();
    }
    if (active) startTick();
    else stopTick();
  }

  function destroy() {
    destroyed = true;
    stopTick();
    clearTimeout(bumpTimer);
    if (resizeObserver) resizeObserver.disconnect();
    if (layoutObserver) layoutObserver.disconnect();
    window.removeEventListener("resize", syncSceneTop);
    poster.removeEventListener("pointerenter", onEnter);
    poster.removeEventListener("pointermove", onMove);
    poster.removeEventListener("pointerleave", onLeave);
    poster.removeEventListener("pointerdown", onDown);
    scene.removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onVisibility);
    flights.forEach((flight) => flight.el.remove());
    flights = [];
    if (instance) instance.cleanup();
    instance = null;
  }

  poster.addEventListener("pointerenter", onEnter);
  poster.addEventListener("pointermove", onMove);
  poster.addEventListener("pointerleave", onLeave);
  poster.addEventListener("pointerdown", onDown);
  scene.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVisibility);

  syncSceneTop();
  window.addEventListener("resize", syncSceneTop);
  if ("ResizeObserver" in window) {
    layoutObserver = new ResizeObserver(syncSceneTop);
    layoutObserver.observe(poster);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncSceneTop).catch(() => {});
  }

  if (reduceMotion) setHint("静态画面（已遵循系统的减少动态设置）");
  else if (saveData) setHint("静态画面（已按省流设置关闭动态）");
  else {
    startTick();
    setTimeout(loadRuntime, 150);
  }

  window.FocusAuthScene = {
    setActive,
    destroy,
    get state() {
      return {
        ready: loaded,
        active,
        reduced: reduceMotion,
        saveData,
        dpr: dprCap(),
        tosses,
        landed,
        tracks,
      };
    },
  };
})();
