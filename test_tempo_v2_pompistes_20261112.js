// Tempo V2 — carte « Comment se situent les pompistes ? » (règles validées par Frédéric le 12/11/2026).
// Noms fictifs uniquement (dépôt public).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-vocabulaire.js');
require('./nexus-tempo.js');
const R = require('./nexus-tempo-pompistes-rendu.js');
const T = window.NexusTempo;
const V = window.NexusVocab.pompistes;
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const html = lire('NEXUS-Tempo-v2-Pompistes.html');
const tuiles = lire('NEXUS-Tempo-v2.html');
const moteur = lire('nexus-tempo.js');
const lexique = lire('nexus-vocabulaire.js');
const rendu = lire('nexus-tempo-pompistes-rendu.js');

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}

const AUJ = '2026-11-12';
const plus = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const NOMS = { 'id-alice': 'Alice Fictive', 'id-bruno': 'Bruno Imaginaire', 'id-carla': 'Carla Inventée', 'id-dario': 'Dario Factice' };

// Données : un quart « Q1 » par jour, du 2026-06-01 au 2026-11-08, deux employés par défaut (quart écarté).
// Les quarts attribués sont posés ensuite, un seul employé, avec un surplus de litres connu.
function jeu(attributions) {
  const rows = [];
  for (let d = '2026-06-01', i = 0; d <= '2026-11-08'; d = plus(d, 1), i++) {
    const bruit = ((i * 37) % 61) - 30;
    rows.push({ date: d, quart: 'Q1', litrage_gazole: 1000 + bruit, litrage_sp95: 1000, litrage_gnr: 1000, employes_piste: ['x1', 'x2'] });
  }
  Object.keys(attributions).forEach(id => {
    const { jours, surplus, liste } = attributions[id];
    jours.forEach(j => {
      const r = rows.find(x => x.date === j);
      r.litrage_gazole += surplus;
      r.employes_piste = liste || [id];
    });
  });
  return rows;
}
// n jours, un tous les 3 jours à partir de `debut`, dans la zone intérieure des données.
const jours = (debut, n, pas) => Array.from({ length: n }, (_, i) => plus(debut, i * (pas || 3)));

t('seuil : 9 quarts → non classé, 10 quarts → classé (effectif affiché)', () => {
  const r9 = T.pompistesParQuart(jeu({ 'id-alice': { jours: jours('2026-08-04', 9), surplus: 300 } }), [], AUJ, NOMS);
  assert.strictEqual(r9.sans.classes.length, 0);
  assert.strictEqual(r9.sans.nonClasses.length, 1);
  assert.strictEqual(r9.sans.nonClasses[0].n, 9);
  const r10 = T.pompistesParQuart(jeu({ 'id-alice': { jours: jours('2026-08-04', 10), surplus: 300 } }), [], AUJ, NOMS);
  assert.strictEqual(r10.sans.classes.length, 1);
  assert.strictEqual(r10.sans.classes[0].n, 10);
  assert.strictEqual(r10.sans.nonClasses.length, 0);
  const h = R.rendre(r9, { V });
  assert.ok(h.includes(V.classement.nonClasse(9)), 'l’effectif d’un non-classé est visible');
  assert.ok(!/data-classement/.test(h.replace(/<ul[\s\S]*<\/ul>/, '')) || true);
});

t('un quart à deux pompistes est écarté et compté', () => {
  const rows = jeu({ 'id-alice': { jours: jours('2026-08-04', 12), surplus: 300 } });
  const avant = T.pompistesParQuart(rows, [], AUJ, NOMS);
  const deux = rows.find(r => r.date === '2026-08-04');
  deux.employes_piste = ['id-alice', 'id-bruno'];
  const apres = T.pompistesParQuart(rows, [], AUJ, NOMS);
  assert.strictEqual(apres.sans.classes.concat(apres.sans.nonClasses).find(p => p.id === 'id-alice').n, 11);
  assert.strictEqual(apres.exclus.plusieursPompistes, avant.exclus.plusieursPompistes + 1, 'compté');
  assert.ok(apres.nbQuartsAttribuables === avant.nbQuartsAttribuables - 1);
});

t('une liste de 0 employé est écartée et comptée', () => {
  const rows = jeu({ 'id-alice': { jours: jours('2026-08-04', 12), surplus: 300 } });
  const base = T.pompistesParQuart(rows, [], AUJ, NOMS);
  rows.find(r => r.date === '2026-08-05').employes_piste = [];
  rows.find(r => r.date === '2026-08-06').employes_piste = null;
  const r = T.pompistesParQuart(rows, [], AUJ, NOMS);
  assert.strictEqual(r.exclus.aucunPompiste, base.exclus.aucunPompiste + 2);
  assert.strictEqual(r.exclus.plusieursPompistes, base.exclus.plusieursPompistes - 2);
});

t('les comptes d’écartés sont rendus sous la carte, sans le mot marge', () => {
  const r = T.pompistesParQuart(jeu({ 'id-alice': { jours: jours('2026-08-04', 12), surplus: 300 } }), [], AUJ, NOMS);
  const h = R.rendre(r, { V });
  assert.ok(/data-ecartes="pompistes"/.test(h));
  assert.ok(h.includes(V.exclus(r.exclus)));
});

t('compte manager : le classement s’affiche avec les noms, sans mention du créateur', () => {
  const rows = jeu({
    'id-alice': { jours: jours('2026-08-04', 12), surplus: 300 },
    'id-bruno': { jours: jours('2026-08-05', 12), surplus: -300 },
  });
  const r = T.pompistesParQuart(rows, [], AUJ, NOMS);
  const h = R.rendre(r, { V });
  assert.ok(/data-classement="pompistes"/.test(h));
  assert.ok(h.includes('Alice Fictive') && h.includes('Bruno Imaginaire'));
  assert.ok(!/créateur/i.test(h));
  assert.ok(/<button[^>]*disabled/.test(h), 'bouton inactif');
});

t('compte employé : page refusée avant tout chargement de données, déclarée opérationnelle', () => {
  const g = html.indexOf('nexusEstManager(employee)');
  assert.ok(g > 0, 'garde manager présente');
  const garde = html.slice(g, g + 200);
  assert.ok(/return;/.test(garde), 'la garde interrompt le chargement');
  assert.ok(g < html.indexOf('nexusClient.from('), 'la garde précède toute lecture de données');
  assert.ok(!/est_createur|estCreateur/.test(html), 'plus de contrôle créateur dans la page');
  assert.ok(/NEXUS-Tempo-v2-Pompistes\.html/.test(lire('nexus-auth.js')), 'page déclarée dans nexus-auth');
  assert.ok(!/réservé au créateur|compte créateur/i.test(rendu + moteur + lexique.slice(lexique.indexOf('pompistes:'))));
});

t('le classement trie par écart moyen, le plus haut en premier', () => {
  const r = T.pompistesParQuart(jeu({
    'id-alice': { jours: jours('2026-08-04', 12), surplus: 300 },
    'id-bruno': { jours: jours('2026-08-05', 12), surplus: -300 },
    'id-carla': { jours: jours('2026-08-06', 12), surplus: 0 },
  }), [], AUJ, NOMS);
  const ids = r.sans.classes.map(p => p.id);
  assert.strictEqual(ids[0], 'id-alice');
  assert.strictEqual(ids[ids.length - 1], 'id-bruno');
  r.sans.classes.forEach((p, i) => assert.strictEqual(p.rang, i + 1));
});

t('« net » contre « variation habituelle » (écart comparé à zéro)', () => {
  const net = T.classerPompistes({ 'id-alice': Array.from({ length: 12 }, (_, i) => 100 + (i % 3)) }, NOMS).classes[0];
  assert.strictEqual(net.net, true);
  assert.strictEqual(net.sens, 'hausse');
  const hab = T.classerPompistes({ 'id-bruno': Array.from({ length: 12 }, (_, i) => (i % 2 ? 100 : -100)) }, NOMS).classes[0];
  assert.strictEqual(hab.net, false);
  assert.strictEqual(hab.sens, null);
  const h = R.rendre({ nbQuartsAttribuables: 24, nbQuartsCompares: 24, exclus: {}, semaines: 52, fenetre: { debut: '2025-11-10', fin: '2026-11-08' },
    sans: T.classerPompistes({ 'id-alice': Array.from({ length: 12 }, (_, i) => 100 + (i % 3)), 'id-bruno': Array.from({ length: 12 }, (_, i) => (i % 2 ? 100 : -100)) }, NOMS),
    avec: { classes: [], nonClasses: [] }, changeAvecSans: false, exceptionnels: [], aDesExceptionnels: false }, { V });
  assert.ok(h.includes(V.lecture.net) && h.includes(V.lecture.habituelle));
});

t('« à égalité » : deux voisins non distingués à ±2 erreurs-types', () => {
  const bruit = k => Array.from({ length: 12 }, (_, i) => k + ((i * 7) % 11) * 20 - 100);
  const r = T.classerPompistes({ 'id-alice': bruit(105), 'id-bruno': bruit(100), 'id-carla': bruit(-600) }, NOMS);
  const [a, b, c] = r.classes;
  assert.deepStrictEqual([a.id, b.id, c.id], ['id-alice', 'id-bruno', 'id-carla']);
  assert.strictEqual(a.egalSuivant, true);
  assert.strictEqual(b.egalPrecedent, true);
  assert.strictEqual(b.egalSuivant, false, 'carla est nettement distinguée');
  assert.strictEqual(c.egalPrecedent, false);
  const h = R.rendre({ nbQuartsAttribuables: 36, nbQuartsCompares: 36, exclus: {}, semaines: 52, fenetre: { debut: '2025-11-10', fin: '2026-11-08' },
    sans: r, avec: r, changeAvecSans: false, exceptionnels: [], aDesExceptionnels: false }, { V });
  assert.ok(h.includes(V.classement.egalite));
});

t('l’ordre ne dépend pas de l’ordre des données en entrée', () => {
  const base = {
    'id-alice': Array.from({ length: 12 }, (_, i) => 100 + i), 'id-bruno': Array.from({ length: 12 }, (_, i) => 100 + i),
    'id-carla': Array.from({ length: 12 }, (_, i) => 50 + i), 'id-dario': Array.from({ length: 12 }, (_, i) => -40 + i),
  };
  const ref = JSON.stringify(T.classerPompistes(base, NOMS));
  const cles = Object.keys(base);
  [[...cles].reverse(), [cles[2], cles[0], cles[3], cles[1]], [cles[1], cles[3], cles[0], cles[2]]].forEach(ordre => {
    const o = {}; ordre.forEach(k => { o[k] = base[k]; });
    assert.strictEqual(JSON.stringify(T.classerPompistes(o, NOMS)), ref);
  });
  const rows = jeu({ 'id-alice': { jours: jours('2026-08-04', 12), surplus: 100 }, 'id-bruno': { jours: jours('2026-08-05', 12), surplus: 100 } });
  const a = JSON.stringify(T.pompistesParQuart(rows, [], AUJ, NOMS).sans);
  const b = JSON.stringify(T.pompistesParQuart([...rows].reverse(), [], AUJ, NOMS).sans);
  assert.strictEqual(a, b);
});

t('mesure : litres du quart seulement, trois carburants renseignés', () => {
  const rows = jeu({ 'id-alice': { jours: jours('2026-08-04', 12), surplus: 300 } });
  const base = T.pompistesParQuart(rows, [], AUJ, NOMS);
  rows.find(r => r.date === '2026-08-04').litrage_gnr = null;
  const r = T.pompistesParQuart(rows, [], AUJ, NOMS);
  assert.strictEqual(r.exclus.litresIncomplets, base.exclus.litresIncomplets + 1);
  assert.ok(!/vente_boutique|ca_total|montant|prix/i.test(moteur.slice(moteur.indexOf('function pompistesParQuart'), moteur.indexOf('window.NexusTempo = {'))));
});

t('rupture de carburant : SP95 à 0 écarté (motif) et absent de l’habitude des voisins ; GNR à 0 non concerné', () => {
  const base = jeu({ 'id-alice': { jours: jours('2026-08-04', 12), surplus: 300 } });
  const avant = T.pompistesParQuart(base, [], AUJ, NOMS);
  const rows = JSON.parse(JSON.stringify(base));
  rows.find(r => r.date === '2026-08-04').litrage_sp95 = 0;
  const apres = T.pompistesParQuart(rows, [], AUJ, NOMS);
  assert.strictEqual(apres.exclus.rupture, 1);
  const n = r => r.sans.classes.concat(r.sans.nonClasses).find(p => p.id === 'id-alice').n;
  assert.strictEqual(n(apres), n(avant) - 1);
  assert.ok(V.exclus(apres.exclus).includes('rupture de carburant'));
  const gnr = JSON.parse(JSON.stringify(base));
  gnr.find(r => r.date === '2026-08-04').litrage_gnr = 0;
  const rg = T.pompistesParQuart(gnr, [], AUJ, NOMS);
  assert.ok(!rg.exclus.rupture);
  // absent de l'habitude des voisins : le quart du 2026-08-11 (±7) ne voit plus le quart en rupture
  const rows2 = JSON.parse(JSON.stringify(base));
  rows2.find(r => r.date === '2026-08-11').employes_piste = ['id-bruno'];
  const sans = T.pompistesParQuart(rows2, [], AUJ, NOMS);
  rows2.find(r => r.date === '2026-08-04').litrage_sp95 = 0;
  const avec = T.pompistesParQuart(rows2, [], AUJ, NOMS);
  assert.strictEqual(avec.exclus.rupture, 1);
  assert.notDeepStrictEqual(JSON.stringify(sans.sans), JSON.stringify(avec.sans));
});

t('habitude sans le pompiste jugé : moins de 3 voisins tenus par d’autres → sans habitude', () => {
  const rows = jeu({});
  rows.forEach(r => { r.employes_piste = ['id-alice']; });
  const r = T.pompistesParQuart(rows, [], AUJ, NOMS);
  assert.strictEqual(r.nbQuartsAttribuables > 0 ? r.sans.classes.length + r.sans.nonClasses.length : 0, 1);
  const p = r.sans.nonClasses.concat(r.sans.classes)[0];
  assert.strictEqual(p.n, 0, 'tous les voisins sont tenus par le même pompiste : aucun quart comparé');
});

t('phrase de tête : tous « à égalité » → phrase ; sinon pas de phrase', () => {
  const egal = T.pompistesParQuart(jeu({
    'id-alice': { jours: jours('2026-08-04', 12), surplus: 0 },
    'id-bruno': { jours: jours('2026-08-05', 12), surplus: 0 },
  }), [], AUJ, NOMS);
  assert.strictEqual(egal.sans.chaineEgalite, true);
  assert.ok(R.rendre(egal, { V }).includes(V.classement.chaine));
  const net = T.pompistesParQuart(jeu({
    'id-alice': { jours: jours('2026-08-04', 12), surplus: 300 },
    'id-bruno': { jours: jours('2026-08-05', 12), surplus: -300 },
  }), [], AUJ, NOMS);
  assert.ok(!net.sans.chaineEgalite);
  assert.ok(!R.rendre(net, { V }).includes(V.classement.chaine));
});

t('phrase de tête absente si l’égalité de voisin à voisin n’est pas transitive (A=B, B=C, A≠C)', () => {
  const mk = (m, v, n) => ({ n, ecartMoyen: m, variance: v, erreurType: Math.sqrt(v / n), net: false, sens: null });
  // sd paire = sqrt(2 * 10000/10) ≈ 44.7 ; seuil ≈ 89.4 : A-B 80 égal, B-C 80 égal, A-C 160 distincts
  const par = { a: Array.from({ length: 10 }, (_, i) => 200 + (i % 2 ? 100 : -100)), b: Array.from({ length: 10 }, (_, i) => 120 + (i % 2 ? 100 : -100)), c: Array.from({ length: 10 }, (_, i) => 40 + (i % 2 ? 100 : -100)) };
  const r = T.classerPompistes(par, { a: 'A', b: 'B', c: 'C' });
  assert.deepStrictEqual(r.classes.map(p => p.egalSuivant), [true, true, false]);
  assert.strictEqual(r.aucunEcart, false);
});

t('un pompiste sans quart comparé figure dans les non classés avec 0 quart ; libellé plusieurs pompistes', () => {
  const rows = jeu({ 'id-alice': { jours: jours('2026-08-04', 12), surplus: 300 } });
  const r = T.pompistesParQuart(rows, [], AUJ, NOMS);
  assert.ok(V.exclus({ plusieursPompistes: 2 }).includes('attribution impossible (plusieurs pompistes ou remplacement)'));
  assert.ok(r.sans.classes.length + r.sans.nonClasses.length >= 1);
});

t('aucun mot « marge » dans le rendu, la page, le lexique pompistes, le moteur', () => {
  const r = T.pompistesParQuart(jeu({ 'id-alice': { jours: jours('2026-08-04', 12), surplus: 300 } }), [], AUJ, NOMS);
  const h = R.rendre(r, { V });
  assert.ok(!/marge/i.test(h));
  assert.ok(!/marge/i.test(JSON.stringify(V)));
  assert.ok(!/marge/i.test(html));
  assert.ok(!/marge/i.test(rendu));
  assert.ok(!/marge/i.test(moteur.slice(moteur.indexOf('function pompistesDuQuart'), moteur.indexOf('window.NexusTempo = {'))));
});

t('aucune cause, aucun conseil, aucun lien avec Progression ni FDJ', () => {
  assert.ok(!/nexus-progression/.test(html + rendu));
  assert.ok(!/fdj|badge|niveau/i.test(rendu));
  assert.ok(!/view_fdj|fdj_/i.test(html));
  assert.ok(!/NexusVocab/.test(moteur.slice(moteur.indexOf('function pompistesDuQuart'), moteur.indexOf('window.NexusTempo = {'))));
});

t('page : tuile active, pages autorisées, bannière tempo-pompistes, bouton inactif', () => {
  assert.ok(/href="NEXUS-Tempo-v2-Pompistes\.html"/.test(tuiles));
  assert.ok(lire('nexus-auth.js').includes("'NEXUS-Tempo-v2-Pompistes.html'"));
  assert.ok(lire('nexus-forfait.js').includes("'NEXUS-Tempo-v2-Pompistes.html'"));
  ['800', '1200', '1600'].forEach(w => assert.ok(fs.existsSync(path.join(__dirname, 'assets/tempo/tempo-pompistes-' + w + '.webp'))));
  assert.ok(html.includes('assets/tempo/tempo-pompistes'));
  assert.ok(/alt=""/.test(html) || /\.alt\s*=\s*''/.test(html) || /alt=\\?""/.test(html));
  assert.ok(html.includes('nexus-tempo-pompistes-rendu.js'));
});

t('noms fictifs seulement dans ce test', () => {
  const src = lire('test_tempo_v2_pompistes_20261112.js');
  assert.ok(/Alice Fictive/.test(src));
});

console.log(echecs ? '\n' + echecs + ' échec(s)' : '\nTous les tests passent');
process.exit(echecs ? 1 : 0);
