/* FOCUS! 登录页左侧：Crispe《Begging for Likes on Instagram》的 Rive 场景
   原作：Crispe / Chris Phillips，CC BY 4.0
   - 先显示静态图，页面空闲后再加载 Rive 运行时，失败时保持静态图
   - 鼠标移动触发 Tracking Trigger，点击触发 Heart Pressed Main
   - 登录后暂停，避免后台继续渲染 */
(() => {
  const poster = document.getElementById("posterScene");
  if (!poster) return;
  const box = document.getElementById("posterSceneBox");
  const canvas = document.getElementById("posterCanvas");
  const hint = document.getElementById("posterSceneHint");
  const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const conn = navigator.connection || null;
  const saveData = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")));
  const scriptSrc = document.currentScript ? document.currentScript.src : location.href;

  let instance = null;
  let inputs = [];
  let loading = false;
  let active = true;
  let lastTrack = 0;
  let lastHeart = 0;
  let resizeObserver = null;
  let destroyed = false;

  function setHint(text) {
    if (hint) hint.textContent = text;
  }

  function fire(name) {
    const input = inputs.find((item) => item.name === name);
    if (input && typeof input.fire === "function") input.fire();
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
          fit: window.rive.Fit.Contain,
          alignment: window.rive.Alignment.Center,
        }),
        onLoad: () => {
          try {
            instance.resizeDrawingSurfaceToCanvas();
            inputs = instance.stateMachineInputs("SM BFL Main") || [];
            poster.classList.add("is-live");
            setHint("点击画面投一颗赞");
            if (resizeObserver) resizeObserver.disconnect();
            resizeObserver = new ResizeObserver(() => {
              if (instance) instance.resizeDrawingSurfaceToCanvas();
            });
            resizeObserver.observe(box);
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

  function onPointerMove(e) {
    if (!instance) return;
    const now = performance.now();
    if (now - lastTrack < 550) return;
    lastTrack = now;
    fire("Tracking Trigger");
    if (e.pointerType === "touch") lastTrack = now + 400;
  }

  function onPointerEnter() {
    if (!instance) {
      loadRuntime();
      return;
    }
    fire("Tracking Trigger");
  }

  function onHeart() {
    if (!instance) {
      loadRuntime();
      return;
    }
    const now = performance.now();
    if (now - lastHeart < 320) return;
    lastHeart = now;
    fire("Heart Pressed Main");
  }

  function onKey(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onHeart();
    }
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
    box.removeEventListener("pointerenter", onPointerEnter);
    box.removeEventListener("pointermove", onPointerMove);
    box.removeEventListener("click", onHeart);
    box.removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onVisibility);
    if (instance) instance.cleanup();
    instance = null;
  }

  box.setAttribute("tabindex", "0");
  box.setAttribute("role", "button");
  box.setAttribute("aria-label", "角色场景，点击或按回车投一颗赞");
  box.addEventListener("pointerenter", onPointerEnter);
  box.addEventListener("pointermove", onPointerMove);
  box.addEventListener("click", onHeart);
  box.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVisibility);

  if (reduceMotion) setHint("静态画面（已遵循系统的减少动态设置）");
  else if (saveData) setHint("静态画面（已按省流设置关闭动态）");
  else setTimeout(loadRuntime, 700);

  window.FocusAuthScene = {
    setActive,
    destroy,
    get state() {
      return { ready: !!instance, active, reduced: reduceMotion, saveData };
    },
  };
})();
