'use strict';
// Telefonul = telecomanda, partea comună pentru Țomapan și Avioanele.
// Afișează ce îi spune ecranul mare (o „vedere”) și trimite înapoi apăsările.
// Fiecare joc își adaugă vederile lui în VEDERI și apoi cheamă pornesteTelecomanda().

const P = new URLSearchParams(location.search);
const AUTO = P.has('auto'); // doar pentru teste: telefonul joaca singur
const SLOT = (P.get('slot') || '').replace(/[^a-z0-9]/gi, '').slice(0, 4);
const JOC_TEL = document.currentScript?.dataset.joc || 'joc';
const CHEIE = JOC_TEL + '-tel' + SLOT;
const CHEIE_INTRAT = JOC_TEL + '-intrat' + SLOT;

let salvat = {};
try { salvat = JSON.parse(localStorage.getItem(CHEIE)) || {}; } catch { /* nimic */ }
if (!salvat.id || !/^[a-z0-9]{8,40}$/.test(salvat.id)) {
  salvat.id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => (b % 36).toString(36)).join('');
}

const st = {
  cod: RETEA.curataCod(P.get('cod') || salvat.cod || ''),
  nume: salvat.nume || '',
  avatar: AVATARE.includes(salvat.avatar) ? salvat.avatar : AVATARE[aleator(AVATARE.length)],
  eu: null,
  retea: null,
  vedere: null,
  curata: null,
  ev: null, // functia vederii curente care primeste evenimente de la ecranul mare
};

function pastreaza() {
  try { localStorage.setItem(CHEIE, JSON.stringify({ id: salvat.id, nume: st.nume, avatar: st.avatar, cod: st.cod })); } catch { /* nimic */ }
}

const trimite = (m) => st.retea?.trimite(m);
const vibreaza = (p) => {
  // browserul permite vibratia doar dupa ce omul a atins ecranul macar o data
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try { navigator.vibrate?.(p); } catch { /* nimic */ }
};
const culoare = () => st.eu?.culoare || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff5d3a';

function flash(tip) {
  const c = 'flash-' + tip;
  document.body.classList.remove('flash-bine', 'flash-rau');
  void document.body.offsetWidth;
  document.body.classList.add(c);
  setTimeout(() => document.body.classList.remove(c), 260);
}

function tremura(el) {
  el.classList.remove('tremura');
  void el.offsetWidth;
  el.classList.add('tremura');
}

// ================= Intrarea in joc =================
function randeazaAvatare() {
  $('#avatare').innerHTML = AVATARE.map((a) => `<button type="button" role="radio" aria-checked="${a === st.avatar}" data-a="${a}">${a}</button>`).join('');
}

function arataIntrare(mesaj = '') {
  st.retea?.opreste();
  st.retea = null;
  st.vedere = null;
  try { sessionStorage.removeItem(CHEIE_INTRAT); } catch { /* nimic */ }
  $('#intrare').hidden = false;
  $('#vedere').hidden = true;
  $('#cap').hidden = true;
  $('#banda').hidden = true;
  $('#in-cod').value = st.cod;
  $('#in-nume').value = st.nume;
  $('#mesaj-intrare').textContent = mesaj;
  randeazaAvatare();
}

function intra() {
  pastreaza();
  try { sessionStorage.setItem(CHEIE_INTRAT, st.cod); } catch { /* nimic */ }
  $('#intrare').hidden = true;
  $('#vedere').hidden = false;
  $('#cap').hidden = false;
  randeazaCap();
  st.vedere = null;
  arataVedere({ tip: 'conectare' });
  tineEcranul();
  st.retea?.opreste();
  st.retea = RETEA.jucator(st.cod, {
    conectat: trimiteSalut,
    mesaj: laMesaj,
    stare: arataStare,
  });
}

function randeazaCap() {
  const av = $('#cap-av');
  av.textContent = st.eu?.avatar || st.avatar;
  av.style.setProperty('--c', culoare());
  $('#cap').style.setProperty('--c', culoare());
  $('#cap-nume').textContent = st.eu?.nume || st.nume;
}

function arataStare(s) {
  const punct = $('#cap-stare');
  punct.className = 'punct-stare' + (s === 'online' ? ' ok' : s === 'fara-internet' || s === 'negasit' ? ' rau' : '');
  const banda = $('#banda');
  if (s === 'online') {
    banda.hidden = true;
    return;
  }
  if (!st.vedere || st.vedere.tip === 'conectare' || st.vedere.tip === 'negasit') {
    // inca nu am intrat: aratam pe tot ecranul ce se intampla
    if (s === 'negasit') {
      if (st.vedere?.tip !== 'negasit') arataVedere({ tip: 'negasit' });
    } else {
      const texte = {
        conectare: 'Pasul 1 din 2: mă conectez la internet…',
        caut: `Pasul 2 din 2: caut ecranul mare (camera ${st.cod})…`,
        pierdut: 'Reîncerc…',
        'fara-internet': 'Nu am internet… reîncerc.',
      };
      arataVedere({ tip: 'conectare', text: texte[s] || 'Mă conectez…' });
    }
    return;
  }
  banda.textContent = s === 'negasit' ? '📡 Ecranul mare nu răspunde… reîncerc' : '📡 Se reconectează…';
  banda.hidden = false;
}

const trimiteSalut = () => trimite({ t: 'salut', id: salvat.id, nume: st.nume, avatar: st.avatar });

function laMesaj(m) {
  if (m.t === 'cine') {
    trimiteSalut(); // ecranul mare a dat refresh și nu ne mai știe
  } else if (m.t === 'bine') {
    st.eu = m.eu;
    randeazaCap();
    $('#banda').hidden = true;
  } else if (m.t === 'refuz') {
    arataIntrare(m.motiv || 'Nu poți intra acum.');
  } else if (m.t === 'vedere' && m.v) {
    arataVedere(m.v);
  } else if (m.t === 'ev') {
    try { st.ev?.(m); } catch (e) { console.error(e); }
  }
}

// ================= Vederi =================
const VEDERI = {};

function arataVedere(v) {
  if (v.cheie && st.vedere?.cheie === v.cheie) return; // aceeasi vedere, retrimisa dupa reconectare
  if (typeof st.curata === 'function') {
    try { st.curata(); } catch { /* nimic */ }
  }
  st.curata = null;
  st.ev = null;
  st.vedere = v;
  if (v.info != null) $('#cap-poz').textContent = v.info;
  else if (v.tip === 'lobby') $('#cap-poz').textContent = '';
  const el = $('#vedere');
  el.className = 'vedere v-' + v.tip;
  el.innerHTML = '';
  el.scrollTop = 0;
  const f = VEDERI[v.tip];
  st.curata = f ? f(v, el) || null : null;
}

const reactiiHtml = () => `<div class="bara-reactii">${REACTII.map((e) => `<button type="button" class="b-reactie" data-e="${e}">${e}</button>`).join('')}</div>`;

function legaReactii(el) {
  let ultim = 0;
  el.querySelectorAll('.b-reactie').forEach((b) => b.addEventListener('click', () => {
    const acum = Date.now();
    if (acum - ultim < 500) return;
    ultim = acum;
    trimite({ t: 'reactie', e: b.dataset.e });
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
    vibreaza(10);
  }));
}

// bara de timp care tine cont cat a trecut deja (dupa reconectare)
function baraTimp(durata, ramas = durata) {
  const trecut = Math.max(0, durata - ramas);
  return `<div class="tel-timp"><i style="animation-duration:${durata}ms;animation-delay:-${trecut}ms"></i></div>`;
}

Object.assign(VEDERI, {
  conectare(v, el) {
    el.innerHTML = `<div class="centru"><div class="mare-emoji spin">${esc(document.body.dataset.emoji || '🎲')}</div><h2>Mă conectez…</h2><p class="text-lung">${esc(v.text || `Camera ${st.cod}`)}</p></div>`;
  },

  negasit(v, el) {
    el.innerHTML = `<div class="centru"><div class="mare-emoji">🔎</div><h2>Nu găsesc camera ${esc(st.cod)}</h2>
      <p class="text-lung">Verifică:\n• pagina „Ecranul mare” e deschisă pe laptop;\n• codul de pe laptop e chiar ${esc(st.cod)}.\n\nReîncerc automat…</p>
      <button type="button" class="buton" id="b-schimba">✏️ Schimbă codul</button></div>`;
    $('#b-schimba').addEventListener('click', () => arataIntrare());
  },

  lobby(v, el) {
    el.innerHTML = `<div class="centru">
      <div class="mare-emoji">${esc(st.eu?.avatar || st.avatar)}</div>
      <h2>Ești în joc!</h2>
      <p class="text-lung">${v.nr} ${v.nr === 1 ? 'jucător conectat' : 'jucători conectați'}.</p>
      ${v.vip
        ? `<button type="button" class="buton principal mare" id="b-start" ${v.pot ? '' : 'disabled'}>▶ Începe jocul</button>
           <p class="mic">${v.pot ? 'Apasă când sunteți toți aici.' : 'Mai așteptăm cel puțin un jucător.'}</p>`
        : '<p class="mic">Așteptăm să pornească jocul…</p>'}
    </div>${reactiiHtml()}`;
    $('#b-start')?.addEventListener('click', () => { trimite({ t: 'start' }); vibreaza(20); });
    legaReactii(el);
    if (AUTO && v.vip && v.pot && v.nr >= (+P.get('n') || 2)) {
      const t = setTimeout(() => $('#b-start')?.click(), 1500);
      return () => clearTimeout(t);
    }
  },

  asteapta(v, el) {
    el.innerHTML = `<div class="centru">
      <div class="mare-emoji">${esc(v.emoji || '⏳')}</div>
      <h2>${esc(v.titlu || '')}</h2>
      ${v.text ? `<p class="text-lung">${esc(v.text)}</p>` : ''}
    </div>${v.faraReactii ? '' : reactiiHtml()}`;
    legaReactii(el);
  },

  alege(v, el) {
    const opt = v.optiuni || [];
    el.innerHTML = `<div class="sus"><h2>${esc(v.titlu)}</h2>${v.text ? `<p class="text-lung">${esc(v.text)}</p>` : ''}</div>
      <div class="optiuni ${opt.length > 3 ? 'multe' : ''}">${opt.map((o) => `
        <button type="button" class="optiune" data-id="${esc(o.id)}"><span class="o-e">${esc(o.emoji || '')}</span><span class="o-t">${esc(o.text)}</span></button>`).join('')}
      </div>`;
    let ales = false;
    el.querySelectorAll('.optiune').forEach((b) => b.addEventListener('click', () => {
      if (ales) return;
      ales = true;
      trimite({ t: 'alege', cheie: v.cheie, id: b.dataset.id });
      b.classList.add('aleasa');
      el.querySelectorAll('.optiune').forEach((x) => x !== b && x.classList.add('stinsa'));
      vibreaza(30);
      el.insertAdjacentHTML('beforeend', '<p class="trimis">Trimis ✓ Uită-te pe ecranul mare</p>');
    }));
    if (AUTO) {
      const t = setTimeout(() => {
        const bs = el.querySelectorAll('.optiune');
        bs[aleator(bs.length)]?.click();
      }, 700 + Math.random() * 1500);
      return () => clearTimeout(t);
    }
  },

  final(v, el) {
    const emoji = v.loc === 1 ? '🏆' : v.loc === 2 ? '🥈' : v.loc === 3 ? '🥉' : '🎉';
    el.innerHTML = `<div class="centru">
      <div class="mare-emoji">${emoji}</div>
      <h2>${v.loc === 1 ? 'Ai câștigat!' : `Locul ${v.loc}`}</h2>
      ${v.text ? `<p class="text-lung"><b>${esc(v.text)}</b></p>` : ''}
      <p class="text-lung">Mulțumim de joc!</p>
      ${v.vip
        ? '<button type="button" class="buton principal mare" id="b-iar">🔁 Încă un joc</button>'
        : '<p class="mic">Mai jucați o dată? Apăsați „Încă un joc” pe ecranul mare.</p>'}
    </div>${reactiiHtml()}`;
    $('#b-iar')?.addEventListener('click', () => trimite({ t: 'din-nou' }));
    legaReactii(el);
    vibreaza(v.loc === 1 ? [100, 60, 100, 60, 200] : 60);
  },
});

// ================= Ecran treaz + revenire in aplicatie =================
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
  if (document.visibilityState !== 'visible' || !st.retea) return;
  tineEcranul();
  st.retea.verifica();
});

// ================= Pornire =================
function pornesteTelecomanda() {
  $('#avatare').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    st.avatar = b.dataset.a;
    randeazaAvatare();
  });

  $('#in-cod').addEventListener('input', (e) => {
    e.target.value = RETEA.curataCod(e.target.value);
  });

  $('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    const cod = RETEA.curataCod($('#in-cod').value);
    const nume = $('#in-nume').value.replace(/\s+/g, ' ').trim().slice(0, 12);
    if (cod.length !== 4) {
      $('#mesaj-intrare').textContent = 'Codul are 4 litere. Îl vezi pe ecranul mare.';
      return;
    }
    if (!nume) {
      $('#mesaj-intrare').textContent = 'Scrie-ți numele.';
      return;
    }
    st.cod = cod;
    st.nume = nume;
    intra();
  });

  if (AUTO && !st.nume) st.nume = 'Bot ' + (SLOT || aleator(99));
  let intratDeja = null;
  try { intratDeja = sessionStorage.getItem(CHEIE_INTRAT); } catch { /* nimic */ }
  if (st.cod.length === 4 && st.nume && (intratDeja === st.cod || AUTO)) {
    intra(); // refresh in timpul jocului: intram direct inapoi
  } else {
    arataIntrare();
    if (st.cod.length === 4) $('#in-nume').focus();
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').catch(() => {});
}
