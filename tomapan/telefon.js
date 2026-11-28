'use strict';
// Țomapan – telefonul: spui STOP pentru literă, scrii cuvintele, verifici răspunsurile celorlalți.

const CHEIE_CIORNA = 'tomapan-ciorna' + SLOT;

// răspunsuri de test pentru modul ?auto
const SILABE = ['ar', 'ina', 'oc', 'elu', 'anda', 'ori', 'ust', 'eta'];

Object.assign(VEDERI, {
  // ---------- tu alegi litera ----------
  'stop-litera'(v, el) {
    el.innerHTML = `<div class="centru">
      <h2>Tu alegi litera! 🔤</h2>
      <p class="text-lung">Literele se schimbă pe ecranul mare.\nApasă STOP când vrei!</p>
      <button type="button" class="buton-stop-litera" id="b-stop"><b>STOP!</b></button>
    </div>`;
    vibreaza([90, 60, 90]);
    let trimis = false;
    const b = $('#b-stop');
    const stop = (e) => {
      e?.preventDefault?.();
      if (trimis) return;
      trimis = true;
      trimite({ t: 'stop-litera', cheie: v.cheie });
      b.classList.add('apasat');
      b.innerHTML = '<b>✋</b>';
      vibreaza(40);
    };
    b.addEventListener('pointerdown', stop);
    const auto = AUTO ? setTimeout(stop, 800 + Math.random() * 1500) : 0;
    return () => clearTimeout(auto);
  },

  // ---------- scrisul ----------
  scrie(v, el) {
    const cats = v.categorii || [];
    const L = v.litera;
    let r = { ...(v.r || {}) };
    try {
      const c = JSON.parse(sessionStorage.getItem(CHEIE_CIORNA));
      if (c?.cheie === v.cheie && c.r) r = { ...r, ...c.r }; // ce e pe telefon e mai nou
    } catch { /* nimic */ }
    el.innerHTML = `
      <div class="scrie-cap">
        <span class="litera-tel">${esc(L)}</span>
        <div class="scrie-info"><b>Cuvinte cu ${esc(L)}</b><small>Atinge un rând și scrie</small></div>
        <span class="timp-text" id="timp-text">${minSecunde(v.ramas ?? v.durata)}</span>
      </div>
      <div id="timp-bara">${baraTimp(v.durata, v.ramas ?? v.durata)}</div>
      <div class="stop-tel" id="stop-tel" hidden></div>
      <div class="campuri">${cats.map((c, i) => `
        <label class="camp-cat">
          <span class="cc-cap"><span class="cc-e">${esc(c.emoji)}</span>${esc(c.nume)}<span class="cc-semn" data-semn="${esc(c.id)}"></span></span>
          <input type="text" data-c="${esc(c.id)}" maxlength="32" autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false"
            enterkeyhint="${i === cats.length - 1 ? 'done' : 'next'}" placeholder="${esc(L)}…" value="${esc(r[c.id] || '')}">
        </label>`).join('')}
      </div>
      <button type="button" class="buton mare buton-stop" id="b-stop" disabled>🛑 STOP! Am terminat</button>
      <p class="mic centrat" id="stop-nota"></p>`;
    const inputs = $$('input[data-c]', el);
    let sfarsit = performance.now() + (v.ramas ?? v.durata);
    let trimisStop = false;

    const citeste = () => {
      const o = {};
      for (const i of inputs) o[i.dataset.c] = i.value;
      return o;
    };
    const pastreazaLocal = () => {
      try { sessionStorage.setItem(CHEIE_CIORNA, JSON.stringify({ cheie: v.cheie, r: citeste() })); } catch { /* nimic */ }
    };
    const trimiteCiorna = (extra = {}) => trimite({ t: 'scrie', cheie: v.cheie, r: citeste(), ...extra });
    const verifica = () => {
      let toate = true;
      for (const i of inputs) {
        const val = i.value.trim();
        const ok = incepeCu(val, L);
        const semn = el.querySelector(`[data-semn="${i.dataset.c}"]`);
        semn.textContent = !val ? '' : ok ? '✓' : `începe cu ${L}!`;
        semn.className = 'cc-semn ' + (!val ? '' : ok ? 'ok' : 'rau');
        i.closest('.camp-cat').classList.toggle('bun', ok);
        if (!ok) toate = false;
      }
      $('#b-stop').disabled = !toate || trimisStop;
      $('#stop-nota').textContent = trimisStop ? 'Ai spus STOP! 🛑' : toate ? 'Ai completat tot! Poți spune STOP.' : 'Completează tot ca să poți spune STOP.';
      return toate;
    };

    let tTrimite = 0;
    inputs.forEach((inp, k) => {
      inp.addEventListener('input', () => {
        verifica();
        pastreazaLocal();
        clearTimeout(tTrimite);
        tTrimite = setTimeout(trimiteCiorna, 450);
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const urm = inputs[k + 1];
        if (urm) urm.focus();
        else inp.blur();
      });
      inp.addEventListener('blur', () => trimiteCiorna());
    });

    $('#b-stop').addEventListener('click', () => {
      if (trimisStop || !verifica()) return;
      trimisStop = true;
      clearTimeout(tTrimite);
      trimiteCiorna({ stop: true });
      vibreaza(60);
      verifica();
    });

    const arataStop = (cine, eu) => {
      const b = $('#stop-tel');
      b.hidden = false;
      b.textContent = eu ? '🛑 Ai spus STOP! Ceilalți mai au câteva secunde.' : `🛑 STOP! ${cine} a terminat. Grăbește-te!`;
    };
    if (v.stop) arataStop(v.stop.nume, v.stop.nume === st.eu?.nume);
    st.ev = (m) => {
      if (m.tip !== 'stop') return;
      sfarsit = performance.now() + m.ramas;
      $('#timp-bara').innerHTML = baraTimp(m.ramas, m.ramas);
      arataStop(m.cine, m.eu);
      if (!m.eu) {
        vibreaza([200, 100, 200]);
        flash('rau');
      }
    };

    const iv = setInterval(() => {
      const ramas = sfarsit - performance.now();
      const t = $('#timp-text');
      if (!t) return;
      t.textContent = minSecunde(ramas);
      t.classList.toggle('urgent', ramas < 10000);
    }, 250);

    verifica();
    if (Object.values(r).some(Boolean)) trimiteCiorna(); // după refresh, retrimitem ce aveam

    const auto = [];
    if (AUTO) {
      inputs.forEach((inp, k) => auto.push(setTimeout(() => {
        inp.value = SLOT !== '1' && Math.random() < 0.08 ? 'X' + alegeUnul(SILABE) : L + alegeUnul(SILABE);
        inp.dispatchEvent(new Event('input'));
      }, 400 + k * (250 + Math.random() * 500))));
      if (SLOT === '1') auto.push(setTimeout(() => $('#b-stop')?.click(), 400 + inputs.length * 800 + 1500));
    }

    return () => {
      clearInterval(iv);
      clearTimeout(tTrimite);
      auto.forEach(clearTimeout);
      trimiteCiorna({ final: true }); // ultimele răspunsuri
      if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
    };
  },

  // ---------- verificarea răspunsurilor celorlalți ----------
  verifica(v, el) {
    const respinse = new Set();
    let gata = false;
    const grupuri = v.grupuri || [];
    el.innerHTML = `${baraTimp(v.durata, v.ramas ?? v.durata)}
      <div class="sus">
        <p class="mic">Categoria ${v.nr} din ${v.total}</p>
        <h2>${esc(v.categorie.emoji)} ${esc(v.categorie.nume)} cu ${esc(v.litera)}</h2>
        <p class="text-lung">E bun? Atinge răspunsurile greșite 👎</p>
      </div>
      <div class="lista-voturi">${grupuri.map((g) => `
        <button type="button" class="vot-b ${g.alMeu ? 'al-meu' : ''}" data-id="${esc(g.id)}" ${g.alMeu ? 'disabled' : ''}>
          <span class="vb-text">${esc(g.text)}</span>
          <span class="vb-cine">${esc(g.avatare)}</span>
          <span class="vb-stare">${g.alMeu ? 'al tău' : '👍'}</span>
        </button>`).join('')}
      </div>
      <button type="button" class="buton principal mare" id="b-gata">Gata ✓</button>`;
    const trimiteVot = () => trimite({ t: 'vot', cheie: v.cheie, respinse: [...respinse], gata });
    const comuta = (b) => {
      if (gata) return;
      const id = b.dataset.id;
      if (respinse.has(id)) respinse.delete(id);
      else respinse.add(id);
      const nu = respinse.has(id);
      b.classList.toggle('respins', nu);
      b.querySelector('.vb-stare').textContent = nu ? '👎' : '👍';
      vibreaza(15);
      trimiteVot();
    };
    el.querySelectorAll('.vot-b:not(.al-meu)').forEach((b) => b.addEventListener('click', () => comuta(b)));
    const b = $('#b-gata');
    const termina = () => {
      if (gata) return;
      gata = true;
      trimiteVot();
      b.disabled = true;
      b.textContent = 'Trimis ✓';
      el.querySelectorAll('.vot-b').forEach((x) => { x.disabled = true; });
      el.insertAdjacentHTML('beforeend', '<p class="trimis">Uită-te pe ecranul mare 👀</p>');
      vibreaza(30);
    };
    b.addEventListener('click', termina);
    if (AUTO) {
      const t = setTimeout(() => {
        const bs = el.querySelectorAll('.vot-b:not(.al-meu)');
        if (bs.length && Math.random() < 0.3) comuta(bs[aleator(bs.length)]);
        termina();
      }, 600 + Math.random() * 1600);
      return () => clearTimeout(t);
    }
  },
});

pornesteTelecomanda();
