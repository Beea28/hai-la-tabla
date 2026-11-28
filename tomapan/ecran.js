'use strict';
// Țomapan – ecranul mare: alege litera, ține timpul, strânge răspunsurile,
// conduce verificarea (voturi pe telefon) și ține punctajul.

const STOP_MS = 5000; // după STOP, ceilalți mai au atât
const VOT_MS = 30000; // timp maxim de verificare pentru o categorie

const T = {
  runda: 0, // câte runde s-au terminat
  litere: [], // literele folosite
};

let verif = null; // categoria verificată acum (pentru click-urile de arbitru de pe laptop)

Object.assign(JOC, {
  minJucatori: 2,
  maxJucatori: 8,
  cheieSalvare: 'tomapan-joc-v1',
  setari: { runde: 5, timp: 90, categorii: [...CATEGORII_CLASICE] },
  laStart,
  continua,
  randeazaLateral,
  randeazaSetari,
  stareJoc: () => ({ runda: T.runda, litere: T.litere }),
  // scorul de la începutul rundei: dacă se dă refresh, runda se reia de la capăt
  salveazaJucator: (j) => ({ scor: j.scorBaza ?? j.scor ?? 0 }),
  reseteaza() {
    T.runda = 0;
    T.litere = [];
    for (const j of S.jucatori) {
      j.scor = 0;
      j.scorBaza = 0;
      j.puncteRunda = 0;
    }
  },
  infoVedere(j, v) { v.info = `⭐ ${j.scor || 0}`; },
  descriereSalvare: (s) => `runda ${(s.joc.runda || 0) + 1} din ${s.setari?.runde || 5}`,
});

const scena = (html) => { $('#scena').innerHTML = html; };
const categoriiAlese = () => {
  const c = CATEGORII.filter((x) => S.setari.categorii.includes(x.id));
  return c.length >= 3 ? c : CATEGORII.filter((x) => x.clasic);
};

function locuri(sortat, val) {
  const loc = new Map();
  sortat.forEach((j, i) => loc.set(j.id, i > 0 && val(j) === val(sortat[i - 1]) ? loc.get(sortat[i - 1].id) : i + 1));
  return loc;
}

// ================= Camera de asteptare =================
function randeazaSetari() {
  for (const b of $$('#seg-runde button')) b.setAttribute('aria-checked', String(+b.dataset.v === S.setari.runde));
  for (const b of $$('#seg-timp button')) b.setAttribute('aria-checked', String(+b.dataset.v === S.setari.timp));
  $('#chips-cat').innerHTML = CATEGORII.map((c) => `<button type="button" class="chip" data-id="${c.id}" aria-pressed="${S.setari.categorii.includes(c.id)}">${c.emoji} ${c.nume}</button>`).join('');
}

function legaSetari() {
  $('#seg-runde').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    S.setari.runde = +b.dataset.v;
    randeazaLobby();
    salveaza();
  });
  $('#seg-timp').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    S.setari.timp = +b.dataset.v;
    randeazaLobby();
    salveaza();
  });
  $('#chips-cat').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    const id = b.dataset.id;
    const are = S.setari.categorii.includes(id);
    if (are && S.setari.categorii.length <= 3) {
      tremuraEl(b);
      return;
    }
    S.setari.categorii = are ? S.setari.categorii.filter((x) => x !== id) : [...S.setari.categorii, id];
    randeazaLobby();
    salveaza();
  });
}

function tremuraEl(el) {
  el.classList.remove('tremura');
  void el.offsetWidth;
  el.classList.add('tremura');
}

// ================= Lista din dreapta =================
function randeazaLateral() {
  const sortat = [...S.jucatori].sort((a, b) => (b.scor || 0) - (a.scor || 0));
  const loc = locuri(sortat, (j) => j.scor || 0);
  $('#lista-jucatori').innerHTML = sortat.map((j) => `
    <li class="${j.online ? '' : 'offline'}">
      <span class="av-cerc" style="--c:${j.culoare}">${j.avatar}</span>
      <span class="lj-nume">${esc(j.nume)}${j.online ? '' : ' <span class="lj-off">offline</span>'}</span>
      <span class="lj-loc">${j.scor > 0 ? MEDALII[loc.get(j.id) - 1] || '' : ''}</span>
      <span class="lj-scor"><b>${j.scor || 0}</b> puncte</span>
    </li>`).join('');
  $('#lat-runda').textContent = T.runda < S.setari.runde ? `Runda ${T.runda + 1} din ${S.setari.runde}` : 'Gata!';
  $('#lat-litere').innerHTML = T.litere.length ? `Litere jucate: ${T.litere.map((l) => `<b>${l}</b>`).join(' ')}` : '';
}

// ================= Desfasurarea jocului =================
async function laStart() {
  JOC.reseteaza();
  randeazaLateral();
  scena('');
  aratTuturor(() => ({ tip: 'asteapta', emoji: '✍️', titlu: 'Începe jocul!', text: 'Uită-te pe ecranul mare 👀' }));
  salveaza();
  SUNET.fanfara();
  const cats = categoriiAlese();
  await anunt({
    emoji: '✍️',
    titlu: 'Să înceapă Țomapanul!',
    text: `${S.setari.runde} runde · ${S.setari.timp} de secunde de scris`,
    extra: `<div class="ordine">${cats.map((c) => `<span>${c.emoji} ${c.nume}</span>`).join('')}</div>`,
    durata: 4200,
  });
  await bucla();
}

async function continua(s) {
  T.runda = s.runda || 0;
  T.litere = Array.isArray(s.litere) ? s.litere.slice(0, T.runda) : [];
  for (const j of S.jucatori) {
    j.scor = j.scor || 0;
    j.scorBaza = j.scor;
    j.puncteRunda = 0;
  }
  randeazaLateral();
  scena('');
  await asteaptaReconectare();
  await bucla();
}

async function bucla() {
  while (S.faza === 'joc' && T.runda < S.setari.runde) {
    for (const j of S.jucatori) j.scorBaza = j.scor;
    salveaza();
    try {
      await runda(T.runda + 1);
    } catch (e) {
      console.error(e);
    }
    if (S.faza !== 'joc') return;
    T.runda++;
    for (const j of S.jucatori) j.scorBaza = j.scor;
    salveaza();
    randeazaLateral();
  }
  if (S.faza === 'joc') terminaJoc();
}

async function runda(nr) {
  for (const j of S.jucatori) j.puncteRunda = 0;
  randeazaLateral();
  const litera = await alegeLitera(nr);
  T.litere.push(litera);
  randeazaLateral();
  const cats = categoriiAlese();
  const rasp = await scriere(litera, cats, nr);
  await verificare(litera, cats, rasp, nr);
  await rezumatRunda(nr);
}

// ---------- 1. Litera: literele se schimbă pe ecran, un jucător spune STOP ----------
async function alegeLitera(nr) {
  const libere = LITERE.filter((l) => !T.litere.includes(l));
  const cine = S.jucatori[(nr - 1) % S.jucatori.length];
  const alegator = cine.online ? cine : S.jucatori.find((j) => j.online) || cine;
  banner(`Runda ${nr} din ${S.setari.runde} · alegem litera`);
  scena(`<div class="sc-litera">
    <p class="sc-titlu">Runda ${nr} din ${S.setari.runde}</p>
    <div class="litera-mare" id="litera">${libere[0]}</div>
    <p class="sc-sub" id="litera-sub">📱 ${nh(alegator)}, spune <b>STOP</b> pe telefon!</p>
    <div class="alfabet">${LITERE.map((l) => `<span class="${T.litere.includes(l) ? 'folosita' : ''}" data-l="${l}">${l}</span>`).join('')}</div>
  </div>`);
  aratTuturor((x) => (x === alegator
    ? { tip: 'stop-litera' }
    : { tip: 'asteapta', emoji: '🔤', titlu: `${alegator.nume} alege litera…`, text: 'Literele se schimbă pe ecranul mare. Când spune STOP, începeți să scrieți!' }));
  const el = $('#litera');
  let k = aleator(libere.length);
  const afiseaza = () => {
    el.textContent = libere[k];
    for (const s of $$('.alfabet span')) s.classList.toggle('aprinsa', s.dataset.l === libere[k]);
  };
  afiseaza();
  const iv = setInterval(() => {
    k = (k + 1) % libere.length;
    afiseaza();
    SUNET.ton(1100, 0.03, 'square', 0.025);
  }, 120);
  const sari = butonSari('✋ Stop de aici');
  sari.apasat.then(() => opresteAscultarea('laptop'));
  await asculta((x, m, fin) => {
    if (x === alegator && m.t === 'stop-litera' && eCheie(x, m)) fin('telefon');
  }, alegator.online ? 15000 : 3000);
  sari.scoate();
  clearInterval(iv);
  const litera = libere[k];
  afiseaza();
  el.classList.add('aleasa');
  $('#litera-sub').innerHTML = `Litera este <b>${litera}</b>!`;
  SUNET.bun();
  aratTuturor(() => ({ tip: 'asteapta', emoji: '🔤', titlu: `Litera ${litera}!`, text: 'Pregătește-te să scrii…', faraReactii: true }));
  await pauza(d(1800));
  return litera;
}

// ---------- 2. Scrisul: fiecare completează pe telefon ----------
function curata(r, cats) {
  const o = {};
  for (const c of cats) {
    const v = r && typeof r === 'object' ? r[c.id] : '';
    o[c.id] = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 32) : '';
  }
  return o;
}

async function scriere(litera, cats, nr) {
  const durata = S.setari.timp * 1000;
  let sfarsit = Date.now() + durata;
  const rasp = new Map(S.jucatori.map((j) => [j.id, curata({}, cats)]));
  const chei = new Map();
  const finale = new Set();
  let stop = null;
  banner(`Runda ${nr} · cuvinte cu litera <b>${litera}</b>`);
  scena(`<div class="sc-scris">
    <div class="sc-st">
      <div class="litera-mare mica">${litera}</div>
      <div class="ceas-mare" id="ceas">${minSecunde(durata)}</div>
    </div>
    <div class="sc-dr">
      <h2>📱 Scrieți pe telefon câte un cuvânt cu <b>${litera}</b>:</h2>
      <div class="cat-lista">${cats.map((c) => `<span>${c.emoji} ${c.nume}</span>`).join('')}</div>
      <p class="sc-nota">🤫 Nimeni nu vede ce scrieți. Cine completează tot poate spune <b>STOP</b>, iar ceilalți mai au ${STOP_MS / 1000} secunde.</p>
      <div class="progrese">${S.jucatori.map((j) => `
        <div class="progres-j" data-id="${j.id}">
          <span class="av-cerc" style="--c:${j.culoare}">${j.avatar}</span>
          <span class="pj-nume">${esc(j.nume)}</span>
          <span class="pj-bile" style="--c:${j.culoare}">${cats.map(() => '<i></i>').join('')}</span>
        </div>`).join('')}</div>
    </div>
    <div id="stop-banner" class="stop-banner" hidden></div>
  </div>`);
  const categorii = cats.map(({ id, nume, emoji }) => ({ id, nume, emoji }));
  for (const j of S.jucatori) {
    arata(j, { tip: 'scrie', litera, categorii, durata, sfarsit });
    chei.set(j.id, j.vedere.cheie);
  }
  SUNET.start();

  const ceas = $('#ceas');
  let ultimaSec = null;
  const iv = setInterval(() => {
    const ramas = sfarsit - Date.now();
    ceas.textContent = minSecunde(ramas);
    ceas.classList.toggle('urgent', ramas <= 10000);
    const s = Math.ceil(ramas / 1000);
    if (ramas <= 10000 && s > 0 && s !== ultimaSec) {
      ultimaSec = s;
      SUNET.bip();
    }
  }, 200);

  const progres = (j) => {
    const r = rasp.get(j.id);
    const n = cats.filter((c) => incepeCu(r[c.id], litera)).length;
    $$(`.progres-j[data-id="${j.id}"] .pj-bile i`).forEach((b, i) => b.classList.toggle('on', i < n));
  };
  const primeste = (j, m) => {
    if (m.t !== 'scrie' || !m.cheie || m.cheie !== chei.get(j.id)) return false;
    const r = curata(m.r, cats);
    rasp.set(j.id, r);
    if (j.vedere?.cheie === m.cheie) j.vedere.r = r; // ca sa le primeasca inapoi daca da refresh
    if (m.final) finale.add(j.id);
    progres(j);
    return true;
  };

  let timer = setTimeout(() => opresteAscultarea(), durata);
  const sari = butonSari('⏹ Gata timpul');
  sari.apasat.then(() => opresteAscultarea());
  await asculta((j, m) => {
    if (!primeste(j, m) || !m.stop || stop) return;
    if (!cats.every((c) => incepeCu(rasp.get(j.id)[c.id], litera))) return;
    // STOP!
    stop = j;
    sfarsit = Math.min(sfarsit, Date.now() + STOP_MS);
    clearTimeout(timer);
    timer = setTimeout(() => opresteAscultarea(), Math.max(0, sfarsit - Date.now()));
    for (const x of S.jucatori) {
      if (x.vedere?.cheie === chei.get(x.id)) {
        x.vedere.sfarsit = sfarsit;
        x.vedere.stop = { nume: j.nume };
      }
      eveniment(x, { tip: 'stop', cine: j.nume, eu: x === j, ramas: sfarsit - Date.now() });
    }
    const b = $('#stop-banner');
    b.innerHTML = `🛑 STOP! ${nh(j)} a terminat. Încă ${STOP_MS / 1000} secunde!`;
    b.hidden = false;
    SUNET.ton(520, 0.5, 'sawtooth', 0.09);
    SUNET.ton(390, 0.6, 'sawtooth', 0.09, 0.18);
  });
  sari.scoate();
  clearTimeout(timer);
  clearInterval(iv);
  ceas.textContent = '0:00';
  ceas.classList.remove('urgent');
  const b = $('#stop-banner');
  b.innerHTML = '✋ Pixurile jos! Strângem răspunsurile…';
  b.hidden = false;
  SUNET.fanfara();

  // fiecare telefon trimite ce a scris când primește vederea următoare
  aratTuturor(() => ({ tip: 'asteapta', emoji: stop ? '🛑' : '⏰', titlu: stop ? 'STOP!' : 'Timpul a expirat!', text: 'Pixurile jos! Urmează verificarea răspunsurilor.', faraReactii: true }));
  await asculta((j, m, fin) => {
    primeste(j, m);
    if (toti(finale)) fin();
  }, 2500);
  await pauza(d(900));
  return rasp;
}

// ---------- 3. Verificarea: categorie cu categorie ----------
async function verificare(litera, cats, rasp, nr) {
  for (let i = 0; i < cats.length; i++) {
    if (S.faza !== 'joc') return;
    await verificaCategorie(litera, cats[i], i, cats.length, rasp, nr);
  }
}

function cardHtml(x, litera) {
  const cls = !x.text ? 'gol' : !x.ok ? 'gresit' : x.g.autori.length > 1 ? 'dublu' : '';
  return `<div class="rasp-card ${cls}" data-id="${x.j.id}" ${x.g ? `data-g="${x.g.id}"` : ''} style="--c:${x.j.culoare}">
    <div class="rc-cine"><span class="av-cerc" style="--c:${x.j.culoare}">${x.j.avatar}</span><span>${esc(x.j.nume)}</span></div>
    <div class="rc-text">${x.text ? esc(x.text) : '—'}</div>
    <div class="rc-jos">
      <span class="rc-stare">${!x.text ? 'nimic scris' : !x.ok ? `nu începe cu ${litera}` : x.g.autori.length > 1 ? `👯 la fel ca altcineva` : ''}</span>
      <span class="rc-puncte"></span>
    </div>
  </div>`;
}

function actualizeazaCarduri(final) {
  if (!verif) return;
  for (const x of verif.intrari) {
    const card = $(`.rasp-card[data-id="${x.j.id}"]`);
    if (!card) continue;
    const stare = card.querySelector('.rc-stare');
    if (final) {
      card.classList.remove('contestat');
      card.classList.add(x.puncte ? 'castiga' : 'pierde');
      card.querySelector('.rc-puncte').textContent = x.puncte ? `+${x.puncte}` : '0';
      if (x.g) {
        stare.textContent = !x.g.valid
          ? (x.g.forta === false ? '⚖️ respins de arbitru' : '👎 respins la vot')
          : x.g.autori.length > 1 ? `👯 la fel ca altcineva` : '⭐ doar al tău';
      }
      continue;
    }
    if (!x.g) continue;
    const contra = x.g.contra.size;
    card.classList.toggle('contestat', x.g.forta === false || (x.g.forta == null && contra > 0));
    stare.textContent = x.g.forta === false ? '⚖️ respins de arbitru'
      : x.g.forta === true ? '⚖️ acceptat de arbitru'
        : contra ? `👎 ×${contra}` : x.g.autori.length > 1 ? '👯 la fel ca altcineva' : '';
  }
}

function timpVerif(ms) {
  const i = $('#sv-timp');
  if (!i) return;
  i.classList.remove('merge');
  void i.offsetWidth;
  if (ms) {
    i.style.animationDuration = ms + 'ms';
    i.classList.add('merge');
  }
}

async function verificaCategorie(litera, cat, i, total, rasp, nr) {
  const intrari = S.jucatori.map((j) => {
    const text = rasp.get(j.id)?.[cat.id] || '';
    return { j, text, ok: incepeCu(text, litera), g: null, puncte: 0 };
  });
  const grupuri = [];
  for (const x of intrari) {
    if (!x.ok) continue;
    const cheie = cheieGrup(x.text);
    let g = grupuri.find((y) => y.cheie === cheie);
    if (!g) {
      g = { id: 'g' + grupuri.length, cheie, text: x.text, autori: [], contra: new Set(), forta: null, valid: true };
      grupuri.push(g);
    }
    g.autori.push(x.j);
    x.g = g;
  }
  const votanti = S.jucatori.filter((v) => v.online && grupuri.some((g) => !g.autori.includes(v)));
  verif = { intrari, grupuri, votanti, arbitru: false };

  banner(`Runda ${nr} · verificăm răspunsurile`);
  scena(`<div class="sc-verif">
    <div class="sv-cap">
      <span class="sv-emoji">${cat.emoji}</span>
      <h2>${cat.nume} cu <b class="sv-litera">${litera}</b></h2>
      <span class="sv-nr">${i + 1} / ${total}</span>
    </div>
    <div class="sv-timp"><i id="sv-timp"></i></div>
    <div class="carduri n${Math.min(S.jucatori.length, 8)}">${intrari.map((x) => cardHtml(x, litera)).join('')}</div>
    <p class="sv-nota" id="sv-nota"></p>
  </div>`);
  SUNET.carte();

  if (votanti.length && grupuri.length) {
    const gata = new Set();
    const sfarsit = Date.now() + VOT_MS;
    for (const v of S.jucatori) {
      if (votanti.includes(v)) {
        arata(v, {
          tip: 'verifica',
          litera,
          categorie: { nume: cat.nume, emoji: cat.emoji },
          nr: i + 1,
          total,
          grupuri: grupuri.map((g) => ({ id: g.id, text: g.text, avatare: g.autori.map((a) => a.avatar).join(''), alMeu: g.autori.includes(v) })),
          durata: VOT_MS,
          sfarsit,
        });
      } else {
        arata(v, { tip: 'asteapta', emoji: cat.emoji, titlu: 'Ceilalți verifică…', text: 'Uită-te pe ecranul mare 👀' });
      }
    }
    timpVerif(VOT_MS);
    $('#sv-nota').innerHTML = '📱 Pe telefon: atingeți răspunsurile greșite, apoi „Gata”.<br><small>Pe laptop puteți face click pe un răspuns ca să decideți voi (arbitru).</small>';
    verif.arbitru = true;
    const sari = butonSari('Mai departe ▶');
    sari.apasat.then(() => opresteAscultarea());
    await asculta((v, m, fin) => {
      if (m.t !== 'vot' || !eCheie(v, m) || gata.has(v.id)) return;
      const respinse = new Set(Array.isArray(m.respinse) ? m.respinse.map(String) : []);
      for (const g of grupuri) {
        if (g.autori.includes(v)) continue;
        if (respinse.has(g.id)) g.contra.add(v.id);
        else g.contra.delete(v.id);
      }
      if (m.gata) gata.add(v.id);
      actualizeazaCarduri(false);
      if (toti(gata, votanti)) fin();
    }, VOT_MS);
    sari.scoate();
    timpVerif(0);
  } else {
    $('#sv-nota').textContent = grupuri.length ? '' : 'Niciun răspuns bun aici 🤷';
    aratTuturor(() => ({ tip: 'asteapta', emoji: cat.emoji, titlu: `${cat.nume} cu ${litera}`, text: 'Uită-te pe ecranul mare 👀' }));
    await pauza(d(2200));
  }
  verif.arbitru = false;

  // decizia: un răspuns cade dacă mai mult de jumătate dintre cei care l-au putut vota l-au respins
  for (const g of grupuri) {
    const n = votanti.filter((v) => !g.autori.includes(v)).length;
    g.valid = g.forta ?? !(g.contra.size * 2 > n);
  }
  for (const x of intrari) {
    x.puncte = x.ok && x.g.valid ? (x.g.autori.length > 1 ? 5 : 10) : 0;
    x.j.scor = (x.j.scor || 0) + x.puncte;
    x.j.puncteRunda = (x.j.puncteRunda || 0) + x.puncte;
  }
  $('#sv-nota').textContent = '';
  actualizeazaCarduri(true);
  SUNET.bun();
  randeazaLateral();
  await pauza(d(2800));
  verif = null;
}

// arbitrul de pe laptop: click pe un răspuns îl respinge, încă un click îl acceptă sigur, al treilea lasă votul să decidă
function clickArbitru(e) {
  const card = e.target.closest('.rasp-card[data-g]');
  if (!card || !verif?.arbitru) return;
  const g = verif.grupuri.find((x) => x.id === card.dataset.g);
  if (!g) return;
  g.forta = g.forta == null ? false : g.forta === false ? true : null;
  actualizeazaCarduri(false);
  SUNET.bip();
}

// ---------- 4. Clasamentul după rundă ----------
async function rezumatRunda(nr) {
  const sortat = [...S.jucatori].sort((a, b) => b.scor - a.scor);
  const loc = locuri(sortat, (j) => j.scor);
  const ultima = nr >= S.setari.runde;
  banner(ultima ? 'Ultima rundă s-a terminat!' : `Runda ${nr} s-a terminat`);
  scena(`<div class="sc-rezumat">
    <h2>${ultima ? 'Gata jocul!' : `Clasament după runda ${nr}`}</h2>
    <ol>${sortat.map((j, i) => `
      <li style="animation-delay:${i * 0.12}s">
        <span class="rz-loc">${MEDALII[loc.get(j.id) - 1] || loc.get(j.id) + '.'}</span>
        <span class="av-cerc" style="--c:${j.culoare}">${j.avatar}</span>
        <span class="rz-nume">${esc(j.nume)}</span>
        <span class="rz-runda">+${j.puncteRunda || 0}</span>
        <span class="rz-total">${j.scor}</span>
      </li>`).join('')}</ol>
    <p class="rz-legenda"><span>+ runda asta</span><span>total</span></p>
  </div>`);
  for (const j of S.jucatori) {
    const l = loc.get(j.id);
    arata(j, { tip: 'asteapta', emoji: l === 1 ? '🏆' : '⭐', titlu: `+${j.puncteRunda || 0} puncte`, text: `Ai ${j.scor} puncte în total.\nEști pe locul ${l}.` });
  }
  SUNET.bun();
  if (ultima) {
    await pauza(d(4500));
    return;
  }
  const sari = butonSari('Runda următoare ▶');
  await Promise.race([pauza(d(9000)), sari.apasat]);
  sari.scoate();
}

function terminaJoc() {
  const sortat = [...S.jucatori].sort((a, b) => b.scor - a.scor);
  const loc = locuri(sortat, (j) => j.scor);
  finalJoc(sortat.map((j) => ({ j, loc: loc.get(j.id), text: `${j.scor} puncte` })));
}

// ================= Pornire =================
legaSetari();
$('#scena').addEventListener('click', clickArbitru);
pornesteEcranul();
