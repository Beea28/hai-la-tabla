'use strict';
// Avioanele: cum joacă calculatorul. Se uită doar la ce se vede pe ecran
// (unde s-a tras, ce a ieșit, avioanele doborâte), nu la avioanele ascunse.
//
// Două feluri de a trage:
//  - „ca un om”: oriunde pe tablă, iar după o lovitură încearcă pe lângă ea;
//  - „gândit”: socotește toate locurile posibile ale avioanelor și trage unde e cel mai probabil un cap.
// Nivelul spune cât de des gândește și cât de des caută pe lângă lovituri.

const NIVELURI = {
  usor: { nume: 'Ușor', text: 'trage mai mult la nimereală', gandeste: 0, peLanga: 0.5 },
  mediu: { nume: 'Mediu', text: 'joacă cam ca un om atent', gandeste: 0.12, peLanga: 0.9 },
  greu: { nume: 'Greu', text: 'socotește fiecare tragere', gandeste: 1, peLanga: 1 },
};

// tinte: [{ id, lovituri: [{ r, c, rez }], doborate: [{ r, c, dir }], ramase }]
// întoarce { id, r, c }: în cine și unde trage
function tragereCalculator(tinte, n, nivel = 'mediu') {
  const N = NIVELURI[nivel] || NIVELURI.mediu;
  const info = tinte.map((t) => {
    const stiut = new Map(t.lovituri.map((l) => [l.r * n + l.c, l.rez]));
    const dob = new Set();
    for (const av of t.doborate) for (const [r, c] of celule(av)) dob.add(r * n + c);
    // pătrățele lovite din avioane încă nedoborâte
    const deschise = t.lovituri.filter((l) => l.rez === 'lovit' && !dob.has(l.r * n + l.c));
    return { t, stiut, dob, deschise };
  });

  // în ce tablă trage: întâi unde a nimerit deja un avion nedoborât
  let alese = info;
  const cuLovituri = info.filter((x) => x.deschise.length);
  if (cuLovituri.length && Math.random() < N.peLanga) alese = cuLovituri;
  else if (N.gandeste >= 1) {
    // nivelul greu: îl atacă pe cel care mai are cele mai puține avioane
    const min = Math.min(...info.map((x) => x.t.ramase));
    alese = info.filter((x) => x.t.ramase === min);
  }
  const x0 = alegeUnul(alese);
  const { t, stiut, dob, deschise } = x0;
  const libera = (r, c) => r >= 0 && c >= 0 && r < n && c < n && !stiut.has(r * n + c) && !dob.has(r * n + c);
  const rasp = (x) => ({ id: t.id, r: Math.floor(x / n), c: x % n });

  const libere = [];
  for (let x = 0; x < n * n; x++) if (!stiut.has(x) && !dob.has(x)) libere.push(x);

  if (Math.random() >= N.gandeste) {
    // ca un om: pe lângă o lovitură, sau oriunde
    if (deschise.length && Math.random() < N.peLanga) {
      const vecini = [];
      for (const l of deschise) {
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          if (libera(l.r + dr, l.c + dc)) vecini.push((l.r + dr) * n + l.c + dc);
        }
      }
      if (vecini.length) return rasp(alegeUnul(vecini));
    }
    return rasp(alegeUnul(libere));
  }

  // gândit: pentru fiecare loc posibil al unui avion, unde i-ar fi capul?
  // un avion nu poate trece prin „aer” sau prin avioane doborâte; dacă acoperă pătrățele lovite, e mai probabil
  const scor = new Array(n * n).fill(0);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      for (let dir = 0; dir < 4; dir++) {
        let ok = true;
        let acopera = 0;
        const cel = celule({ r, c, dir });
        for (let k = 0; k < cel.length && ok; k++) {
          const [rr, cc] = cel[k];
          if (rr < 0 || cc < 0 || rr >= n || cc >= n) { ok = false; break; }
          const x = rr * n + cc;
          const s = stiut.get(x);
          if (dob.has(x) || s === 'aer' || (k === 0 && s)) ok = false;
          else if (s === 'lovit') acopera++;
        }
        if (ok) scor[r * n + c] += 1 + 40 * acopera * acopera;
      }
    }
  }
  const max = Math.max(...libere.map((x) => scor[x]));
  return rasp(alegeUnul(libere.filter((y) => scor[y] === max)));
}
