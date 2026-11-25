/* FOCUS! 登录页左侧：Crispe《Begging for Likes on Instagram》的 Rive 场景
   原作：Crispe / Chris Phillips，CC BY 4.0
   - 先显示静态图，页面空闲后再加载 Rive 运行时，失败时保持静态图
   - 整块海报都可交互：指针移动触发 Tracking，按下立即投一颗赞
   - 登录后暂停，避免后台继续渲染 */
(() => {
  const poster = document.getElementById("authPoster");
  const scene = document.getElementById("posterScene");
  if (!poster || !scene) return;
  const canvas = document.getElementById("posterCanvas");
  const hint = document.getElementById("posterSceneHint");
  const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const conn = navigator.connection || null;
  const saveData = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")));
  const scriptSrc = document.currentScript ? document.currentScript.src : location.href;
  const DPR_CAP = 1; // 场景是扁平插画，1x 足够，显著降低每帧填充成本
  const TRACK_GAP = 140; // 指针移动触发跟踪的最小间隔
  const HEART_GAP = 50; // 连点保护，不丢正常点击

  let instance = null;
  let inputs = [];
  let loading = false;
  let loaded = false;
  let active = true;
  let lastTrack = 0;
  let lastHeart = 0;
  let hearts = 0;
  let tracks = 0;
  let moveQueued = false;
  let resizeObserver = null;
  let destroyed = false;

  function setHint(text) {
    if (hint) hint.textContent = text;
  }

  function fire(name) {
    const input = inputs.find((item) => item.name === name);
    if (!input || typeof input.fire !== "function") return;
    input.fire();
    if (name === "Heart Pressed Main") hearts += 1;
    else tracks += 1;
  }

  function baseUrl() {
    return new URL("character/", scriptSrc);
  }

  function boot(wasmUrl, rivUrl) {
    if (destroyed || instance) return;
    try {
      window.rive.RuntimeLoader.setWasmUrl(wasmUrl);
      instance = new window.rive.Rive({
        src: rivUrl,
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
            instance.resizeDrawingSurfaceToCanvas(DPR_CAP);
            inputs = instance.stateMachineInputs("SM BFL Main") || [];
            loaded = true;
            scene.classList.add("is-live");
            setHint("点击画面投一颗赞");
            if (resizeObserver) resizeObserver.disconnect();
            resizeObserver = new ResizeObserver(() => {
              if (instance) instance.resizeDrawingSurfaceToCanvas(DPR_CAP);
            });
            resizeObserver.observe(scene);
            if (!active || document.hidden) instance.pause();
          } catch (err) {
            setHint("点击画面投一颗赞");
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

  function loadRuntime() {
    if (instance || loading || destroyed || reduceMotion || saveData) return;
    loading = true;
    const base = baseUrl();
    const script = document.createElement("script");
    script.src = new URL("rive.js", base).href;
    script.onload = () => boot(new URL("rive.wasm", base).href, new URL("crispe-scene.riv", base).href);
    script.onerror = () => {
      loading = false;
      setHint("动态场景加载失败，当前为静态画面");
    };
    document.head.appendChild(script);
  }

  function isControl(target) {
    return !!(target && target.closest && target.closest("button, a, input, label, select, textarea"));
  }

  function onPointerMove() {
    if (!instance || moveQueued) return;
    moveQueued = true;
    requestAnimationFrame(() => {
      moveQueued = false;
      const now = performance.now();
      if (now - lastTrack < TRACK_GAP) return;
      lastTrack = now;
      fire("Tracking Trigger");
    });
  }

  function onPointerEnter() {
    if (!instance) {
      loadRuntime();
      return;
    }
    const now = performance.now();
    if (now - lastTrack < TRACK_GAP) return;
    lastTrack = now;
    fire("Tracking Trigger");
  }

  function onPointerDown(e) {
    if (isControl(e.target)) return;
    if (!instance) {
      loadRuntime();
      return;
    }
    const now = performance.now();
    if (now - lastHeart < HEART_GAP) return;
    lastHeart = now;
    fire("Heart Pressed Main");
    e.preventDefault();
  }

  function onKey(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (!instance) {
      loadRuntime();
      return;
    }
    fire("Heart Pressed Main");
  }

  function onFocus() {
    poster.classList.add("is-scene-focused");
  }

  function onBlur() {
    poster.classList.remove("is-scene-focused");
  }

  function onVisibility() {
    if (!instance) return;
    if (document.hidden) instance.pause();
    else if (active) instance.play();
  }

  function setActive(value) {
    active = !!value;
    if (!instance) return;
    if (active && !document.hidden) instance.play();
    else instance.pause();
  }

  function destroy() {
    destroyed = true;
    if (resizeObserver) resizeObserver.disconnect();
    poster.removeEventListener("pointerenter", onPointerEnter);
    poster.removeEventListener("pointermove", onPointerMove);
    poster.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("keydown", onKey);
    canvas.removeEventListener("focus", onFocus);
    canvas.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVisibility);
    if (instance) instance.cleanup();
    instance = null;
  }

  poster.addEventListener("pointerenter", onPointerEnter);
  poster.addEventListener("pointermove", onPointerMove);
  poster.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("keydown", onKey);
  canvas.addEventListener("focus", onFocus);
  canvas.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);

  if (reduceMotion) setHint("静态画面（已遵循系统的减少动态设置）");
  else if (saveData) setHint("静态画面（已按省流设置关闭动态）");
  else setTimeout(loadRuntime, 700);

  window.FocusAuthScene = {
    setActive,
    destroy,
    get state() {
      return { ready: loaded, active, reduced: reduceMotion, saveData, dpr: DPR_CAP, hearts, tracks };
    },
  };
})();
