// A4-2 : le niveau d'un risque (anomalie < signal faible < exposition < risque avéré)
// et son urgence sont deux dimensions. Aucun lecteur ne doit trier sur le niveau
// seul. Garde statique : la table de rangs de niveau n'existe que dans
// nexus-risques-moteur.js ; ses lecteurs sont nommés.
// Les EXCEPTIONS sont des écarts connus, signalés à Guardian (#409, 7219361314),
// en attente d'arbitrage : la garde échoue si une exception disparaît (à retirer
// alors de la liste) ou si un nouvel écart apparaît.
const assert = require('assert');
const cp = require('child_process');
const fs = require('fs');
const fichiers = cp.execSync("git ls-files '*.js' '*.html'", { cwd: __dirname, encoding: 'utf8' })
  .split('\n').filter(f => f && !/^test_|\/test_|^\.github\//.test(f));
const MOTEUR = 'nexus-risques-moteur.js';
const LECTEURS_RANG_NIVEAU = ['NEXUS-Brief-v1.html', 'nexus-rapport-direction-moteur.js', 'nexus-risques-donnees.js'];
const EXCEPTIONS_RANG_NIVEAU = ['nexus-secteurs-moteur.js']; // choix des 3 catégories citées, pas un ordre d'urgence (à confirmer)
// Point 1 (nexus-risques-donnees.js) corrigé (GO Guardian 7219369125). Point 2 laissé hors du lot : sa copie
// locale met signal_faible et anomalie à égalité (0), RANG_NIVEAU les sépare ; les signaux de marge peuvent
// être 'anomalie' (qualifierMargeCategorie sans historique) : remplacer changerait l'ordre affiché.
const EXCEPTIONS_TABLE_LOCALE = ['nexus-rapport-direction-moteur.js'];
let ok = 0;
function t(n, f) { try { f(); ok++; } catch (e) { console.error('ECHEC', n, e.message); process.exitCode = 1; } }
const lire = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
const avecRangNiveau = fichiers.filter(f => /\bRANG_NIVEAU\b/.test(lire(f)));
const avecTableLocale = fichiers.filter(f => /\brisque_avere\s*:\s*\d/.test(lire(f)));

t('RANG_NIVEAU n\'est lu que par les lecteurs nommés (hors exceptions connues)', () => {
  const permis = new Set([MOTEUR, ...LECTEURS_RANG_NIVEAU, ...EXCEPTIONS_RANG_NIVEAU]);
  const intrus = avecRangNiveau.filter(f => !permis.has(f));
  assert.deepStrictEqual(intrus, [], 'tri sur le niveau hors des fichiers autorisés : ' + intrus.join(', '));
});
t('chaque exception RANG_NIVEAU existe encore (sinon la retirer de la liste)', () => {
  EXCEPTIONS_RANG_NIVEAU.forEach(f => assert.ok(avecRangNiveau.includes(f), f + ' ne lit plus RANG_NIVEAU'));
});
t('aucune table de rangs de niveau écrite ailleurs que dans le moteur (hors copies connues)', () => {
  const permis = new Set([MOTEUR, ...EXCEPTIONS_TABLE_LOCALE]);
  const intrus = avecTableLocale.filter(f => !permis.has(f));
  assert.deepStrictEqual(intrus, [], 'table de rangs locale : ' + intrus.join(', '));
});
t('chaque copie locale connue existe encore (sinon la retirer de la liste)', () => {
  EXCEPTIONS_TABLE_LOCALE.forEach(f => assert.ok(avecTableLocale.includes(f), f + ' n\'a plus de table locale'));
});
t('le moteur porte bien la table et la dimension d\'urgence séparée', () => {
  const s = lire(MOTEUR);
  assert.ok(/const RANG_NIVEAU\s*=/.test(s)); assert.ok(/RANG_URGENCE/.test(s));
});

// Parité du point 1 : l'ancien tri (table locale) et le tri par RANG_NIVEAU, quatre niveaux et ex aequo.
t('point 1 : parité de tri, quatre niveaux, ex aequo', () => {
  const vm = require('vm');
  const g = { console }; g.global = g; g.window = g; vm.createContext(g);
  ['nexus-risques-moteur.js'].forEach(f => vm.runInContext(lire(f), g, { filename: f }));
  const RN = g.NexusRisques.RANG_NIVEAU;
  const ancien = { risque_avere: 3, exposition: 2, signal_faible: 1, anomalie: 0 };
  ['risque_avere', 'exposition', 'signal_faible', 'anomalie'].forEach(n => assert.strictEqual(RN[n], ancien[n], n));
  const jeu = [
    { id: 1, niveau: 'anomalie', derniere_detection_le: '2026-11-01' }, { id: 2, niveau: 'risque_avere', derniere_detection_le: '2026-11-02' },
    { id: 3, niveau: 'signal_faible', derniere_detection_le: '2026-11-03' }, { id: 4, niveau: 'exposition', derniere_detection_le: '2026-11-04' },
    { id: 5, niveau: 'risque_avere', derniere_detection_le: '2026-11-05' }, { id: 6, niveau: 'anomalie', derniere_detection_le: '2026-11-05' },
    { id: 7, niveau: 'signal_faible', derniere_detection_le: '2026-11-03' }, { id: 8, niveau: 'inconnu', derniere_detection_le: '2026-11-06' },
  ];
  const tri = r => jeu.slice().sort((a, b) => ((r[b.niveau] || 0) - (r[a.niveau] || 0)) || (new Date(b.derniere_detection_le) - new Date(a.derniere_detection_le))).map(x => x.id);
  assert.deepStrictEqual(tri(RN), tri(ancien));
});
console.log(ok + ' ok');
