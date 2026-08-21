// Test — Cutover production Inventaire (21/08/2026, demande explicite de
// Frédéric après constat réel sur le pilote : 96 des 112 produits du site
// avaient une alerte ouverte issue de tests/dev, faisant exploser l'aperçu
// "Prochain inventaire" à 98 produits). Trois volets :
//  1. Point de référence PRODUCTION_START (inventaire_points_reference) —
//     tout ce qui précède ce point ne doit plus alimenter les indicateurs
//     opérationnels (couverture, sélection), sans jamais rien supprimer.
//  2. File de recontrôle priorisée et plafonnée : les anomalies critiques
//     restent toujours incluses, illimité ; les non critiques sont triées
//     (ancienneté puis répétition) et plafonnées par quart.
//  3. Écran Contrôle Inventaire : un état "Phase terrain démarrée" dédié
//     juste après un cutover, distinct du texte générique "Initialisation".
//
// Rappel opérationnel (voir NEXUS-Data-Dictionary-v2.md v2.204) : le
// cutover réel a été exécuté sur site vito-sainte-marie le 21/08/2026 —
// 1113 alertes historiques (02/08–20/08) résolues avec motif standardisé,
// tracées dans inventaire_audit_log, 0 donnée supprimée.
//
// Même discipline que les tests précédents : extraction par regex/comptage
// d'accolades des vraies fonctions du fichier, jamais réécrites à la main.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJET = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}
async function testAsync(nom, fn) {
  try { await fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

const MOTEUR_PATH = path.join(PROJET, 'nexus-inventaire-moteur.js');
require(MOTEUR_PATH);
const M = globalThis.NexusInventaireMoteur;
assert.ok(M, 'NexusInventaireMoteur non chargé');
assert.ok(typeof M.appliquerCutoverControles === 'function', 'appliquerCutoverControles non exportée');
assert.ok(typeof M.agregerAnomaliesParProduit === 'function', 'agregerAnomaliesParProduit non exportée');

// ------------------------------------------------------------
// PARTIE 1 — appliquerCutoverControles (pur)
// ------------------------------------------------------------
(function partie1() {
  testSync('appliquerCutoverControles : aucun cutover -> renvoie les données telles quelles (comportement historique)', () => {
    const r = M.appliquerCutoverControles({ p1: '2026-08-10T10:00:00Z' }, null);
    assert.strictEqual(r.p1, '2026-08-10T10:00:00Z');
  });

  testSync('appliquerCutoverControles : contrôle antérieur au cutover -> traité comme jamais contrôlé (absent, pas null explicite)', () => {
    const r = M.appliquerCutoverControles({ p1: '2026-08-10T10:00:00Z' }, '2026-08-21T00:00:00Z');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(r, 'p1'), false);
  });

  testSync('appliquerCutoverControles : contrôle postérieur au cutover -> conservé tel quel', () => {
    const r = M.appliquerCutoverControles({ p1: '2026-08-22T10:00:00Z' }, '2026-08-21T00:00:00Z');
    assert.strictEqual(r.p1, '2026-08-22T10:00:00Z');
  });

  testSync('appliquerCutoverControles : contrôle exactement au moment du cutover -> conservé (borne inclusive)', () => {
    const r = M.appliquerCutoverControles({ p1: '2026-08-21T00:00:00Z' }, '2026-08-21T00:00:00Z');
    assert.strictEqual(r.p1, '2026-08-21T00:00:00Z');
  });

  testSync('appliquerCutoverControles : mélange de produits avant/après -> chacun traité indépendamment', () => {
    const r = M.appliquerCutoverControles({ avant: '2026-08-01T00:00:00Z', apres: '2026-08-25T00:00:00Z' }, '2026-08-21T00:00:00Z');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(r, 'avant'), false);
    assert.strictEqual(r.apres, '2026-08-25T00:00:00Z');
  });

  testSync('appliquerCutoverControles : entrée vide/undefined -> objet vide, jamais une exception', () => {
    assert.deepStrictEqual(M.appliquerCutoverControles(undefined, '2026-08-21T00:00:00Z'), {});
    assert.deepStrictEqual(M.appliquerCutoverControles({}, '2026-08-21T00:00:00Z'), {});
  });
})();

// ------------------------------------------------------------
// PARTIE 2 — agregerAnomaliesParProduit (pur)
// ------------------------------------------------------------
(function partie2() {
  testSync('agregerAnomaliesParProduit : une seule alerte -> occurrences=1, gravité reprise telle quelle', () => {
    const r = M.agregerAnomaliesParProduit([{ produit_id: 'p1', gravite: 'attention', cree_le: '2026-08-20T00:00:00Z' }]);
    assert.strictEqual(r.p1.occurrences, 1);
    assert.strictEqual(r.p1.graviteMax, 'attention');
    assert.strictEqual(r.p1.plusAncienneCreeLe, '2026-08-20T00:00:00Z');
  });

  testSync('agregerAnomaliesParProduit : une seule alerte critique parmi plusieurs -> graviteMax devient critique', () => {
    const r = M.agregerAnomaliesParProduit([
      { produit_id: 'p1', gravite: 'attention', cree_le: '2026-08-20T00:00:00Z' },
      { produit_id: 'p1', gravite: 'critique', cree_le: '2026-08-21T00:00:00Z' },
    ]);
    assert.strictEqual(r.p1.graviteMax, 'critique');
    assert.strictEqual(r.p1.occurrences, 2);
  });

  testSync('agregerAnomaliesParProduit : plusieurs occurrences -> garde la DATE la plus ANCIENNE (ancienneté réelle)', () => {
    const r = M.agregerAnomaliesParProduit([
      { produit_id: 'p1', gravite: 'attention', cree_le: '2026-08-19T00:00:00Z' },
      { produit_id: 'p1', gravite: 'attention', cree_le: '2026-08-21T00:00:00Z' },
    ]);
    assert.strictEqual(r.p1.plusAncienneCreeLe, '2026-08-19T00:00:00Z');
  });

  testSync('agregerAnomaliesParProduit : ligne sans produit_id -> ignorée sans exception', () => {
    const r = M.agregerAnomaliesParProduit([{ produit_id: null, gravite: 'critique', cree_le: '2026-08-20T00:00:00Z' }]);
    assert.deepStrictEqual(r, {});
  });

  testSync('agregerAnomaliesParProduit : liste vide/undefined -> objet vide', () => {
    assert.deepStrictEqual(M.agregerAnomaliesParProduit([]), {});
    assert.deepStrictEqual(M.agregerAnomaliesParProduit(undefined), {});
  });
})();

// ------------------------------------------------------------
// PARTIE 3 — construirePlanComptage : file priorisée et plafonnée
// ------------------------------------------------------------
(function partie3() {
  function produit(id) { return { id, actif: true }; }
  const baseArgs = {
    produits: [1, 2, 3, 4, 5].map(n => produit(`p${n}`)),
    reglesParProduit: {}, dernierControleParProduit: {},
    quart: 'matin', dateISO: '2026-08-21', socleCible: 0, surprisesCible: 0, seed: 'x',
  };

  testSync('construirePlanComptage : sans anomaliesDetailParProduit -> comportement historique inchangé (toutes les anomalies incluses, illimité)', () => {
    const r = M.construirePlanComptage(Object.assign({}, baseArgs, {
      produitsAvecAnomalieRecente: ['p1', 'p2', 'p3', 'p4', 'p5'],
    }));
    assert.strictEqual(r.items.length, 5, 'toutes incluses, comme avant ce lot');
    assert.ok(r.items.every(i => i.raison_selection === 'anomalie_recente'));
  });

  testSync('construirePlanComptage : anomalie critique -> toujours incluse, jamais comptée dans le plafond', () => {
    const detail = {
      p1: { graviteMax: 'critique', plusAncienneCreeLe: '2026-08-20', occurrences: 1 },
      p2: { graviteMax: 'attention', plusAncienneCreeLe: '2026-08-20', occurrences: 1 },
    };
    const r = M.construirePlanComptage(Object.assign({}, baseArgs, {
      anomaliesDetailParProduit: detail, plafondAnomaliesNonCritiques: 0,
    }));
    // p1 critique incluse via 'anomalie_recente' malgré un plafond non-critique à 0.
    const p1Item = r.items.find(i => i.produit_id === 'p1');
    assert.ok(p1Item && p1Item.raison_selection === 'anomalie_recente');
    // p2 (non critique, plafond=0) n'est jamais incluse via 'anomalie_recente' —
    // si elle apparaît quand même, ce ne peut être que via coverage_gap (aucun
    // dernier contrôle dans baseArgs -> en retard par le délai, indépendamment
    // de l'anomalie), jamais comme un contournement du plafond.
    const p2Item = r.items.find(i => i.produit_id === 'p2');
    assert.ok(!p2Item || p2Item.raison_selection !== 'anomalie_recente');
  });

  testSync('construirePlanComptage : anomalies non critiques -> plafonnées, priorité aux plus anciennes', () => {
    const detail = {
      p1: { graviteMax: 'attention', plusAncienneCreeLe: '2026-08-10', occurrences: 1 }, // 11 jours
      p2: { graviteMax: 'attention', plusAncienneCreeLe: '2026-08-20', occurrences: 1 }, // 1 jour
      p3: { graviteMax: 'attention', plusAncienneCreeLe: '2026-08-15', occurrences: 1 }, // 6 jours
    };
    const r = M.construirePlanComptage(Object.assign({}, baseArgs, {
      anomaliesDetailParProduit: detail, plafondAnomaliesNonCritiques: 2,
    }));
    const inclus = r.items.filter(i => i.raison_selection === 'anomalie_recente').map(i => i.produit_id).sort();
    assert.deepStrictEqual(inclus, ['p1', 'p3'], 'les deux anomalies les plus anciennes doivent passer, pas p2 (la plus récente)');
  });

  testSync('construirePlanComptage : à ancienneté égale, la plus répétée passe en premier', () => {
    const detail = {
      p1: { graviteMax: 'attention', plusAncienneCreeLe: '2026-08-15', occurrences: 1 },
      p2: { graviteMax: 'attention', plusAncienneCreeLe: '2026-08-15', occurrences: 5 },
    };
    const r = M.construirePlanComptage(Object.assign({}, baseArgs, {
      anomaliesDetailParProduit: detail, plafondAnomaliesNonCritiques: 1,
    }));
    const inclus = r.items.filter(i => i.raison_selection === 'anomalie_recente').map(i => i.produit_id);
    assert.deepStrictEqual(inclus, ['p2']);
  });

  testSync('construirePlanComptage : anomalie non critique reportée par le plafond -> reste éligible via coverage_gap si réellement en retard', () => {
    const detail = {
      p1: { graviteMax: 'attention', plusAncienneCreeLe: '2026-08-20', occurrences: 1 },
      p2: { graviteMax: 'attention', plusAncienneCreeLe: '2026-08-19', occurrences: 1 },
    };
    const r = M.construirePlanComptage(Object.assign({}, baseArgs, {
      anomaliesDetailParProduit: detail, plafondAnomaliesNonCritiques: 1,
      dernierControleParProduit: { p1: '2026-08-01' }, // p1 en retard (>7j) au sens du délai standard
    }));
    // p2 (plus ancienne anomalie) passe via anomalie_recente ; p1 (reportée par
    // le plafond) doit quand même apparaître, mais via coverage_gap.
    const p1Item = r.items.find(i => i.produit_id === 'p1');
    const p2Item = r.items.find(i => i.produit_id === 'p2');
    assert.ok(p2Item && p2Item.raison_selection === 'anomalie_recente');
    assert.ok(p1Item && p1Item.raison_selection === 'coverage_gap');
  });

  testSync('construirePlanComptage : plafond par défaut utilisé si non fourni (8)', () => {
    const detail = {};
    for (let n = 1; n <= 10; n++) detail[`p${n}`] = { graviteMax: 'attention', plusAncienneCreeLe: '2026-08-01', occurrences: 1 };
    const r = M.construirePlanComptage({
      produits: Array.from({ length: 10 }, (_, i) => produit(`p${i + 1}`)),
      reglesParProduit: {}, dernierControleParProduit: {},
      quart: 'matin', dateISO: '2026-08-21', socleCible: 0, surprisesCible: 0, seed: 'x',
      anomaliesDetailParProduit: detail,
    });
    const inclus = r.items.filter(i => i.raison_selection === 'anomalie_recente');
    assert.strictEqual(inclus.length, 8, 'plafond par défaut = 8, documenté comme choix pragmatique');
  });
})();

// ------------------------------------------------------------
// PARTIE 4 — Écran Contrôle Inventaire : renderEtatConfiance / cutover
// ------------------------------------------------------------
(function partie4() {
  const html = fs.readFileSync(path.join(PROJET, 'NEXUS-Inventaire-Manager-v1.html'), 'utf8');
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const script = scriptMatches.reduce((a, b) => (b.length > a.length ? b : a), '');
  assert.ok(script.includes('renderEtatConfianceCutover'), 'renderEtatConfianceCutover introuvable');

  function extraireFonction(nomFonction) {
    let debut = script.indexOf(`function ${nomFonction}(`);
    assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
    const prefixe = 'async ';
    if (script.slice(debut - prefixe.length, debut) === prefixe) debut -= prefixe.length;
    let i = script.indexOf('(', debut);
    let profParen = 1, k = i + 1;
    while (profParen > 0) { if (script[k] === '(') profParen++; else if (script[k] === ')') profParen--; k++; }
    let j = script.indexOf('{', k);
    let profondeur = 1, l = j + 1;
    while (profondeur > 0) { if (script[l] === '{') profondeur++; else if (script[l] === '}') profondeur--; l++; }
    return script.slice(debut, l);
  }
  function extraireObjetConst(nomConst) {
    const debut = script.indexOf(`const ${nomConst} =`);
    assert.ok(debut !== -1, `Constante ${nomConst} introuvable`);
    let k = script.indexOf('{', debut);
    let prof = 1, l = k + 1;
    while (prof > 0) { if (script[l] === '{') prof++; else if (script[l] === '}') prof--; l++; }
    return script.slice(debut, l);
  }

  const src = [
    extraireObjetConst('CLASSE_MATURITE'),
    extraireObjetConst('TEXTE_MATURITE'),
    extraireFonction('renderEtatConfianceCutover'),
    extraireFonction('renderEtatConfiance'),
    `globalThis.__test = { renderEtatConfiance };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;

  testSync('renderEtatConfiance : niveau initialisation SANS cutover -> texte générique historique (aucune mention de cutover)', () => {
    const out = T.renderEtatConfiance({ niveau: 'initialisation', libelle: 'Initialisation' }, null);
    assert.ok(out.includes('Maturité de la chaîne'));
    assert.ok(!out.includes('Phase terrain démarrée'));
  });

  testSync('renderEtatConfiance : niveau initialisation AVEC cutover -> "Phase terrain démarrée" + checklist', () => {
    const out = T.renderEtatConfiance({ niveau: 'initialisation', libelle: 'Initialisation' }, { date_heure: '2026-08-21T12:00:00Z' });
    assert.ok(out.includes('Phase terrain démarrée'));
    assert.ok(out.includes('Historique de test clôturé'));
    assert.ok(out.includes('Couverture physique à construire'));
    assert.ok(out.includes('Rapprochement Decenium à établir'));
    assert.ok(out.includes('Aucun écart réel calculé pour le moment.'));
  });

  testSync('renderEtatConfiance : niveau AU-DELÀ de initialisation avec cutover -> reprend le texte générique normal (progression naturelle)', () => {
    const out = T.renderEtatConfiance({ niveau: 'observation_terrain', libelle: 'Observation terrain' }, { date_heure: '2026-08-21T12:00:00Z' });
    assert.ok(!out.includes('Phase terrain démarrée'));
    assert.ok(out.includes('Observation terrain'));
  });

  testSync('renderEtatConfiance : maturité absente -> aucun rendu, quel que soit le cutover', () => {
    assert.strictEqual(T.renderEtatConfiance(null, { date_heure: '2026-08-21T12:00:00Z' }), '');
  });
})();

console.log(`\nRésultat : ${process.exitCode === 1 ? 'AVEC ÉCHECS' : 'OK'}`);
