# Hai la Tablă!

Joc de tablă gratuit pentru 2–6 jucători. Tabla se vede pe **laptop sau TV**, iar fiecare jucător folosește **telefonul ca telecomandă**. Totul merge din browser (Chrome, Safari, Edge, Firefox), fără conturi și fără instalări.

**Link:** https://beea28.github.io/hai-la-tabla/

## Cum se joacă
1. Pe laptop deschizi linkul → „Ecranul mare”. Apar un cod QR și un cod de 4 litere.
2. Fiecare jucător scanează codul QR cu telefonul (sau intră pe link și scrie codul), își scrie numele și își alege un personaj.
3. Alegi cât de lung să fie jocul (Scurt / Mediu / Lung) și apeși „Începe jocul” (pe laptop sau pe telefonul primului jucător).
4. Pe rând, fiecare aruncă zarul de pe telefon. Pionul merge pe tablă, iar căsuțele colorate au surprize:
   - ⏩ 3 căsuțe înainte · 🍌 3 căsuțe înapoi
   - 🎁 carte surpriză (trotinetă, elicopter, ploaie, magnet…)
   - 🎭 provocare din viața reală (ceilalți votează pe telefon dacă ai reușit)
   - 🔄 poți schimba locul cu alt jucător · 🎲 mai arunci o dată
5. După fiecare rundă urmează un **minijoc** pentru toți. Locul 1 primește +3 căsuțe, locul 2 +2, locul 3 +1 (la 2 jucători: +3 și +1).
6. Primul care ajunge la 🏆 câștigă.

Cât așteaptă, ceilalți pot trimite reacții (😂 👏 😱 🔥) care zboară pe ecranul mare.

## Minijocurile
| | Minijoc | Ce faci |
|---|---|---|
| 🔥 | Degete de foc | apeși cât mai repede, 6 secunde |
| 🚦 | Semaforul | apeși când se face verde (3 runde) |
| ⏱️ | Stop la fix | oprești cronometrul „pe ascuns” la exact X secunde |
| 👀 | Câte sunt? | numeri desenele de pe ecranul mare |
| 🎨 | Capcana culorilor | apeși culoarea literelor, nu ce scrie |
| 🔍 | Găsește intrusul | găsești desenul diferit din grilă |
| 🧠 | Ține minte | repeți ordinea fructelor (cine greșește iese) |
| 💞 | Te cunosc? | alegi în secret, apoi ghicești ce a ales celălalt / majoritatea |
| 🎈 | Balonul | ții apăsat să umfli balonul, dar nu prea mult… 💥 |

## Bine de știut
- Laptopul și telefoanele au nevoie de internet (pot fi pe Wi-Fi diferite sau pe date mobile).
- Dacă un telefon se blochează sau pierde semnalul, se reconectează singur. Dacă dai refresh pe laptop, apare „Continuă jocul”.
- Dacă cineva nu răspunde, laptopul poate arunca zarul în locul lui (buton sau tasta Spațiu).
- Pe Android și iPhone, din meniul browserului → „Adaugă pe ecranul principal”, ca să apară ca aplicație.

## Cum funcționează (tehnic)
- Site static (HTML, CSS, JavaScript), fără server propriu, găzduit pe **GitHub Pages**.
- Telefoanele și laptopul își trimit mesaje prin servere publice gratuite **MQTT** (WebSocket securizat): HiveMQ, EMQX și Mosquitto. Laptopul ascultă pe toate trei, iar telefonul îl folosește pe primul care merge, așa că jocul merge și pe date mobile sau pe rețele Wi-Fi diferite. Biblioteca e [MQTT.js](https://github.com/mqttjs/MQTT.js) (licență MIT).
- Serverele sunt publice: mesajele jocului (porecle, mutări) nu sunt secrete, deci nu scrieți date personale în nume.
- Codul QR e generat local cu [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (licență MIT).
- Ambele biblioteci sunt copiate în `lib/`, ca jocul să nu depindă de alte site-uri pentru cod.

Textele (provocări, dileme, avatare) sunt în `continut.js` și se pot completa ușor.

## Test local
```
python -m http.server 8771 --directory .
```
Apoi deschide http://localhost:8771/ecran.html pe calculator. Pentru telefoane trebuie HTTPS, deci testul real se face pe linkul GitHub Pages.

Pentru teste automate: `telefon.html?cod=ABCD&auto&slot=1` face telefonul să joace singur; `ecran.html?rapid` scurtează anunțurile.

După ce modifici fișierele, schimbă `CACHE` din `sw.js` (de ex. `hai-la-tabla-v2`), ca telefoanele să ia versiunea nouă.
