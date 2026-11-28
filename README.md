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

## Mai multe jocuri, la fel: ecranul mare + telefoanele
Pe același site mai sunt două jocuri, care merg exact ca Hai la Tablă (cod QR sau cod de 4 litere, telefonul e telecomanda):

### ✍️ Țomapan (2–8 jucători)
**Link:** https://beea28.github.io/hai-la-tabla/tomapan/

Țări, orașe, munți, ape, plante, animale, nume.
1. Pe ecranul mare se schimbă literele. Un jucător (pe rând, în fiecare rundă altul) apasă **STOP** pe telefon și așa se alege litera.
2. Fiecare scrie pe telefon câte un cuvânt cu litera aceea pentru fiecare categorie. Nimeni nu vede ce scrie celălalt. Telefonul arată dacă un cuvânt nu începe cu litera bună.
3. Cine a completat tot poate apăsa **STOP**: ceilalți mai au 5 secunde. Altfel, runda se termină când expiră timpul (1, 1½ sau 2 minute).
4. Verificarea se face categorie cu categorie: răspunsurile apar pe ecranul mare, iar pe telefon fiecare atinge răspunsurile pe care le crede greșite. Un răspuns cade dacă mai mult de jumătate dintre cei care l-au putut vota îl resping. Pe laptop se poate face click pe un răspuns ca să decidă un „arbitru”.
5. Punctaj: **10 puncte** pentru un răspuns pe care l-ai scris doar tu, **5 puncte** dacă l-a mai scris cineva, 0 dacă e greșit sau gol. Diacriticele și majusculele nu contează („Brasov” = „Brașov”), iar „Lacul Bâlea” e bun și la B.
6. După ultima rundă (3, 5 sau 8), câștigă cine are cele mai multe puncte.

Categoriile clasice sunt cele 7 din ȚOMAPAN; pe ecranul mare se mai pot alege: mâncare, meserii, obiecte, sporturi, vedete, filme (în `tomapan/reguli.js` se pot adăuga altele).

### ✈️ Avioanele (2–6 jucători, poate juca și calculatorul)
**Link:** https://beea28.github.io/hai-la-tabla/avioane/

Jocul cu avioane de pe foaia cu pătrățele. Avionul are 10 pătrățele: capul, aripile (5), corpul și coada (3).
1. Fiecare își așază avioanele pe telefon, în secret (le muți, le rotești sau le pui la întâmplare). Le știe doar laptopul, care e și arbitru, deci nu se poate trișa.
2. Pe rând, fiecare alege pe telefon o căsuță (de ex. C7) și trage. Dacă sunt mai mulți jucători, alegi și în tabla cui tragi. Pe ecranul mare se vede unde țintești.
3. **Aer** dacă n-ai nimerit nimic, **Lovit** dacă ai nimerit un avion. Dacă nimerești **capul**, avionul e doborât și apare întreg pe tablă.
4. Cine rămâne fără avioane iese din joc. Ultimul care mai are avioane câștigă. La final se văd toate avioanele.

Moduri: **Clasic** (tablă 10×10, câte 3 avioane) sau **Rapid** (8×8, câte 2 avioane).

**Calculatorul:** în camera de așteptare apeși „Adaugă un calculator” pe nivelul dorit. Poți pune mai mulți, chiar de niveluri diferite, ca să poți juca și singur:
- 🙂 **Ușor** – trage mai mult la nimereală și doar uneori încearcă pe lângă o lovitură (îi trebuie în medie ~46 de trageri ca să doboare 3 avioane pe 10×10);
- 😐 **Mediu** – caută pe lângă lovituri ca un om atent și uneori „socotește” (~28 de trageri);
- 😈 **Greu** – socotește la fiecare tragere unde e cel mai probabil un cap (~13 trageri).

Calculatorul vede doar ce e pe ecran (unde s-a tras și ce a ieșit), nu avioanele ascunse. Regulile lui sunt în `avioane/calculator.js`.

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

### Cum sunt organizate fișierele
- Rădăcina: Hai la Tablă! (`ecran.*`, `telefon.*`, `continut.js`), plus ce folosesc toate jocurile: `retea.js`, `sunet.js`, `comun.css`, `lib/`.
- `comun/`: partea comună pentru Țomapan și Avioanele: camera, jucătorii, reconectarea, anunțurile, salvarea și podiumul (`gazda.js` pe ecranul mare, `telecomanda.js` pe telefon, `baza.js` pentru amândouă).
- `tomapan/` și `avioane/`: fiecare joc are `index.html` (pagina de start), `ecran.html/.js`, `telefon.html/.js`, `stil.css`, iconițele lui și regulile (`tomapan/reguli.js`, `avioane/avion.js`).
- Fiecare joc folosește alt „canal” pe serverele MQTT (`data-canal` la `retea.js`), ca să nu se amestece camerele între jocuri.

## Test local
```
python -m http.server 8771 --directory .
```
Apoi deschide http://localhost:8771/ecran.html pe calculator. Pentru telefoane trebuie HTTPS, deci testul real se face pe linkul GitHub Pages.

Pentru teste automate: `telefon.html?cod=ABCD&auto&slot=1` face telefonul să joace singur; `ecran.html?rapid` scurtează anunțurile. Merge la fel și în `tomapan/` și `avioane/`.

După ce modifici fișierele, schimbă `CACHE` din `sw.js` (de ex. `hai-la-tabla-v4`), ca telefoanele să ia versiunea nouă. Dacă adaugi fișiere noi, trece-le și în lista `FISIERE` din `sw.js`.
