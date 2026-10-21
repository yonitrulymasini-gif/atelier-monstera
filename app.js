const { species, anatomy, care, quiz } = window.MONSTERA;
const QUIZ_LEN = 5;
const NAV = [
  { id: "accueil", label: "Accueil" },
  { id: "especes", label: "Espèces" },
  { id: "quiz", label: "Quiz" },
  { id: "entretien", label: "Entretien" },
  { id: "anatomie", label: "Anatomie" },
];

const state = {
  page: "accueil",
  query: "",
  open: null,
  answers: {},
  quizIndex: 0,
  quizDone: false,
  round: [],
  history: [],
  mapView: null,
};

const root = document.getElementById("root");

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const KIND_RANK = { species: 0, subspecies: 1, cultivar: 2, lookalike: 3 };

function plantStem(s) {
  return s.name
    .replace(/^Monstera\s+/i, "")
    .replace(/\s+subsp\..*$/i, "")
    .replace(/\s+var\..*$/i, "")
    .replace(/\s+[—–].*$/, "")
    .replace(/\s+[‘'].*$/, "")
    .replace(/\s+panachée.*$/i, "")
    .split(/\s+/)[0]
    .toLowerCase();
}

function placeBits(s) {
  return (s.origin || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(
      /mexique|guatemala|belize|honduras|salvador|nicaragua|costa rica|panama|colombie|equateur|perou|bolivie|bresil|venezuela|guyane|trinite|trinidad|amazonie|antilles|caraibe|amerique centrale|thailande|asie/g,
    ) || [];
}

const PLACE_ISO = {
  mexique: ["MX"],
  guatemala: ["GT"],
  belize: ["BZ"],
  honduras: ["HN"],
  salvador: ["SV"],
  nicaragua: ["NI"],
  "costa rica": ["CR"],
  panama: ["PA"],
  colombie: ["CO"],
  equateur: ["EC"],
  perou: ["PE"],
  bolivie: ["BO"],
  bresil: ["BR"],
  venezuela: ["VE"],
  guyane: ["GF"],
  trinite: ["TT"],
  trinidad: ["TT"],
  antilles: ["CU", "HT", "DO", "JM", "TT"],
  caraibe: ["CU", "HT", "DO", "JM", "TT"],
  "amerique centrale": ["MX", "GT", "BZ", "SV", "HN", "NI", "CR", "PA"],
};

const ISO_FR = {
  MX: "Mexique",
  GT: "Guatemala",
  BZ: "Belize",
  SV: "Salvador",
  HN: "Honduras",
  NI: "Nicaragua",
  CR: "Costa Rica",
  PA: "Panama",
  CU: "Cuba",
  HT: "Haïti",
  DO: "Rép. dominicaine",
  JM: "Jamaïque",
  TT: "Trinité",
  CO: "Colombie",
  VE: "Venezuela",
  GY: "Guyana",
  SR: "Suriname",
  GF: "Guyane",
  EC: "Équateur",
  PE: "Pérou",
  BR: "Brésil",
  BO: "Bolivie",
  PY: "Paraguay",
  CL: "Chili",
  AR: "Argentine",
  UY: "Uruguay",
};

const ISO_ORDER = Object.keys(ISO_FR);

function rangeIsos(open) {
  const codes = new Set();
  for (const bit of placeBits(open)) {
    for (const iso of PLACE_ISO[bit] || []) codes.add(iso);
  }
  return ISO_ORDER.filter((iso) => codes.has(iso) && window.WORLD_PATHS && window.WORLD_PATHS[iso]);
}

const MAP_W = 1000;
const MAP_H = 500;
const MAP_FULL = { x: 0, y: 0, w: MAP_W, h: MAP_H };

function pathBox(d) {
  const nums = d.match(/-?\d+\.?\d*/g);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  if (!nums) return { minX: 0, minY: 0, maxX: MAP_W, maxY: MAP_H };
  for (let i = 0; i < nums.length - 1; i += 2) {
    const x = Number(nums[i]);
    const y = Number(nums[i + 1]);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function fitMapView(open) {
  const native = rangeIsos(open);
  const paths = window.WORLD_PATHS;
  if (!paths || !native.length) return { ...MAP_FULL };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const iso of native) {
    const box = pathBox(paths[iso]);
    if (box.minX < minX) minX = box.minX;
    if (box.minY < minY) minY = box.minY;
    if (box.maxX > maxX) maxX = box.maxX;
    if (box.maxY > maxY) maxY = box.maxY;
  }
  let w = Math.max(48, maxX - minX);
  let h = Math.max(48, maxY - minY);
  const pad = Math.max(28, Math.max(w, h) * 0.2);
  minX -= pad;
  minY -= pad;
  w += pad * 2;
  h += pad * 2;
  const aspect = MAP_W / MAP_H;
  if (w / h > aspect) {
    const nh = w / aspect;
    minY -= (nh - h) / 2;
    h = nh;
  } else {
    const nw = h * aspect;
    minX -= (nw - w) / 2;
    w = nw;
  }
  return { x: minX, y: minY, w, h };
}

function setMapViewBox(svg, view) {
  state.mapView = view;
  if (svg) {
    svg.setAttribute(
      "viewBox",
      `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`,
    );
  }
}

function zoomMapByFactor(svg, factor, clientX, clientY) {
  const cur = state.mapView || MAP_FULL;
  let w = cur.w * factor;
  let h = cur.h * factor;
  if (factor > 1 && w >= MAP_W * 0.97) {
    setMapViewBox(svg, { ...MAP_FULL });
    return;
  }
  w = Math.max(28, Math.min(MAP_W, w));
  h = w / (MAP_W / MAP_H);
  const rect = svg ? svg.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 };
  const px = (clientX - rect.left) / Math.max(1, rect.width);
  const py = (clientY - rect.top) / Math.max(1, rect.height);
  setMapViewBox(svg, {
    x: cur.x + px * cur.w - px * w,
    y: cur.y + py * cur.h - py * h,
    w,
    h,
  });
}

function zoomMapAt(svg, dir, clientX, clientY) {
  zoomMapByFactor(svg, dir === "in" ? 0.78 : 1 / 0.78, clientX, clientY);
}

function zoomMap(dir) {
  const svg = document.querySelector(".range-map svg");
  if (!svg) {
    const cur = state.mapView || MAP_FULL;
    const cx = cur.x + cur.w / 2;
    const cy = cur.y + cur.h / 2;
    zoomMapAt(null, dir, cx, cy);
    return;
  }
  const rect = svg.getBoundingClientRect();
  zoomMapAt(svg, dir, rect.left + rect.width / 2, rect.top + rect.height / 2);
}

function bindMapInteract() {
  const svg = document.querySelector(".range-map svg");
  if (!svg || !state.open) return;
  if (!state.mapView) state.mapView = fitMapView(state.open);

  const pts = new Map();
  let lastPan = null;
  let lastPinch = 0;

  const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  svg.addEventListener("pointerdown", (e) => {
    svg.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    svg.classList.add("is-dragging");
    if (pts.size === 1) lastPan = { x: e.clientX, y: e.clientY };
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      lastPinch = gap(a, b);
      lastPan = null;
    }
  });

  svg.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const view = state.mapView;
    const rect = svg.getBoundingClientRect();
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = gap(a, b);
      if (lastPinch) {
        zoomMapByFactor(svg, lastPinch / d, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      lastPinch = d;
      return;
    }
    if (!lastPan) return;
    const dx = ((e.clientX - lastPan.x) * view.w) / Math.max(1, rect.width);
    const dy = ((e.clientY - lastPan.y) * view.h) / Math.max(1, rect.height);
    lastPan = { x: e.clientX, y: e.clientY };
    setMapViewBox(svg, { ...view, x: view.x - dx, y: view.y - dy });
  });

  const endPtr = (e) => {
    pts.delete(e.pointerId);
    if (pts.size === 1) lastPan = [...pts.values()][0];
    if (pts.size < 2) lastPinch = 0;
    if (!pts.size) {
      lastPan = null;
      svg.classList.remove("is-dragging");
    }
  };
  svg.addEventListener("pointerup", endPtr);
  svg.addEventListener("pointercancel", endPtr);
  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoomMapAt(svg, e.deltaY < 0 ? "in" : "out", e.clientX, e.clientY);
    },
    { passive: false },
  );
}

function rangeMapHtml(open) {
  const native = rangeIsos(open);
  const paths = window.WORLD_PATHS;
  if (!paths || !native.length) return "";
  const names = native.map((iso) => ISO_FR[iso]);
  if (!state.mapView) state.mapView = fitMapView(open);
  const view = state.mapView;
  const land = Object.entries(paths)
    .map(([iso, d]) => `<path class="${native.includes(iso) ? "native" : "land"}" data-iso="${iso}" d="${d}" />`)
    .join("");
  return `
    <section class="section tight range">
      <h2 class="mid">Pays d’origine</h2>
      <figure class="range-map">
        <div class="map-zoom">
          <button type="button" data-map-zoom="in" aria-label="Zoomer">+</button>
          <button type="button" data-map-zoom="out" aria-label="Dézoomer">−</button>
        </div>
        <svg viewBox="${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}" role="img" aria-label="${esc(names.join(", "))}">
          <rect class="sea" x="-80" y="-80" width="1160" height="660" />
          ${land}
        </svg>
        <figcaption><span class="swatch"></span> ${esc(names.join(" · "))}</figcaption>
      </figure>
    </section>
  `;
}

function relatedSpecies(open) {
  const stem = plantStem(open);
  const places = new Set(placeBits(open));
  const ranked = species
    .filter((s) => s.id !== open.id)
    .map((s) => {
      let score = 0;
      if (s.kind === open.kind) score += 2;
      if (plantStem(s) === stem) score += 9;
      if (s.image && open.image && s.image === open.image) score -= 20;
      score += placeBits(s).filter((p) => places.has(p)).length * 2;
      if (open.kind === "species" && s.kind === "cultivar" && plantStem(s) === stem) score += 7;
      if (open.kind === "cultivar" && s.kind === "species" && plantStem(s) === stem) score += 8;
      if (open.kind === "subspecies" && s.kind === "species" && plantStem(s) === stem) score += 12;
      if (open.kind === "lookalike" && s.kind === "lookalike") score += 8;
      return { s, score };
    })
    .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name, "fr"));

  const picked = [];
  const seenPhoto = new Set(open.image ? [open.image] : []);
  for (const { s } of ranked) {
    if (picked.length >= 3) break;
    if (!s.image || seenPhoto.has(s.image)) continue;
    picked.push(s);
    if (s.image) seenPhoto.add(s.image);
  }
  return picked;
}

function filteredSpecies() {
  const q = state.query.trim().toLowerCase();
  return species
    .filter((s) => {
      if (!q && s.kind === "subspecies") return false;
      const hay = [s.name, s.summary, s.origin, s.kind, ...s.common, ...s.traits].join(" ").toLowerCase();
      return !q || hay.includes(q);
    })
    .sort((a, b) => {
      const r = (KIND_RANK[a.kind] ?? 0) - (KIND_RANK[b.kind] ?? 0);
      return r || a.name.localeCompare(b.name, "fr");
    });
}

function kindLabel(kind) {
  if (kind === "cultivar") return "Cultivar / mutation";
  if (kind === "subspecies") return "Sous-espèce / variété";
  if (kind === "lookalike") return "Vendue comme Monstera — ce n’en est pas une";
  return "Espèce";
}

function snapshot() {
  return {
    page: state.page,
    openId: state.open ? state.open.id : null,
    query: state.query,
    scroll: window.scrollY,
  };
}

function goBack() {
  const prev = state.history.pop();
  if (!prev) {
    state.open = null;
    state.page = "especes";
    window.scrollTo(0, 0);
    render();
    return;
  }
  state.page = prev.page;
  state.open = prev.openId ? species.find((s) => s.id === prev.openId) || null : null;
  if (state.page === "fiche" && !state.open) {
    state.page = "especes";
  }
  state.mapView = state.page === "fiche" && state.open ? fitMapView(state.open) : null;
  state.query = prev.query || "";
  render();
  window.scrollTo(0, prev.scroll || 0);
}

function photoBlock(s, alt) {
  if (!s.image) {
    return `<div class="no-photo"><span>Pas de photo de cette espèce</span></div>`;
  }
  const fit = s.imageFit === "contain" ? " contain" : "";
  return `<img class="${fit.trim()}" src="${s.image}" alt="${esc(alt)}" />`;
}

const HOME_BLURB = {
  deliciosa: "Grandes feuilles vertes, d’abord entières, puis découpées et trouées.",
  obliqua: "Feuilles très percées, presque ajourées, plus délicates.",
  adansonii: "Feuilles plus petites, trouées au milieu, sans grandes fentes.",
};

function renderHome() {
  const featured = ["deliciosa", "obliqua", "adansonii"]
    .map((id) => species.find((s) => s.id === id))
    .filter(Boolean);
  return `
    <section class="hero">
      <div>
        <p class="eyebrow">Genre Monstera · famille Araceae</p>
        <h1>Tout connaitre sur les Monstera.</h1>
        <p class="lede">
          Noms savants et populaires, portraits, anatomie, culture et un quiz. Un atelier pour
          reconnaître une deliciosa, une adansonii, une obliqua — et ce qui les distingue vraiment.
        </p>
        <div class="actions">
          <button class="cta" data-go="especes">Explorer les espèces</button>
          <button class="cta ghost" data-go="quiz">Tester mes connaissances</button>
        </div>
      </div>
      <figure>
        <img src="https://commons.wikimedia.org/wiki/Special:FilePath/Monstera%20deliciosa%20foliage.JPG?width=1400" alt="Feuille de Monstera deliciosa" />
      </figure>
    </section>
    <section class="section tight">
      <h2 class="mid">Les trois plantes de base</h2>
      <div class="grid trio">
        ${featured
          .map(
            (s) => `
          <article class="card" data-open="${s.id}">
            <div class="card-media">
              ${photoBlock(s, s.name)}
            </div>
            <div class="card-body">
              <h3>${esc(s.name)}</h3>
              <p>${esc(HOME_BLURB[s.id] || s.summary)}</p>
            </div>
          </article>`,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderSpecies() {
  const list = filteredSpecies();
  const nSp = species.filter((s) => s.kind === "species").length;
  const nCv = species.filter((s) => s.kind === "cultivar").length;
  return `
    <section class="section">
      <header class="section-head">
        <p class="eyebrow">Encyclopédie</p>
        <h1>${nSp} espèces, plus les mutations</h1>
        <p class="lede">
          Toutes les espèces sauvages reconnues par Kew, du Mexique à l’Amazonie.
          Ensuite, quelques formes de culture bien connues (Albo, Thai Constellation, Aurea, Esqueleto)
          et deux plantes vendues « Monstera » qui appartiennent à un autre genre.
          Tape un nom ou un pays pour filtrer.
        </p>
      </header>
      <div class="toolbar">
        <input type="search" id="search" placeholder="Rechercher un nom, un trait, un pays…" value="${esc(state.query)}" aria-label="Rechercher une espèce" />
      </div>
      <div class="grid">
        ${list
          .map(
            (s) => `
          <article class="card" data-open="${s.id}">
            <div class="card-media">
              ${photoBlock(s, "Feuillage de " + s.name)}
            </div>
            <div class="card-body">
              <h2>${esc(s.name)}</h2>
              <p class="aka">${esc(kindLabel(s.kind))}${s.common.length ? " · " + esc(s.common.join(" · ")) : ""}</p>
              <p>${esc(s.summary)}</p>
              <span class="text-btn">Ouvrir la fiche</span>
            </div>
          </article>`,
          )
          .join("")}
      </div>
      ${list.length === 0 ? `<p class="empty">Aucune espèce ne correspond.</p>` : ""}
    </section>
  `;
}

function renderAnatomy() {
  const steps = anatomy
    .map(
      (item, i) => `
      <article class="care-step">
        <p class="care-num">${String(i + 1).padStart(2, "0")}</p>
        <div>
          <h2>${esc(item.title)}</h2>
          <p>${esc(item.explain)}</p>
          <ul>${item.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
        </div>
      </article>`,
    )
    .join("");
  return `
    <section class="section care-page">
      <header class="section-head">
        <p class="eyebrow">Lire une feuille</p>
        <h1>Anatomie d’une Monstera</h1>
        <p class="lede">Fentes, trous, racines dans l’air, nœuds : ce que tu vois sur la plante, et à quoi ça correspond.</p>
      </header>
      <div class="care-split">
        <figure class="portrait">
          <img src="https://commons.wikimedia.org/wiki/Special:FilePath/Starr_080731-9572_Monstera_deliciosa.jpg?width=1400" alt="Feuille découpée de Monstera deliciosa" />
        </figure>
        <div class="care-list">${steps}</div>
      </div>
    </section>
  `;
}

function renderCare() {
  const steps = care.steps
    .map(
      (item, i) => `
      <article class="care-step">
        <p class="care-num">${String(i + 1).padStart(2, "0")}</p>
        <div>
          <h2>${esc(item.title)}</h2>
          <ul>${item.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
        </div>
      </article>`,
    )
    .join("");
  return `
    <section class="section care-page">
      <header class="section-head">
        <p class="eyebrow">Culture</p>
        <h1>Faire vivre une Monstera</h1>
        <p class="lede">${esc(care.lead)}</p>
      </header>
      <div class="care-split">
        <figure class="portrait">
          <img src="https://commons.wikimedia.org/wiki/Special:FilePath/Monstera%20deliciosa%20(Monaco).jpg?width=1400" alt="Monstera deliciosa en culture" />
        </figure>
        <div class="care-list">${steps}</div>
      </div>
      <div class="care-warn">
        <strong>${esc(care.warning.title)}</strong>
        <ul>${care.warning.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      </div>
    </section>
  `;
}

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function mixQuestion(item) {
  const order = shuffle(item.options.map((_, i) => i));
  return {
    q: item.q,
    why: item.why,
    options: order.map((i) => item.options[i]),
    answer: order.indexOf(item.answer),
  };
}

function dealQuiz() {
  state.round = shuffle(quiz).slice(0, QUIZ_LEN).map(mixQuestion);
  state.answers = {};
  state.quizIndex = 0;
  state.quizDone = false;
}

function currentQuiz() {
  if (!state.round.length) dealQuiz();
  return state.round;
}

function quizScore() {
  return currentQuiz().reduce((n, item, i) => n + (state.answers[i] === item.answer ? 1 : 0), 0);
}

function quizMessage(score) {
  if (score === QUIZ_LEN) return "Parfait. Tu peux expliquer une Monstera sans mélanger les noms.";
  if (score >= 4) return "Très bien. Relis juste les questions ratées, ça va coller.";
  if (score === 3) return "Pas mal. Un tour dans Anatomie et Entretien et tu gagnes des points.";
  return "C’est un début. Va voir Anatomie (les mots) et Entretien (les gestes), puis reviens.";
}

function resetQuiz() {
  dealQuiz();
}

function renderQuiz() {
  const round = currentQuiz();
  if (state.quizDone) {
    const score = quizScore();
    const missed = round
      .map((item, i) => ({ item, i }))
      .filter(({ item, i }) => state.answers[i] !== item.answer);
    return `
      <section class="section quiz-page">
        <div class="quiz-card quiz-result">
          <p class="eyebrow">Résultat</p>
          <p class="quiz-score">${score}<span> / ${QUIZ_LEN}</span></p>
          <h1>${score === QUIZ_LEN ? "Tout juste" : score >= 4 ? "Presque" : "On continue"}</h1>
          <p class="lede">${esc(quizMessage(score))}</p>
          ${
            missed.length
              ? `<div class="quiz-missed">
                  <h2>À retenir</h2>
                  ${missed
                    .map(
                      ({ item, i }) => `
                    <article>
                      <p class="q-title">${i + 1}. ${esc(item.q)}</p>
                      <p>Ta réponse : ${esc(item.options[state.answers[i]] ?? "—")}</p>
                      <p>La bonne : ${esc(item.options[item.answer])}</p>
                      <p class="why">${esc(item.why)}</p>
                    </article>`,
                    )
                    .join("")}
                </div>`
              : ""
          }
          <div class="quiz-actions">
            <button class="cta" id="reset-quiz">Recommencer</button>
            <button class="cta ghost" data-go="anatomie">Lire l’anatomie</button>
          </div>
        </div>
      </section>
    `;
  }

  const i = state.quizIndex;
  const item = round[i];
  const chosen = state.answers[i];
  const revealed = chosen !== undefined;
  const last = i === round.length - 1;
  const options = item.options
    .map((opt, j) => {
      let cls = "opt";
      if (revealed) {
        if (j === item.answer) cls += " good";
        else if (j === chosen) cls += " bad";
      }
      return `<button class="${cls}" data-answer="${i}:${j}" ${revealed ? "disabled" : ""}>${esc(opt)}</button>`;
    })
    .join("");

  return `
    <section class="section quiz-page">
      <div class="quiz-card">
        <div class="quiz-progress">
          <p class="eyebrow">Question ${i + 1} / ${QUIZ_LEN}</p>
          <div class="quiz-bar" aria-hidden="true"><span style="width:${((i + (revealed ? 1 : 0)) / QUIZ_LEN) * 100}%"></span></div>
        </div>
        <h1 class="q-title">${esc(item.q)}</h1>
        <div class="options">${options}</div>
        ${
          revealed
            ? `<div class="quiz-feedback ${chosen === item.answer ? "ok" : "ko"}">
                <p><strong>${chosen === item.answer ? "Oui." : "Non."}</strong> ${esc(item.why)}</p>
              </div>
              <div class="quiz-actions">
                <button class="cta" id="${last ? "quiz-finish" : "quiz-next"}">${last ? "Voir mon score" : "Question suivante"}</button>
              </div>`
            : `<p class="quiz-hint">Choisis une réponse. La correction s’affiche tout de suite.</p>`
        }
      </div>
    </section>
  `;
}

function renderFiche() {
  const open = state.open;
  if (!open) return renderSpecies();
  const index = species.findIndex((s) => s.id === open.id);
  const prev = species[(index - 1 + species.length) % species.length];
  const next = species[(index + 1) % species.length];
  const others = relatedSpecies(open);
  return `
    <article class="fiche">
      <div class="fiche-hero">
        ${photoBlock(open, open.name)}
      </div>
      <div class="fiche-body">
        <button class="back" id="go-back">← Retour</button>
        <p class="eyebrow">${esc(open.family)}</p>
        <h1>${esc(open.name)}</h1>
        <p class="aka">${esc(open.common.join(" · "))}</p>
        <p class="lede">${esc(open.summary)}</p>
        <p>${esc(open.description)}</p>
        <ul class="facts">
          <li><span>Origine</span>${esc(open.origin)}</li>
          <li><span>Taille</span>${esc(open.size)}</li>
          <li><span>Lumière</span>${esc(open.light)}</li>
            <li><span>Eau</span>${esc(open.water)}</li>
          </ul>
          <p class="credit">Photo : ${esc(open.credit)}</p>
        <div class="fiche-nav">
          <button class="cta ghost" data-open="${prev.id}">← ${esc(prev.name)}</button>
          <button class="cta ghost" data-open="${next.id}">${esc(next.name)} →</button>
        </div>
      </div>
    </article>
    ${rangeMapHtml(open)}
    <section class="section tight">
      <h2 class="mid">${open.kind === "cultivar" ? "Même plante, autres formes" : open.kind === "lookalike" ? "Souvent confondues" : "Proche de celle-ci"}</h2>
      <div class="grid trio">
        ${others
          .map(
            (s) => `
          <article class="card" data-open="${s.id}">
            <div class="card-media">
              ${photoBlock(s, s.name)}
            </div>
            <div class="card-body">
              <h3>${esc(s.name)}</h3>
              <p>${esc(s.summary)}</p>
            </div>
          </article>`,
          )
          .join("")}
      </div>
    </section>
  `;
}

function pageHtml() {
  if (state.page === "fiche") return renderFiche();
  if (state.page === "accueil") return renderHome();
  if (state.page === "especes") return renderSpecies();
  if (state.page === "anatomie") return renderAnatomy();
  if (state.page === "entretien") return renderCare();
  if (state.page === "quiz") return renderQuiz();
  return "";
}

function render() {
  root.innerHTML = `
    <div class="app">
      <header class="top">
        <button class="brand" data-go="accueil"><span class="logo" aria-hidden>◈</span> Atelier Monstera</button>
        <nav>
          <div class="nav-side nav-left">
            ${NAV.slice(0, 2)
              .map((item) => {
                const on = state.page === item.id || (state.page === "fiche" && item.id === "especes");
                return `<button class="${on ? "active" : ""}" data-go="${item.id}">${item.label}</button>`;
              })
              .join("")}
          </div>
          <button class="${state.page === "quiz" ? "active" : ""}" data-go="quiz">Quiz</button>
          <div class="nav-side nav-right">
            ${NAV.slice(3)
              .map((item) => {
                const on = state.page === item.id;
                return `<button class="${on ? "active" : ""}" data-go="${item.id}">${item.label}</button>`;
              })
              .join("")}
          </div>
        </nav>
      </header>
      <main>${pageHtml()}</main>
    </div>
  `;

  const search = document.getElementById("search");
  if (search) {
    search.addEventListener("input", (e) => {
      state.query = e.target.value;
      render();
      const again = document.getElementById("search");
      if (again) {
        again.focus();
        again.setSelectionRange(again.value.length, again.value.length);
      }
    });
  }

  bindMapInteract();
}

root.addEventListener("click", (e) => {
  if (e.target.closest("#go-back")) {
    goBack();
    return;
  }

  const zoomBtn = e.target.closest("[data-map-zoom]");
  if (zoomBtn) {
    zoomMap(zoomBtn.dataset.mapZoom);
    return;
  }

  const go = e.target.closest("[data-go]");
  if (go) {
    state.history = [];
    state.page = go.dataset.go;
    state.open = null;
    state.mapView = null;
    window.scrollTo(0, 0);
    render();
    return;
  }

  const openBtn = e.target.closest("[data-open]");
  if (openBtn) {
    state.history.push(snapshot());
    state.open = species.find((s) => s.id === openBtn.dataset.open) || null;
    state.page = "fiche";
    state.mapView = state.open ? fitMapView(state.open) : null;
    window.scrollTo(0, 0);
    render();
    return;
  }

  const answerBtn = e.target.closest("[data-answer]");
  if (answerBtn && !state.quizDone && state.answers[state.quizIndex] === undefined) {
    const [i, j] = answerBtn.dataset.answer.split(":").map(Number);
    state.answers[i] = j;
    render();
    return;
  }

  if (e.target.id === "quiz-next") {
    state.quizIndex = Math.min(state.quizIndex + 1, QUIZ_LEN - 1);
    window.scrollTo(0, 0);
    render();
    return;
  }

  if (e.target.id === "quiz-finish") {
    state.quizDone = true;
    window.scrollTo(0, 0);
    render();
    return;
  }

  if (e.target.id === "reset-quiz") {
    resetQuiz();
    window.scrollTo(0, 0);
    render();
    return;
  }

});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && (state.open || state.history.length)) {
    goBack();
  }
});

render();
