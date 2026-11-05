// Écran FDJ Opérations (demande de Frédéric, 05/11/2026) : quand la continuité
// de stock est rompue entre deux quarts, le chiffre concerné passe en orange
// sur les deux quarts, recalculé à l'affichage (pas lu dans le statut d'une alerte).
const assert = require('assert');
const fs = require('fs');
const BASE = __dirname + '/';
require(BASE + 'nexus-fdj-moteur.js');
const M = global.NexusFdjMoteur;
const html = fs.readFileSync(BASE + 'NEXUS-FDJ-Manager-v1.html', 'utf8');

const PERLE = 'perle-rare-2', AUTRE = 'autre-jeu';

// Cas réel Sainte-Marie : le 30/10 Q2 finit à 45, le 31/10 Q1 démarre à 46.
const q1_31 = { [PERLE]: { stock_initial: 46, appro: 0, stock_final: 40 }, [AUTRE]: { stock_initial: 10, appro: 0, stock_final: 8 } };
const q2_30 = { [PERLE]: { stock_initial: 60, appro: 0, stock_final: 45 }, [AUTRE]: { stock_initial: 12, appro: 0, stock_final: 10 } };

// 31/10 Q1 édité : voisin précédent = 30/10 Q2.
let m = M.marquesContinuiteVoisins(q1_31, { [PERLE]: 45, [AUTRE]: 10 }, {});
assert.deepStrictEqual(m.initial, { [PERLE]: { precedent: 45, courant: 46 } }, 'INITIAL de PERLE RARE marqué, seul');
assert.deepStrictEqual(m.final, {}, 'aucun FINAL marqué sans quart suivant');

// 30/10 Q2 édité : voisin suivant = 31/10 Q1.
m = M.marquesContinuiteVoisins(q2_30, {}, { [PERLE]: 46, [AUTRE]: 10 });
assert.deepStrictEqual(m.final, { [PERLE]: { suivant: 46, courant: 45 } }, 'FINAL de PERLE RARE marqué, seul');
assert.deepStrictEqual(m.initial, {}, 'aucun INITIAL marqué sans quart précédent');

// L'écart disparaît -> la marque disparaît (recalcul à l'affichage).
q1_31[PERLE].stock_initial = 45;
assert.deepStrictEqual(M.marquesContinuiteVoisins(q1_31, { [PERLE]: 45, [AUTRE]: 10 }, {}).initial, {});

// Valeurs inconnues : jamais 0 par défaut, jamais de fausse marque.
q1_31[PERLE].stock_initial = null;
assert.deepStrictEqual(M.marquesContinuiteVoisins(q1_31, { [PERLE]: 45 }, {}).initial, {}, 'initial vide : pas de marque');
q1_31[PERLE].stock_initial = 46;
assert.deepStrictEqual(M.marquesContinuiteVoisins(q1_31, {}, {}).initial, {}, 'pas de voisin : pas de marque');
assert.deepStrictEqual(M.marquesContinuiteVoisins(undefined, undefined, undefined), { initial: {}, final: {} });
// 0 est une vraie valeur : 0 contre 5 est un écart.
assert.deepStrictEqual(Object.keys(M.marquesContinuiteVoisins({ g: { stock_initial: 0 } }, { g: 5 }, {}).initial), ['g']);

// Câblage de l'écran : orange (amber), jamais rouge, infobulles exactes, voisins chargés.
assert(/\.jeu-input\.continuite-rompue\{[^}]*var\(--amber\)/.test(html), 'classe orange');
assert(!/\.continuite-rompue\{[^}]*var\(--red\)/.test(html), 'pas de rouge');
assert(html.includes('Ne suit pas le quart précédent ('), 'infobulle du quart suivant');
assert(html.includes('Le quart suivant démarre à '), 'infobulle du quart précédent');
assert(html.includes('marquesContinuiteVoisins(edition.counts, edition.voisinsFinalPrecedent, edition.voisinsInitialSuivant)'), 'recalcul à l\'affichage');
assert(html.includes('chargerVoisinsContinuite(shift)'), 'voisins chargés à l\'ouverture');
assert(!/marquesContinuiteVoisins[^\n]*fdj_alertes/.test(html), 'indépendant du statut des alertes');
console.log('OK test_fdj_continuite_orange_manager_20261105');
