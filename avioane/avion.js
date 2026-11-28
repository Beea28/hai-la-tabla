'use strict';
// Avioanele: forma avionului, rotirea și așezarea pe tablă.
// Fișierul e folosit și de ecranul mare, și de telefon.

// avionul cu nasul în sus, față de cap (rând, coloană):
//        X          cap
//    X X X X X      aripi
//        X          corp
//      X X X        coadă
const FORMA = [[0, 0], [1, -2], [1, -1], [1, 0], [1, 1], [1, 2], [2, 0], [3, -1], [3, 0], [3, 1]];
const COLOANE = 'ABCDEFGHIJKL';
const MODURI = {
  clasic: { n: 10, k: 3 },
  rapid: { n: 8, k: 2 },
};

// dir: 0 = nasul în sus, 1 = spre dreapta, 2 = în jos, 3 = spre stânga
function roteste([dr, dc], dir) {
  for (let i = 0; i < dir; i++) [dr, dc] = [dc, -dr];
  return [dr, dc];
}

// căsuțele unui avion; prima e capul
function celule(av) {
  return FORMA.map((o) => {
    const [dr, dc] = roteste(o, av.dir);
    return [av.r + dr, av.c + dc];
  });
}

const eticheta = (r, c) => COLOANE[c] + (r + 1);

// căsuță -> { i: al câtelea avion, cap: e capul? }
function hartaAvioane(avioane, n) {
  const h = new Map();
  (avioane || []).forEach((av, i) => celule(av).forEach(([r, c], k) => h.set(r * n + c, { i, cap: k === 0 })));
  return h;
}

// încape avionul pe tablă, fără să se suprapună cu celelalte?
function poateSta(av, altele, n) {
  const ocupat = hartaAvioane(altele, n);
  return celule(av).every(([r, c]) => r >= 0 && c >= 0 && r < n && c < n && !ocupat.has(r * n + c));
}

function asezareValida(avioane, n, k) {
  if (!Array.isArray(avioane) || avioane.length !== k) return false;
  return avioane.every((av, i) => poateSta(av, avioane.slice(0, i), n));
}

function asezareAleatoare(n, k) {
  for (let incercare = 0; incercare < 500; incercare++) {
    const avioane = [];
    for (let i = 0; i < k; i++) {
      for (let t = 0; t < 300; t++) {
        const av = { r: aleator(n), c: aleator(n), dir: aleator(4) };
        if (poateSta(av, avioane, n)) {
          avioane.push(av);
          break;
        }
      }
    }
    if (avioane.length === k) return avioane;
  }
  return null;
}

// ce vine de pe rețea: păstrăm doar numere întregi și verificăm așezarea
function curataAvioane(x, n, k) {
  if (!Array.isArray(x) || x.length !== k) return null;
  const av = x.map((a) => ({ r: a?.r | 0, c: a?.c | 0, dir: ((a?.dir | 0) % 4 + 4) % 4 }));
  return asezareValida(av, n, k) ? av : null;
}
