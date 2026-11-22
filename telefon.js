'use strict';
// Telefonul = telecomanda. Afiseaza ce ii spune ecranul mare si trimite inapoi apasarile.

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sec = (ms) => (ms / 1000).toFixed(2).replace('.', ',');
const aleator = (n) => Math.floor(Math.random() * n);

const P = new URLSearchParams(location.search);
const AUTO = P.has('auto'); // doar pentru teste: telefonul joaca singur
const SLOT = (P.get('slot') || '').replace(/[^a-z0-9]/gi, '').slice(0, 4);
const CHEIE = 'hlt-tel' + SLOT;

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
};

function pastreaza() {
  try { localStorage.setItem(CHEIE, JSON.stringify({ id: salvat.id, nume: st.nume, avatar: st.avatar, cod: st.cod })); } catch { /* nimic */ }
}

const trimite = (m) => st.retea?.trimite(m);
const raspunde = (v, extra) => trimite({ t: 'mj', cheie: v.cheie, ...extra });
const vibreaza = (p) => {
  // browserul permite vibratia doar dupa ce omul a atins ecranul macar o data
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try { navigator.vibrate?.(p); } catch { /* nimic */ }
};
const culoare = () => st.eu?.culoare || '#ff5d3a';

function flash(tip) {
  const c = 'flash-' + tip;
  document.body.classList.remove('flash-bine', 'flash-rau');
  void document.body.offsetWidth;
  document.body.classList.add(c);
  setTimeout(() => document.body.classList.remove(c), 260);
}

// ================= Intrarea in joc =================
function randeazaAvatare() {
  $('#avatare').innerHTML = AVATARE.map((a) => `<button type="button" role="radio" aria-checked="${a === st.avatar}" data-a="${a}">${a}</button>`).join('');
}

function arataIntrare(mesaj = '') {
  st.retea?.opreste();
  st.retea = null;
  st.vedere = null;
  try { sessionStorage.removeItem('hlt-intrat' + SLOT); } catch { /* nimic */ }
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
  try { sessionStorage.setItem('hlt-intrat' + SLOT, st.cod); } catch { /* nimic */ }
  $('#intrare').hidden = true;
  $('#vedere').hidden = false;
  $('#cap').hidden = false;
  randeazaCap();
  st.vedere = null;
  arataVedere({ tip: 'conectare' });
  tineEcranul();
  st.retea?.opreste();
  st.retea = RETEA.jucator(st.cod, {
    conectat: () => trimite({ t: 'salut', id: salvat.id, nume: st.nume, avatar: st.avatar }),
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

function laMesaj(m) {
  if (m.t === 'bine') {
    st.eu = m.eu;
    randeazaCap();
    $('#banda').hidden = true;
  } else if (m.t === 'refuz') {
    arataIntrare(m.motiv || 'Nu poți intra acum.');
  } else if (m.t === 'vedere' && m.v) {
    arataVedere(m.v);
  }
}

// ================= Vederi =================
function arataVedere(v) {
  if (v.cheie && st.vedere?.cheie === v.cheie) return; // aceeasi vedere, retrimisa dupa reconectare
  if (typeof st.curata === 'function') {
    try { st.curata(); } catch { /* nimic */ }
  }
  st.curata = null;
  st.vedere = v;
  if (v.poz != null) $('#cap-poz').textContent = `📍 ${v.poz}/${v.total}`;
  else if (v.tip === 'lobby') $('#cap-poz').textContent = '';
  const el = $('#vedere');
  el.className = 'vedere v-' + v.tip;
  el.innerHTML = '';
  const f = v.tip === 'mj' ? MJ[v.joc] : RANDARI[v.tip];
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

const baraTimp = (ms) => `<div class="tel-timp"><i style="animation-duration:${ms}ms"></i></div>`;

const RANDARI = {
  conectare(v, el) {
    el.innerHTML = `<div class="centru"><div class="mare-emoji spin">🎲</div><h2>Mă conectez…</h2><p class="text-lung">${esc(v.text || `Camera ${st.cod}`)}</p></div>`;
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

  zar(v, el) {
    const scuturare = 'DeviceMotionEvent' in window && typeof DeviceMotionEvent.requestPermission !== 'function' && matchMedia('(pointer: coarse)').matches;
    el.innerHTML = `<div class="centru">
      <h2>E rândul tău! 🎉</h2>
      <button type="button" class="buton-zar" id="b-zar" style="--c:${culoare()}"><span class="zar-mic">🎲</span><b>Aruncă zarul</b></button>
      <p class="mic">${scuturare ? 'Apasă sau scutură telefonul' : 'Apasă pe zar'}</p>
    </div>`;
    vibreaza([90, 60, 90]);
    const b = $('#b-zar');
    let trimis = false;
    const arunca = () => {
      if (trimis) return;
      trimis = true;
      trimite({ t: 'zar', cheie: v.cheie });
      b.classList.add('rostogol');
      b.querySelector('b').textContent = 'Se rostogolește…';
      vibreaza(40);
    };
    b.addEventListener('click', arunca);
    let h = null;
    if (scuturare) {
      h = (e) => {
        const a = e.accelerationIncludingGravity || e.acceleration;
        if (a && Math.hypot(a.x || 0, a.y || 0, a.z || 0) > 25) arunca();
      };
      window.addEventListener('devicemotion', h);
    }
    const auto = AUTO ? setTimeout(arunca, 600 + Math.random() * 800) : 0;
    return () => {
      if (h) window.removeEventListener('devicemotion', h);
      clearTimeout(auto);
    };
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

  numaratoare(v, el) {
    let n = 3;
    el.innerHTML = '<div class="centru"><p class="text-lung">Pregătește-te!</p><div class="numaratoare" id="nr">3</div></div>';
    vibreaza(20);
    const iv = setInterval(() => {
      n--;
      const nr = $('#nr');
      if (!nr) return;
      if (n <= 0) {
        nr.textContent = 'START!';
        nr.style.fontSize = '4rem';
        clearInterval(iv);
      } else nr.textContent = n;
      vibreaza(20);
    }, 800);
    return () => clearInterval(iv);
  },

  final(v, el) {
    const emoji = v.loc === 1 ? '🏆' : v.loc === 2 ? '🥈' : v.loc === 3 ? '🥉' : '🎉';
    el.innerHTML = `<div class="centru">
      <div class="mare-emoji">${emoji}</div>
      <h2>${v.loc === 1 ? 'Ai câștigat!' : `Locul ${v.loc}`}</h2>
      <p class="text-lung">Mulțumim de joc!</p>
      ${v.vip
        ? '<button type="button" class="buton principal mare" id="b-iar">🔁 Încă un joc</button>'
        : '<p class="mic">Mai jucați o dată? Apăsați „Încă un joc” pe ecranul mare.</p>'}
    </div>${reactiiHtml()}`;
    $('#b-iar')?.addEventListener('click', () => trimite({ t: 'din-nou' }));
    legaReactii(el);
    vibreaza(v.loc === 1 ? [100, 60, 100, 60, 200] : 60);
  },
};

// ================= Minijocuri pe telefon =================
// minijocuri cu scor local trimis periodic (Degete de foc, Capcana culorilor, Gaseste intrusul)
function scorLocal(v, el, { porneste, final }) {
  let scor = 0;
  let gata = false;
  let trimis = null;
  const api = {
    get gata() { return gata; },
    get scor() { return scor; },
    adauga(x) {
      if (gata) return;
      scor += x;
      const s = el.querySelector('#scor');
      if (s) s.textContent = scor;
    },
  };
  const autoStop = porneste(api);
  const iv = setInterval(() => {
    if (scor !== trimis) {
      trimis = scor;
      raspunde(v, { n: scor });
    }
  }, 220);
  const to = setTimeout(() => {
    gata = true;
    clearInterval(iv);
    autoStop?.();
    raspunde(v, { n: scor, gata: true });
    el.innerHTML = `<div class="centru"><div class="mare-emoji">${final.emoji}</div><h2>${final.text(scor)}</h2><p class="text-lung">Uită-te pe ecranul mare 👀</p></div>`;
  }, v.durata);
  return () => {
    clearInterval(iv);
    clearTimeout(to);
    autoStop?.();
  };
}

const MJ = {
  apasa(v, el) {
    el.innerHTML = `${baraTimp(v.durata)}<div class="centru">
      <button type="button" class="buton-apasa" id="b-apasa" style="--c:${culoare()}"><b id="scor">0</b><span>APASĂ!</span></button></div>`;
    return scorLocal(v, el, {
      porneste(api) {
        const b = $('#b-apasa');
        const apasa = (e) => {
          e?.preventDefault?.();
          if (api.gata) return;
          api.adauga(1);
          b.classList.remove('lovit');
          void b.offsetWidth;
          b.classList.add('lovit');
        };
        b.addEventListener('pointerdown', apasa);
        if (AUTO) {
          const iv = setInterval(apasa, 110 + Math.random() * 80);
          return () => clearInterval(iv);
        }
      },
      final: { emoji: '🔥', text: (n) => `${n} apăsări!` },
    });
  },

  culori(v, el) {
    el.innerHTML = `${baraTimp(v.durata)}
      <p class="scor-mic">Puncte: <b id="scor">0</b></p>
      <div class="stroop-cuvant" id="cuv"></div>
      <p class="mic" style="text-align:center">Apasă CULOAREA literelor 👇</p>
      <div class="stroop-butoane">${CULORI_STROOP.map((c, i) => `<button type="button" class="stroop-b" data-i="${i}" style="background:${c.c}" aria-label="${c.n}"></button>`).join('')}</div>`;
    return scorLocal(v, el, {
      porneste(api) {
        const cuv = $('#cuv');
        let corect = 0;
        const nou = () => {
          const w = aleator(4);
          let c = w;
          if (Math.random() < 0.8) {
            do { c = aleator(4); } while (c === w);
          }
          corect = c;
          cuv.textContent = CULORI_STROOP[w].n;
          cuv.style.color = CULORI_STROOP[c].c;
          cuv.classList.remove('nou');
          void cuv.offsetWidth;
          cuv.classList.add('nou');
        };
        const apasa = (i) => {
          if (api.gata) return;
          if (i === corect) {
            api.adauga(1);
            flash('bine');
            vibreaza(10);
          } else {
            api.adauga(-1);
            flash('rau');
            vibreaza(80);
          }
          nou();
        };
        el.querySelectorAll('.stroop-b').forEach((b) => b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          apasa(+b.dataset.i);
        }));
        nou();
        if (AUTO) {
          const iv = setInterval(() => apasa(Math.random() < 0.8 ? corect : aleator(4)), 650);
          return () => clearInterval(iv);
        }
      },
      final: { emoji: '🎨', text: (n) => `${n} puncte!` },
    });
  },

  intrus(v, el) {
    el.innerHTML = `${baraTimp(v.durata)}<p class="scor-mic">Găsite: <b id="scor">0</b></p><div class="grila" id="grila"></div>`;
    return scorLocal(v, el, {
      porneste(api) {
        const grila = $('#grila');
        let k = 0;
        const nou = () => {
          const m = api.scor < 3 ? 3 : api.scor < 7 ? 4 : 5;
          let [a, b] = PERECHI_INTRUS[aleator(PERECHI_INTRUS.length)];
          if (Math.random() < 0.5) [a, b] = [b, a];
          k = aleator(m * m);
          grila.className = 'grila m' + m;
          grila.style.gridTemplateColumns = `repeat(${m}, 1fr)`;
          grila.innerHTML = Array.from({ length: m * m }, (_, i) => `<button type="button" class="celula" data-i="${i}">${i === k ? b : a}</button>`).join('');
        };
        const apasa = (i) => {
          if (api.gata) return;
          if (i === k) {
            api.adauga(1);
            flash('bine');
            vibreaza(15);
            nou();
          } else {
            api.adauga(-1);
            vibreaza(80);
            grila.classList.remove('tremura');
            void grila.offsetWidth;
            grila.classList.add('tremura');
          }
        };
        grila.addEventListener('pointerdown', (e) => {
          const c = e.target.closest('.celula');
          if (!c) return;
          e.preventDefault();
          apasa(+c.dataset.i);
        });
        nou();
        if (AUTO) {
          const iv = setInterval(() => apasa(Math.random() < 0.85 ? k : aleator(9)), 900);
          return () => clearInterval(iv);
        }
      },
      final: { emoji: '🔍', text: (n) => `${n} găsite!` },
    });
  },

  semafor(v, el) {
    let faza = 'rosu';
    let t0 = 0;
    let to2 = 0;
    let auto = 0;
    el.innerHTML = `<button type="button" class="semafor-tel rosu" id="b-sem"><span class="st-mare">✋</span><b>Așteaptă verde…</b><small>Runda ${v.runda} din 3</small></button>`;
    const b = $('#b-sem');
    const termina = (extra, html) => {
      faza = 'gata';
      clearTimeout(to);
      clearTimeout(to2);
      clearTimeout(auto);
      raspunde(v, extra);
      b.className = 'semafor-tel gata';
      b.innerHTML = html;
    };
    const apasa = (e) => {
      e?.preventDefault?.();
      if (faza === 'rosu') {
        vibreaza([60, 40, 60]);
        termina({ devreme: true }, '<span class="st-mare">🚫</span><b>Prea devreme!</b><small>Așteaptă runda următoare</small>');
      } else if (faza === 'verde') {
        const ms = Math.round(performance.now() - t0);
        termina({ ms }, `<span class="st-mare">⚡</span><b>${ms} ms</b><small>Uită-te pe ecranul mare</small>`);
      }
    };
    const to = setTimeout(() => {
      faza = 'verde';
      t0 = performance.now();
      b.className = 'semafor-tel verde';
      b.innerHTML = '<span class="st-mare">👆</span><b>APASĂ!</b>';
      vibreaza(40);
      to2 = setTimeout(() => {
        if (faza === 'verde') termina({ ms: 2000 }, '<span class="st-mare">😴</span><b>Prea încet!</b>');
      }, 2000);
      if (AUTO) auto = setTimeout(apasa, 180 + Math.random() * 300);
    }, v.intarziere);
    b.addEventListener('pointerdown', apasa);
    return () => {
      clearTimeout(to);
      clearTimeout(to2);
      clearTimeout(auto);
    };
  },

  cronometru(v, el) {
    const t0 = performance.now();
    let oprit = false;
    let raf = 0;
    el.innerHTML = `<div class="centru">
      <p class="text-lung">Oprește la exact <b>${v.tinta},00 s</b></p>
      <div class="ceas" id="ceas">0,00</div>
      <button type="button" class="buton-mare" id="b-stop">STOP ✋</button>
      <p class="mic" id="nota">Cronometrul dispare după 2 secunde. Numără în gând!</p>
    </div>`;
    const ceas = $('#ceas');
    const cadru = () => {
      const t = performance.now() - t0;
      ceas.textContent = t < v.vizibil ? sec(t) : '?,??';
      ceas.classList.toggle('ascuns', t >= v.vizibil);
      if (!oprit) raf = requestAnimationFrame(cadru);
    };
    raf = requestAnimationFrame(cadru);
    const stop = (e) => {
      e?.preventDefault?.();
      if (oprit) return;
      oprit = true;
      cancelAnimationFrame(raf);
      const ms = Math.round(performance.now() - t0);
      raspunde(v, { ms });
      ceas.textContent = sec(ms);
      ceas.classList.remove('ascuns');
      $('#b-stop').disabled = true;
      $('#nota').textContent = 'Vezi pe ecranul mare cât de aproape ai fost!';
      vibreaza(40);
    };
    $('#b-stop').addEventListener('pointerdown', stop);
    const lim = setTimeout(stop, v.tinta * 2000 + 4000);
    const auto = AUTO ? setTimeout(stop, v.tinta * 1000 + (Math.random() - 0.5) * 3000) : 0;
    return () => {
      oprit = true;
      cancelAnimationFrame(raf);
      clearTimeout(lim);
      clearTimeout(auto);
    };
  },

  cate(v, el) {
    let val = '';
    let trimis = false;
    el.innerHTML = `<div class="sus"><h2>Câte ${esc(v.emoji)} erau?</h2></div>
      <div class="afisaj" id="afis">?</div>
      <div class="tastatura">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map((k) => `<button type="button" class="tasta ${k === '✓' ? 'ok' : ''}" data-k="${k}">${k}</button>`).join('')}</div>`;
    const afis = $('#afis');
    const apasa = (k) => {
      if (trimis) return;
      if (k === '⌫') val = val.slice(0, -1);
      else if (k === '✓') {
        if (!val) return;
        trimis = true;
        raspunde(v, { nr: +val });
        afis.classList.add('trimis');
        afis.textContent = val + ' ✓';
        el.querySelector('.tastatura').classList.add('stinsa');
        vibreaza(30);
        return;
      } else if (val.length < 3) val = (val === '0' ? '' : val) + k;
      afis.textContent = val || '?';
      vibreaza(8);
    };
    el.querySelectorAll('.tasta').forEach((b) => b.addEventListener('click', () => apasa(b.dataset.k)));
    if (AUTO) {
      const t = setTimeout(() => {
        String(5 + aleator(20)).split('').forEach(apasa);
        apasa('✓');
      }, 1200 + Math.random() * 2000);
      return () => clearTimeout(t);
    }
  },

  memorie(v, el) {
    let idx = 0;
    let gata = false;
    el.innerHTML = `<div class="sus"><h2>Repetă ordinea!</h2><div class="progres" id="prog">${v.secv.map(() => '<i></i>').join('')}</div></div>
      <div class="paduri">${PADURI_MEMORIE.map((p, i) => `<button type="button" class="pad" data-i="${i}" style="--c:${p.c}">${p.e}</button>`).join('')}</div>`;
    const termina = (emoji, titlu, text) => setTimeout(() => {
      el.innerHTML = `<div class="centru"><div class="mare-emoji">${emoji}</div><h2>${titlu}</h2><p class="text-lung">${text}</p></div>`;
    }, 350);
    const apasa = (i, b) => {
      if (gata) return;
      if (b) {
        b.classList.remove('aprins');
        void b.offsetWidth;
        b.classList.add('aprins');
      }
      if (i === v.secv[idx]) {
        $('#prog').children[idx].classList.add('ok');
        idx++;
        vibreaza(15);
        if (idx === v.secv.length) {
          gata = true;
          raspunde(v, { ok: true });
          flash('bine');
          termina('✅', 'Corect!', 'Așteaptă runda următoare…');
        }
      } else {
        gata = true;
        vibreaza([80, 50, 80]);
        flash('rau');
        raspunde(v, { ok: false });
        termina('❌', 'Greșit!', 'Ai ieșit din joc. Urmărește-i pe ceilalți!');
      }
    };
    el.querySelectorAll('.pad').forEach((b) => b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      apasa(+b.dataset.i, b);
    }));
    if (AUTO) {
      const greseste = Math.random() < 0.2;
      let k = 0;
      const iv = setInterval(() => {
        if (gata) return clearInterval(iv);
        const corect = v.secv[k++];
        apasa(greseste && k === v.secv.length ? (corect + 1) % 4 : corect);
      }, 450);
      return () => clearInterval(iv);
    }
  },

  balon(v, el) {
    if (v.spart) {
      el.innerHTML = '<div class="centru"><div class="mare-emoji bum">💥</div><h2>BUM!</h2><p class="text-lung">Ai ținut prea mult… Uită-te pe ecranul mare!</p></div>';
      vibreaza([200, 80, 200]);
      return;
    }
    let jos = null;
    let gata = false;
    let raf = 0;
    el.innerHTML = `<div class="centru">
      <div class="balon-zona"><div class="balon-tel" id="bal" style="--c:${culoare()}"></div></div>
      <button type="button" class="buton-tine" id="b-tine">ȚINE APĂSAT</button>
      <p class="mic" id="nota">Dă drumul înainte să explodeze! 💥</p>
    </div>`;
    const bal = $('#bal');
    const b = $('#b-tine');
    const cadru = () => {
      const ms = performance.now() - jos;
      bal.style.transform = `scale(${0.4 + (Math.min(ms, 9000) / 9000) * 1.3})`;
      raf = requestAnimationFrame(cadru);
    };
    const apasa = (e) => {
      e?.preventDefault?.();
      if (gata || jos != null) return;
      try { if (e?.pointerId != null) b.setPointerCapture(e.pointerId); } catch { /* nimic */ }
      jos = performance.now();
      raspunde(v, { jos: true });
      b.classList.add('apasat');
      b.textContent = 'UMFLĂ… 😬';
      raf = requestAnimationFrame(cadru);
      vibreaza(20);
    };
    const lasa = () => {
      if (gata || jos == null) return;
      gata = true;
      cancelAnimationFrame(raf);
      raspunde(v, { sus: true });
      const ms = performance.now() - jos;
      b.classList.remove('apasat');
      b.disabled = true;
      b.textContent = `Ai oprit la ${sec(ms)} s`;
      $('#nota').textContent = 'Vezi pe ecranul mare dacă ai câștigat!';
    };
    b.addEventListener('pointerdown', apasa);
    b.addEventListener('pointerup', lasa);
    b.addEventListener('pointercancel', lasa);
    b.addEventListener('lostpointercapture', lasa);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    let auto1 = 0;
    let auto2 = 0;
    if (AUTO) {
      auto1 = setTimeout(() => {
        apasa();
        auto2 = setTimeout(lasa, 1500 + Math.random() * 6000);
      }, 500 + Math.random() * 1500);
    }
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(auto1);
      clearTimeout(auto2);
    };
  },
};

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

(function porneste() {
  if (AUTO && !st.nume) st.nume = 'Bot ' + (SLOT || aleator(99));
  let intratDeja = null;
  try { intratDeja = sessionStorage.getItem('hlt-intrat' + SLOT); } catch { /* nimic */ }
  if (st.cod.length === 4 && st.nume && (intratDeja === st.cod || AUTO)) {
    intra(); // refresh in timpul jocului: intram direct inapoi
  } else {
    arataIntrare();
    if (st.cod.length === 4) $('#in-nume').focus();
  }
})();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
