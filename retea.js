// Legatura laptop <-> telefoane prin servere publice gratuite MQTT (WebSocket securizat).
// Nu avem server propriu: laptopul si telefoanele isi lasa mesaje pe un „canal” al camerei.
// Laptopul asculta pe toate serverele din lista; telefonul il foloseste pe primul care merge.
// Asa jocul merge si pe date mobile sau pe retele Wi-Fi diferite.

const RETEA = (() => {
  const PREFIX = 'hailatabla/v2/';
  const BROKERI = [
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://broker.emqx.io:8084/mqtt',
    'wss://test.mosquitto.org:8081/mqtt',
  ];
  const LITERE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // fara I si O, ca sa nu se confunde cu 1 si 0
  const ID_CONN = /^[a-z0-9]{6,24}$/;

  const idNou = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => (b % 36).toString(36)).join('');

  function codNou() {
    let c = '';
    for (let i = 0; i < 4; i++) c += LITERE[Math.floor(Math.random() * LITERE.length)];
    return c;
  }

  function curataCod(c) {
    return String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  }

  function client(url) {
    const c = mqtt.connect(url, {
      clientId: 'hlt_' + idNou(10),
      clean: true,
      keepalive: 20,
      connectTimeout: 8000,
      reconnectPeriod: 2500,
      resubscribe: true,
    });
    c.on('error', () => { /* reincearca singur */ });
    return c;
  }

  function citeste(payload) {
    try {
      const d = JSON.parse(typeof payload === 'string' ? payload : new TextDecoder().decode(payload));
      return d && typeof d === 'object' ? d : null;
    } catch {
      return null;
    }
  }

  // ---------------- Laptopul (gazda) ----------------
  // h: { mesaj(conn, m), inchis(conn), stare(text) }
  function gazda(cod, h) {
    const canal = PREFIX + cod + '/h';
    const conexiuni = new Map(); // „broker:telefon” -> conexiune
    let oprit = false;

    const clienti = BROKERI.map((url, idx) => {
      const c = client(url);
      c.on('connect', () => {
        c.subscribe(canal, { qos: 0 });
        stare();
      });
      c.on('close', stare);
      c.on('offline', stare);
      c.on('message', (topic, payload) => {
        const d = citeste(payload);
        if (!d || !ID_CONN.test(String(d.c)) || !d.m || typeof d.m !== 'object') return;
        const cheie = idx + ':' + d.c;
        let conn = conexiuni.get(cheie);
        if (!conn) {
          conn = conexiune(d.c, c, cheie);
          conexiuni.set(cheie, conn);
        }
        conn.ultim = Date.now();
        if (d.m.t === '__inchis') {
          conexiuni.delete(cheie);
          conn.inchisa = true;
          h.inchis?.(conn);
          return;
        }
        h.mesaj?.(conn, d.m);
      });
      return c;
    });

    // o „conexiune” = un telefon pe un anumit server; are aceeasi forma ca o conexiune obisnuita
    function conexiune(cid, c, cheie) {
      const topic = PREFIX + cod + '/p/' + cid;
      const conn = {
        cid,
        inchisa: false,
        ultim: Date.now(),
        get open() { return !conn.inchisa && c.connected; },
        send(m) {
          if (!conn.inchisa) c.publish(topic, JSON.stringify(m), { qos: 0 });
        },
        close() {
          if (conn.inchisa) return;
          try { c.publish(topic, JSON.stringify({ t: '__inchis' }), { qos: 0 }); } catch { /* nimic */ }
          conn.inchisa = true;
          conexiuni.delete(cheie);
          h.inchis?.(conn);
        },
      };
      return conn;
    }

    const t0 = Date.now();
    function stare() {
      if (oprit) return;
      if (clienti?.some((c) => c.connected)) h.stare?.('online');
      else h.stare?.(Date.now() - t0 > 12000 ? 'fara-internet' : 'conectare');
    }
    h.stare?.('conectare');
    const verificare = setInterval(stare, 4000);

    // curatam conexiunile telefoanelor disparute de mult
    const curatenie = setInterval(() => {
      const acum = Date.now();
      for (const [k, conn] of conexiuni) if (acum - conn.ultim > 180000) conexiuni.delete(k);
    }, 60000);

    return {
      opreste() {
        oprit = true;
        clearInterval(verificare);
        clearInterval(curatenie);
        for (const c of clienti) { try { c.end(true); } catch { /* nimic */ } }
      },
    };
  }

  // ---------------- Telefonul (jucator) ----------------
  // h: { conectat(), mesaj(m), stare(text) }
  function jucator(cod, h) {
    const cid = idNou(12);
    const canalMeu = PREFIX + cod + '/p/' + cid;
    const canalGazda = PREFIX + cod + '/h';
    let idx = 0;
    let c = null;
    let oprit = false;
    let online = false;
    let ultim = 0; // ultimul mesaj de la laptop
    let conectatLa = 0; // cand ne-am conectat la server
    let pornitLa = 0;
    let timerServer = null;

    function porneste() {
      if (oprit) return;
      try { c?.end(true); } catch { /* nimic */ }
      online = false;
      pornitLa = Date.now();
      conectatLa = 0;
      h.stare?.('conectare');
      const cl = client(BROKERI[idx]);
      c = cl;
      clearTimeout(timerServer);
      timerServer = setTimeout(() => {
        if (cl === c && !cl.connected) schimbaServer();
      }, 9000);
      cl.on('connect', () => {
        if (cl !== c) return;
        clearTimeout(timerServer);
        conectatLa = Date.now();
        cl.subscribe(canalMeu, { qos: 0 }, () => {
          if (cl !== c) return;
          h.stare?.(online ? 'online' : 'caut');
          trimiteBrut({ t: 'ping' });
        });
      });
      cl.on('offline', () => {
        if (cl !== c) return;
        online = false;
        conectatLa = 0;
        h.stare?.('pierdut');
      });
      cl.on('message', (topic, payload) => {
        if (cl !== c) return;
        const m = citeste(payload);
        if (!m) return;
        ultim = Date.now();
        if (m.t === '__inchis') {
          online = false;
          h.stare?.('pierdut');
          return;
        }
        if (!online) {
          online = true;
          h.stare?.('online');
          h.conectat?.();
        }
        if (m.t !== 'pong') h.mesaj?.(m);
      });
    }

    function schimbaServer() {
      idx = (idx + 1) % BROKERI.length;
      porneste();
    }

    function trimiteBrut(m) {
      if (!c || !c.connected) return false;
      try {
        c.publish(canalGazda, JSON.stringify({ c: cid, m }), { qos: 0 });
        return true;
      } catch {
        return false;
      }
    }

    // „ping” regulat: tinem legatura si observam repede daca s-a pierdut
    const puls = setInterval(() => {
      if (oprit || !c) return;
      const acum = Date.now();
      if (!c.connected) {
        if (acum - pornitLa > 15000 && !conectatLa) schimbaServer();
        return;
      }
      trimiteBrut({ t: 'ping' });
      if (online && acum - ultim > 7000) {
        online = false;
        h.stare?.('pierdut');
      }
      if (!online) {
        const asteptam = acum - Math.max(conectatLa, ultim);
        if (asteptam > 5000) h.stare?.('negasit');
        // laptopul poate fi pe alt server din lista: incercam urmatorul
        if (asteptam > 12000) schimbaServer();
      }
    }, 2000);

    porneste();

    return {
      trimite(m) {
        return online && trimiteBrut(m);
      },
      verifica() {
        // apelat cand telefonul revine in aplicatie
        if (oprit) return;
        if (!c || !c.connected) porneste();
        else trimiteBrut({ t: 'ping' });
      },
      opreste() {
        oprit = true;
        clearInterval(puls);
        clearTimeout(timerServer);
        try { trimiteBrut({ t: '__inchis' }); } catch { /* nimic */ }
        try { c?.end(true); } catch { /* nimic */ }
      },
    };
  }

  return { codNou, curataCod, gazda, jucator };
})();
