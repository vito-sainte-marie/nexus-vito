// UN HARNAIS QUI VOYAGE SANS SES FICHIERS.
//
// Deux fois le même défaut sur le candidat #65, le 28/09/2026. La recette
// navigateur y est arrivée par transport de commits, mais ce qu'elle OUVRE est
// resté derrière : `NEXUS-Live-Developpement-v1.html` (l'écran), puis
// `outils/fixtures/photo-pointage-recette.png` (la photo du pointage). Dans les
// deux cas le code était là, l'objet non, et le rouge tombait à l'exécution —
// dans la CI, après un `npm install` de Playwright et 187 Mio de navigateur.
//
// Ce que ce fichier mesure : tout chemin que la recette construit avec
// `path.join(__dirname, …)` doit exister DANS L'ARBRE. Le manque se voit alors
// en local, en une seconde, au lieu de coûter un passage de CI complet.
//
//   TÉMOIN        — une source qui désigne un fichier absent doit être REFUSÉE,
//                   et le refus doit NOMMER le chemin manquant.
//   CONTRE-TÉMOIN — la vraie recette, dont les fichiers sont là, doit passer.
//                   Une garde qui refuse tout ne prouve rien.
//   CONTRE-TÉMOIN — la garde doit vraiment LIRE la source : une source sans
//                   aucun `path.join(__dirname, …)` ne doit rien produire, et
//                   ne doit surtout pas être maquillée en succès.

const fs = require('fs');
const path = require('path');

// Extraction volontairement littérale : on ne cherche que ce qu'on peut vérifier
// sans exécuter la recette. Un chemin calculé à l'exécution échapperait à cette
// garde — c'est assumé, et c'est pourquoi elle ne remplace pas le passage réel.
function cheminsDeclares(source) {
  const chemins = [];
  const motif = /path\.join\(__dirname\s*,\s*((?:'[^']*'\s*,\s*)*'[^']*')\s*\)/g;
  let m;
  while ((m = motif.exec(source)) !== null) {
    chemins.push(m[1].split(',').map(s => s.trim().slice(1, -1)));
  }
  return chemins;
}

function manquants(source, racine) {
  return cheminsDeclares(source)
    .map(bouts => path.join(racine, ...bouts))
    .filter(p => !fs.existsSync(p));
}

const echecs = [];
function verifier(nom, condition, detail) {
  if (!condition) echecs.push(`${nom} — ${detail}`);
}

// ---- TÉMOIN : un fichier désigné mais absent doit être refusé --------------
const sourceFausse = "const X = path.join(__dirname, 'fixtures', 'photo-qui-n-existe-pas.png');";
const vus = manquants(sourceFausse, __dirname + '/outils');
verifier('témoin/l’absence est vue',
  vus.length === 1, `un fichier absent doit être signalé, vu : ${vus.length}`);
verifier('témoin/le refus nomme le chemin',
  vus.length === 1 && /photo-qui-n-existe-pas\.png/.test(vus[0]),
  'le refus doit nommer le fichier manquant, pas seulement compter');

// ---- CONTRE-TÉMOIN : la garde lit vraiment la source ----------------------
verifier('contre-témoin/source muette',
  cheminsDeclares('const X = 42;').length === 0,
  'une source sans path.join(__dirname, …) ne doit rien produire');
verifier('contre-témoin/la vraie source déclare bien des chemins',
  cheminsDeclares(fs.readFileSync(path.join(__dirname, 'outils', 'recette-navigateur-test.js'), 'utf8')).length > 0,
  'la recette déclare au moins un fichier — si plus aucun, cette garde ne mesure plus rien');

// ---- CONTRE-TÉMOIN : l'arbre réel doit passer -----------------------------
const dossierOutils = path.join(__dirname, 'outils');
const source = fs.readFileSync(path.join(dossierOutils, 'recette-navigateur-test.js'), 'utf8');
const absents = manquants(source, dossierOutils);
verifier('contre-témoin/arbre complet',
  absents.length === 0,
  'la recette désigne des fichiers qui ne sont pas dans cet arbre :\n      '
  + absents.map(p => path.relative(__dirname, p)).join('\n      '));

// ---------------------------------------------------------------------------
if (echecs.length) {
  console.error('ÉCHEC — le harnais de recette désigne des fichiers absents :');
  for (const e of echecs) console.error('  · ' + e);
  process.exit(1);
}
console.log('OK — tout fichier que la recette ouvre est présent dans l’arbre.');
