'use strict';
// Ecranul mare: tine starea jocului, deseneaza tabla si conduce minijocurile.
// Telefoanele sunt doar „telecomenzi”: primesc de aici ce sa afiseze (o „vedere”) si trimit inapoi apasarile.

// ================= Utilitare =================
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pauza = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const alegeUnul = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const amesteca = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
};
const sec = (ms) => (ms / 1000).toFixed(2).replace('.', ',');

const PARAM = new URLSearchParams(location.search);
const RAPID = PARAM.has('rapid') ? 0.35 : 1; // doar pentru teste: anunturi mai scurte
const d = (ms) => Math.round(ms * RAPID);

const MAX_JUCATORI = 6;
const CHEIE_SALVARE = 'hlt-joc-v1';
const DIM = { 30: [6, 5], 42: [7, 6], 54: [9, 6] }; // coloane x randuri pentru fiecare lungime
const ICON = { plus: '⏩', minus: '🍌', cadou: '🎁', provocare: '🎭', schimb: '🔄', zar: '🎲' };
const MEDALII = ['🥇', '🥈', '🥉'];
const ID_VALID = /^[a-z0-9]{6,40}$/i;

// ================= Starea jocului =================
const S = {
  cod: null,
  faza: 'pornire', // pornire | lobby | joc | final
  setari: { lungime: 42 },
  jucatori: [],
  vipId: null,
  tabla: [],
  pozitii: [],
  runda: 1,
  ordineTura: 0,
  curent: null,
  sacMj: [],
  saci: {},
};

let camera = null;
let ascultator = null;
let finCurent = null;
let contorCheie = 0;

const jucator = (id) => S.jucatori.find((j) => j.id === id);
const altii = (j) => S.jucatori.filter((x) => x !== j);
const nh = (j) => `<span class="nj" style="color:${j.culoare}">${j.avatar} ${esc(j.nume)}</span>`;
const castigator = () => S.tabla.length > 0 && S.jucatori.some((j) => j.poz >= S.tabla.length - 1);

// ================= Retea =================
function deschideCamera(cod) {
  camera?.opreste();
  S.cod = cod;
  afiseazaCod();
  camera = RETEA.gazda(cod, {
    mesaj: laMesaj,
    inchis: laInchidere,
    stare: arataStareRetea,
    codOcupat: () => {
      deschideCamera(RETEA.codNou());
      salveaza();
    },
  });
}

function arataStareRetea(stare) {
  const el = $('#stare-retea');
  if (!el) return;
  const texte = {
    conectare: ['Se conectează…', ''],
    online: ['Camera e deschisă. Intrați!', 'ok'],
    reconectare: ['Se reconectează la server…', ''],
    'cod-ocupat': ['Se redeschide camera…', ''],
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
  $('#cod-mare').textContent = S.cod;
  $('#cod-mic').textContent = S.cod;
  const url = adresaTelefon();
  $('#qr').innerHTML = qrSvg(url);
  $('#qr-mic').innerHTML = qrSvg(url);
  $('#adresa').textContent = location.host + location.pathname.replace(/[^/]*$/, '');
}

function trimite(j, m) {
  if (!j.conn || !j.conn.open) return;
  try { j.conn.send(m); } catch { /* telefonul s-a deconectat */ }
}

// trimite unui telefon ce sa afiseze; „cheie” leaga raspunsul de intrebare
function arata(j, v) {
  v.cheie = (++contorCheie).toString(36) + Math.random().toString(36).slice(2, 6);
  if (S.faza === 'joc' && S.tabla.length) {
    v.poz = j.poz;
    v.total = S.tabla.length - 1;
  }
  j.vedere = v;
  trimite(j, { t: 'vedere', v });
}

function aratTuturor(fn) {
  for (const j of S.jucatori) {
    const v = fn(j);
    if (v) arata(j, v);
  }
}

const eCheie = (j, m) => !!m.cheie && j.vedere?.cheie === m.cheie;
const toti = (colectie) => S.jucatori.every((j) => colectie.has(j.id) || !j.online);

function jucatorDupaConn(conn) {
  return S.jucatori.find((j) => j.conn === conn);
}

function laMesaj(conn, m) {
  if (m.t === 'ping') {
    try { conn.send({ t: 'pong' }); } catch { /* nimic */ }
    const j = jucatorDupaConn(conn);
    if (j) atins(j);
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
    if (j.online && acum - j.ultim > 9000) {
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
    else if (j.vedere) trimite(j, { t: 'vedere', v: j.vedere });
    else arata(j, { tip: 'asteapta', emoji: '👋', titlu: 'Te-ai reconectat!', text: 'Jocul continuă imediat. Uită-te pe ecranul mare 👀' });
    randeazaJucatori();
    return;
  }
  if (S.faza !== 'lobby') {
    refuza(conn, 'Jocul a început deja. Intri la jocul următor 🙂');
    return;
  }
  if (S.jucatori.length >= MAX_JUCATORI) {
    refuza(conn, `Camera e plină (maxim ${MAX_JUCATORI} jucători).`);
    return;
  }
  const culoare = CULORI.find((c) => !S.jucatori.some((x) => x.culoare === c)) || CULORI[0];
  j = {
    id,
    nume: curataNume(m.nume, 'Jucător ' + (S.jucatori.length + 1)),
    avatar: AVATARE.includes(m.avatar) ? m.avatar : alegeUnul(AVATARE),
    culoare,
    poz: 0,
    sosit: null,
    conn,
    online: true,
    ultim: Date.now(),
    vedere: null,
    ultimaReactie: 0,
  };
  S.jucatori.push(j);
  if (!S.vipId || !jucator(S.vipId)) S.vipId = j.id;
  SUNET.intrare();
  trimiteBine(j);
  trimiteLobby();
  randeazaJucatori();
  salveaza();
}

function trimiteLobby() {
  aratTuturor((j) => ({ tip: 'lobby', vip: j.id === S.vipId, pot: S.jucatori.length >= 2, nr: S.jucatori.length }));
}

function scoateJucator(id) {
  if (S.faza !== 'lobby') return;
  const j = jucator(id);
  if (!j) return;
  if (j.conn) refuza(j.conn, 'Ai fost scos din cameră. Poți intra din nou cu codul camerei.');
  S.jucatori = S.jucatori.filter((x) => x !== j);
  if (S.vipId === id) S.vipId = S.jucatori[0]?.id || null;
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
  try {
    localStorage.setItem(CHEIE_SALVARE, JSON.stringify({
      timp: Date.now(),
      cod: S.cod,
      faza: S.faza,
      setari: S.setari,
      runda: S.runda,
      ordineTura: S.ordineTura,
      vipId: S.vipId,
      sacMj: S.sacMj,
      tabla: S.tabla.map((c) => c.tip),
      jucatori: S.jucatori.map(({ id, nume, avatar, culoare, poz }) => ({ id, nume, avatar, culoare, poz })),
    }));
  } catch { /* nimic */ }
}

function citesteSalvarea() {
  try {
    const s = JSON.parse(localStorage.getItem(CHEIE_SALVARE));
    if (!s || !s.cod || Date.now() - s.timp > 6 * 3600e3 || !Array.isArray(s.jucatori) || !s.jucatori.length) return null;
    if (s.faza === 'joc' && s.tabla?.length) return s;
    if (s.faza === 'lobby') return s;
  } catch { /* nimic */ }
  return null;
}

function stergeSalvarea() {
  try { localStorage.removeItem(CHEIE_SALVARE); } catch { /* nimic */ }
}

// ================= Ecrane =================
function arataEcran(nume) {
  for (const id of ['pornire', 'lobby', 'joc']) $('#' + id).hidden = id !== nume;
  $('#final').hidden = true;
  $('#mj').hidden = true;
  $('#strat-zar').hidden = true;
  $('#strat-anunt').hidden = true;
}

function randeazaJucatori() {
  if (S.faza === 'lobby') randeazaLobby();
  else if (S.faza === 'joc') randeazaLateral();
}

function randeazaLobby() {
  let html = S.jucatori.map((j) => `
    <div class="loc-jucator ${j.online ? '' : 'offline'}" style="border-color:${j.culoare}">
      <span class="av-cerc" style="--c:${j.culoare}">${j.avatar}</span>
      <span class="nume">${esc(j.nume)}
        ${j.id === S.vipId ? '<span class="eticheta-vip">⭐ poate porni jocul</span>' : ''}
        ${j.online ? '' : '<span class="eticheta-vip">se reconectează…</span>'}
      </span>
      <button class="scoate" type="button" data-id="${j.id}" title="Scoate jucătorul">✕</button>
    </div>`).join('');
  for (let i = S.jucatori.length; i < MAX_JUCATORI; i++) {
    html += `<div class="loc-jucator gol">${i < 2 ? 'Așteptăm un jucător…' : 'loc liber'}</div>`;
  }
  $('#lobby-jucatori').innerHTML = html;
  $('#nr-jucatori').textContent = `${S.jucatori.length}/${MAX_JUCATORI}`;
  const pot = S.jucatori.length >= 2;
  $('#buton-start').disabled = !pot;
  const vip = jucator(S.vipId);
  $('#nota-start').textContent = pot
    ? (vip ? `Sau apasă „Începe jocul” pe telefonul lui ${vip.nume}.` : '')
    : 'E nevoie de cel puțin 2 jucători.';
  for (const b of document.querySelectorAll('#seg-lungime button')) {
    b.setAttribute('aria-checked', String(+b.dataset.v === S.setari.lungime));
  }
}

function clasamentPozitii() {
  const sortat = [...S.jucatori].sort((a, b) => b.poz - a.poz);
  const loc = new Map();
  sortat.forEach((j, i) => loc.set(j.id, i > 0 && j.poz === sortat[i - 1].poz ? loc.get(sortat[i - 1].id) : i + 1));
  return loc;
}

function randeazaLateral() {
  const fin = Math.max(1, S.tabla.length - 1);
  const loc = clasamentPozitii();
  $('#lista-jucatori').innerHTML = S.jucatori.map((j) => `
    <li class="${S.curent === j.id ? 'activ' : ''} ${j.online ? '' : 'offline'}">
      <span class="av-cerc" style="--c:${j.culoare}">${j.avatar}</span>
      <span class="lj-nume">${esc(j.nume)}${j.online ? '' : ' <span class="lj-off">offline</span>'}</span>
      <span class="lj-loc">${j.poz > 0 ? MEDALII[loc.get(j.id) - 1] || '' : ''}</span>
      <span class="lj-bara"><i style="width:${(j.poz / fin) * 100}%;background:${j.culoare}"></i></span>
    </li>`).join('');
  $('#lat-runda').textContent = `Runda ${S.runda}`;
}

function banner(html) {
  $('#banner').innerHTML = html;
}

// ================= Tabla =================
function genereazaTabla(n) {
  const POND = [['normal', 26], ['plus', 13], ['minus', 12], ['cadou', 16], ['provocare', 14], ['schimb', 7], ['zar', 8]];
  const total = POND.reduce((s, p) => s + p[1], 0);
  const alegeTip = () => {
    let r = Math.random() * total;
    for (const [t, w] of POND) if ((r -= w) < 0) return t;
    return 'normal';
  };
  const tabla = [];
  for (let i = 0; i < n; i++) {
    let tip;
    if (i === 0) tip = 'start';
    else if (i === n - 1) tip = 'final';
    else if (i < 3) tip = 'normal';
    else {
      do { tip = alegeTip(); } while (tip !== 'normal' && tabla[i - 1].tip === tip);
    }
    tabla.push({ tip });
  }
  return tabla;
}

function pseudo(i, k) {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// drum neted (Catmull-Rom) prin centrele casutelor
function drum(pts) {
  let s = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    s += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return s;
}

function randeazaTabla() {
  const n = S.tabla.length;
  const [col, randuri] = DIM[n] || [7, Math.ceil(n / 7)];
  const SX = 150;
  const SY = 138;
  const M = 96;
  const W = M * 2 + (col - 1) * SX;
  const H = M * 2 + (randuri - 1) * SY;
  // serpentina: de jos in sus, alternand directia
  S.pozitii = S.tabla.map((c, i) => {
    const r = Math.floor(i / col);
    const k = i % col;
    const cc = r % 2 === 0 ? k : col - 1 - k;
    const capat = k === 0 || k === col - 1;
    const jx = capat ? 0 : (pseudo(i, 1) - 0.5) * 26;
    const jy = (pseudo(i, 2) - 0.5) * 22;
    return { x: M + cc * SX + jx, y: H - M - r * SY + jy };
  });
  const dd = drum(S.pozitii);
  let html = `<path class="drum-margine" d="${dd}"/><path class="drum" d="${dd}"/><path class="drum-linie" d="${dd}"/><g id="casute">`;
  S.tabla.forEach((c, i) => {
    const p = S.pozitii[i];
    html += `<g class="casuta t-${c.tip}" data-i="${i}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})">`;
    if (c.tip === 'start') html += '<rect class="c-fond" x="-60" y="-40" width="120" height="80" rx="26"/><text class="c-txt">START</text>';
    else if (c.tip === 'final') html += '<circle class="c-fond" r="58"/><text class="c-ico" y="2">🏆</text>';
    else if (c.tip === 'normal') html += `<circle class="c-fond" r="42"/><text class="c-nr" y="1" style="font-size:22px;dominant-baseline:central">${i}</text>`;
    else html += `<circle class="c-fond" r="42"/><text class="c-ico" y="-4">${ICON[c.tip]}</text><text class="c-nr" y="31">${i}</text>`;
    html += '</g>';
  });
  html += '</g><g id="pioni">';
  for (const j of S.jucatori) {
    html += `<g class="pion" data-id="${j.id}"><g class="pion-in">
      <ellipse class="p-umbra" cx="0" cy="25" rx="20" ry="7"/>
      <circle class="p-inel" r="29" stroke="${j.culoare}"/>
      <circle class="p-cerc" r="27" stroke="${j.culoare}"/>
      <text class="p-emoji" y="2">${j.avatar}</text></g></g>`;
  }
  html += '</g>';
  const svg = $('#tabla');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = html;
  randeazaPioni();
}

const pionEl = (j) => $(`.pion[data-id="${j.id}"]`);

function offsetPion(n, k) {
  if (n === 1) return [0, 0];
  const r = n === 2 ? 17 : 22;
  const a = (k / n) * Math.PI * 2 + (n === 2 ? 0 : -Math.PI / 2);
  return [Math.cos(a) * r, Math.sin(a) * r];
}

function randeazaPioni(sar = []) {
  const grupuri = new Map();
  for (const j of S.jucatori) {
    if (!grupuri.has(j.poz)) grupuri.set(j.poz, []);
    grupuri.get(j.poz).push(j);
  }
  for (const [poz, lista] of grupuri) {
    const p = S.pozitii[poz];
    if (!p) continue;
    lista.forEach((j, k) => {
      const el = pionEl(j);
      if (!el) return;
      const [ox, oy] = offsetPion(lista.length, k);
      el.style.transform = `translate(${(p.x + ox).toFixed(1)}px, ${(p.y + oy - 8).toFixed(1)}px)`;
      el.classList.toggle('activ', S.curent === j.id);
    });
  }
  for (const j of sar) {
    const inEl = pionEl(j)?.querySelector('.pion-in');
    if (!inEl) continue;
    inEl.classList.remove('sare');
    void inEl.getBoundingClientRect();
    inEl.classList.add('sare');
  }
}

function ridicaActiv() {
  const j = jucator(S.curent);
  const el = j && pionEl(j);
  if (el) el.parentNode.appendChild(el);
}

function aprindeCasuta(i) {
  const el = $(`.casuta[data-i="${i}"]`);
  if (!el) return;
  el.classList.remove('aprinsa');
  void el.getBoundingClientRect();
  el.classList.add('aprinsa');
}

async function muta(j, pasi) {
  const fin = S.tabla.length - 1;
  const dir = Math.sign(pasi);
  for (let k = 0; k < Math.abs(pasi); k++) {
    const nou = j.poz + dir;
    if (nou < 0 || nou > fin) break;
    j.poz = nou;
    randeazaPioni([j]);
    SUNET.pas(dir);
    if (j.poz === fin) {
      if (j.sosit == null) j.sosit = performance.now();
      break;
    }
    await pauza(d(290));
  }
  await pauza(d(260));
  randeazaLateral();
}

async function zborPioni(lista) {
  const el = lista.map(pionEl);
  el.forEach((e) => e?.classList.add('zbor'));
  randeazaPioni();
  SUNET.bun();
  await pauza(1000);
  el.forEach((e) => e?.classList.remove('zbor'));
  randeazaLateral();
}

async function schimba(a, b) {
  const pa = a.poz;
  a.poz = b.poz;
  b.poz = pa;
  await zborPioni([a, b]);
}

async function zboara(j, poz) {
  j.poz = poz;
  await zborPioni([j]);
}

// ================= Zarul =================
const PUNCTE = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
let rotiri = 0;

function construiesteZar() {
  $('#zar').innerHTML = [1, 2, 3, 4, 5, 6].map((f) =>
    `<div class="fata f${f}">${Array.from({ length: 9 }, (_, i) => (PUNCTE[f].includes(i + 1) ? '<i class="punct"></i>' : '<i></i>')).join('')}</div>`,
  ).join('');
}

async function rostogoleste(val) {
  rotiri += 2;
  const [rx, ry] = ROT[val];
  SUNET.zar();
  $('#zar').style.transform = `rotateX(${rx + 360 * rotiri}deg) rotateY(${ry + 360 * (rotiri + 1)}deg)`;
  await pauza(1250);
}

function asteaptaRand(j) {
  return { tip: 'asteapta', emoji: j.avatar, titlu: `E rândul lui ${j.nume}`, text: 'Uită-te pe ecranul mare 👀' };
}

async function cereZar(j) {
  aratTuturor((x) => (x === j ? { tip: 'zar' } : asteaptaRand(j)));
  $('#strat-zar').hidden = false;
  $('#zar-text').innerHTML = `📱 ${nh(j)}, aruncă zarul!`;
  $('#zar-buton').hidden = false;
  const r = await asculta((x, m, fin) => {
    if (x === j && m.t === 'zar' && eCheie(x, m)) fin('telefon');
  }, j.online ? 60000 : 12000);
  $('#zar-buton').hidden = true;
  arata(j, { tip: 'asteapta', emoji: '🎲', titlu: 'Se rostogolește…', text: 'Uită-te pe ecranul mare 👀' });
  const val = rnd(1, 6);
  $('#zar-text').innerHTML = r === 'telefon' ? `${nh(j)} aruncă…` : `Arunc eu pentru ${nh(j)}…`;
  await rostogoleste(val);
  $('#zar-text').innerHTML = `${nh(j)} a dat <b>${val}</b>!`;
  await pauza(d(1100));
  $('#strat-zar').hidden = true;
  return val;
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

function dinSac(nume, lista) {
  if (!S.saci[nume]?.length) S.saci[nume] = amesteca(lista.map((_, i) => i));
  return lista[S.saci[nume].pop()];
}

// ================= Efectele casutelor =================
async function efect(j, adancime) {
  const tip = S.tabla[j.poz]?.tip;
  if (tip && tip !== 'normal') aprindeCasuta(j.poz);
  if (tip === 'plus') {
    await anunt({ emoji: '⏩', titlu: 'Vânt din spate!', text: `${nh(j)} zboară 3 căsuțe înainte.`, stil: 'verde', sunet: SUNET.bun });
    await muta(j, 3);
  } else if (tip === 'minus') {
    await anunt({ emoji: '🍌', titlu: 'Coajă de banană!', text: `${nh(j)} alunecă 3 căsuțe înapoi.`, stil: 'rosu', sunet: SUNET.rau });
    await muta(j, -3);
  } else if (tip === 'cadou') {
    await carteSurpriza(j);
  } else if (tip === 'provocare') {
    await provocare(j);
  } else if (tip === 'schimb') {
    await schimbLoc(j);
  } else if (tip === 'zar' && adancime < 2) {
    await anunt({ emoji: '🎲', titlu: 'Mai arunci o dată!', text: nh(j), stil: 'mov', durata: 1800, sunet: SUNET.bun });
    const v = await cereZar(j);
    await muta(j, v);
    if (!castigator()) await efect(j, adancime + 1);
  }
}

const CARTI = [
  { e: '🛴', t: 'Trotinetă găsită!', x: 'Mergi 4 căsuțe înainte.', f: (j) => muta(j, 4) },
  { e: '🍲', t: 'Ți-a căzut telefonul în ciorbă!', x: 'Până îl pescuiești… 2 căsuțe înapoi.', f: (j) => muta(j, -2) },
  { e: '🎉', t: 'Petrecere!', x: 'Toată lumea merge 2 căsuțe înainte.', f: () => Promise.all(S.jucatori.map((x) => muta(x, 2))) },
  { e: '🌧️', t: 'Ploaie torențială', x: 'Toți ceilalți dau 2 căsuțe înapoi.', f: (j) => Promise.all(altii(j).map((x) => muta(x, -2))) },
  {
    e: '🧲', t: 'Magnet', x: 'Îl tragi pe cel din fața ta 3 căsuțe înapoi.',
    f: async (j) => {
      const inFata = altii(j).filter((x) => x.poz > j.poz).sort((a, b) => a.poz - b.poz);
      if (!inFata.length) {
        await anunt({ emoji: '😎', titlu: 'Nimeni nu e în fața ta!', text: 'Primești o căsuță bonus.', durata: 2000 });
        return muta(j, 1);
      }
      return Promise.all(inFata.filter((x) => x.poz === inFata[0].poz).map((x) => muta(x, -3)));
    },
  },
  {
    e: '🐢', t: 'Ajutor pentru cel din urmă', x: 'Cine e pe ultimul loc merge 4 căsuțe înainte.',
    f: () => {
      const min = Math.min(...S.jucatori.map((x) => x.poz));
      return Promise.all(S.jucatori.filter((x) => x.poz === min).map((x) => muta(x, 4)));
    },
  },
  {
    e: '🍀', t: 'Zarul norocos', x: 'Mai arunci o dată!',
    f: async (j) => { const v = await cereZar(j); await muta(j, v); },
  },
  {
    e: '🚁', t: 'Elicopter', x: 'Zbori până chiar în spatele liderului.',
    f: async (j) => {
      const max = Math.max(...altii(j).map((x) => x.poz));
      if (j.poz >= max) {
        await anunt({ emoji: '👑', titlu: 'Ești deja în frunte!', text: 'Primești o căsuță bonus.', durata: 2000 });
        return muta(j, 1);
      }
      return zboara(j, Math.max(j.poz, max - 1));
    },
  },
  { e: '🥨', t: 'Covrigul magic', x: 'Tu mergi 3 înainte, ceilalți 1 înapoi.', f: (j) => Promise.all([muta(j, 3), ...altii(j).map((x) => muta(x, -1))]) },
  {
    e: '🔀', t: 'Lumea pe dos!', x: 'Primul și ultimul își schimbă locurile.',
    f: async () => {
      const sortat = [...S.jucatori].sort((a, b) => b.poz - a.poz);
      const p = sortat[0];
      const u = sortat[sortat.length - 1];
      if (p.poz === u.poz) {
        await anunt({ emoji: '🤝', titlu: 'Sunteți la egalitate!', text: 'Nu se schimbă nimic.', durata: 2000 });
        return;
      }
      return schimba(p, u);
    },
  },
  { e: '🦶', t: 'Ai călcat strâmb', x: '1 căsuță înapoi.', f: (j) => muta(j, -1) },
  { e: '💨', t: 'Turbo!', x: 'Mergi 6 căsuțe înainte!', f: (j) => muta(j, 6) },
];

async function carteSurpriza(j) {
  const c = dinSac('carti', CARTI);
  SUNET.carte();
  await anunt({ emoji: c.e, titlu: c.t, text: `${nh(j)}: ${c.x}`, stil: 'galben intoarsa', durata: 3300 });
  await c.f(j);
}

async function provocare(j) {
  const text = dinSac('provocari', PROVOCARI);
  SUNET.carte();
  arataCarte(`<div class="carte-emoji">🎭</div><h2>Provocare pentru ${nh(j)}</h2><p>${esc(text)}</p>
    <div class="bara-timp"><i style="animation-duration:30s"></i></div>
    <p class="mic">Când termini, apasă „Am terminat” pe telefon. Apoi ceilalți votează.</p>`, 'mov');
  aratTuturor((x) => (x === j
    ? { tip: 'alege', titlu: 'Provocarea ta 🎭', text, optiuni: [{ id: 'gata', emoji: '✅', text: 'Am terminat!' }, { id: 'renunt', emoji: '🙈', text: 'Renunț' }] }
    : { tip: 'asteapta', emoji: '🎭', titlu: `Provocare pentru ${j.nume}`, text: `„${text}”\n\nFii atent, votezi imediat după!` }));
  const r = await asculta((x, m, fin) => {
    if (x === j && m.t === 'alege' && eCheie(x, m)) fin(m.id);
  }, j.online ? 30000 : 8000);
  ascundeCarte();
  if (r === 'renunt') {
    await anunt({ emoji: '🙈', titlu: `${nh(j)} a renunțat`, text: '1 căsuță înapoi.', stil: 'rosu', sunet: SUNET.rau });
    await muta(j, -1);
    return;
  }
  const judecatori = altii(j).filter((x) => x.online);
  let da = 0;
  let nu = 0;
  if (judecatori.length) {
    arataCarte(`<div class="carte-emoji">🗳️</div><h2>A reușit ${nh(j)}?</h2><p>Votați pe telefon!</p><div class="voturi" id="voturi"></div>`, 'mov');
    aratTuturor((x) => (x === j
      ? { tip: 'asteapta', emoji: '🤞', titlu: 'Ceilalți votează…', text: 'Sperăm că i-ai convins!' }
      : { tip: 'alege', titlu: `A reușit ${j.nume}?`, text, optiuni: [{ id: 'da', emoji: '👍', text: 'Da, a reușit!' }, { id: 'nu', emoji: '👎', text: 'Nu prea…' }] }));
    const voturi = new Map();
    await asculta((x, m, fin) => {
      if (x === j || m.t !== 'alege' || !eCheie(x, m) || voturi.has(x.id)) return;
      voturi.set(x.id, m.id);
      $('#voturi')?.insertAdjacentHTML('beforeend', `<span class="vot">${x.avatar}✔️</span>`);
      if (judecatori.every((y) => voturi.has(y.id) || !y.online)) fin();
    }, 20000);
    for (const v of voturi.values()) (v === 'da' ? da++ : nu++);
    ascundeCarte();
  }
  if (da >= nu) {
    await anunt({ emoji: '🎉', titlu: 'Bravo!', text: `${nh(j)} a reușit${da + nu ? ` (${da} 👍 / ${nu} 👎)` : ''}. 3 căsuțe înainte!`, stil: 'verde', sunet: SUNET.bun });
    await muta(j, 3);
  } else {
    await anunt({ emoji: '😅', titlu: 'Nu de data asta…', text: `${da} 👍 / ${nu} 👎. ${nh(j)} dă 1 căsuță înapoi.`, stil: 'rosu', sunet: SUNET.rau });
    await muta(j, -1);
  }
}

async function schimbLoc(j) {
  const ceilalti = altii(j);
  SUNET.carte();
  arataCarte(`<div class="carte-emoji">🔄</div><h2>${nh(j)} poate schimba locul</h2><p>cu oricine vrea. Alege pe telefon…</p>`, 'roz');
  aratTuturor((x) => (x === j
    ? {
      tip: 'alege',
      titlu: 'Schimbi locul cu cineva? 🔄',
      text: 'Alege jucătorul cu care faci schimb de locuri.',
      optiuni: [...ceilalti.map((x2) => ({ id: x2.id, emoji: x2.avatar, text: `${x2.nume} · căsuța ${x2.poz}` })), { id: 'nu', emoji: '🙅', text: 'Rămân pe loc' }],
    }
    : { tip: 'asteapta', emoji: '🔄', titlu: `${j.nume} alege…`, text: 'Oare cu cine face schimb? 😬' }));
  const r = await asculta((x, m, fin) => {
    if (x === j && m.t === 'alege' && eCheie(x, m)) fin(m.id);
  }, j.online ? 30000 : 6000);
  ascundeCarte();
  const tinta = ceilalti.find((x) => x.id === r);
  if (!tinta) {
    await anunt({ emoji: '🙅', titlu: `${nh(j)} rămâne pe loc`, durata: 2000 });
    return;
  }
  await anunt({ emoji: '🔄', titlu: 'Schimb de locuri!', text: `${nh(j)} ⇄ ${nh(tinta)}`, stil: 'roz', durata: 2200, sunet: SUNET.bun });
  await schimba(j, tinta);
}

// ================= Desfasurarea jocului =================
async function tura(j) {
  S.curent = j.id;
  ridicaActiv();
  randeazaPioni();
  randeazaLateral();
  banner(`Runda ${S.runda} · rândul lui ${nh(j)}`);
  const val = await cereZar(j);
  await muta(j, val);
  if (castigator()) return;
  await efect(j, 0);
}

async function bucla() {
  while (S.faza === 'joc') {
    while (S.ordineTura < S.jucatori.length) {
      salveaza();
      try {
        await tura(S.jucatori[S.ordineTura]);
      } catch (e) {
        console.error(e);
      }
      if (castigator()) return finalJoc();
      S.ordineTura++;
    }
    salveaza();
    try {
      await rundaMinijoc();
    } catch (e) {
      console.error(e);
      $('#mj').hidden = true;
    }
    if (castigator()) return finalJoc();
    S.runda++;
    S.ordineTura = 0;
  }
}

async function pornesteJoc() {
  if (S.faza !== 'lobby' || S.jucatori.length < 2) return;
  S.faza = 'joc';
  S.tabla = genereazaTabla(S.setari.lungime);
  S.jucatori = amesteca(S.jucatori);
  for (const j of S.jucatori) {
    j.poz = 0;
    j.sosit = null;
  }
  S.runda = 1;
  S.ordineTura = 0;
  S.sacMj = [];
  S.saci = {};
  S.curent = null;
  arataEcran('joc');
  randeazaTabla();
  randeazaLateral();
  banner('');
  tineEcranul();
  aratTuturor(() => ({ tip: 'asteapta', emoji: '🎲', titlu: 'Începe jocul!', text: 'Uită-te pe ecranul mare 👀' }));
  salveaza();
  SUNET.fanfara();
  await anunt({
    emoji: '🎲',
    titlu: 'Să înceapă jocul!',
    text: 'Zarul a stabilit ordinea:',
    extra: `<div class="ordine">${S.jucatori.map((j, i) => `<span>${i + 1}. ${nh(j)}</span>`).join('')}</div>`,
    durata: 4200,
  });
  bucla();
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

async function finalJoc() {
  S.faza = 'final';
  S.curent = null;
  stergeSalvarea();
  randeazaPioni();
  banner('');
  await pauza(d(700));
  // clasament: cine a ajuns primul, apoi dupa pozitie
  const ord = (j) => j.sosit ?? Infinity;
  const sortat = [...S.jucatori].sort((a, b) => ord(a) - ord(b) || b.poz - a.poz);
  const clasament = [];
  sortat.forEach((j, i) => {
    const prev = sortat[i - 1];
    const egal = prev && j.poz === prev.poz && (ord(j) === ord(prev) || Math.abs(ord(j) - ord(prev)) < 120);
    clasament.push({ j, loc: egal ? clasament[i - 1].loc : i + 1 });
  });
  const castigatori = clasament.filter((r) => r.loc === 1);
  $('#final-titlu').innerHTML = castigatori.length > 1
    ? `🏆 Egalitate: ${castigatori.map((r) => nh(r.j)).join(' și ')}!`
    : `🏆 ${nh(castigatori[0].j)} a câștigat!`;
  const podium = [clasament[1], clasament[0], clasament[2]].filter(Boolean);
  $('#podium').innerHTML = podium.map((r) => `
    <div class="treapta l${Math.min(r.loc, 3)}">
      <span class="av-cerc" style="--c:${r.j.culoare}">${r.j.avatar}</span>
      <span class="nume">${esc(r.j.nume)}</span>
      <div class="bloc">${r.loc}</div>
    </div>`).join('');
  $('#final-rest').innerHTML = clasament.slice(3).map((r) => `<li>${r.loc}. ${nh(r.j)}</li>`).join('');
  $('#final').hidden = false;
  for (const r of clasament) arata(r.j, { tip: 'final', loc: r.loc, vip: r.j.id === S.vipId });
  SUNET.fanfara();
  confetti();
}

function inapoiInLobby() {
  S.faza = 'lobby';
  S.tabla = [];
  S.runda = 1;
  S.ordineTura = 0;
  S.sacMj = [];
  S.curent = null;
  for (const j of S.jucatori) {
    j.poz = 0;
    j.sosit = null;
  }
  arataEcran('lobby');
  randeazaLobby();
  trimiteLobby();
  salveaza();
}

// ================= Minijocuri: cadrul comun =================
function corp(html) {
  const el = $('#mj-corp');
  el.innerHTML = html;
  return el;
}

function timpMj(ms) {
  const i = $('#mj-timp');
  i.classList.remove('merge');
  void i.offsetWidth;
  if (ms) {
    i.style.animationDuration = ms + 'ms';
    i.classList.add('merge');
  }
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

const stariHtml = () => S.jucatori.map((j) => `
  <div class="stare-j" data-id="${j.id}">
    <span class="av-cerc" style="--c:${j.culoare}">${j.avatar}</span>
    <span>${esc(j.nume)}</span>
    <span class="st">${j.online ? '⏳' : '😴'}</span>
  </div>`).join('');

function stare(j, text) {
  const el = $(`.stare-j[data-id="${j.id}"] .st`);
  if (el) el.textContent = text;
}

// piste cu bare care cresc in timp real
function piste(unitate, info = '') {
  corp(`<div class="piste">${info ? `<p class="piste-info">${info}</p>` : ''}${S.jucatori.map((j) => `
    <div class="pista" data-id="${j.id}">
      <span class="av-cerc" style="--c:${j.culoare}">${j.avatar}</span>
      <span class="pista-nume">${esc(j.nume)}</span>
      <div class="pista-drum"><div class="pista-bara" style="background:${j.culoare}"></div></div>
      <b class="pista-nr">0</b>
    </div>`).join('')}</div>`);
  return (valori) => {
    const max = Math.max(unitate, ...valori.values());
    for (const [id, v] of valori) {
      const el = $(`.pista[data-id="${id}"]`);
      if (!el) continue;
      el.querySelector('.pista-bara').style.width = (Math.max(0, v) / max) * 100 + '%';
      el.querySelector('.pista-nr').textContent = v;
    }
  };
}

// minijocuri jucate pe telefon, cu scor live pe ecran
async function pisteLocale(joc, durata, eticheta, unitate, info) {
  const val = new Map(S.jucatori.map((j) => [j.id, 0]));
  const gata = new Set();
  const actualizeaza = piste(unitate, info);
  aratTuturor(() => ({ tip: 'mj', joc, durata }));
  timpMj(durata);
  await asculta((j, m, fin) => {
    if (m.t !== 'mj' || !eCheie(j, m) || gata.has(j.id)) return;
    if (Number.isFinite(m.n)) val.set(j.id, clamp(Math.round(m.n), -99, 300));
    if (m.gata) gata.add(j.id);
    actualizeaza(val);
    if (toti(gata)) fin();
  }, durata + 3500);
  return S.jucatori.map((j) => ({
    j,
    scor: val.get(j.id),
    invalid: !gata.has(j.id) && val.get(j.id) === 0,
    text: `${val.get(j.id)} ${eticheta}`,
  }));
}

function puncteAleatoare(k) {
  const W = 1000;
  const H = 560;
  const M = 45;
  let min = 80;
  let incercari = 0;
  const p = [];
  while (p.length < k) {
    const x = M + Math.random() * (W - 2 * M);
    const y = M + Math.random() * (H - 2 * M);
    if (p.every((q) => (q.x - x) ** 2 + (q.y - y) ** 2 >= min * min)) p.push({ x, y });
    if (++incercari > 300) {
      min *= 0.9;
      incercari = 0;
    }
  }
  return p.map((q) => ({ x: ((q.x / W) * 100).toFixed(2), y: ((q.y / H) * 100).toFixed(2) }));
}

function dilemaHtml(dl, sub) {
  const opt = (k, [e, t]) => `<div class="dilema-opt" data-o="${k}"><span class="e">${e}</span><span class="t">${esc(t)}</span><div class="cine"></div></div>`;
  return `<div class="dilema">
    <p class="dilema-q">${esc(dl.q)}</p>
    <p class="dilema-sub">${sub}</p>
    <div class="dilema-optiuni">${opt('a', dl.a)}<span class="dilema-sau">sau</span>${opt('b', dl.b)}</div>
    <div class="stari">${stariHtml()}</div>
  </div>`;
}

// ================= Minijocurile =================
const MINIJOCURI = [
  {
    id: 'apasa',
    nume: 'Degete de foc',
    emoji: '🔥',
    maiMare: true,
    regula: 'Apăsați pe telefon cât mai repede, timp de 6 secunde!',
    telefon: 'Apasă butonul cât poți de repede. Merge și cu două degete 😉',
    joaca: () => pisteLocale('apasa', 6000, 'apăsări', 40, '📱 Apăsați! Apăsați! Apăsați! 🔥'),
  },
  {
    id: 'semafor',
    nume: 'Semaforul',
    emoji: '🚦',
    maiMare: false,
    regula: 'Când se face VERDE, apăsați cât mai repede! Cine apasă pe roșu pierde runda.',
    telefon: 'Când telefonul se face verde, apasă oriunde pe ecran. Sunt 3 runde.',
    async joaca() {
      const RUNDE = 3;
      const total = new Map(S.jucatori.map((j) => [j.id, 0]));
      const raspunsuri = new Map(S.jucatori.map((j) => [j.id, 0]));
      for (let r = 1; r <= RUNDE; r++) {
        const intarziere = rnd(1800, 4200);
        corp(`<div class="semafor-scena">
          <div class="semafor"><i class="bec rosu aprins"></i><i class="bec verde"></i></div>
          <div><p class="sem-info">Runda ${r} din ${RUNDE}</p>
          <div class="sem-rez">${S.jucatori.map((j) => `<div class="sem-rand" data-id="${j.id}"><span class="av-cerc" style="--c:${j.culoare}">${j.avatar}</span> ${esc(j.nume)}: <b>…</b></div>`).join('')}</div></div>
        </div>`);
        const verde = () => {
          $('.bec.rosu')?.classList.remove('aprins');
          $('.bec.verde')?.classList.add('aprins');
        };
        aratTuturor(() => ({ tip: 'mj', joc: 'semafor', intarziere, runda: r }));
        const tv = setTimeout(() => { verde(); SUNET.start(); }, intarziere);
        const rez = new Map();
        await asculta((j, m, fin) => {
          if (m.t !== 'mj' || !eCheie(j, m) || rez.has(j.id)) return;
          const v = m.devreme ? { ms: 1000, devreme: true } : { ms: clamp(Math.round(+m.ms || 2000), 90, 2000) };
          rez.set(j.id, v);
          const b = $(`.sem-rand[data-id="${j.id}"] b`);
          if (b) b.textContent = v.devreme ? '🚫 prea devreme' : `${v.ms} ms`;
          if (toti(rez)) fin();
        }, intarziere + 3500);
        clearTimeout(tv);
        verde();
        for (const j of S.jucatori) {
          const v = rez.get(j.id);
          total.set(j.id, total.get(j.id) + (v ? v.ms : 2000));
          if (v) raspunsuri.set(j.id, raspunsuri.get(j.id) + 1);
          else {
            const b = $(`.sem-rand[data-id="${j.id}"] b`);
            if (b) b.textContent = '😴 n-a apăsat';
          }
        }
        await pauza(d(2600));
      }
      return S.jucatori.map((j) => ({
        j,
        scor: total.get(j.id),
        invalid: raspunsuri.get(j.id) === 0,
        text: `${sec(total.get(j.id))} s în total`,
      }));
    },
  },
  {
    id: 'cronometru',
    nume: 'Stop la fix',
    emoji: '⏱️',
    maiMare: false,
    regula: 'Pe telefon pornește un cronometru care dispare după 2 secunde. Opriți-l cât mai aproape de timpul cerut!',
    telefon: 'Numără în gând și apasă STOP la timpul cerut.',
    async joaca() {
      const tinta = alegeUnul([5, 7, 8, 10, 12]);
      const VIZ = 2500;
      corp(`<div class="crono-scena">
        <p class="crono-tinta">Opriți la exact <b>${tinta},00</b> secunde</p>
        <div class="crono-ceas" id="ceas">0,00</div>
        <div class="stari">${stariHtml()}</div>
      </div>`);
      aratTuturor(() => ({ tip: 'mj', joc: 'cronometru', tinta, vizibil: VIZ }));
      const t0 = performance.now();
      const ceas = $('#ceas');
      const iv = setInterval(() => {
        const el = performance.now() - t0;
        if (el < VIZ) ceas.textContent = sec(el);
        else {
          ceas.textContent = '?,??';
          ceas.classList.add('ascuns');
        }
      }, 50);
      const rez = new Map();
      await asculta((j, m, fin) => {
        if (m.t !== 'mj' || !eCheie(j, m) || rez.has(j.id)) return;
        rez.set(j.id, clamp(Math.round(+m.ms || 0), 0, 60000));
        stare(j, '✋');
        if (toti(rez)) fin();
      }, tinta * 2000 + 6000);
      clearInterval(iv);
      ceas.classList.remove('ascuns');
      ceas.textContent = `${tinta},00`;
      await pauza(d(1200));
      return S.jucatori.map((j) => {
        const ms = rez.get(j.id);
        if (ms == null) return { j, scor: 1e9, invalid: true, text: 'nu a oprit' };
        const dif = ms - tinta * 1000;
        return { j, scor: Math.abs(dif), text: `${sec(ms)} s (${dif >= 0 ? '+' : '−'}${sec(Math.abs(dif))})` };
      });
    },
  },
  {
    id: 'cate',
    nume: 'Câte sunt?',
    emoji: '👀',
    maiMare: false,
    regula: 'Pe ecran apar multe desene, doar câteva secunde. Numărați-le pe cele cerute!',
    telefon: 'Uită-te la ecranul mare și numără. Apoi scrii numărul pe telefon.',
    async joaca() {
      const [tinta, d1, d2, nume] = alegeUnul(TEME_CATE);
      const n = rnd(9, 22);
      const elemente = amesteca([...Array(n).fill(tinta), ...Array(rnd(5, 12)).fill(d1), ...Array(rnd(5, 12)).fill(d2)]);
      const pts = puncteAleatoare(elemente.length);
      corp(`<div class="cate-scena">
        <p class="cate-int" id="cate-int">Numărați: ${tinta} ${esc(nume)}!</p>
        <div class="cate-camp ascuns" id="camp">${elemente.map((e, i) => `<span class="cate-el ${e === tinta ? 'tinta' : ''}" style="left:${pts[i].x}%;top:${pts[i].y}%">${e}</span>`).join('')}</div>
        <div class="stari">${stariHtml()}</div>
      </div>`);
      aratTuturor(() => ({ tip: 'asteapta', emoji: '👀', titlu: `Numără ${tinta}!`, text: 'Uită-te la ecranul mare. Ai doar câteva secunde!', faraReactii: true }));
      await pauza(500);
      const camp = $('#camp');
      camp.classList.remove('ascuns');
      timpMj(6000);
      await pauza(6000);
      camp.classList.add('ascuns');
      camp.insertAdjacentHTML('beforeend', '<div class="cate-semn">?</div>');
      $('#cate-int').textContent = `Câte ${tinta} erau? Scrieți pe telefon!`;
      aratTuturor(() => ({ tip: 'mj', joc: 'cate', emoji: tinta }));
      timpMj(20000);
      const rez = new Map();
      await asculta((j, m, fin) => {
        if (m.t !== 'mj' || !eCheie(j, m) || rez.has(j.id)) return;
        const nr = parseInt(m.nr, 10);
        if (!Number.isFinite(nr)) return;
        rez.set(j.id, clamp(nr, 0, 999));
        stare(j, '✅');
        if (toti(rez)) fin();
      }, 20000);
      timpMj(0);
      $('.cate-semn')?.remove();
      camp.classList.remove('ascuns');
      camp.classList.add('dezvaluit');
      $('#cate-int').innerHTML = `Erau <b>${n}</b> ${tinta}!`;
      for (const j of S.jucatori) stare(j, rez.has(j.id) ? String(rez.get(j.id)) : '—');
      SUNET.bun();
      await pauza(d(4000));
      return S.jucatori.map((j) => {
        const g = rez.get(j.id);
        if (g == null) return { j, scor: 1e9, invalid: true, text: 'fără răspuns' };
        return { j, scor: Math.abs(g - n), text: g === n ? `a zis ${g} 🎯 exact!` : `a zis ${g} (diferență ${Math.abs(g - n)})` };
      });
    },
  },
  {
    id: 'culori',
    nume: 'Capcana culorilor',
    emoji: '🎨',
    maiMare: true,
    regula: 'Pe telefon apare un cuvânt colorat. Apăsați CULOAREA literelor, nu ce scrie!<br><span class="exemplu-stroop" style="color:#60a5fa">ROȘU</span> ➜ apeși pe albastru',
    telefon: 'Apasă culoarea literelor, nu ce scrie. Ai 20 de secunde!',
    joaca: () => pisteLocale('culori', 20000, 'puncte', 10, '📱 Jucați pe telefon!<small>Apăsați culoarea literelor, nu ce scrie. Greșeala scade un punct.</small>'),
  },
  {
    id: 'intrus',
    nume: 'Găsește intrusul',
    emoji: '🔍',
    maiMare: true,
    regula: 'Pe telefon apar desene la fel, dar unul e diferit. Găsiți-l de cât mai multe ori în 20 de secunde!',
    telefon: 'Apasă pe desenul diferit. O greșeală scade un punct.',
    joaca: () => pisteLocale('intrus', 20000, 'găsite', 10, '📱 Jucați pe telefon!<small>Găsiți desenul diferit. Greșeala scade un punct.</small>'),
  },
  {
    id: 'memorie',
    nume: 'Ține minte',
    emoji: '🧠',
    maiMare: true,
    regula: 'Fructele se aprind pe ecran, pe rând. Repetați ordinea pe telefon! Cine greșește, iese.',
    telefon: 'Uită-te la ordinea fructelor pe ecranul mare, apoi apasă-le la fel.',
    async joaca() {
      const secv = [rnd(0, 3), rnd(0, 3)];
      let inJoc = S.jucatori.filter((j) => j.online).map((j) => j.id);
      const record = new Map(S.jucatori.map((j) => [j.id, 0]));
      corp(`<div class="mem-scena">
        <p class="mem-info" id="mem-info"></p>
        <div class="mem-paduri">${PADURI_MEMORIE.map((p, i) => `<div class="mem-pad" data-i="${i}" style="--c:${p.c}">${p.e}</div>`).join('')}</div>
        <div class="stari">${stariHtml()}</div>
      </div>`);
      const info = $('#mem-info');
      for (const j of S.jucatori) stare(j, inJoc.includes(j.id) ? '🙂' : '😴');
      for (let runda = 1; runda <= 9 && inJoc.length; runda++) {
        secv.push(rnd(0, 3));
        const L = secv.length;
        info.textContent = `Runda ${runda}: țineți minte ${L} fructe!`;
        aratTuturor((j) => (inJoc.includes(j.id)
          ? { tip: 'asteapta', emoji: '👀', titlu: 'Uită-te la ecran!', text: `Ține minte ${L} fructe, în ordine.`, faraReactii: true }
          : { tip: 'asteapta', emoji: '🍿', titlu: 'Ai ieșit din joc', text: 'Urmărește-i pe ceilalți!' }));
        await pauza(1300);
        for (const i of secv) {
          const pad = $(`.mem-pad[data-i="${i}"]`);
          pad.classList.add('aprins');
          SUNET.nota(i);
          await pauza(Math.max(380, 650 - runda * 30));
          pad.classList.remove('aprins');
          await pauza(200);
        }
        info.textContent = 'Acum repetați pe telefon!';
        aratTuturor((j) => (inJoc.includes(j.id) ? { tip: 'mj', joc: 'memorie', secv: [...secv] } : null));
        const lim = 6000 + L * 1200;
        timpMj(lim);
        const rez = new Map();
        await asculta((j, m, fin) => {
          if (!inJoc.includes(j.id) || m.t !== 'mj' || !eCheie(j, m) || rez.has(j.id)) return;
          rez.set(j.id, !!m.ok);
          stare(j, m.ok ? '✅' : '❌');
          if (inJoc.every((id) => rez.has(id) || !jucator(id)?.online)) fin();
        }, lim);
        timpMj(0);
        const bun = inJoc.filter((id) => rez.get(id) === true);
        for (const id of inJoc) if (!rez.has(id)) stare(jucator(id), '❌');
        for (const id of bun) record.set(id, L);
        if (!bun.length) {
          info.textContent = 'Toți au greșit! Gata.';
          break;
        }
        if (bun.length === 1 && inJoc.length > 1) {
          info.innerHTML = `${nh(jucator(bun[0]))} a rămas ultimul!`;
          break;
        }
        inJoc = bun;
        info.textContent = bun.length === 1 ? 'Corect! Mai departe…' : `Corect! Rămân ${bun.length} în joc.`;
        for (const id of bun) stare(jucator(id), '🙂');
        await pauza(d(1600));
      }
      await pauza(d(2200));
      return S.jucatori.map((j) => ({ j, scor: record.get(j.id), text: record.get(j.id) ? `${record.get(j.id)} fructe` : 'a greșit din prima' }));
    },
  },
  {
    id: 'tecunosc',
    nume: 'Te cunosc?',
    emoji: '💞',
    maiMare: true,
    regula: () => (S.jucatori.length === 2
      ? 'Fiecare alege în secret ce preferă. Apoi ghiciți ce a ales celălalt!'
      : 'Fiecare alege în secret ce preferă. Apoi ghiciți ce a ales majoritatea!'),
    telefon: 'Alegi ce preferi tu, apoi ghicești. Două întrebări.',
    async joaca() {
      const doi = S.jucatori.length === 2;
      const dileme = amesteca(DILEME).slice(0, 2);
      const puncte = new Map(S.jucatori.map((j) => [j.id, 0]));
      for (let k = 0; k < dileme.length; k++) {
        const dl = dileme[k];
        const opt = [{ id: 'a', emoji: dl.a[0], text: dl.a[1] }, { id: 'b', emoji: dl.b[0], text: dl.b[1] }];
        corp(dilemaHtml(dl, `Întrebarea ${k + 1} din 2 · Fiecare alege în secret pe telefon 🤫`));
        aratTuturor(() => ({ tip: 'alege', titlu: dl.q, text: 'Tu ce alegi? Nu vede nimeni 🤫', optiuni: opt }));
        const alegeri = new Map();
        timpMj(15000);
        await asculta((j, m, fin) => {
          if (m.t !== 'alege' || !eCheie(j, m) || alegeri.has(j.id) || !['a', 'b'].includes(m.id)) return;
          alegeri.set(j.id, m.id);
          stare(j, '✅');
          if (toti(alegeri)) fin();
        }, 15000);
        $('.dilema-sub').textContent = doi ? 'Acum ghiciți: ce a ales celălalt?' : 'Acum ghiciți: ce a ales majoritatea?';
        for (const j of S.jucatori) stare(j, '🤔');
        aratTuturor((j) => {
          const alt = S.jucatori.find((x) => x !== j);
          return { tip: 'alege', titlu: doi ? `Ce a ales ${alt.nume}?` : 'Ce a ales majoritatea?', text: dl.q, optiuni: opt };
        });
        const ghiciri = new Map();
        timpMj(15000);
        await asculta((j, m, fin) => {
          if (m.t !== 'alege' || !eCheie(j, m) || ghiciri.has(j.id) || !['a', 'b'].includes(m.id)) return;
          ghiciri.set(j.id, m.id);
          stare(j, '✅');
          if (toti(ghiciri)) fin();
        }, 15000);
        timpMj(0);
        // dezvaluire
        const nrA = [...alegeri.values()].filter((v) => v === 'a').length;
        const nrB = alegeri.size - nrA;
        const maj = nrA > nrB ? ['a'] : nrB > nrA ? ['b'] : ['a', 'b'];
        for (const parte of ['a', 'b']) {
          const cine = S.jucatori.filter((j) => alegeri.get(j.id) === parte);
          $(`.dilema-opt[data-o="${parte}"] .cine`).innerHTML = cine.length
            ? cine.map((j) => `<span class="av-cerc" style="--c:${j.culoare}">${j.avatar}</span>`).join('')
            : '<span style="opacity:.5">nimeni</span>';
        }
        if (!doi && alegeri.size) maj.forEach((p) => $(`.dilema-opt[data-o="${p}"]`).classList.add('castiga'));
        $('.dilema-sub').textContent = 'Iată ce ați ales!';
        for (const j of S.jucatori) {
          const g = ghiciri.get(j.id);
          let corect = false;
          if (g) {
            if (doi) corect = alegeri.get(S.jucatori.find((x) => x !== j).id) === g;
            else corect = alegeri.size > 0 && maj.includes(g);
          }
          if (corect) puncte.set(j.id, puncte.get(j.id) + 1);
          stare(j, g ? (corect ? '✅ a ghicit' : '❌ n-a ghicit') : '😴');
        }
        SUNET.bun();
        await pauza(d(5500));
      }
      return S.jucatori.map((j) => ({ j, scor: puncte.get(j.id), text: `a ghicit ${puncte.get(j.id)} din 2` }));
    },
  },
  {
    id: 'balon',
    nume: 'Balonul',
    emoji: '🎈',
    maiMare: true,
    regula: 'Țineți apăsat pe telefon ca să umflați balonul. Cel mai mare balon câștigă… dar dacă țineți prea mult: BUM! 💥',
    telefon: 'Ține degetul apăsat ca să umfli. Dă drumul înainte să explodeze!',
    async joaca() {
      const T = rnd(3000, 8000);
      const FER = 20000;
      const st = new Map(S.jucatori.map((j) => [j.id, { jos: null, dur: null, spart: false }]));
      corp(`<div style="display:grid;gap:3vh;justify-items:center;width:100%">
        <p class="balon-info" id="balon-info">Umflați! Cine are curaj? 😬</p>
        <div class="balon-scena">${S.jucatori.map((j) => `
          <div class="balon-loc" data-id="${j.id}" style="position:relative">
            <div class="balon" style="--c:${j.culoare}"></div><div class="balon-fir"></div>
            <div class="balon-av">${j.avatar}</div><div class="balon-txt">gata?</div>
          </div>`).join('')}</div>
      </div>`);
      aratTuturor(() => ({ tip: 'mj', joc: 'balon' }));
      timpMj(FER);
      const sparge = (j, s) => {
        s.spart = true;
        s.dur = T;
        SUNET.pop();
        arata(j, { tip: 'mj', joc: 'balon', spart: true });
        const loc = $(`.balon-loc[data-id="${j.id}"]`);
        loc?.querySelector('.balon').classList.add('spart');
        loc?.insertAdjacentHTML('afterbegin', '<span class="balon-bum" style="top:20%">💥</span>');
      };
      const deseneaza = () => {
        const acum = performance.now();
        for (const j of S.jucatori) {
          const s = st.get(j.id);
          if (s.jos != null && s.dur == null && acum - s.jos >= T) sparge(j, s);
          const ms = s.dur != null ? s.dur : s.jos != null ? acum - s.jos : 0;
          const loc = $(`.balon-loc[data-id="${j.id}"]`);
          if (!loc) continue;
          loc.querySelector('.balon').style.transform = `scale(${0.35 + (Math.min(ms, 9000) / 9000) * 1.25})`;
          loc.querySelector('.balon-txt').textContent = s.spart ? 'BUM!' : s.dur != null ? `${sec(s.dur)} s` : s.jos != null ? 'umflă…' : 'gata?';
        }
      };
      let raf = 0;
      const cadru = () => {
        deseneaza();
        if (S.jucatori.every((j) => st.get(j.id).dur != null || !j.online)) opresteAscultarea();
        else raf = requestAnimationFrame(cadru);
      };
      raf = requestAnimationFrame(cadru);
      await asculta((j, m) => {
        if (m.t !== 'mj' || !eCheie(j, m)) return;
        const s = st.get(j.id);
        if (s.dur != null) return;
        if (m.jos && s.jos == null) s.jos = performance.now();
        else if (m.sus && s.jos != null) {
          const dur = performance.now() - s.jos;
          if (dur >= T) sparge(j, s);
          else s.dur = dur;
        }
      }, FER);
      cancelAnimationFrame(raf);
      for (const j of S.jucatori) {
        const s = st.get(j.id);
        if (s.dur != null) continue;
        if (s.jos != null) {
          const dur = performance.now() - s.jos;
          if (dur >= T) sparge(j, s);
          else s.dur = dur;
        } else s.dur = 0;
      }
      deseneaza();
      $('#balon-info').innerHTML = `Baloanele explodau la <b>${sec(T)} secunde</b>!`;
      await pauza(d(3200));
      return S.jucatori.map((j) => {
        const s = st.get(j.id);
        return {
          j,
          scor: s.spart ? -1 : s.dur,
          invalid: s.spart || !s.dur, // balonul spart nu primeste premiu
          text: s.spart ? '💥 a explodat' : s.dur ? `${sec(s.dur)} s` : 'nu a umflat',
        };
      });
    },
  },
];

function claseaza(rez, maiMare) {
  const sortat = [...rez].sort((a, b) => (maiMare ? b.scor - a.scor : a.scor - b.scor));
  const premii = S.jucatori.length === 2 ? [3, 1] : [3, 2, 1];
  let loc = 0;
  sortat.forEach((r, i) => {
    if (i === 0 || r.scor !== sortat[i - 1].scor) loc = i + 1;
    r.loc = loc;
    r.premiu = r.invalid ? 0 : premii[loc - 1] || 0;
  });
  return sortat;
}

async function introMj(mj) {
  $('#mj-emoji').textContent = mj.emoji;
  $('#mj-titlu').textContent = mj.nume;
  timpMj(0);
  $('#mj').hidden = false;
  SUNET.minijoc();
  const DUR = d(9000);
  const regula = typeof mj.regula === 'function' ? mj.regula() : mj.regula;
  corp(`<div class="mj-intro">
    <div class="mj-intro-emoji">${mj.emoji}</div>
    <p class="mj-regula">${regula}</p>
    <p class="mj-tel">📱 ${mj.telefon}</p>
    <div class="bara-gata"><i style="animation-duration:${DUR}ms"></i></div>
  </div>`);
  aratTuturor(() => ({ tip: 'asteapta', emoji: mj.emoji, titlu: mj.nume, text: mj.telefon }));
  const sari = butonSari('Am înțeles, start! ▶');
  await Promise.race([pauza(DUR), sari.apasat]);
  sari.scoate();
  aratTuturor(() => ({ tip: 'numaratoare' }));
  for (const n of [3, 2, 1]) {
    corp(`<div class="mj-numaratoare">${n}</div>`);
    SUNET.bip();
    await pauza(800);
  }
  SUNET.start();
}

async function arataRezultate(clasament) {
  timpMj(0);
  corp(`<div class="rezultate"><h3>Rezultate</h3><ol>${clasament.map((r, i) => `
    <li class="rez-rand loc-${r.loc}" style="animation-delay:${i * 0.15}s">
      <span class="rez-loc">${MEDALII[r.loc - 1] || r.loc + '.'}</span>
      <span class="av-cerc" style="--c:${r.j.culoare}">${r.j.avatar}</span>
      <span class="rez-nume">${esc(r.j.nume)}</span>
      <span class="rez-text">${r.text}</span>
      <span class="rez-premiu ${r.premiu ? '' : 'zero'}">${r.premiu ? `+${r.premiu} ➜` : '—'}</span>
    </li>`).join('')}</ol></div>`);
  SUNET.bun();
  for (const r of clasament) {
    arata(r.j, {
      tip: 'asteapta',
      emoji: r.loc === 1 ? '🏆' : r.premiu ? '👍' : '💪',
      titlu: r.loc === 1 ? 'Ai câștigat minijocul!' : `Locul ${r.loc}`,
      text: r.premiu ? `Mergi ${r.premiu} ${r.premiu === 1 ? 'căsuță' : 'căsuțe'} înainte.` : 'Data viitoare iese mai bine!',
    });
  }
  await pauza(d(6000));
}

async function rundaMinijoc() {
  if (!S.sacMj.length) S.sacMj = amesteca(MINIJOCURI.map((m) => m.id));
  const id = PARAM.get('minijoc') || S.sacMj.shift();
  salveaza();
  const mj = MINIJOCURI.find((m) => m.id === id) || MINIJOCURI[0];
  S.curent = null;
  randeazaPioni();
  randeazaLateral();
  banner(`Runda ${S.runda} · minijoc!`);
  await anunt({ emoji: '🎮', titlu: 'Minijoc!', text: 'Toată lumea joacă. Primii merg înainte.', stil: 'mov', durata: 2200 });
  await introMj(mj);
  const rez = await mj.joaca();
  const clasament = claseaza(rez, mj.maiMare);
  await arataRezultate(clasament);
  $('#mj').hidden = true;
  aratTuturor(() => ({ tip: 'asteapta', emoji: '🏃', titlu: 'Mutăm pionii…', text: 'Uită-te pe ecranul mare 👀' }));
  await Promise.all(clasament.filter((r) => r.premiu).map((r) => muta(r.j, r.premiu)));
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
  Object.assign(S, { faza: 'lobby', jucatori: [], vipId: null, tabla: [], runda: 1, ordineTura: 0, sacMj: [], saci: {}, curent: null });
  arataEcran('lobby');
  deschideCamera(RETEA.codNou());
  randeazaLobby();
}

async function continua(s) {
  S.setari = s.setari || S.setari;
  S.vipId = s.vipId;
  S.runda = s.runda || 1;
  S.ordineTura = s.ordineTura || 0;
  S.sacMj = s.sacMj || [];
  S.jucatori = s.jucatori.map((j) => ({ ...j, poz: j.poz || 0, sosit: null, conn: null, online: false, ultim: 0, vedere: null, ultimaReactie: 0 }));
  deschideCamera(s.cod);
  if (s.faza === 'lobby') {
    S.faza = 'lobby';
    arataEcran('lobby');
    randeazaLobby();
    return;
  }
  S.faza = 'joc';
  S.tabla = s.tabla.map((tip) => ({ tip }));
  arataEcran('joc');
  randeazaTabla();
  randeazaLateral();
  tineEcranul();
  await asteaptaReconectare();
  bucla();
}

function initializare() {
  construiesteZar();

  $('#buton-start').addEventListener('click', () => { SUNET.deblocheaza(); pornesteJoc(); });
  $('#seg-lungime').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    S.setari.lungime = +b.dataset.v;
    randeazaLobby();
    salveaza();
  });
  $('#lobby-jucatori').addEventListener('click', (e) => {
    const b = e.target.closest('.scoate');
    if (b) scoateJucator(b.dataset.id);
  });
  $('#zar-buton').addEventListener('click', () => opresteAscultarea('laptop'));
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
  // tasta Spatiu / Enter: arunca zarul in locul jucatorului curent
  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !$('#strat-zar').hidden && !$('#zar-buton').hidden) {
      e.preventDefault();
      opresteAscultarea('laptop');
    }
  });

  const salvat = citesteSalvarea();
  if (!salvat) {
    cameraNoua();
    return;
  }
  const nume = salvat.jucatori.map((j) => `${j.avatar} ${esc(j.nume)}`).join(', ');
  $('#pornire-continut').innerHTML = `
    <p class="slab" style="font-size:1.2rem">Ai un joc neterminat${salvat.faza === 'joc' ? ` (runda ${salvat.runda})` : ''}, cu ${nume}.<br>Codul camerei: <b>${esc(salvat.cod)}</b></p>
    <div class="butoane">
      <button id="b-continua" class="buton principal" type="button">▶ Continuă jocul</button>
      <button id="b-nou" class="buton" type="button">✨ Joc nou</button>
    </div>`;
  $('#b-continua').addEventListener('click', () => { SUNET.deblocheaza(); continua(salvat); });
  $('#b-nou').addEventListener('click', cameraNoua);
}

initializare();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
