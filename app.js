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
      /mexique|guatemala|belize|honduras|salvador|nicaragua|costa rica|panama|colombie|equateur|perou|bolivie|bresil|guyane|amazonie|antilles|caraibe|thailande|asie/g,
    ) || [];
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

function photoBlock(s, alt) {
  if (!s.image) {
    return `<div class="no-photo"><span>Pas de photo de cette espèce</span></div>`;
  }
  return `<img src="${s.image}" alt="${esc(alt)}" />`;
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
          Liste calée sur Kew (POWO) : le genre compte aujourd’hui environ 73 espèces acceptées, du Mexique à l’Amazonie.
          Ici : les espèces, les sous-espèces utiles, les cultivars vraiment documentés (Albo, Thai Con, Aurea, Mint, Esqueleto…)
          et deux plantes vendues « Monstera » qui n’en sont pas. Les mutations de boutique n’ont pas de fin : on n’invente pas un nom pour chaque tache.
          Une photo seulement si elle est nette et vraiment de cette plante — pas la même deliciosa partout.
        </p>
        <p class="lede">${nSp} espèces · ${nCv} cultivars · cherche un nom, un pays, « cultivar » ou « pas une Monstera ».</p>
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
        <button class="back" id="close-modal">← Toutes les espèces</button>
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
          <span class="nav-break" aria-hidden="true"></span>
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
}

root.addEventListener("click", (e) => {
  const go = e.target.closest("[data-go]");
  if (go) {
    state.page = go.dataset.go;
    state.open = null;
    window.scrollTo(0, 0);
    render();
    return;
  }

  const openBtn = e.target.closest("[data-open]");
  if (openBtn) {
    state.open = species.find((s) => s.id === openBtn.dataset.open) || null;
    state.page = "fiche";
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

  if (e.target.id === "close-modal") {
    state.open = null;
    state.page = "especes";
    window.scrollTo(0, 0);
    render();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.open) {
    state.open = null;
    state.page = "especes";
    render();
  }
});

render();
