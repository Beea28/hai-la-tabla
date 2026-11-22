// Legatura laptop <-> telefoane, direct prin WebRTC (PeerJS).
// Serverul public gratuit PeerJS face doar „prezentarea” (cine cu cine vorbeste);
// datele jocului circula direct intre telefon si laptop. Nu avem server propriu,
// deci site-ul poate sta pe GitHub Pages, ca orice pagina statica.

const RETEA = (() => {
  const PREFIX = 'hailatabla-v1-';
  const LITERE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // fara I si O, ca sa nu se confunde cu 1 si 0

  function codNou() {
    let c = '';
    for (let i = 0; i < 4; i++) c += LITERE[Math.floor(Math.random() * LITERE.length)];
    return c;
  }

  function curataCod(c) {
    return String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  }

  // ---------------- Laptopul (gazda) ----------------
  // h: { deschis(cod), mesaj(conn, m), inchis(conn), stare(text), codOcupat() }
  function gazda(cod, h) {
    let peer = null;
    let oprit = false;
    let incercari = 0;
    let timer = null;

    function porneste() {
      if (oprit) return;
      h.stare?.('conectare');
      peer = new Peer(PREFIX + cod, { debug: 1 });
      const p = peer;
      p.on('open', () => {
        incercari = 0;
        h.stare?.('online');
        h.deschis?.(cod);
      });
      p.on('connection', (conn) => {
        conn.on('data', (m) => {
          if (m && typeof m === 'object') h.mesaj?.(conn, m);
        });
        conn.on('close', () => h.inchis?.(conn));
        conn.on('error', () => h.inchis?.(conn));
      });
      p.on('disconnected', () => {
        // legatura cu serverul de „prezentare” s-a pierdut; jucatorii deja conectati merg in continuare
        if (oprit || p !== peer) return;
        h.stare?.('reconectare');
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!oprit && p === peer && !p.destroyed && p.disconnected) {
            try { p.reconnect(); } catch { reporneste(2000); }
          }
        }, 1500);
      });
      p.on('error', (e) => {
        if (oprit || p !== peer) return;
        if (e.type === 'unavailable-id') {
          // codul e inca ocupat (de ex. dupa un refresh rapid) - mai incercam putin, apoi cerem cod nou
          incercari++;
          if (incercari > 8) {
            h.codOcupat?.();
            return;
          }
          h.stare?.('cod-ocupat');
          reporneste(2500);
          return;
        }
        if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
          h.stare?.('fara-internet');
          reporneste(3000);
        }
        // alte erori (ex. un telefon care a plecat) nu opresc camera
      });
    }

    function reporneste(ms) {
      clearTimeout(timer);
      try { peer?.destroy(); } catch { /* nimic */ }
      peer = null;
      timer = setTimeout(porneste, ms);
    }

    porneste();

    return {
      opreste() {
        oprit = true;
        clearTimeout(timer);
        try { peer?.destroy(); } catch { /* nimic */ }
      },
    };
  }

  // ---------------- Telefonul (jucator) ----------------
  // h: { conectat(), mesaj(m), stare(text) }
  function jucator(cod, h) {
    let peer = null;
    let conn = null;
    let oprit = false;
    let timer = null;
    let ultim = 0;

    function porneste() {
      if (oprit) return;
      try { peer?.destroy(); } catch { /* nimic */ }
      conn = null;
      h.stare?.('conectare');
      peer = new Peer({ debug: 1 });
      const p = peer;
      p.on('open', () => { if (p === peer) leaga(); });
      p.on('error', (e) => {
        if (oprit || p !== peer) return;
        if (e.type === 'peer-unavailable') {
          h.stare?.('negasit');
          programeaza(2500);
        } else if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(e.type)) {
          h.stare?.('fara-internet');
          programeaza(3000, true);
        }
      });
      p.on('disconnected', () => {
        if (oprit || p !== peer) return;
        // daca legatura directa cu laptopul inca merge, doar ne reconectam la server in liniste
        if (conn && conn.open) {
          setTimeout(() => { try { if (p === peer && !p.destroyed && p.disconnected) p.reconnect(); } catch { /* nimic */ } }, 1000);
        } else {
          programeaza(2000, true);
        }
      });
    }

    function leaga() {
      if (oprit) return;
      try { conn?.close(); } catch { /* nimic */ }
      const c = peer.connect(PREFIX + cod, { serialization: 'json', reliable: true });
      conn = c;
      const limita = setTimeout(() => {
        if (c === conn && !c.open) programeaza(500, true);
      }, 9000);
      c.on('open', () => {
        clearTimeout(limita);
        if (c !== conn) return;
        ultim = Date.now();
        h.stare?.('online');
        h.conectat?.();
      });
      c.on('data', (m) => {
        if (c !== conn) return;
        ultim = Date.now();
        if (!m || typeof m !== 'object' || m.t === 'pong') return;
        h.mesaj?.(m);
      });
      c.on('close', () => {
        if (c !== conn || oprit) return;
        h.stare?.('pierdut');
        programeaza(1200);
      });
      c.on('error', () => {
        if (c !== conn || oprit) return;
        programeaza(1200);
      });
    }

    // refacere: daca peer-ul e bun, refacem doar legatura; altfel o luam de la capat
    function programeaza(ms, peerNou = false) {
      if (oprit) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!peerNou && peer && !peer.destroyed && peer.open) leaga();
        else porneste();
      }, ms);
    }

    // „ping” regulat: asa observam repede daca legatura a murit (ex. ecran blocat)
    const puls = setInterval(() => {
      if (oprit || !conn || !conn.open) return;
      try { conn.send({ t: 'ping' }); } catch { /* nimic */ }
      if (Date.now() - ultim > 8000) {
        h.stare?.('pierdut');
        programeaza(0, true);
      }
    }, 2000);

    porneste();

    return {
      trimite(m) {
        if (!conn || !conn.open) return false;
        try { conn.send(m); return true; } catch { return false; }
      },
      verifica() {
        // apelat cand telefonul revine in aplicatie
        if (oprit) return;
        if (!conn || !conn.open || Date.now() - ultim > 5000) programeaza(0, !peer || peer.destroyed || peer.disconnected);
      },
      opreste() {
        oprit = true;
        clearInterval(puls);
        clearTimeout(timer);
        try { conn?.close(); } catch { /* nimic */ }
        try { peer?.destroy(); } catch { /* nimic */ }
      },
    };
  }

  return { codNou, curataCod, gazda, jucator };
})();
