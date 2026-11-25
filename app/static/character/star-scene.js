/* FOCUS! 首页求星场景：Canvas 重绘 + 鼠标头部跟随 + 点击投星。
   参考 Crispe / Chris Phillips《Begging for Likes on Instagram》的交互，CC BY 4.0。
   本文件只负责场景本身，不修改计时、环境音或账号数据。 */
(() => {
  const canvas = document.getElementById("starScene");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const pauseBtn = document.getElementById("starPause");
  const fallback = document.getElementById("starSceneFallback");
  const base = window.FOCUS_CHARACTER_BASE || "/static/character/";

  const W = 800;
  const H = 550;
  const C = {
    bg: "#fffaf4",
    mint: "#dcf5e9",
    mintDark: "#a8d0bc",
    purple: "#ab86c5",
    plum: "#662654",
    skin: "#fdc6b2",
    paper: "#fffdf9",
    star: "#eab95d",
    line: "#f5e9f8",
  };

  const head = new Image();

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let started = performance.now();
  let paused = !!reduceMotion;
  let pauseAt = 0;
  let loop = true;
  let clicked = -1e9;
  let look = 0;
  let raf = 0;
  let ready = false;
  let active = false;
  let initialized = false;
  let clicks = 0;

  function setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function path(c, d, color, stroke, width = 1) {
    const p = new Path2D(d);
    c.fillStyle = color;
    c.fill(p);
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = width;
      c.lineJoin = "round";
      c.lineCap = "round";
      c.stroke(p);
    }
  }

  function ellipse(c, x, y, rx, ry, color) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
  }

  function line(c, d, color, width = 2) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    c.stroke(new Path2D(d));
  }

  function star(c, x, y, r, rot = 0) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.46 : r;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fillStyle = C.star;
    c.fill();
    c.restore();
  }

  function draw(c, t, depth = 0, phase = -1) {
    c.fillStyle = C.bg;
    c.fillRect(0, 0, W, H);
    path(c, "M0 0H135L53 423H0Z", C.mint);
    path(c, "M665 0H800V423H760Z", C.mint);
    line(c, "M0 423H800", C.mintDark, 2);
    line(c, "M55 422L0 510 M700 422L800 500 M100 455L0 548", C.mint, 1);
    for (const [x, y] of [[100, 100], [610, 70], [90, 250], [700, 330]]) {
      line(c, `M${x} ${y}h55 M${x + 16} ${y}v-12 M${x + 40} ${y}v12`, C.mintDark, 1);
    }
    ellipse(c, 340, 488, 219, 27, C.mint);
    ellipse(c, 649 - ((t * 0.025) % 1050), 528, 85, 16, "#c9eadc");

    // 后方手臂搭在画板上
    path(c, "M340 255 C369 249 391 216 411 183 L449 114 Q458 100 470 110 Q479 116 469 132 L439 209 Q420 258 379 294Z", C.purple);
    path(c, "M447 115 Q450 98 464 98 L489 101 Q502 103 499 111 Q498 117 486 114 L472 114 L472 124 L454 128Z", C.skin);

    // 跪坐的腿和鞋子
    path(c, "M274 365 C253 389 231 415 207 440 Q190 459 156 462 L140 479 Q169 500 212 487 L293 443 Q319 417 329 389Z", C.plum);
    path(c, "M321 372 Q345 365 361 388 L411 441 Q431 461 425 481 Q421 497 393 498 L260 496 Q241 488 252 472 L343 462 L304 421Z", C.plum);
    path(c, "M149 457 Q129 451 119 473 Q113 490 133 493 L161 487 L171 475Z", C.paper, C.purple, 2);
    line(c, "M124 473l17 7 M128 466l17 8", C.purple, 1.5);

    // 卫衣
    path(c, "M281 239 Q269 232 252 248 Q232 270 229 311 L221 354 Q220 378 245 386 Q294 402 342 384 Q361 376 360 348 L356 277 Q348 251 330 245Z", C.purple);
    path(c, "M267 243 Q253 228 273 221 Q293 213 308 231 Q321 215 341 225 Q357 236 346 254 L316 265Z", C.purple);
    path(c, "M284 234 L307 254 L335 237 L324 232 L307 246 L294 232Z", C.plum);
    line(c, "M267 251Q280 244 294 258 M322 258Q335 244 347 252", C.line, 2);
    line(c, "M296 263V301 M317 263V301", C.paper, 4);
    path(c, "M258 271 Q241 279 249 301 Q267 328 307 337 L383 326 Q396 318 391 303 Q388 291 371 295 L309 303 L283 279Z", C.purple);
    line(c, "M281 291Q294 309 315 313 M234 365Q281 383 339 372", C.line, 2);

    const bounce = phase >= 0 && phase < 1 ? Math.sin(phase * Math.PI) * 2 : 0;
    path(c, `M376 ${297 + bounce} Q391 ${287 + bounce} 405 ${295 + bounce} L417 ${300 + bounce} Q427 ${308 + bounce} 418 ${316 + bounce} L401 ${325 + bounce} Q388 ${327 + bounce} 377 ${318 + bounce}Z`, C.skin);

    // 已认可头部原图，不重绘五官
    if (ready) {
      c.save();
      const breath = Math.sin(t / 800) * 0.7;
      c.translate(326, 231 + breath);
      c.rotate((depth === 0 ? look : 0) * 0.027);
      c.drawImage(head, -91, -160, 183, 173);
      c.restore();
    }

    // GitHub 仓库画板（递归缩略图）
    path(c, "M588 395 L552 491 L565 491 L603 403 L665 491 L679 491 L615 395Z", C.mintDark);
    path(c, "M475 99L751 99L751 405L475 405Z", C.mintDark);
    c.fillStyle = C.paper;
    c.fillRect(483, 107, 260, 285);
    c.fillStyle = C.plum;
    c.font = "bold 14px system-ui";
    c.fillText("GitHub", 495, 128);
    c.font = "11px system-ui";
    c.fillText("MIMAO28 / Focus_web", 560, 128);
    if (depth < 2) {
      c.save();
      c.beginPath();
      c.rect(491, 144, 244, 167);
      c.clip();
      c.translate(491, 144);
      c.scale(244 / W, 167 / H);
      draw(c, t, depth + 1, phase);
      c.restore();
    } else {
      c.fillStyle = C.mint;
      c.fillRect(491, 144, 244, 167);
    }
    c.fillStyle = C.plum;
    c.font = "bold 13px system-ui";
    c.fillText("Focus, one moment at a time.", 495, 333);
    c.fillStyle = C.mintDark;
    c.fillRect(495, 344, 204, 3);
    c.fillRect(495, 353, 161, 3);
    star(c, 506, 376, 8);
    c.font = "bold 12px system-ui";
    c.fillStyle = C.plum;
    c.fillText("Star", 521, 380);
    line(c, "M718 370v13h13v-13Z", C.mintDark, 1.5);

    // 杯子
    const cy = 293 + bounce;
    path(c, `M405 ${cy} L459 ${cy} L454 ${cy + 51} Q432 ${cy + 61} 411 ${cy + 51}Z`, C.plum);
    ellipse(c, 432, cy, 28, 7, C.purple);
    ellipse(c, 432, cy, 22, 4, C.mint);
    line(c, `M459 ${cy + 10}Q481 ${cy + 13} 461 ${cy + 34}`, C.plum, 6);
    line(c, `M417 ${cy + 10}L420 ${cy + 37}`, C.line, 2);

    // 休息的小猫
    ellipse(c, 441, 472, 60, 15, C.mintDark);
    path(c, "M393 453 Q391 423 414 421 Q443 415 451 436 L484 448 Q499 463 481 474 L412 474 Q391 471 393 453Z", C.paper, C.purple, 1.5);
    path(c, "M432 438 L427 410 Q442 408 449 437 M470 439 L487 417 Q498 428 484 451Z", C.purple);
    ellipse(c, 459, 452, 27, 21, C.paper);
    path(c, "M437 446 Q446 437 454 448 L452 462 L438 459Z M463 448 Q474 438 484 446 L482 461 L466 462Z", C.purple);
    ellipse(c, 459, 460, 6, 4, C.plum);
    line(c, "M443 450l7 2 M471 451l7-2", C.plum, 2);

    // 一颗星沿连续曲线飞向杯子
    if (phase >= 0 && phase < 1) {
      const u = phase;
      const x = (1 - u) * (1 - u) * 700 + 2 * (1 - u) * u * 542 + u * u * 432;
      const y = (1 - u) * (1 - u) * 167 + 2 * (1 - u) * u * 80 + u * u * 292;
      star(c, x, y, 16 * (1 - 0.45 * u), u * 2.4);
      if (u > 0.78) {
        c.globalAlpha = (1 - u) * 4;
        ellipse(c, 432, 294, 32, 9, C.star);
        c.globalAlpha = 1;
      }
    }
  }

  function time() {
    return paused ? pauseAt : performance.now() - started;
  }

  function render(t, capture = false) {
    const phase = capture || loop ? ((t % 4800) - 1100) / 1200 : (performance.now() - clicked) / 1200;
    draw(ctx, t, 0, phase);
  }

  function drawFrame() {
    if (ready) render(time());
  }

  function tick() {
    raf = 0;
    if (!active || paused) return;
    render(time());
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (!active || paused || !ready || raf) return;
    raf = requestAnimationFrame(tick);
  }

  function setActive(value) {
    active = !!value;
    if (active) {
      if (paused) drawFrame();
      else start();
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function updatePauseLabel() {
    if (pauseBtn) pauseBtn.textContent = paused ? "继续动效" : "暂停动效";
  }

  function togglePause() {
    if (!ready) return;
    if (!paused) {
      pauseAt = time();
      paused = true;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      drawFrame();
    } else {
      started = performance.now() - pauseAt;
      paused = false;
      if (active) start();
    }
    updatePauseLabel();
  }

  function toss() {
    if (paused) return;
    clicked = performance.now();
    loop = false;
    clicks += 1;
  }

  setupCanvas();
  updatePauseLabel();

  head.onload = () => {
    ready = true;
    if (fallback) fallback.hidden = true;
    canvas.hidden = false;
    drawFrame();
    if (active) start();
  };

  head.onerror = () => {
    ready = false;
    canvas.hidden = true;
    if (pauseBtn) pauseBtn.hidden = true;
    if (fallback) {
      fallback.src = base + "star-scene-fallback.png";
      fallback.hidden = false;
    }
  };

  head.src = base + "approved-head.png";

  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    look = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width - 0.45) * 2));
  });
  canvas.addEventListener("pointerleave", () => {
    look = 0;
  });
  canvas.addEventListener("click", toss);
  canvas.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toss();
    }
  });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);

  window.FocusStarScene = {
    init() {
      if (!initialized) initialized = true;
      setActive(true);
    },
    setActive,
    get state() {
      return { ready, paused, active, loop, clicks };
    },
  };
})();
