'use strict';
// Ecranul mare, partea comună pentru Țomapan și Avioanele:
// camera (cod + QR), jucătorii, legătura cu telefoanele, anunțurile, salvarea și finalul cu podium.
// Fiecare joc completează obiectul JOC cu regulile lui (vezi ecran.js din folderul jocului).

const PARAM = new URLSearchParams(location.search);
const RAPID = PARAM.has('rapid') ? 0.35 : 1; // doar pentru teste: anunturi mai scurte
const d = (ms) => Math.round(ms * RAPID);
const ID_VALID = /^[a-z0-9]{6,40}$/i;
const MEDALII = ['🥇', '🥈', '🥉'];

const JOC = {
  minJucatori: 2,
  maxJucatori: 8,
  cheieSalvare: 'joc-v1',
  setari: {},
  // completate de fiecare joc:
  // laStart()            – porneste jocul (async)
  // stareJoc()           – ce salvam ca sa putem continua dupa refresh
  // salveazaJucator(j)   – campurile proprii ale jucatorului care se salveaza
  // continua(stare)      – reia jocul salvat (async)
  // randeazaLateral()    – actualizeaza lista de jucatori din joc
  // randeazaSetari()     – actualizeaza setarile din camera de asteptare
  // reseteaza()          – inainte de „Încă un joc”
  // infoVedere(j, v)     – completeaza ce vede jucatorul sus pe telefon (v.info)
  // descriereSalvare(s)  – text scurt pentru „Continuă jocul”
  // etichetaBot(j)       – ce scrie sub numele unui calculator în camera de așteptare
};

const S = {
  cod: null,
  faza: 'pornire', // pornire | lobby | joc | final
  setari: {},
  jucatori: [],
  vipId: null,
};

let camera = null;
let ascultator = null;
let finCurent = null;
let contorCheie = 0;

const jucator = (id) => S.jucatori.find((j) => j.id === id);
const altii = (j) => S.jucatori.filter((x) => x !== j);
const oameni = () => S.jucatori.filter((j) => !j.bot);
const nh = (j) => `<span class="nj" style="color:${j.culoare}">${j.avatar} ${esc(j.nume)}</span>`;

// ================= Retea =================
function deschideCamera(cod) {
  camera?.opreste();
  S.cod = cod;
  afiseazaCod();
  camera = RETEA.gazda(cod, {
    mesaj: laMesaj,
    inchis: laInchidere,
    stare: arataStareRetea,
  });
}

function arataStareRetea(stare) {
  const el = $('#stare-retea');
  if (!el) return;
  const texte = {
    conectare: ['Se conectează…', ''],
    online: ['Camera e deschisă. Intrați!', 'ok'],
    'fara-internet': ['Nu am internet sau serverul nu răspunde. Reîncerc…', 'rau'],
  };
  const [text, cls] = texte[stare] || ['', ''];
  el.textContent = text;
  el.className = 'stare-retea ' + cls;
}

function adresaTelefon() {
  return new URL('telefon.html?cod=' + S.cod, location.href).href;
}

function qrSvg(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: 'Cod QR' });
}

function afiseazaCod() {
  const url = adresaTelefon();
  for (const el of $$('.cod-text')) el.textContent = S.cod;
  for (const el of $$('.qr-cod')) el.innerHTML = qrSvg(url);
  const a = $('#adresa');
  if (a) a.textContent = location.host + location.pathname.replace(/[^/]*$/, '');
}

function trimite(j, m) {
  if (j.bot || !j.conn || !j.conn.open) return;
  try { j.conn.send(m); } catch { /* telefonul s-a deconectat */ }
}

// trimite unui telefon ce sa afiseze; „cheie” leaga raspunsul de intrebare
function arata(j, v) {
  v.cheie = (++contorCheie).toString(36) + Math.random().toString(36).slice(2, 6);
  if (S.faza === 'joc') JOC.infoVedere?.(j, v);
  j.vedere = v;
  trimiteVedere(j);
}

// v.sfarsit = momentul (ceasul laptopului) cand expira timpul; telefonul primeste cat a mai ramas
function trimiteVedere(j) {
  const v = j.vedere;
  if (!v) return;
  if (v.sfarsit) v.ramas = Math.max(0, v.sfarsit - Date.now());
  trimite(j, { t: 'vedere', v });
}

function aratTuturor(fn) {
  for (const j of S.jucatori) {
    const v = fn(j);
    if (v) arata(j, v);
  }
}

// trimite un „eveniment” in vederea curenta (fara s-o redeseneze)
function eveniment(j, m) {
  trimite(j, { t: 'ev', ...m });
}

const eCheie = (j, m) => !!m.cheie && j.vedere?.cheie === m.cheie;
const toti = (colectie, lista = S.jucatori) => lista.every((j) => colectie.has(j.id) || !j.online);

function jucatorDupaConn(conn) {
  return S.jucatori.find((j) => j.conn === conn);
}

function laMesaj(conn, m) {
  if (m.t === 'ping') {
    try { conn.send({ t: 'pong' }); } catch { /* nimic */ }
    const j = jucatorDupaConn(conn);
    if (j) atins(j);
    else ceriSalut(conn);
    return;
  }
  if (m.t === 'salut') {
    salut(conn, m);
    return;
  }
  const j = jucatorDupaConn(conn);
  if (!j) return;
  atins(j);
  if (m.t === 'reactie') return reactie(j, m.e);
  if (m.t === 'start') {
    if (S.faza === 'lobby' && j.id === S.vipId) pornesteJoc();
    return;
  }
  if (m.t === 'din-nou') {
    if (S.faza === 'final' && j.id === S.vipId) inapoiInLobby();
    return;
  }
  if (ascultator) ascultator(j, m);
}

// un telefon necunoscut ne trimite „ping” (de ex. după refresh pe laptop): îl rugăm să se prezinte iar
function ceriSalut(conn) {
  const acum = Date.now();
  if (acum - (conn.cerutSalut || 0) < 4000) return;
  conn.cerutSalut = acum;
  try { conn.send({ t: 'cine' }); } catch { /* nimic */ }
}

function atins(j) {
  j.ultim = Date.now();
  if (!j.online) {
    j.online = true;
    randeazaJucatori();
  }
}

function laInchidere(conn) {
  const j = jucatorDupaConn(conn);
  if (!j) return;
  j.conn = null;
  j.online = false;
  randeazaJucatori();
}

// daca un telefon nu mai trimite nimic cateva secunde, il marcam deconectat
setInterval(() => {
  const acum = Date.now();
  let schimbat = false;
  for (const j of S.jucatori) {
    if (!j.bot && j.online && acum - j.ultim > 9000) {
      j.online = false;
      schimbat = true;
    }
  }
  if (schimbat) randeazaJucatori();
}, 2000);

function curataNume(n, rezerva) {
  const s = String(n || '').replace(/\s+/g, ' ').trim().slice(0, 12);
  return s || rezerva;
}

function refuza(conn, motiv) {
  try { conn.send({ t: 'refuz', motiv }); } catch { /* nimic */ }
  setTimeout(() => { try { conn.close(); } catch { /* nimic */ } }, 800);
}

function trimiteBine(j) {
  trimite(j, { t: 'bine', cod: S.cod, eu: { nume: j.nume, avatar: j.avatar, culoare: j.culoare } });
}

function culoareLibera() {
  return CULORI.find((c) => !S.jucatori.some((x) => x.culoare === c)) || CULORI[S.jucatori.length % CULORI.length];
}

function jucatorNou(date) {
  return {
    conn: null,
    online: false,
    ultim: Date.now(),
    vedere: null,
    ultimaReactie: 0,
    bot: false,
    ...date,
  };
}

function salut(conn, m) {
  const id = String(m.id || '');
  if (!ID_VALID.test(id)) return;
  let j = jucator(id);
  if (j) {
    // un jucator cunoscut revine (telefon blocat, refresh, internet picat)
    if (j.conn && j.conn !== conn) {
      const vechi = j.conn;
      setTimeout(() => { try { vechi.close(); } catch { /* nimic */ } }, 0);
    }
    j.conn = conn;
    j.ultim = Date.now();
    j.online = true;
    if (S.faza === 'lobby') {
      j.nume = curataNume(m.nume, j.nume);
      if (AVATARE.includes(m.avatar)) j.avatar = m.avatar;
    }
    trimiteBine(j);
    if (S.faza === 'lobby') trimiteLobby();
    else if (j.vedere) trimiteVedere(j);
    else arata(j, { tip: 'asteapta', emoji: '👋', titlu: 'Te-ai reconectat!', text: 'Jocul continuă imediat. Uită-te pe ecranul mare 👀' });
    randeazaJucatori();
    return;
  }
  if (S.faza !== 'lobby') {
    refuza(conn, 'Jocul a început deja. Intri la jocul următor 🙂');
    return;
  }
  if (S.jucatori.length >= JOC.maxJucatori) {
    refuza(conn, `Camera e plină (maxim ${JOC.maxJucatori} jucători).`);
    return;
  }
  j = jucatorNou({
    id,
    nume: curataNume(m.nume, 'Jucător ' + (S.jucatori.length + 1)),
    avatar: AVATARE.includes(m.avatar) ? m.avatar : alegeUnul(AVATARE),
    culoare: culoareLibera(),
    conn,
    online: true,
  });
  S.jucatori.push(j);
  if (!S.vipId || !jucator(S.vipId)) S.vipId = j.id;
  SUNET.intrare();
  trimiteBine(j);
  trimiteLobby();
  randeazaJucatori();
  salveaza();
}

// jucator controlat de calculator (de ex. la Avioane); nivel: usor | mediu | greu
function adaugaBot(nume, avatar, nivel) {
  if (S.faza !== 'lobby' || S.jucatori.length >= JOC.maxJucatori) return null;
  const j = jucatorNou({ id: 'bot' + Math.random().toString(36).slice(2, 10), nume, avatar, nivel, culoare: culoareLibera(), bot: true, online: true });
  S.jucatori.push(j);
  SUNET.intrare();
  trimiteLobby();
  randeazaJucatori();
  salveaza();
  return j;
}

function trimiteLobby() {
  const pot = S.jucatori.length >= JOC.minJucatori;
  aratTuturor((j) => (j.bot ? null : { tip: 'lobby', vip: j.id === S.vipId, pot, nr: S.jucatori.length, min: JOC.minJucatori }));
}

function scoateJucator(id) {
  if (S.faza !== 'lobby') return;
  const j = jucator(id);
  if (!j) return;
  if (j.conn) refuza(j.conn, 'Ai fost scos din cameră. Poți intra din nou cu codul camerei.');
  S.jucatori = S.jucatori.filter((x) => x !== j);
  if (S.vipId === id) S.vipId = oameni()[0]?.id || null;
  trimiteLobby();
  randeazaJucatori();
  salveaza();
}

function reactie(j, e) {
  if (!REACTII.includes(e)) return;
  const acum = Date.now();
  if (acum - (j.ultimaReactie || 0) < 450) return;
  j.ultimaReactie = acum;
  const el = document.createElement('div');
  el.className = 'reactie';
  el.style.left = rnd(5, 88) + '%';
  el.style.setProperty('--c', j.culoare);
  el.style.setProperty('--r', rnd(-25, 25) + 'deg');
  el.innerHTML = `${e}<small>${j.avatar}</small>`;
  $('#reactii').appendChild(el);
  el.addEventListener('animationend', () => el.remove());
  SUNET.reactie();
}

// ================= Ascultarea raspunsurilor =================
// O singura „intrebare” activa la un moment dat. fin(v) incheie asteptarea.
function asculta(handler, timeoutMs) {
  return new Promise((res) => {
    let gata = false;
    let timer = null;
    const fin = (v = null) => {
      if (gata) return;
      gata = true;
      clearTimeout(timer);
      if (finCurent === fin) {
        finCurent = null;
        ascultator = null;
      }
      res(v);
    };
    if (timeoutMs) timer = setTimeout(() => fin(null), timeoutMs);
    finCurent?.(null); // o intrebare noua o inchide pe cea veche
    finCurent = fin;
    ascultator = (j, m) => handler(j, m, fin);
  });
}
function opresteAscultarea(v = null) {
  finCurent?.(v);
}

// ================= Salvare (refresh pe laptop) =================
function salveaza() {
  if (S.faza === 'pornire' || S.faza === 'final') return;
  if (S.faza === 'lobby' && !S.jucatori.length) return;
  const joc = S.faza === 'joc' ? JOC.stareJoc?.() : null;
  if (S.faza === 'joc' && !joc) return;
  try {
    localStorage.setItem(JOC.cheieSalvare, JSON.stringify({
      timp: Date.now(),
      cod: S.cod,
      faza: S.faza,
      setari: S.setari,
      vipId: S.vipId,
      jucatori: S.jucatori.map((j) => ({
        id: j.id, nume: j.nume, avatar: j.avatar, culoare: j.culoare, bot: j.bot, nivel: j.nivel,
        ...(S.faza === 'joc' ? JOC.salveazaJucator?.(j) : null),
      })),
      joc,
    }));
  } catch { /* nimic */ }
}

function citesteSalvarea() {
  try {
    const s = JSON.parse(localStorage.getItem(JOC.cheieSalvare));
    if (!s || !s.cod || Date.now() - s.timp > 6 * 3600e3 || !Array.isArray(s.jucatori) || !s.jucatori.length) return null;
    if (s.faza === 'joc' && s.joc) return s;
    if (s.faza === 'lobby') return s;
  } catch { /* nimic */ }
  return null;
}

function stergeSalvarea() {
  try { localStorage.removeItem(JOC.cheieSalvare); } catch { /* nimic */ }
}

// ================= Ecrane =================
function arataEcran(nume) {
  for (const id of ['pornire', 'lobby', 'joc']) $('#' + id).hidden = id !== nume;
  $('#final').hidden = true;
  $('#strat-anunt').hidden = true;
}

function randeazaJucatori() {
  if (S.faza === 'lobby') randeazaLobby();
  else if (S.faza === 'joc') JOC.randeazaLateral?.();
}

function randeazaLobby() {
  let html = S.jucatori.map((j) => `
    <div class="loc-jucator ${j.online ? '' : 'offline'}" style="border-color:${j.culoare}">
      <span class="av-cerc" style="--c:${j.culoare}">${j.avatar}</span>
      <span class="nume">${esc(j.nume)}
        ${j.id === S.vipId ? '<span class="eticheta-vip">⭐ poate porni jocul</span>' : ''}
        ${j.bot ? `<span class="eticheta-vip">${esc(JOC.etichetaBot?.(j) || 'joacă singur')}</span>` : ''}
        ${j.online ? '' : '<span class="eticheta-vip">se reconectează…</span>'}
      </span>
      <button class="scoate" type="button" data-id="${j.id}" title="Scoate jucătorul">✕</button>
    </div>`).join('');
  for (let i = S.jucatori.length; i < JOC.maxJucatori; i++) {
    html += `<div class="loc-jucator gol">${i < JOC.minJucatori ? 'Așteptăm un jucător…' : 'loc liber'}</div>`;
  }
  $('#lobby-jucatori').innerHTML = html;
  $('#nr-jucatori').textContent = `${S.jucatori.length}/${JOC.maxJucatori}`;
  const pot = S.jucatori.length >= JOC.minJucatori;
  $('#buton-start').disabled = !pot;
  const vip = jucator(S.vipId);
  $('#nota-start').textContent = pot
    ? (vip ? `Sau apasă „Începe jocul” pe telefonul lui ${vip.nume}.` : '')
    : `E nevoie de cel puțin ${JOC.minJucatori} jucători.`;
  JOC.randeazaSetari?.();
}

function banner(html) {
  $('#banner').innerHTML = html;
}

// ================= Anunturi =================
async function anunt({ emoji, titlu, text = '', extra = '', durata = 2800, stil = '', sunet = null }) {
  const s = $('#strat-anunt');
  s.innerHTML = `<div class="carte ${stil}"><div class="carte-emoji">${emoji}</div><h2>${titlu}</h2>${text ? `<p>${text}</p>` : ''}${extra}</div>`;
  s.hidden = false;
  sunet?.();
  await pauza(d(durata));
  s.hidden = true;
}

function arataCarte(html, stil = '') {
  const s = $('#strat-anunt');
  s.innerHTML = `<div class="carte ${stil}">${html}</div>`;
  s.hidden = false;
}

function ascundeCarte() {
  $('#strat-anunt').hidden = true;
}

function butonSari(text) {
  const b = document.createElement('button');
  b.className = 'buton mic buton-sari';
  b.type = 'button';
  b.textContent = text;
  document.body.appendChild(b);
  const apasat = new Promise((res) => b.addEventListener('click', res, { once: true }));
  return { apasat, scoate: () => b.remove() };
}

// ================= Pornirea si sfarsitul jocului =================
async function pornesteJoc() {
  if (S.faza !== 'lobby' || S.jucatori.length < JOC.minJucatori) return;
  S.faza = 'joc';
  S.jucatori = amesteca(S.jucatori);
  arataEcran('joc');
  banner('');
  tineEcranul();
  try {
    await JOC.laStart();
  } catch (e) {
    console.error(e);
  }
}

async function asteaptaReconectare() {
  const sari = butonSari('Continuă fără ei ▶');
  const lista = () => S.jucatori.map((j) => `<span>${j.online ? '✅' : '⏳'} ${nh(j)}</span>`).join('');
  arataCarte(`<div class="carte-emoji">📱</div><h2>Jocul continuă!</h2><p>Telefoanele se reconectează singure…</p><div class="ordine" id="lista-reconectare">${lista()}</div>`, 'mov');
  const t0 = Date.now();
  let apasat = false;
  sari.apasat.then(() => { apasat = true; });
  while (!apasat && Date.now() - t0 < 60000 && !S.jucatori.every((j) => j.online)) {
    await pauza(500);
    const el = $('#lista-reconectare');
    if (el) el.innerHTML = lista();
  }
  sari.scoate();
  ascundeCarte();
}

// clasament: [{ j, loc, text }] in ordinea locurilor
function finalJoc(clasament) {
  S.faza = 'final';
  stergeSalvarea();
  opresteAscultarea();
  banner('');
  const castigatori = clasament.filter((r) => r.loc === 1);
  $('#final-titlu').innerHTML = castigatori.length > 1
    ? `🏆 Egalitate: ${castigatori.map((r) => nh(r.j)).join(' și ')}!`
    : `🏆 ${nh(castigatori[0].j)} a câștigat!`;
  const podium = [clasament[1], clasament[0], clasament[2]].filter(Boolean);
  $('#podium').innerHTML = podium.map((r) => `
    <div class="treapta l${Math.min(r.loc, 3)}">
      <span class="av-cerc" style="--c:${r.j.culoare}">${r.j.avatar}</span>
      <span class="nume">${esc(r.j.nume)}</span>
      ${r.text ? `<span class="treapta-text">${esc(r.text)}</span>` : ''}
      <div class="bloc">${r.loc}</div>
    </div>`).join('');
  $('#final-rest').innerHTML = clasament.slice(3).map((r) => `<li>${r.loc}. ${nh(r.j)}${r.text ? ` · ${esc(r.text)}` : ''}</li>`).join('');
  $('#final').hidden = false;
  for (const r of clasament) arata(r.j, { tip: 'final', loc: r.loc, vip: r.j.id === S.vipId, text: r.text || '' });
  SUNET.fanfara();
  confetti();
}

function inapoiInLobby() {
  if (S.faza !== 'final') return;
  JOC.reseteaza?.();
  S.faza = 'lobby';
  arataEcran('lobby');
  randeazaLobby();
  trimiteLobby();
  salveaza();
}

// ================= Confetti =================
let rafConfetti = 0;
function confetti() {
  const c = $('#confetti');
  const x = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = (c.width = innerWidth * dpr);
  const H = (c.height = innerHeight * dpr);
  const culori = ['#ff5d3a', '#ffbe0b', '#16a34a', '#2563eb', '#9333ea', '#ec4899'];
  const p = Array.from({ length: 180 }, () => ({
    x: Math.random() * W,
    y: -Math.random() * H,
    vx: (Math.random() - 0.5) * 2 * dpr,
    vy: (2 + Math.random() * 3) * dpr,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.2,
    w: (6 + Math.random() * 8) * dpr,
    h: (8 + Math.random() * 10) * dpr,
    c: alegeUnul(culori),
  }));
  const t0 = performance.now();
  cancelAnimationFrame(rafConfetti);
  const pas = (t) => {
    x.clearRect(0, 0, W, H);
    for (const q of p) {
      q.x += q.vx;
      q.y += q.vy;
      q.r += q.vr;
      if (q.y > H + 20 && t - t0 < 6000) {
        q.y = -20;
        q.x = Math.random() * W;
      }
      x.save();
      x.translate(q.x, q.y);
      x.rotate(q.r);
      x.fillStyle = q.c;
      x.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
      x.restore();
    }
    if (t - t0 < 11000 && !$('#final').hidden) rafConfetti = requestAnimationFrame(pas);
    else x.clearRect(0, 0, W, H);
  };
  rafConfetti = requestAnimationFrame(pas);
}

// ================= Ecran treaz =================
let wakeLock = null;
async function tineEcranul() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch { /* nu e suportat */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.faza === 'joc') tineEcranul();
});

// ================= Pornire =================
function cameraNoua() {
  stergeSalvarea();
  JOC.reseteaza?.();
  Object.assign(S, { faza: 'lobby', jucatori: [], vipId: null });
  arataEcran('lobby');
  deschideCamera(RETEA.codNou());
  randeazaLobby();
}

async function continuaSalvarea(s) {
  S.setari = { ...JOC.setari, ...(s.setari || {}) };
  S.vipId = s.vipId;
  S.jucatori = s.jucatori.map((j) => jucatorNou({ ...j, online: !!j.bot }));
  deschideCamera(s.cod);
  if (s.faza === 'lobby') {
    S.faza = 'lobby';
    arataEcran('lobby');
    randeazaLobby();
    return;
  }
  S.faza = 'joc';
  arataEcran('joc');
  tineEcranul();
  try {
    await JOC.continua(s.joc);
  } catch (e) {
    console.error(e);
  }
}

// apelat de joc dupa ce si-a completat obiectul JOC
function pornesteEcranul() {
  S.setari = structuredClone(JOC.setari);

  $('#buton-start').addEventListener('click', () => { SUNET.deblocheaza(); pornesteJoc(); });
  $('#lobby-jucatori').addEventListener('click', (e) => {
    const b = e.target.closest('.scoate');
    if (b) scoateJucator(b.dataset.id);
  });
  $('#buton-din-nou').addEventListener('click', inapoiInLobby);
  $('#buton-camera-noua').addEventListener('click', () => {
    stergeSalvarea();
    location.href = 'ecran.html';
  });
  const bSunet = $('#buton-sunet');
  const butonSunet = () => { bSunet.textContent = SUNET.mut ? '🔇' : '🔊'; };
  bSunet.addEventListener('click', () => { SUNET.mut = !SUNET.mut; butonSunet(); SUNET.bip(); });
  butonSunet();
  $('#buton-ecran').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  document.addEventListener('pointerdown', () => SUNET.deblocheaza(), { once: true });

  const salvat = citesteSalvarea();
  if (!salvat) {
    cameraNoua();
    return;
  }
  const nume = salvat.jucatori.map((j) => `${j.avatar} ${esc(j.nume)}`).join(', ');
  const detalii = salvat.faza === 'joc' ? JOC.descriereSalvare?.(salvat) || '' : '';
  $('#pornire-continut').innerHTML = `
    <p class="slab" style="font-size:1.2rem">Ai un joc neterminat${detalii ? ` (${esc(detalii)})` : ''}, cu ${nume}.<br>Codul camerei: <b>${esc(salvat.cod)}</b></p>
    <div class="butoane">
      <button id="b-continua" class="buton principal" type="button">▶ Continuă jocul</button>
      <button id="b-nou" class="buton" type="button">✨ Joc nou</button>
    </div>`;
  $('#b-continua').addEventListener('click', () => { SUNET.deblocheaza(); continuaSalvarea(salvat); });
  $('#b-nou').addEventListener('click', cameraNoua);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').catch(() => {});
