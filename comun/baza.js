'use strict';
// Lucruri comune pentru Țomapan și Avioanele (și pe ecranul mare, și pe telefon).

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pauza = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const aleator = (n) => Math.floor(Math.random() * n);
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

const AVATARE = ['🦊', '🐼', '🐸', '🐯', '🐵', '🦄', '🐙', '🐧', '🐨', '🐷', '🐰', '🦁', '🐶', '🐱', '🐻', '🐔'];

// culori pentru jucatori (maxim 8), lizibile pe alb
const CULORI = ['#e11d48', '#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#ca8a04', '#db2777'];

const REACTII = ['😂', '👏', '😱', '🔥', '😭', '🥳'];
