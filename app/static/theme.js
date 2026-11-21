/* FOCUS! 主题系统：25 套配色，每套自动生成亮色/暗色两版。 */
(function () {
  const PALETTES = [
    { id: "classic", name: "经典 FOCUS", likes: 0, colors: ["#F3E9E0", "#F5C84B", "#E8442E", "#1A160A"] },
    { id: "c01", name: "海盐蓝", likes: 1645, colors: ["#A0E0EF", "#60C1E5", "#005A9C", "#1B365D"] },
    { id: "c02", name: "奶油森林", likes: 1086, colors: ["#FFF2B4", "#E5CD82", "#728E6D", "#15370D"] },
    { id: "c03", name: "燕麦橄榄", likes: 1014, colors: ["#F5F0E6", "#C8B48A", "#7F8C6A", "#1E3B2F"] },
    { id: "c04", name: "冰川青", likes: 988, colors: ["#EEEEEE", "#B9E4E8", "#167D8D", "#071B2B"] },
    { id: "c05", name: "沙丘日落", likes: 917, colors: ["#73A5CA", "#FFE9A9", "#FFCB56", "#FF933E"] },
    { id: "c06", name: "梅子奶油", likes: 875, colors: ["#EEE3B0", "#8A2A78", "#500071", "#290044"] },
    { id: "c07", name: "陶土晴空", likes: 829, colors: ["#D46743", "#E89B5B", "#BFE7EA", "#FFEAD3"] },
    { id: "c08", name: "莓果柠檬", likes: 827, colors: ["#930031", "#FFA500", "#FFF2A7", "#BEDEFF"] },
    { id: "c09", name: "糖果薄荷", likes: 797, colors: ["#FF7171", "#FFF3E3", "#D5E8E6", "#9FA0FF"] },
    { id: "c10", name: "紫罗兰粉", likes: 774, colors: ["#705EFF", "#B26CFF", "#FFE4F6", "#FF6082"] },
    { id: "c11", name: "暮光蓝紫", likes: 756, colors: ["#FCF9EC", "#C9B5E0", "#6061B6", "#00105B"] },
    { id: "c12", name: "雾蓝杏桃", likes: 742, colors: ["#619DC6", "#A6C8E2", "#F4F0E2", "#F4BAA3"] },
    { id: "c13", name: "薄荷莓紫", likes: 721, colors: ["#98E8DE", "#D552A3", "#8E1EA2", "#542177"] },
    { id: "c14", name: "落日紫", likes: 643, colors: ["#FFD749", "#FF5B42", "#802C62", "#421454"] },
    { id: "c15", name: "西瓜薄荷", likes: 564, colors: ["#4ADD82", "#FFE7F0", "#FF9FC7", "#FA699E"] },
    { id: "c16", name: "米色鼠尾草", likes: 501, colors: ["#F5F5F0", "#E6D8C3", "#C2A68C", "#5D866C"] },
    { id: "c17", name: "苔绿奶油", likes: 485, colors: ["#9BA685", "#455230", "#637545", "#EBEBD8"] },
    { id: "c18", name: "珊瑚青灰", likes: 483, colors: ["#9DBEB8", "#FFC2B4", "#FF8882", "#194350"] },
    { id: "c19", name: "橄榄阳光", likes: 472, colors: ["#587529", "#71951E", "#EDDA5E", "#F4BE38"] },
    { id: "c20", name: "蜜桃湖蓝", likes: 466, colors: ["#FFF2A5", "#F5A89A", "#6AB0AF", "#FFEFD2"] },
    { id: "c21", name: "焦糖橙", likes: 450, colors: ["#EE6200", "#FF9A00", "#F7D794", "#FBA17E"] },
    { id: "c22", name: "青柠莓红", likes: 427, colors: ["#9FED72", "#FFECCB", "#FFA97B", "#E00000"] },
    { id: "c23", name: "雾青深海", likes: 392, colors: ["#CFEAE0", "#5B91A3", "#2F4A63", "#131B2B"] },
    { id: "c24", name: "苔原晨光", likes: 363, colors: ["#D2CF9A", "#9A7E3B", "#323D25", "#28301C"] },
  ];

  const KEY = "focus.theme.v1";
  const root = document.documentElement;
  let state = { id: "classic", mode: "light" };

  /* ---------- 颜色工具 ---------- */
  const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgb2hex = (rgb) =>
    "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => {
    const A = hex2rgb(a);
    const B = hex2rgb(b);
    return rgb2hex(A.map((v, i) => v + (B[i] - v) * t));
  };
  const lum = (hex) => {
    const [r, g, b] = hex2rgb(hex).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const sat = (hex) => {
    const [r, g, b] = hex2rgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return 0;
    const l = (max + min) / 2;
    return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  };
  const rgba = (hex, a) => {
    const [r, g, b] = hex2rgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };
  const bestFg = (bg, candidates) =>
    candidates.reduce((best, c) => (ratio(c, bg) > ratio(best, bg) ? c : best), candidates[0]);
  const ensure = (color, bg, min, toward) => {
    let c = color;
    for (let i = 0; i < 40 && ratio(c, bg) < min; i++) c = mix(c, toward, 0.07);
    return c;
  };
  const vivid = (colors) => {
    const pool = colors.filter((c) => lum(c) > 0.28 && lum(c) < 0.88);
    const list = pool.length ? pool : colors;
    return list.reduce((a, b) => (sat(b) > sat(a) ? b : a), list[0]);
  };

  /* ---------- 由 4 个色生成一套主题变量 ---------- */
  function tokens(palette, mode) {
    const colors = palette.colors.map((c) => c.toUpperCase());
    const byLum = [...colors].sort((a, b) => lum(a) - lum(b));
    const darkest = byLum[0];
    const lightest = byLum[byLum.length - 1];
    const bySat = [...colors].sort((a, b) => sat(b) - sat(a));
    const accent0 = bySat[0];
    const accent20 = bySat.find((c) => c !== accent0) || bySat[1] || lightest;
    const third0 = bySat.find((c) => c !== accent0 && c !== accent20) || bySat[2] || lightest;

    let cream, paper, ink, accent, accent2, accent3, heroBg, heroFg, cards, shadow;
    if (mode === "light") {
      cream = lightest;
      paper = mix(lightest, "#FFFFFF", 0.62);
      ink = ensure(darkest, paper, 7, "#000000");
      accent = ensure(accent0, cream, 4.5, "#000000");
      accent2 = ensure(accent20, cream, 3, "#000000");
      accent3 = ensure(third0, cream, 3, "#000000");
      heroBg = vivid(colors);
      if (ratio(heroBg, lightest) < 1.2) heroBg = mix(lightest, accent, 0.3);
      heroFg = bestFg(heroBg, [ink, "#FFFDF7"]);
      cards = [mix(lightest, accent, 0.16), accent2, accent3, accent];
      shadow = ink;
    } else {
      let bg = darkest;
      for (let i = 0; i < 20 && lum(bg) > 0.1; i++) bg = mix(bg, "#000000", 0.1);
      cream = bg;
      paper = mix(bg, "#FFFFFF", 0.09);
      ink = ensure(lightest, bg, 7, "#FFFFFF");
      accent = ensure(accent0, bg, 4.5, "#FFFFFF");
      accent2 = ensure(accent20, bg, 3, "#FFFFFF");
      accent3 = ensure(third0, bg, 3, "#FFFFFF");
      heroBg = mix(accent, bg, 0.82);
      heroFg = bestFg(heroBg, [ink, "#0B0A06"]);
      cards = [mix(accent, bg, 0.26), mix(accent2, bg, 0.26), mix(accent3, bg, 0.26), mix(lightest, bg, 0.16)];
      shadow = "#000000";
    }

    const cardFg = cards.map((c) => bestFg(c, [ink, mode === "light" ? "#FFFDF7" : "#0B0A06"]));
    const quoteBg = accent;
    const quoteFg = bestFg(quoteBg, [ink, "#FFFDF7"]);
    let footBg = mode === "light" ? darkest : mix(cream, "#000000", 0.35);
    if (mode === "light") {
      for (let i = 0; i < 20 && lum(footBg) > 0.16; i++) footBg = mix(footBg, "#000000", 0.1);
    }
    const footFg = bestFg(footBg, ["#F3E9E0", ink]);

    return {
      "--cream": cream,
      "--paper": paper,
      "--ink": ink,
      "--red": accent,
      "--yellow": cards[0],
      "--pink": cards[1],
      "--green": cards[2],
      "--orange": cards[3],
      "--hero-bg": heroBg,
      "--hero-fg": heroFg,
      "--accent-2": accent2,
      "--accent-2-fg": bestFg(accent2, [ink, "#FFFDF7"]),
      "--card1-fg": cardFg[0],
      "--card2-fg": cardFg[1],
      "--card3-fg": cardFg[2],
      "--card4-fg": cardFg[3],
      "--quote-bg": quoteBg,
      "--quote-fg": quoteFg,
      "--quote-meta": rgba(quoteFg, 0.72),
      "--foot-bg": footBg,
      "--foot-fg": footFg,
      "--foot-line": rgba(footFg, 0.25),
      "--foot-muted": rgba(footFg, 0.6),
      "--muted": rgba(ink, 0.66),
      "--ink-a75": rgba(ink, 0.75),
      "--ink-a68": rgba(ink, 0.68),
      "--ink-a45": rgba(ink, 0.45),
      "--ink-a25": rgba(ink, 0.25),
      "--ink-a22": rgba(ink, 0.22),
      "--overlay": rgba(mode === "light" ? ink : "#000000", mode === "light" ? 0.45 : 0.62),
      "--ring": rgba(accent, 0.32),
      "--shadow": shadow,
      "--shadow-soft": mode === "light" ? rgba(shadow, 0.22) : "rgba(0, 0, 0, 0.5)",
    };
  }

  function apply(id, mode, persist) {
    const palette = PALETTES.find((p) => p.id === id) || PALETTES[0];
    const t = tokens(palette, mode === "dark" ? "dark" : "light");
    Object.keys(t).forEach((k) => root.style.setProperty(k, t[k]));
    root.dataset.theme = palette.id;
    root.dataset.mode = mode;
    root.style.colorScheme = mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t["--cream"]);
    state = { id: palette.id, mode: mode === "dark" ? "dark" : "light" };
    if (persist !== false) {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
        /* 忽略 */
      }
    }
    window.dispatchEvent(new CustomEvent("focus-theme", { detail: state }));
  }

  function load() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch (e) {
      saved = null;
    }
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const id = saved && PALETTES.some((p) => p.id === saved.id) ? saved.id : "classic";
    const mode = saved && (saved.mode === "dark" || saved.mode === "light") ? saved.mode : prefersDark ? "dark" : "light";
    apply(id, mode, false);
  }

  /* ---------- 界面 ---------- */
  const $ = (id) => document.getElementById(id);

  function renderGrid() {
    const grid = $("paletteGrid");
    if (!grid) return;
    grid.innerHTML = "";
    PALETTES.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "palette-item";
      btn.dataset.palette = p.id;
      const sw = document.createElement("div");
      sw.className = "palette-swatches";
      p.colors.forEach((c) => {
        const s = document.createElement("span");
        s.style.background = c;
        sw.appendChild(s);
      });
      const name = document.createElement("span");
      name.className = "palette-name";
      name.textContent = p.name;
      const likes = document.createElement("span");
      likes.className = "palette-likes";
      likes.textContent = p.likes ? `♥ ${p.likes.toLocaleString("en-US")}` : "默认配色";
      btn.append(sw, name, likes);
      btn.addEventListener("click", () => {
        apply(p.id, state.mode, true);
        syncActive();
      });
      grid.appendChild(btn);
    });
  }

  function syncActive() {
    document.querySelectorAll("[data-palette]").forEach((el) => {
      el.classList.toggle("active", el.dataset.palette === state.id);
    });
    document.querySelectorAll("[data-mode-pick]").forEach((el) => {
      el.classList.toggle("active", el.dataset.modePick === state.mode);
    });
  }

  function openTheme() {
    const modal = $("themeModal");
    if (!modal) return;
    renderGrid();
    syncActive();
    modal.hidden = false;
  }

  function closeTheme() {
    const modal = $("themeModal");
    if (modal) modal.hidden = true;
  }

  function bind() {
    ["themeBtn", "themeBtnAuth"].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener("click", openTheme);
    });
    const close = $("themeClose");
    if (close) close.addEventListener("click", closeTheme);
    const modal = $("themeModal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target.id === "themeModal") closeTheme();
      });
    }
    document.querySelectorAll("[data-mode-pick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        apply(state.id, btn.dataset.modePick, true);
        syncActive();
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeTheme();
    });
    window.addEventListener("focus-theme", syncActive);
  }

  window.FocusTheme = {
    palettes: PALETTES,
    apply,
    set: (id, mode) => apply(id, mode || state.mode, true),
    get: () => ({ ...state }),
  };

  load();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
