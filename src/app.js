"use strict";
const { invoke } = window.__TAURI__.core;

/* ------------------------------------------------------------------ settings */
const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark",  label: "Dark" },
  { id: "dusk",  label: "Dusk" },
  { id: "dawn",  label: "Dawn" },
];

const GRADIENTS = [
  { id: "aurora",   label: "Aurora",   css: "radial-gradient(at 20% 15%, #2bd4a8aa 0, transparent 50%), radial-gradient(at 85% 80%, #6a5cffaa 0, transparent 55%), linear-gradient(135deg, #0b2b3a, #14405a 60%, #1c2b5c)" },
  { id: "sunset",   label: "Sunset",   css: "radial-gradient(at 80% 10%, #ffd27acc 0, transparent 45%), linear-gradient(165deg, #ff9a6b 0%, #ff5e7e 48%, #5b2a86 100%)" },
  { id: "ocean",    label: "Ocean",    css: "radial-gradient(at 15% 85%, #0a3d91aa 0, transparent 55%), linear-gradient(160deg, #6fd6f2 0%, #2a8fc9 50%, #0b4f8a 100%)" },
  { id: "forest",   label: "Forest",   css: "radial-gradient(at 85% 15%, #c7e8a0aa 0, transparent 45%), linear-gradient(155deg, #71b280 0%, #2f7a68 50%, #134e5e 100%)" },
  { id: "lavender", label: "Lavender", css: "radial-gradient(at 80% 85%, #fbc2ebaa 0, transparent 50%), linear-gradient(135deg, #a18cd1 0%, #c9a7e8 50%, #fbc2eb 100%)" },
  { id: "ember",    label: "Ember",    css: "radial-gradient(at 30% 20%, #ffb36baa 0, transparent 50%), linear-gradient(160deg, #3a1c1c 0%, #8a2e2e 55%, #e4733a 100%)" },
];

const FONTS = [
  { id: "serif",   label: "Lora",               note: "Serif — classic & warm",     stack: "var(--font-serif)" },
  { id: "sans",    label: "Inter",              note: "Sans-serif — clean & modern", stack: "var(--font-sans)" },
  { id: "classic", label: "Cormorant Garamond", note: "Old-style — elegant",        stack: "var(--font-classic)" },
];

const DEFAULTS = { translation: "ASV", theme: "dark", bg: "theme", dim: 40, font: "serif", autofit: true, size: 56 };
const HISTORY_MAX = 30;

const store = {
  get(k, d) { try { const v = localStorage.getItem("sefer." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("sefer." + k, JSON.stringify(v)); return true; } catch { return false; } },
};

const state = {
  settings: { ...DEFAULTS, ...store.get("settings", {}) },
  history: store.get("history", []),     // newest first: [{b, c, v}]
  index: 0,
  total: 0,
  books: [],
  verse: null,
};

/* --------------------------------------------------------------------- dom */
const $ = (id) => document.getElementById(id);
const el = {
  bg: $("bg"), verse: $("verse"), ref: $("refText"), panel: $("panel"), gear: $("gear"),
  translation: $("translation"), themes: $("themes"), bgs: $("bgs"), fonts: $("fonts"),
  dim: $("dim"), autofit: $("autofit"), size: $("size"), sizeRow: $("sizeRow"), bgMsg: $("bgMsg"),
  goBook: $("goBook"), goChapter: $("goChapter"), goVerse: $("goVerse"),
  history: $("history"), histCount: $("histCount"),
};

function saveSettings() { store.set("settings", state.settings); }
const panelOpen = () => document.body.classList.contains("panel-open");

/* ------------------------------------------------------------------ reader */
let navToken = 0;

async function show(index, { push = true } = {}) {
  const token = ++navToken;
  const [i, verse] = await invoke("verse_at", { translation: state.settings.translation, index });
  if (token !== navToken) return;          // a newer keypress superseded this one
  state.index = i;
  state.verse = verse;
  el.verse.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = verse.text;
  el.verse.appendChild(span);
  el.ref.textContent = `${verse.book} ${verse.chapter}:${verse.verse}`;
  fit();
  store.set("pos", { b: verse.book_id, c: verse.chapter, v: verse.verse });
  if (push) queueHistory(verse);
  syncGoTo();
  if (panelOpen()) renderHistory();
}

const next = () => show(state.index + 1);
const prev = () => show(state.index - 1);

/** Largest font size at which the verse fits the available area. */
function fit() {
  const span = el.verse.firstElementChild;
  if (!span) return;
  const s = state.settings;
  if (!s.autofit) { span.style.fontSize = s.size + "px"; return; }
  const maxW = el.verse.clientWidth, maxH = el.verse.clientHeight;
  let lo = 14, hi = Math.min(260, Math.max(40, maxH));
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    span.style.fontSize = mid + "px";
    (span.offsetHeight <= maxH && span.scrollWidth <= maxW) ? (lo = mid) : (hi = mid);
  }
  span.style.fontSize = lo + "px";
}

/* ----------------------------------------------------------------- history */
let histTimer = null, histPending = null;

function queueHistory(v) {
  histPending = { b: v.book_id, c: v.chapter, v: v.verse };
  clearTimeout(histTimer);
  histTimer = setTimeout(flushHistory, 700);   // don't log verses skipped past while holding a key
}

function flushHistory() {
  clearTimeout(histTimer);
  if (!histPending) return;
  const h = histPending; histPending = null;
  state.history = [h, ...state.history.filter((x) => !(x.b === h.b && x.c === h.c && x.v === h.v))].slice(0, HISTORY_MAX);
  store.set("history", state.history);
  if (panelOpen()) renderHistory();
}

function renderHistory() {
  flushHistory();
  el.histCount.textContent = `(${state.history.length}/${HISTORY_MAX})`;
  el.history.innerHTML = "";
  const cur = state.verse;
  state.history.forEach((h) => {
    const li = document.createElement("li");
    const name = state.books.find((b) => b.id === h.b)?.name ?? "?";
    li.textContent = `${name} ${h.c}:${h.v}`;
    if (cur && cur.book_id === h.b && cur.chapter === h.c && cur.verse === h.v) li.classList.add("now");
    li.onclick = () => { goTo(h.b, h.c, h.v); closePanel(); };
    el.history.appendChild(li);
  });
}

async function goTo(b, c, v) {
  const idx = await invoke("find", { translation: state.settings.translation, bookId: b, chapter: c, verse: v });
  show(idx);
}

/* ------------------------------------------------------------------ go to */
function fillSelect(sel, count, selected) {
  sel.innerHTML = "";
  for (let n = 1; n <= count; n++) sel.add(new Option(n, n));
  sel.value = String(Math.min(Math.max(selected, 1), count));
}
function onBookChange() {
  const b = state.books.find((x) => x.id === +el.goBook.value);
  fillSelect(el.goChapter, b.chapters.length, 1);
  onChapterChange();
}
function onChapterChange() {
  const b = state.books.find((x) => x.id === +el.goBook.value);
  fillSelect(el.goVerse, b.chapters[+el.goChapter.value - 1], 1);
}
function syncGoTo() {
  const v = state.verse; if (!v || !state.books.length) return;
  el.goBook.value = String(v.book_id);
  const b = state.books.find((x) => x.id === v.book_id);
  fillSelect(el.goChapter, b.chapters.length, v.chapter);
  fillSelect(el.goVerse, b.chapters[v.chapter - 1], v.verse);
}

/* -------------------------------------------------------------- appearance */
function bgImage() { return store.get("bgImage", null); }

function applyAppearance() {
  const s = state.settings;
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.style.setProperty("--verse-font", FONTS.find((f) => f.id === s.font).stack);

  let css = "";
  if (s.bg.startsWith("g:")) css = GRADIENTS.find((g) => "g:" + g.id === s.bg)?.css ?? "";
  else if (s.bg === "image") { const img = bgImage(); if (img) css = `url("${img}")`; }
  el.bg.style.background = css;
  if (css) { el.bg.style.backgroundSize = "cover"; el.bg.style.backgroundPosition = "center"; }
  document.body.classList.toggle("has-bg", !!css);
  document.body.style.setProperty("--dim", s.dim / 100);

  el.sizeRow.style.display = s.autofit ? "none" : "flex";
  for (const b of el.themes.children) b.setAttribute("aria-pressed", b.dataset.id === s.theme);
  for (const b of el.fonts.children) b.setAttribute("aria-pressed", b.dataset.id === s.font);
  for (const b of el.bgs.children) b.setAttribute("aria-pressed", b.dataset.id === s.bg);
  fit();
}

function update(patch) { Object.assign(state.settings, patch); saveSettings(); applyAppearance(); }

// resize screen
const SIZE_MIN = 18, SIZE_MAX = 140;   // matches the #size slider range

/** Set a manual font size (px). Turns auto-fit off so the size takes effect. */
function setSize(px) {
  const size = Math.round(Math.min(SIZE_MAX, Math.max(SIZE_MIN, px)));
  el.size.value = size;          // keep the slider in sync
  el.autofit.checked = false;    // keep the checkbox in sync
  update({ size, autofit: false });
}

/** Size currently on screen, so Ctrl +/- starts from what you see (even in auto-fit). */
function currentSize() {
  const span = el.verse.firstElementChild;
  return span ? parseFloat(getComputedStyle(span).fontSize) : state.settings.size;
}

/** Downscale a user image so it fits comfortably in localStorage. */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 2200 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image.")); };
    img.src = url;
  });
}

/* ------------------------------------------------------------------- setup */
function buildPanel() {
  THEMES.forEach((t) => {
    const b = document.createElement("button");
    b.className = "theme-btn"; b.dataset.id = t.id; b.textContent = t.label;
    const probe = { light: ["#fbf7ec", "#2a2118"], dark: ["#15181e", "#ebe8e1"], dusk: ["#4b2f6b", "#f6e9f0"], dawn: ["#ffd9c4", "#3a2a2e"] }[t.id];
    b.style.background = probe[0]; b.style.color = probe[1];
    b.onclick = () => update({ theme: t.id });
    el.themes.appendChild(b);
  });

  const none = document.createElement("button");
  none.className = "swatch"; none.dataset.id = "theme"; none.innerHTML = "<span>Theme</span>";
  none.style.background = "var(--bg-grad)";
  none.onclick = () => update({ bg: "theme" });
  el.bgs.appendChild(none);
  GRADIENTS.forEach((g) => {
    const b = document.createElement("button");
    b.className = "swatch"; b.dataset.id = "g:" + g.id; b.style.background = g.css;
    b.innerHTML = `<span>${g.label}</span>`;
    b.onclick = () => update({ bg: "g:" + g.id });
    el.bgs.appendChild(b);
  });

  FONTS.forEach((f) => {
    const b = document.createElement("button");
    b.className = "font-btn"; b.dataset.id = f.id; b.style.fontFamily = f.stack;
    b.innerHTML = `${f.label}<small>${f.note}</small>`;
    b.onclick = () => update({ font: f.id });
    el.fonts.appendChild(b);
  });

  $("pickImage").onclick = () => $("imageFile").click();
  $("imageFile").onchange = async (e) => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    try {
      const data = await loadImage(file);
      if (!store.set("bgImage", data)) throw new Error("Image is too large to save.");
      el.bgMsg.textContent = "";
      update({ bg: "image" });
    } catch (err) { el.bgMsg.textContent = err.message; }
  };
  $("clearBg").onclick = () => { try { localStorage.removeItem("sefer.bgImage"); } catch {} el.bgMsg.textContent = ""; update({ bg: "theme" }); };

  el.dim.value = state.settings.dim;
  el.dim.oninput = () => update({ dim: +el.dim.value });
  el.autofit.checked = state.settings.autofit;
  el.autofit.onchange = () => update({ autofit: el.autofit.checked });
  el.size.value = state.settings.size;
  el.size.oninput = () => update({ size: +el.size.value });

  el.goBook.onchange = onBookChange;
  el.goChapter.onchange = onChapterChange;
  $("go").onclick = () => { goTo(+el.goBook.value, +el.goChapter.value, +el.goVerse.value); closePanel(); };

  $("clearHist").onclick = () => { histPending = null; state.history = []; store.set("history", []); renderHistory(); };

  el.translation.onchange = async () => {
    const v = state.verse;
    state.settings.translation = el.translation.value; saveSettings();
    state.books = await invoke("books", { translation: el.translation.value });
    fillBooks();
    const idx = await invoke("find", { translation: el.translation.value, bookId: v.book_id, chapter: v.chapter, verse: v.verse });
    show(idx, { push: false });
  };
}

function fillBooks() {
  el.goBook.innerHTML = "";
  state.books.forEach((b) => el.goBook.add(new Option(b.name, b.id)));
}

function openPanel() { 
  document.body.classList.add("panel-open"); 
  el.panel.setAttribute("aria-hidden", "false"); 
  renderHistory(); 
  el.goBook.focus({ preventScroll: true });
}
function closePanel() { document.body.classList.remove("panel-open"); el.panel.setAttribute("aria-hidden", "true"); document.activeElement?.blur(); }

/* auto-hide the settings button */
let uiTimer;
function pokeUI() {
  document.body.classList.add("show-ui");
  clearTimeout(uiTimer);
  uiTimer = setTimeout(() => document.body.classList.remove("show-ui"), 2500);
}

document.addEventListener("keydown", (e) => {
if ((e.ctrlKey || e.metaKey) && !e.altKey) {
  if (e.key === "+" || e.key === "=") { e.preventDefault(); setSize(currentSize() + 5); }
  else if (e.key === "-" || e.key === "_") { e.preventDefault(); setSize(currentSize() - 5); }
  else if (e.key === "0") { e.preventDefault(); update({ autofit: true }); el.autofit.checked = true; }
  return;
}
  
  if (e.key === "Escape" && panelOpen()) { closePanel(); return; }
  if (panelOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === "ArrowRight") { e.preventDefault(); next(); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
  else if (e.key.toLowerCase() === "`") { e.preventDefault(); openPanel(); } 
});
document.addEventListener("mousemove", pokeUI);
window.addEventListener("resize", fit);
window.addEventListener("beforeunload", flushHistory);
el.gear.onclick = openPanel;
$("close").onclick = closePanel;

document.addEventListener("click", (e) => {
  if (panelOpen() && !el.panel.contains(e.target) && !el.gear.contains(e.target)) closePanel();
});

/* ------------------------------------------------------------------- start */
(async function init() {
  buildPanel();
  applyAppearance();

  const list = await invoke("translations");
  list.forEach((t) => el.translation.add(new Option(t.label, t.id)));
  if (!list.some((t) => t.id === state.settings.translation)) state.settings.translation = list[0].id;
  el.translation.value = state.settings.translation;

  state.books = await invoke("books", { translation: state.settings.translation });
  state.total = await invoke("total", { translation: state.settings.translation });
  fillBooks();

  const pos = store.get("pos", { b: 1, c: 1, v: 1 });
  const idx = await invoke("find", { translation: state.settings.translation, bookId: pos.b, chapter: pos.c, verse: pos.v });
  await show(idx);
  if (document.fonts?.ready) document.fonts.ready.then(fit);
  pokeUI();
})();
