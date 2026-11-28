'use strict';
// Avioanele – ecranul mare: tablele tuturor, cu loviturile, și cine trage acum.
// Avioanele fiecăruia le știe doar laptopul (arbitrul), deci nimeni nu poate trișa.

const ASEZARE_MS = 120000; // timp pentru așezarea avioanelor
const TRAGE_MS = 60000; // timp pentru o tragere

const A = {
  faza: null, // asezare | lupta
  n: 10, // tabla are n×n căsuțe
  k: 3, // câte avioane are fiecare
  tura: 0, // al cui e rândul (indice în S.jucatori)
  nrTura: 0,
  dezvaluit: false, // la final se văd toate avioanele
};

Object.assign(JOC, {
  minJucatori: 2,
  maxJucatori: 6,
  cheieSalvare: 'avioane-joc-v1',
  setari: { mod: 'clasic' },
  laStart,
  continua,
  randeazaLateral: () => { if (A.faza) for (const j of S.jucatori) actualizeazaTabla(j); },
  randeazaSetari,
  stareJoc: () => (A.faza ? { faza: A.faza, n: A.n, k: A.k, tura: A.tura, nrTura: A.nrTura } : null),
  salveazaJucator: (j) => ({
    avioane: j.avioane || null,
    lovituri: j.lovituri || [],
    trageri: j.trageri || 0,
    nimeriri: j.nimeriri || 0,
    eliminatLa: j.eliminatLa ?? null,
  }),
  reseteaza() {
    for (const b of $$('.buton-sari')) b.remove(); // „Înapoi la clasament”, dacă a rămas
    A.faza = null;
    A.dezvaluit = false;
    for (const j of S.jucatori) pregatesteJucator(j);
  },
  infoVedere(j, v) {
    if (A.faza === 'lupta') v.info = `✈️ ${A.k - doborate(j).length}/${A.k}`;
  },
  descriereSalvare: (s) => (s.joc.faza === 'lupta' ? `tura ${(s.joc.nrTura || 0) + 1}` : 'se așază avioanele'),
  etichetaBot: (j) => `calculator · ${nivelBot(j).nume}`,
});

function pregatesteJucator(j) {
  j.avioane = null;
  j.ciorna = null;
  j.lovituri = [];
  j.gata = false;
  j.trageri = 0;
  j.nimeriri = 0;
  j.eliminatLa = null;
  j.ultimaTinta = null;
  j._harta = null;
}

// ================= Regulile =================
function harta(j) {
  if (!j._harta || j._hartaPentru !== j.avioane) {
    j._harta = hartaAvioane(j.avioane, A.n);
    j._hartaPentru = j.avioane;
  }
  return j._harta;
}

// indicii avioanelor doborâte (cu capul lovit)
function doborate(j) {
  if (!j.avioane) return [];
  const capuri = new Set(j.lovituri.filter((l) => l.rez === 'cap').map((l) => l.r * A.n + l.c));
  return j.avioane.map((av, i) => (capuri.has(av.r * A.n + av.c) ? i : -1)).filter((i) => i >= 0);
}

const inViata = (j) => doborate(j).length < A.k;

function celuleDoborate(j) {
  const s = new Set();
  for (const i of doborate(j)) for (const [r, c] of celule(j.avioane[i])) s.add(r * A.n + c);
  return s;
}

// se poate trage acolo? (nu s-a mai tras și nu e dintr-un avion deja doborât)
function liber(t, r, c) {
  if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= A.n || c >= A.n) return false;
  if (t.lovituri.some((l) => l.r === r && l.c === c)) return false;
  return !celuleDoborate(t).has(r * A.n + c);
}

// calculatorul trage (și „trage în locul lui” pentru cine lipsește, pe nivelul mediu)
// îi dăm doar ce se vede pe ecran, nu și avioanele ascunse (vezi calculator.js)
function tragereAI(j, tinte) {
  const publice = tinte.map((t) => ({
    id: t.id,
    lovituri: t.lovituri,
    doborate: doborate(t).map((i) => t.avioane[i]),
    ramase: A.k - doborate(t).length,
  }));
  const { id, r, c } = tragereCalculator(publice, A.n, j.bot ? j.nivel : 'mediu');
  return { t: tinte.find((t) => t.id === id), r, c };
}

const AVATARE_BOT = ['🤖', '👾', '🛸', '🦾', '💻', '🛰️'];
const nivelBot = (j) => NIVELURI[j.nivel] || NIVELURI.mediu;

// ================= Camera de asteptare =================
function formaHtml() {
  // avionul cu nasul în sus, într-o grilă de 5×4
  const h = hartaAvioane([{ r: 0, c: 2, dir: 0 }], 5);
  let html = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    const x = h.get(r * 5 + c);
    html += `<i class="${x ? (x.cap ? 'p cap' : 'p') : ''}"></i>`;
  }
  return html;
}

function randeazaSetari() {
  for (const b of $$('#seg-mod button')) b.setAttribute('aria-checked', String(b.dataset.v === S.setari.mod));
  const plin = S.jucatori.length >= JOC.maxJucatori;
  for (const b of $$('#butoane-bot button')) b.disabled = plin;
}

function legaSetari() {
  $('#forma-lobby').innerHTML = formaHtml();
  $('#seg-mod').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b || !MODURI[b.dataset.v]) return;
    S.setari.mod = b.dataset.v;
    randeazaLobby();
    salveaza();
  });
  $('#butoane-bot').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-nivel]');
    if (!b || !NIVELURI[b.dataset.nivel]) return;
    const boti = S.jucatori.filter((j) => j.bot);
    const avatar = AVATARE_BOT.find((a) => !boti.some((j) => j.avatar === a)) || '🤖';
    const nume = (k) => (k === 1 ? 'Calculatorul' : `Calculator ${k}`);
    let k = 1;
    while (boti.some((j) => j.nume === nume(k))) k++;
    adaugaBot(nume(k), avatar, b.dataset.nivel);
  });
}

// ================= Tablele de pe ecran =================
function randeazaTabele() {
  const n = S.jucatori.length;
  const col = n <= 3 ? n : n === 4 ? 2 : 3;
  const el = $('#tabele');
  el.style.setProperty('--col', col);
  el.style.setProperty('--rand', Math.ceil(n / col));
  el.innerHTML = S.jucatori.map((j) => `
    <div class="tabla-av" data-id="${j.id}" style="--c:${j.culoare}">
      <div class="ta-cap">
        <span class="av-cerc" style="--c:${j.culoare}">${j.avatar}</span>
        <span class="ta-nume">${esc(j.nume)}</span>
        ${j.bot ? `<span class="ta-nivel">${nivelBot(j).nume}</span>` : ''}
        <span class="ta-eticheta"></span>
        <span class="ta-avioane"></span>
      </div>
      <div class="ta-zona">
        <div class="grila-av" style="--n1:${A.n + 1};grid-template-columns:repeat(${A.n + 1},1fr)"></div>
        <div class="ta-stare"></div>
      </div>
    </div>`).join('');
  for (const j of S.jucatori) actualizeazaTabla(j);
}

const tablaEl = (j) => $(`.tabla-av[data-id="${j.id}"]`);
const celEl = (j, r, c) => tablaEl(j)?.querySelector(`.cel[data-x="${r * A.n + c}"]`);

function actualizeazaTabla(j, nou = null) {
  const t = tablaEl(j);
  if (!t) return;
  const n = A.n;
  const lov = new Map((j.lovituri || []).map((l) => [l.r * n + l.c, l.rez]));
  const dob = new Set(doborate(j));
  const h = j.avioane ? harta(j) : new Map();
  let html = '<span class="eti"></span>';
  for (let c = 0; c < n; c++) html += `<span class="eti">${COLOANE[c]}</span>`;
  for (let r = 0; r < n; r++) {
    html += `<span class="eti">${r + 1}</span>`;
    for (let c = 0; c < n; c++) {
      const x = r * n + c;
      const rez = lov.get(x);
      const p = h.get(x);
      const cls = ['cel'];
      let txt = '';
      if (p && dob.has(p.i)) cls.push('avion');
      else if (p && A.dezvaluit) cls.push('avion-viu');
      if (rez) cls.push(rez);
      if (rez === 'lovit') txt = '🔥';
      else if (rez === 'cap') txt = '💀';
      else if (p?.cap && (dob.has(p.i) || A.dezvaluit)) cls.push('cap-av');
      if (nou && nou.r === r && nou.c === c) cls.push('boom');
      html += `<span class="${cls.join(' ')}" data-x="${x}">${txt}</span>`;
    }
  }
  t.querySelector('.grila-av').innerHTML = html;
  const nrDob = dob.size;
  t.querySelector('.ta-avioane').innerHTML = Array.from({ length: A.k }, (_, i) => `<i class="${i < A.k - nrDob ? '' : 'jos'}">✈️</i>`).join('');
  const stare = t.querySelector('.ta-stare');
  if (A.faza === 'asezare') {
    stare.innerHTML = j.gata ? '<span>✅ Gata!</span>' : `<span>${j.online ? '✏️ își așază avioanele…' : '😴 offline'}</span>`;
    t.classList.toggle('gata', !!j.gata);
  } else if (A.faza === 'lupta' && !inViata(j) && !A.dezvaluit) {
    stare.innerHTML = '<span>💀 A rămas fără avioane</span>';
  } else stare.innerHTML = '';
  t.classList.toggle('eliminat', A.faza === 'lupta' && !inViata(j));
  t.classList.toggle('offline', !j.online);
}

function marcheazaTura(j, tinte) {
  for (const x of S.jucatori) {
    const t = tablaEl(x);
    if (!t) continue;
    t.classList.toggle('trage', x === j);
    t.classList.toggle('tinta', !!tinte?.includes(x));
    t.querySelector('.ta-eticheta').textContent = x === j ? '🎯 trage acum' : '';
  }
}

function previzualizare(t, r, c) {
  for (const el of $$('.cel.previz')) el.classList.remove('previz');
  for (const el of $$('.tabla-av.vizata')) el.classList.remove('vizata');
  if (!t) return;
  tablaEl(t)?.classList.add('vizata');
  celEl(t, r, c)?.classList.add('previz');
}

function mesajPeTabla(j, text, cls) {
  const z = tablaEl(j)?.querySelector('.ta-zona');
  if (!z) return;
  const el = document.createElement('div');
  el.className = 'ta-mesaj ' + cls;
  el.textContent = text;
  z.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// ================= Vederile de pe telefoane =================
const lovituriPub = (t) => t.lovituri.map((l) => [l.r, l.c, l.rez]);

function vedereTrage(j, tinte) {
  return {
    tip: 'trage',
    n: A.n,
    implicit: tinte.some((t) => t.id === j.ultimaTinta) ? j.ultimaTinta : tinte[0].id,
    tinte: tinte.map((t) => ({
      id: t.id,
      nume: t.nume,
      avatar: t.avatar,
      culoare: t.culoare,
      ramase: A.k - doborate(t).length,
      lovituri: lovituriPub(t),
      doborate: doborate(t).map((i) => t.avioane[i]),
    })),
    durata: TRAGE_MS,
    sfarsit: Date.now() + TRAGE_MS,
  };
}

function vedereApara(x, cine, ultima = null) {
  const viu = inViata(x);
  return {
    tip: 'apara',
    n: A.n,
    k: A.k,
    avioane: x.avioane,
    lovituri: lovituriPub(x),
    ultima,
    ramase: A.k - doborate(x).length,
    titlu: !viu ? 'Ai rămas fără avioane 😵' : cine ? `E rândul lui ${cine.nume} 🎯` : 'Tabla ta',
    text: !viu ? 'Urmărește jocul pe ecranul mare!' : 'Aici vezi unde au tras ceilalți în avioanele tale.',
  };
}

// ================= Desfasurarea jocului =================
async function laStart() {
  const m = MODURI[S.setari.mod] || MODURI.clasic;
  A.n = m.n;
  A.k = m.k;
  A.tura = 0;
  A.nrTura = 0;
  A.dezvaluit = false;
  A.faza = null;
  for (const j of S.jucatori) pregatesteJucator(j);
  aratTuturor(() => ({ tip: 'asteapta', emoji: '✈️', titlu: 'Începe jocul!', text: 'Uită-te pe ecranul mare 👀' }));
  SUNET.fanfara();
  await anunt({
    emoji: '✈️',
    titlu: 'Lupta aeriană începe!',
    text: `Fiecare are ${A.k} avioane pe o tablă de ${A.n}×${A.n}. Nimerești capul? Avionul cade!`,
    extra: `<div class="forma-avion mare">${formaHtml()}</div>`,
    durata: 5000,
  });
  await asezare();
  if (S.faza !== 'joc') return;
  await anunt({
    emoji: '🎯',
    titlu: 'Toate avioanele sunt în aer!',
    text: 'Trageți pe rând, în ordinea asta:',
    extra: `<div class="ordine">${S.jucatori.map((j, i) => `<span>${i + 1}. ${nh(j)}${j.bot ? ` <small class="slab">(${nivelBot(j).nume})</small>` : ''}</span>`).join('')}</div>`,
    durata: 3200,
  });
  await lupta();
}

async function continua(s) {
  A.n = s.n || 10;
  A.k = s.k || 3;
  A.tura = s.tura || 0;
  A.nrTura = s.nrTura || 0;
  A.dezvaluit = false;
  A.faza = s.faza;
  for (const j of S.jucatori) {
    j.lovituri = Array.isArray(j.lovituri) ? j.lovituri : [];
    j.avioane = curataAvioane(j.avioane, A.n, A.k);
    j.gata = !!j.avioane;
  }
  if (S.jucatori.some((j) => !j.avioane)) A.faza = 'asezare';
  randeazaTabele();
  banner('');
  await asteaptaReconectare();
  if (A.faza === 'asezare') await asezare();
  await lupta();
}

async function asezare() {
  A.faza = 'asezare';
  const { n, k } = A;
  for (const j of S.jucatori) {
    if (j.bot) {
      j.avioane = asezareAleatoare(n, k);
      j.gata = true;
    }
  }
  randeazaTabele();
  marcheazaTura(null);
  banner('✈️ Așezați-vă avioanele pe telefon');
  const sfarsit = Date.now() + ASEZARE_MS;
  for (const j of S.jucatori) {
    if (!j.gata) arata(j, { tip: 'aseaza', n, k, avioane: j.ciorna, durata: ASEZARE_MS, sfarsit });
  }
  const gata = () => new Set(S.jucatori.filter((j) => j.gata).map((j) => j.id));
  if (!toti(gata())) {
    const sari = butonSari('Începem ▶ (cine nu e gata primește avioanele la întâmplare)');
    sari.apasat.then(() => opresteAscultarea());
    await asculta((j, m, fin) => {
      if (m.t !== 'aseaza' || !eCheie(j, m) || j.gata) return;
      const av = curataAvioane(m.avioane, n, k);
      if (!av) return;
      j.ciorna = av;
      j.vedere.avioane = av; // dacă dă refresh, le găsește tot acolo
      if (m.gata) {
        j.avioane = av;
        j.gata = true;
        SUNET.bip();
        arata(j, { tip: 'apara', ...vedereApara(j, null), titlu: 'Avioanele sunt la locul lor! ✅', text: 'Așteptăm să termine și ceilalți…' });
        actualizeazaTabla(j);
      }
      if (toti(gata())) fin();
    }, ASEZARE_MS);
    sari.scoate();
  }
  for (const j of S.jucatori) {
    if (!j.gata) {
      j.avioane = j.ciorna || asezareAleatoare(n, k);
      j.gata = true;
    }
  }
  A.faza = 'lupta';
  for (const j of S.jucatori) actualizeazaTabla(j);
  salveaza();
}

async function lupta() {
  while (S.faza === 'joc') {
    if (S.jucatori.filter(inViata).length <= 1) return terminaJoc();
    A.tura %= S.jucatori.length;
    const j = S.jucatori[A.tura];
    if (inViata(j)) {
      salveaza();
      try {
        await tura(j);
      } catch (e) {
        console.error(e);
      }
      A.nrTura++;
    }
    A.tura = (A.tura + 1) % S.jucatori.length;
  }
}

let asteptTragere = false;

async function tura(j) {
  const tinte = S.jucatori.filter((x) => x !== j && inViata(x));
  marcheazaTura(j, tinte);
  previzualizare(null);
  banner(`🎯 Rândul lui ${nh(j)}`);
  for (const x of S.jucatori) arata(x, x === j ? vedereTrage(j, tinte) : vedereApara(x, j));
  let lov = null;
  if (j.bot) {
    await pauza(d(1400));
    lov = tragereAI(j, tinte);
  } else {
    const sari = butonSari('🎯 Trage în locul lui (Spațiu)');
    sari.apasat.then(() => opresteAscultarea());
    asteptTragere = true;
    lov = await asculta((x, m, fin) => {
      if (x !== j || !eCheie(x, m)) return;
      const t = tinte.find((y) => y.id === m.tinta);
      if (!t) return;
      if (m.t === 'tinteste' && liber(t, m.r, m.c)) previzualizare(t, m.r, m.c);
      if (m.t === 'trage' && liber(t, m.r, m.c)) fin({ t, r: m.r, c: m.c });
    }, j.online ? TRAGE_MS : 10000);
    asteptTragere = false;
    sari.scoate();
    lov ||= tragereAI(j, tinte);
  }
  previzualizare(null);
  j.ultimaTinta = lov.t.id;
  arata(j, { ...vedereApara(j, null), titlu: 'Ai tras! 🎯', text: 'Uită-te pe ecranul mare 👀' });
  await impusca(j, lov.t, lov.r, lov.c);
}

async function impusca(j, t, r, c) {
  const cel = celEl(t, r, c);
  tablaEl(t)?.classList.add('vizata');
  banner(`${nh(j)} trage în ${nh(t)} · <b>${eticheta(r, c)}</b>`);
  if (cel) {
    cel.classList.add('vizat');
    cel.textContent = '🎯';
  }
  SUNET.ton(1500, 0.85, 'sine', 0.07, 0, 320);
  await pauza(d(950));
  const p = harta(t).get(r * A.n + c);
  const rez = !p ? 'aer' : p.cap ? 'cap' : 'lovit';
  t.lovituri.push({ r, c, rez, de: j.id });
  j.trageri = (j.trageri || 0) + 1;
  if (rez !== 'aer') j.nimeriri = (j.nimeriri || 0) + 1;
  actualizeazaTabla(t, { r, c });
  tablaEl(t)?.classList.remove('vizata');
  arata(t, vedereApara(t, j, [r, c]));
  if (rez === 'aer') {
    mesajPeTabla(t, '💨 Aer!', 'aer');
    SUNET.ton(260, 0.3, 'triangle', 0.1, 0, 140);
    await pauza(d(1500));
    return;
  }
  if (rez === 'lovit') {
    mesajPeTabla(t, '🔥 Lovit!', 'lovit');
    SUNET.pop();
    await pauza(d(1700));
    return;
  }
  // capul: avionul e doborât
  mesajPeTabla(t, '💥 Doborât!', 'cap');
  SUNET.pop();
  setTimeout(() => SUNET.bun(), 250);
  await pauza(d(1300));
  await anunt({
    emoji: '💥',
    titlu: 'Avion doborât!',
    text: `${nh(j)} a nimerit capul unui avion al lui ${nh(t)}!`,
    durata: 2400,
    stil: 'rosu',
  });
  if (!inViata(t)) {
    t.eliminatLa = A.nrTura;
    actualizeazaTabla(t);
    arata(t, vedereApara(t, j, [r, c]));
    await anunt({
      emoji: '💀',
      titlu: `${nh(t)} a rămas fără avioane!`,
      text: S.jucatori.filter(inViata).length > 1 ? 'Lupta continuă fără el.' : '',
      durata: 2600,
      sunet: SUNET.rau,
    });
  }
}

async function terminaJoc() {
  if (S.faza !== 'joc') return;
  marcheazaTura(null);
  banner('🏁 Gata! Iată unde erau toate avioanele');
  A.dezvaluit = true;
  for (const j of S.jucatori) actualizeazaTabla(j);
  aratTuturor((x) => ({ ...vedereApara(x, null), titlu: inViata(x) ? 'Ai câștigat! 🏆' : 'Gata jocul!', text: 'Uită-te pe ecranul mare 👀' }));
  await pauza(d(3500));
  const vii = S.jucatori.filter(inViata);
  const elim = S.jucatori.filter((j) => !inViata(j)).sort((a, b) => (b.eliminatLa ?? 0) - (a.eliminatLa ?? 0));
  const text = (j) => `${j.nimeriri || 0} ${j.nimeriri === 1 ? 'nimerire' : 'nimeriri'} din ${j.trageri || 0}`;
  const clasament = [
    ...vii.map((j) => ({ j, loc: 1, text: text(j) })),
    ...elim.map((j, i) => ({ j, loc: vii.length + i + 1, text: text(j) })),
  ];
  finalJoc(clasament);
}

// ================= Pornire =================
legaSetari();
$('#buton-tabele').addEventListener('click', () => {
  $('#final').hidden = true;
  const b = butonSari('🏆 Înapoi la clasament');
  b.apasat.then(() => {
    b.scoate();
    if (S.faza === 'final') $('#final').hidden = false;
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === ' ' && asteptTragere) {
    e.preventDefault();
    opresteAscultarea();
  }
});
pornesteEcranul();
