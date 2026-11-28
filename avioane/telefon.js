'use strict';
// Avioanele – telefonul: îți așezi avioanele în secret, tragi când e rândul tău
// și vezi unde au tras ceilalți în tabla ta.

function grilaHtml(n, celula, tag = 'button') {
  let html = '<span class="eti"></span>';
  for (let c = 0; c < n; c++) html += `<span class="eti">${COLOANE[c]}</span>`;
  for (let r = 0; r < n; r++) {
    html += `<span class="eti">${r + 1}</span>`;
    for (let c = 0; c < n; c++) {
      const [cls, txt] = celula(r, c);
      html += `<${tag} ${tag === 'button' ? 'type="button" ' : ''}class="cel ${cls}" data-r="${r}" data-c="${c}">${txt}</${tag}>`;
    }
  }
  return html;
}

Object.assign(VEDERI, {
  // ---------- așezarea avioanelor ----------
  aseaza(v, el) {
    const { n, k } = v;
    let av = curataAvioane(v.avioane, n, k) || asezareAleatoare(n, k);
    let sel = 0;
    let gata = false;
    el.innerHTML = `${baraTimp(v.durata, v.ramas ?? v.durata)}
      <div class="sus">
        <h2>✈️ Așază-ți avioanele</h2>
        <p class="mic">Atinge un avion ca să-l alegi, apoi atinge un loc liber: acolo va fi <b>capul</b>. Atinge avionul ales ca să-l rotești.</p>
      </div>
      <div class="grila-tel" id="grila" style="grid-template-columns:repeat(${n + 1},1fr);--c:${culoare()}"></div>
      <div class="butoane-asezare">
        <button type="button" class="buton" id="b-aleator">🎲 Altă așezare</button>
        <button type="button" class="buton" id="b-roteste">🔄 Rotește</button>
      </div>
      <button type="button" class="buton principal mare" id="b-gata">✅ Gata, sunt în aer!</button>`;
    const grila = $('#grila');
    const deseneaza = () => {
      const h = hartaAvioane(av, n);
      grila.innerHTML = grilaHtml(n, (r, c) => {
        const p = h.get(r * n + c);
        if (!p) return ['', ''];
        return [`p${p.i}${p.i === sel ? ' sel' : ''}${p.cap ? ' capul' : ''}`, ''];
      });
    };
    let tCiorna = 0;
    const trimiteCiorna = (final = false) => trimite({ t: 'aseaza', cheie: v.cheie, avioane: av, gata: final });
    const schimbat = () => {
      deseneaza();
      clearTimeout(tCiorna);
      tCiorna = setTimeout(() => trimiteCiorna(), 400);
      vibreaza(10);
    };
    const rotesteSel = () => {
      const altele = av.filter((_, i) => i !== sel);
      for (let d = 1; d < 4; d++) {
        const cand = { ...av[sel], dir: (av[sel].dir + d) % 4 };
        if (poateSta(cand, altele, n)) {
          av[sel] = cand;
          schimbat();
          return;
        }
      }
      tremura(grila);
      vibreaza(60);
    };
    grila.addEventListener('click', (e) => {
      const b = e.target.closest('.cel');
      if (!b || gata) return;
      const r = +b.dataset.r;
      const c = +b.dataset.c;
      const p = hartaAvioane(av, n).get(r * n + c);
      if (p && p.i !== sel) {
        sel = p.i;
        deseneaza();
        vibreaza(10);
        return;
      }
      if (p) {
        rotesteSel();
        return;
      }
      // loc liber: mutăm avionul ales cu capul aici (dacă nu încape așa, încercăm alte direcții)
      const altele = av.filter((_, i) => i !== sel);
      for (let d = 0; d < 4; d++) {
        const cand = { r, c, dir: (av[sel].dir + d) % 4 };
        if (poateSta(cand, altele, n)) {
          av[sel] = cand;
          schimbat();
          return;
        }
      }
      tremura(grila);
      vibreaza(60);
    });
    $('#b-roteste').addEventListener('click', () => { if (!gata) rotesteSel(); });
    $('#b-aleator').addEventListener('click', () => {
      if (gata) return;
      av = asezareAleatoare(n, k) || av;
      schimbat();
    });
    $('#b-gata').addEventListener('click', () => {
      if (gata) return;
      gata = true;
      clearTimeout(tCiorna);
      trimiteCiorna(true);
      sel = -1;
      deseneaza();
      for (const b of $$('.butoane-asezare .buton', el)) b.disabled = true;
      const b = $('#b-gata');
      b.disabled = true;
      b.textContent = 'Trimis ✓';
      vibreaza(30);
    });
    deseneaza();
    trimiteCiorna();
    const auto = AUTO ? setTimeout(() => $('#b-gata')?.click(), 800 + Math.random() * 1500) : 0;
    return () => {
      clearTimeout(tCiorna);
      clearTimeout(auto);
    };
  },

  // ---------- e rândul tău să tragi ----------
  trage(v, el) {
    const n = v.n;
    const tinte = v.tinte || [];
    let tinta = tinte.find((t) => t.id === v.implicit) || tinte[0];
    let sel = null;
    let trimis = false;
    const multe = tinte.length > 1;
    el.innerHTML = `${baraTimp(v.durata, v.ramas ?? v.durata)}
      <div class="sus">
        <h2>🎯 E rândul tău!</h2>
        <p class="mic">${multe ? 'Alege în cine tragi, apoi o căsuță.' : 'Alege o căsuță în care tragi.'}</p>
      </div>
      ${multe
        ? `<div class="tinte">${tinte.map((t) => `<button type="button" class="tinta-b" data-id="${esc(t.id)}" style="--c:${t.culoare}"><span>${esc(t.avatar)}</span><b>${esc(t.nume)}</b><small>✈️ ${t.ramase}</small></button>`).join('')}</div>`
        : `<p class="tinta-unica">Tragi în tabla lui <b style="color:${tinta.culoare}">${esc(tinta.avatar)} ${esc(tinta.nume)}</b> · mai are ✈️ ${tinta.ramase}</p>`}
      <div class="grila-tel" id="grila" style="grid-template-columns:repeat(${n + 1},1fr)"></div>
      <button type="button" class="buton principal mare" id="b-trage" disabled>Alege o căsuță</button>`;
    const grila = $('#grila');
    const bT = $('#b-trage');
    const stiut = () => new Map(tinta.lovituri.map(([r, c, rez]) => [r * n + c, rez]));
    const dobCel = () => hartaAvioane(tinta.doborate, n);
    const liber = (r, c) => !stiut().has(r * n + c) && !dobCel().has(r * n + c);
    const deseneaza = () => {
      const m = stiut();
      const dob = dobCel();
      grila.style.setProperty('--c', tinta.culoare);
      grila.innerHTML = grilaHtml(n, (r, c) => {
        const x = r * n + c;
        const rez = m.get(x);
        const p = dob.get(x);
        const ales = sel && sel[0] === r && sel[1] === c;
        const cls = [];
        if (p) cls.push('avion');
        if (rez) cls.push(rez);
        if (ales) cls.push('tintit');
        return [cls.join(' '), rez === 'lovit' ? '🔥' : rez === 'cap' ? '💀' : ales ? '🎯' : ''];
      });
      for (const b of $$('.tinta-b', el)) b.classList.toggle('aleasa', b.dataset.id === tinta.id);
    };
    const foc = () => {
      if (!sel || trimis) return;
      trimis = true;
      trimite({ t: 'trage', cheie: v.cheie, tinta: tinta.id, r: sel[0], c: sel[1] });
      bT.disabled = true;
      bT.textContent = 'Foc! 💥 Uită-te pe ecranul mare';
      vibreaza([40, 30, 80]);
    };
    const alege = (r, c) => {
      if (trimis) return;
      if (!liber(r, c)) {
        tremura(grila);
        vibreaza(60);
        return;
      }
      if (sel && sel[0] === r && sel[1] === c) {
        foc();
        return;
      }
      sel = [r, c];
      trimite({ t: 'tinteste', cheie: v.cheie, tinta: tinta.id, r, c });
      bT.disabled = false;
      bT.textContent = `🎯 Trage în ${eticheta(r, c)}!`;
      vibreaza(10);
      deseneaza();
    };
    grila.addEventListener('click', (e) => {
      const b = e.target.closest('.cel');
      if (b) alege(+b.dataset.r, +b.dataset.c);
    });
    bT.addEventListener('click', foc);
    el.querySelectorAll('.tinta-b').forEach((b) => b.addEventListener('click', () => {
      if (trimis) return;
      tinta = tinte.find((t) => t.id === b.dataset.id) || tinta;
      sel = null;
      bT.disabled = true;
      bT.textContent = 'Alege o căsuță';
      deseneaza();
      vibreaza(10);
    }));
    deseneaza();
    vibreaza([90, 60, 90]);
    if (AUTO) {
      const t = setTimeout(() => {
        tinta = alegeUnul(tinte);
        const libere = [];
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (liber(r, c)) libere.push([r, c]);
        const [r, c] = alegeUnul(libere);
        alege(r, c);
        setTimeout(foc, 300);
      }, 600 + Math.random() * 900);
      return () => clearTimeout(t);
    }
  },

  // ---------- tabla ta, cu loviturile primite ----------
  apara(v, el) {
    const n = v.n;
    const lov = new Map((v.lovituri || []).map(([r, c, rez]) => [r * n + c, rez]));
    const h = hartaAvioane(v.avioane, n);
    const jos = new Set();
    for (const [x, rez] of lov) if (rez === 'cap' && h.get(x)) jos.add(h.get(x).i);
    const ultima = Array.isArray(v.ultima) ? v.ultima[0] * n + v.ultima[1] : -1;
    el.innerHTML = `<div class="sus"><h2>${esc(v.titlu)}</h2><p class="mic">${esc(v.text)}</p></div>
      <div class="grila-tel mea" style="grid-template-columns:repeat(${n + 1},1fr);--c:${culoare()}">${grilaHtml(n, (r, c) => {
        const x = r * n + c;
        const p = h.get(x);
        const rez = lov.get(x);
        const cls = [];
        if (p) cls.push(`p${p.i}`, jos.has(p.i) ? 'jos' : '', p.cap ? 'capul' : '');
        if (rez) cls.push(rez);
        if (x === ultima) cls.push('boom');
        return [cls.join(' '), rez === 'lovit' ? '🔥' : rez === 'cap' ? '💀' : ''];
      }, 'span')}</div>
      <p class="ramase">✈️ Îți mai zboară <b>${v.ramase}</b> din ${v.k} ${v.k === 1 ? 'avion' : 'avioane'}</p>
      ${reactiiHtml()}`;
    legaReactii(el);
    if (ultima >= 0) {
      const rez = lov.get(ultima);
      if (rez === 'aer') vibreaza(30);
      else {
        vibreaza([200, 80, 200]);
        flash('rau');
      }
    }
  },
});

pornesteTelecomanda();
