// Continutul jocului: avatare, culori, provocari, dileme, teme pentru minijocuri.
// Totul e in romana si poate fi extins liber: adauga randuri noi in liste.

const AVATARE = ['🦊', '🐼', '🐸', '🐯', '🐵', '🦄', '🐙', '🐧', '🐨', '🐷', '🐰', '🦁', '🐶', '🐱', '🐻', '🐔'];

// culori pentru jucatori (maxim 6), lizibile pe alb
const CULORI = ['#e11d48', '#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2'];

const REACTII = ['😂', '👏', '😱', '🔥', '😭', '🥳'];

// Provocari: jucatorul le face in realitate, ceilalti voteaza pe telefon daca a reusit.
const PROVOCARI = [
  'Spune 5 fructe în 10 secunde!',
  'Imită o găină care tocmai a făcut un ou.',
  'Spune de 3 ori, repede: „Capra calcă piatra, piatra crapă-n patru”.',
  'Fă cea mai serioasă față. Ceilalți au 10 secunde să te facă să râzi.',
  'Cântă refrenul unei melodii cunoscute. Ceilalți trebuie s-o recunoască.',
  'Fă câte un compliment fiecărui jucător.',
  'Mimează o meserie. Ceilalți au 20 de secunde s-o ghicească.',
  'Numește 4 țări care încep cu litera „S” în 15 secunde.',
  'Spune o glumă. Dacă cineva zâmbește, ai reușit.',
  'Stai într-un picior, cu ochii închiși, 10 secunde.',
  'Prezintă vremea de mâine ca un prezentator TV foarte dramatic.',
  'Fă sunetul unui animal. Ceilalți ghicesc ce animal e.',
  'Descrie-ți ziua de azi în exact 3 cuvinte.',
  'Spune 5 cuvinte care rimează cu „pisică”.',
  'Numără de la 20 la 1, cât poți de repede, fără greșeală.',
  'Bate din palme ritmul unei melodii. Ceilalți ghicesc melodia.',
  'Râzi ca un personaj negativ din desenele animate.',
  'Prezintă-l pe jucătorul din dreapta ta ca pe un super-erou.',
  'Spune alfabetul de la A la M în 10 secunde, fără greșeală.',
  'Vinde-le celorlalți un obiect din cameră, ca la teleshopping.',
  'Mimează un animal, fără sunete. Ceilalți ghicesc în 20 de secunde.',
  'Comandă o pizza imaginară vorbind ca un robot.',
  'Spune numele a 5 orașe din România în 10 secunde.',
  'Imită un alt jucător. Ceilalți ghicesc pe cine.',
  'Fă o reclamă de 10 secunde pentru zarul acestui joc.',
  'Spune „Hai la tablă!” în 3 feluri: fericit, trist și speriat.',
  'Recită măcar două versuri dintr-o poezie de grădiniță.',
  'Fă un dans de victorie de 5 secunde.',
  'Povestește în 20 de secunde ceva amuzant care ți s-a întâmplat.',
  'Spune 5 animale care încep cu litera „C” în 15 secunde.',
  'Vorbește 15 secunde despre cartofi, ca și cum ar fi o știre-bombă.',
  'Fă 5 sărituri pe loc și strigă „Sunt în formă!” la fiecare.',
];

// Dileme pentru „Te cunosc?”: [emoji, text] pentru fiecare varianta.
const DILEME = [
  { q: 'Unde mergi în concediu?', a: ['🏔️', 'La munte'], b: ['🏖️', 'La mare'] },
  { q: 'Ce mănânci diseară?', a: ['🍕', 'Pizza'], b: ['🌯', 'Shaorma'] },
  { q: 'Ce animal ai alege?', a: ['🐶', 'Câine'], b: ['🐱', 'Pisică'] },
  { q: 'Ce poftă ai acum?', a: ['🍰', 'Ceva dulce'], b: ['🥨', 'Ceva sărat'] },
  { q: 'Ce bei dimineața?', a: ['☕', 'Cafea'], b: ['🍵', 'Ceai'] },
  { q: 'Ce anotimp preferi?', a: ['☀️', 'Vara'], b: ['❄️', 'Iarna'] },
  { q: 'Seara, la televizor:', a: ['🎬', 'Un film'], b: ['📺', 'Un serial'] },
  { q: 'Ești mai degrabă...', a: ['🌅', 'Matinal'], b: ['🌙', 'Bufniță de noapte'] },
  { q: 'Ce superputere ai alege?', a: ['🕊️', 'Să zbori'], b: ['👻', 'Să fii invizibil'] },
  { q: 'La masa de sărbători:', a: ['🍖', 'Mici'], b: ['🥬', 'Sarmale'] },
  { q: 'Vacanța ideală:', a: ['😴', 'Odihnă totală'], b: ['🧗', 'Aventură non-stop'] },
  { q: 'Cu prietenii preferi să...', a: ['💬', 'Scrii mesaje'], b: ['📞', 'Vorbești la telefon'] },
  { q: 'Garnitura perfectă:', a: ['🍟', 'Cartofi prăjiți'], b: ['🥔', 'Piure'] },
  { q: 'Desertul perfect:', a: ['🍫', 'Ciocolată'], b: ['🍦', 'Înghețată'] },
  { q: 'Vineri seara:', a: ['🎉', 'Petrecere mare'], b: ['🛋️', 'Seară liniștită'] },
  { q: 'La ce ai renunța pentru un an?', a: ['🎵', 'La muzică'], b: ['🎬', 'La filme'] },
  { q: 'Ce talent ai vrea?', a: ['🍳', 'Să gătești orice'], b: ['🎸', 'Să cânți la orice'] },
  { q: 'Mașina timpului te duce în...', a: ['⏪', 'Trecut'], b: ['⏩', 'Viitor'] },
  { q: 'Pe cartofi prăjiți pui...', a: ['🥫', 'Ketchup'], b: ['🥚', 'Maioneză'] },
  { q: 'Desert la restaurant:', a: ['🥞', 'Clătite'], b: ['🍩', 'Papanași'] },
  { q: 'Ce e mai greu?', a: ['📵', 'O lună fără telefon'], b: ['🍬', 'Un an fără dulciuri'] },
  { q: 'Ce ai vrea să poți?', a: ['🐾', 'Să vorbești cu animalele'], b: ['🌍', 'Să vorbești orice limbă'] },
  { q: 'Unde dormi în vacanță?', a: ['⛺', 'La cort'], b: ['🏨', 'La hotel'] },
  { q: 'Ce ai vrea să poți?', a: ['🧠', 'Să citești gânduri'], b: ['🔮', 'Să vezi viitorul'] },
  { q: 'Cum te plimbi prin oraș?', a: ['🚲', 'Pe bicicletă'], b: ['🛴', 'Pe trotinetă'] },
  { q: 'La prânz:', a: ['🥣', 'Supă'], b: ['🍲', 'Ciorbă'] },
  { q: 'La o petrecere preferi să...', a: ['🎤', 'Cânți la karaoke'], b: ['💃', 'Dansezi'] },
  { q: 'Încălțămintea preferată:', a: ['👟', 'Adidași'], b: ['👡', 'Sandale'] },
  { q: 'Ce e mai frumos?', a: ['🌅', 'Răsăritul'], b: ['🌇', 'Apusul'] },
  { q: 'Ai vrea să fii cel mai...', a: ['🤓', 'Deștept din cameră'], b: ['😂', 'Amuzant din cameră'] },
  { q: 'Cumpărături:', a: ['📦', 'Online'], b: ['🛒', 'La magazin'] },
  { q: 'Ce vreme preferi?', a: ['🌧️', 'Ploaie'], b: ['🌨️', 'Ninsoare'] },
  { q: 'La film:', a: ['🍿', 'Popcorn'], b: ['🥔', 'Chipsuri'] },
  { q: 'Unde ai trăi?', a: ['🐓', 'La țară'], b: ['🏙️', 'La oraș'] },
  { q: 'Duminică dimineața:', a: ['🐭', 'Desene animate'], b: ['😴', 'Somn până la prânz'] },
  { q: 'Fructul preferat:', a: ['🍎', 'Mere'], b: ['🍌', 'Banane'] },
  { q: 'În parcul de distracții:', a: ['🎢', 'Rollercoaster'], b: ['🎡', 'Roata mare'] },
  { q: 'Mesajele le scrii...', a: ['😀', 'Cu multe emoji'], b: ['✍️', 'Doar cu text'] },
];

// „Cate sunt?”: [ce numeri, distractor 1, distractor 2, cum se cheama la plural]
const TEME_CATE = [
  ['🐑', '🐐', '🐄', 'oi'],
  ['🍎', '🍐', '🍊', 'mere'],
  ['⭐', '🌙', '☁️', 'stele'],
  ['🐟', '🐠', '🐙', 'pești'],
  ['🎈', '🎁', '🎉', 'baloane'],
  ['🐞', '🐝', '🦋', 'buburuze'],
  ['🦆', '🐔', '🐤', 'rațe'],
  ['🌻', '🌷', '🌼', 'floarea-soarelui'],
];

// „Gaseste intrusul”: [cel des intalnit, intrusul]
const PERECHI_INTRUS = [
  ['😀', '😃'], ['🐶', '🐺'], ['🍎', '🍅'], ['🐸', '🐢'], ['⚽', '🏐'], ['🌞', '🌝'],
  ['🍋', '🍌'], ['🐱', '🐯'], ['🚗', '🚙'], ['🐔', '🦆'], ['🍪', '🍩'], ['🐭', '🐹'],
  ['🌲', '🌳'], ['🌷', '🌹'], ['🍊', '🍑'], ['😺', '😸'], ['🐻', '🐨'], ['🎃', '🍊'],
];

// Culorile din „Capcana culorilor”
const CULORI_STROOP = [
  { n: 'ROȘU', c: '#f87171' },
  { n: 'VERDE', c: '#4ade80' },
  { n: 'ALBASTRU', c: '#60a5fa' },
  { n: 'GALBEN', c: '#facc15' },
];

// Fructele din „Tine minte”
const PADURI_MEMORIE = [
  { e: '🍓', c: '#ef4444' },
  { e: '🍋', c: '#facc15' },
  { e: '🍇', c: '#8b5cf6' },
  { e: '🥝', c: '#22c55e' },
];
