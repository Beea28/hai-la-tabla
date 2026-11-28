'use strict';
// Țomapan: categoriile, literele și cum verificăm un răspuns.
// Fișierul e folosit și de ecranul mare, și de telefon. Categoriile se pot completa liber.

const CATEGORII = [
  { id: 'tari', nume: 'Țări', emoji: '🌍', clasic: true },
  { id: 'orase', nume: 'Orașe', emoji: '🏙️', clasic: true },
  { id: 'munti', nume: 'Munți', emoji: '⛰️', clasic: true },
  { id: 'ape', nume: 'Ape', emoji: '🌊', clasic: true },
  { id: 'plante', nume: 'Plante', emoji: '🌿', clasic: true },
  { id: 'animale', nume: 'Animale', emoji: '🐾', clasic: true },
  { id: 'nume', nume: 'Nume', emoji: '👤', clasic: true },
  { id: 'mancare', nume: 'Mâncare', emoji: '🍕' },
  { id: 'meserii', nume: 'Meserii', emoji: '👷' },
  { id: 'obiecte', nume: 'Obiecte', emoji: '🧸' },
  { id: 'sporturi', nume: 'Sporturi', emoji: '⚽' },
  { id: 'vedete', nume: 'Vedete', emoji: '⭐' },
  { id: 'filme', nume: 'Filme', emoji: '🎬' },
];
const CATEGORII_CLASICE = CATEGORII.filter((c) => c.clasic).map((c) => c.id);

// literele din joc: fără K, Q, W, X, Y și fără diacritice (sunt prea grele)
const LITERE = 'ABCDEFGHIJLMNOPRSTUVZ'.split('');

// cuvinte de început care se pot sări: „Lacul Bâlea” e bun și la B, „Marea Neagră” și la N
const PREFIXE = new Set([
  'raul', 'lacul', 'marea', 'oceanul', 'fluviul', 'paraul', 'izvorul', 'cascada', 'balta', 'delta', 'golful', 'canalul',
  'muntii', 'muntele', 'masivul', 'varful', 'dealul', 'pestera', 'orasul', 'satul', 'comuna', 'insula', 'insulele',
  'tara', 'republica', 'regatul', 'statul', 'sf', 'sfantul',
]);

function normal(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function cuvinte(s) {
  return normal(s).split(/[^a-z0-9]+/).filter(Boolean);
}

// răspunsul începe cu litera cerută? (fără să conteze diacriticele sau majusculele)
function incepeCu(text, litera) {
  const c = cuvinte(text);
  if (!c.length || c.join('').length < 2) return false;
  const l = normal(litera);
  if (c[0][0] === l) return true;
  return c.length > 1 && PREFIXE.has(c[0]) && c[1][0] === l;
}

// două răspunsuri sunt „la fel” dacă diferă doar prin diacritice, spații, majuscule sau cuvântul de început
function cheieGrup(text) {
  const c = cuvinte(text);
  if (c.length > 1 && PREFIXE.has(c[0])) c.shift();
  return c.join('');
}

const minSecunde = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
