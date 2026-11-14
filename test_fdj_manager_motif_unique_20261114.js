// Test — rendu réel de l'écran "État du stock FDJ" après la refonte
// "lecture managériale" (14/08/2026).
//
// Complète test_fdj_stock_lecture_manageriale.js (qui vérifie le moteur
// pur) en exécutant le VRAI script inline de NEXUS-FDJ-Manager-v1.html
// via vm.runInContext, avec un mock DOM minimal — pour attraper les bugs
// de gabarit/exécution (accès à une propriété manquante, etc.) qu'un
// simple node --check ne peut pas voir. Même convention que les tests DOM
// précédents du projet (mock générique par id, handle
// globalThis.__NEXUS_TEST__ pour exposer les `let` de plus haut niveau).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-FDJ-Manager-v1.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Attendu 1 <script> inline, trouvé ${scripts.length}`);
let scriptSrc = scripts[0];

// Le moteur réel (pas un mock) — même discipline que les autres tests DOM
// du projet : on veut vérifier le vrai calcul, pas une réimplémentation.
const moteurSrc = fs.readFileSync(path.join(DIR, 'nexus-fdj-moteur.js'), 'utf8');

function fabriquerDocument() {
  const registre = new Map();
  function elementPour(id) {
    if (!registre.has(id)) {
      registre.set(id, {
        id, value: '', textContent: '', _innerHTML: '', style: {}, dataset: {},
        classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
        addEventListener(){}, click(){},
        get innerHTML() { return this._innerHTML; },
        set innerHTML(v) { this._innerHTML = v; },
      });
    }
    return registre.get(id);
  }
  return {
    getElementById: elementPour,
    querySelectorAll() { return []; },
    querySelector() { return null; },
  };
}

const documentMock = fabriquerDocument();
const sandbox = {
  document: documentMock,
  console,
  // Pas de `window` ici : nexus-fdj-moteur.js s'attache à
  // `(typeof window !== 'undefined' ? window : globalThis)` — un `window`
  // même vide le ferait s'attacher à sandbox.window.NexusFdjMoteur au lieu
  // de sandbox.NexusFdjMoteur directement.
  nexusRequireAuth: () => new Promise(() => {}), // neutralise l'init réel (voir tests précédents du projet)
  nexusClient: {},
  Date,
};
vm.createContext(sandbox);
vm.runInContext(moteurSrc, sandbox); // NexusFdjMoteur réel, attaché à sandbox.globalThis via (window||globalThis)


scriptSrc += `
;globalThis.__NEXUS_TEST__ = {
  get edition(){ return edition; }, set edition(v){ edition = v; },
  get jeux(){ return jeux; }, set jeux(v){ jeux = v; },
  motifStockCouvertParEcart, motifCorrectionStockEffectif, certificationDemandee,
  quartEnCoursSansComptage, caisseSaisieModifiee, brouillonSansVerdict,
  correctionsStockEdition, reprefillStockInitial,
};
`;
vm.runInContext(scriptSrc, sandbox);
const H = sandbox.__NEXUS_TEST__;
const NexusFdjMoteur = sandbox.NexusFdjMoteur;
let n = 0, ko = 0;
async function test(nom, fn) {
  try { await fn(); n++; } catch (e) { ko++; console.error('ÉCHEC :', nom, '\n ', e.message); }
}
// Écart de caisse simulé : le calcul réel dépend de toute la caisse attendue,
// hors sujet ici.
let ecartSimule = -3;
sandbox.ecartCaisseEdition = () => ecartSimule;

function nouvelleEdition(extra) {
  return Object.assign({
    estNouveau: false, date: '2026-11-10', quart: 2, statutShift: 'ouvert',
    confirmeLe: null, valideLe: null, certifier: false,
    lotsPayes: 0, caisseTirages: 0, regularisations: 0, caisseReelle: 100,
    resultatControle: '', motifEcart: '', motifEcartTexte: '', ecartOrigine: null,
    motifCorrectionStock: '', stockInitialAuto: {}, stockInitialBase: {},
    avant: { lotsPayes: 0, caisseTirages: 0, regularisations: 0, caisseReelle: 100,
             resultatControle: '', motifEcart: '', motifEcartTexte: '',
             counts: { g1: { stock_initial: 22, appro: 0, stock_final: null } } },
    counts: { g1: { stock_initial: 22, appro: 0, stock_final: null } },
  }, extra || {});
}
H.jeux = [{ id: 'g1', nom: 'CASH 5€', prix: 5, tickets_par_carnet: 50 }];

(async () => {
  // --- Point 1 : un seul motif -------------------------------------------
  await test('correction de stock seule : champ requis, 5 caractères', () => {
    H.edition = nouvelleEdition();
    H.edition.counts.g1.stock_initial = 25;
    assert.strictEqual(H.correctionsStockEdition().length, 1);
    assert.strictEqual(H.motifStockCouvertParEcart(), false);
    H.edition.motifCorrectionStock = 'abc';
    assert.strictEqual(NexusFdjMoteur.motifCorrectionStockValide(H.motifCorrectionStockEffectif()), false);
    H.edition.motifCorrectionStock = 'erreur de saisie';
    assert.strictEqual(H.motifCorrectionStockEffectif(), 'erreur de saisie');
  });
  await test('correction de caisse + stock + motif d’écart : un seul motif', () => {
    H.edition = nouvelleEdition({ motifEcart: 'autre', motifEcartTexte: 'billet faux trouvé' });
    H.edition.counts.g1.stock_initial = 25;
    assert.strictEqual(H.motifStockCouvertParEcart(), true);
    assert.ok(H.motifCorrectionStockEffectif().includes('billet faux trouvé'));
    assert.ok(H.motifCorrectionStockEffectif().length >= 5);
  });
  await test('« Autre motif » sans texte ne couvre pas le stock', () => {
    H.edition = nouvelleEdition({ motifEcart: 'autre', motifEcartTexte: '' });
    H.edition.counts.g1.stock_initial = 25;
    assert.strictEqual(H.motifStockCouvertParEcart(), false);
  });
  await test('sans écart de caisse, un motif d’écart périmé ne couvre pas', () => {
    ecartSimule = 0;
    H.edition = nouvelleEdition({ motifEcart: 'autre', motifEcartTexte: 'ancien motif' });
    H.edition.counts.g1.stock_initial = 25;
    assert.strictEqual(H.motifStockCouvertParEcart(), false);
    ecartSimule = -3;
  });
  await test('aucune correction : pas de champ requis', () => {
    H.edition = nouvelleEdition();
    assert.strictEqual(H.correctionsStockEdition().length, 0);
  });

  // --- Point 2 : le stock initial affiché est celui de la base -----------
  sandbox.chargerStockInitialHerite = async () => ({ g1: 25 });
  await test('valeur en base (22) jamais remplacée par la fin précédente (25)', async () => {
    H.edition = nouvelleEdition({ stockInitialAuto: { g1: true }, stockInitialBase: { g1: true } });
    await H.reprefillStockInitial();
    assert.strictEqual(H.edition.counts.g1.stock_initial, 22);
  });
  await test('case vide : préremplie avec la fin du quart précédent', async () => {
    H.edition = nouvelleEdition({ stockInitialBase: { g1: false } });
    H.edition.counts.g1.stock_initial = null;
    await H.reprefillStockInitial();
    assert.strictEqual(H.edition.counts.g1.stock_initial, 25);
    assert.strictEqual(H.edition.stockInitialAuto.g1, true);
  });
  await test('enregistrer sans changer 22 : aucune correction, donc aucun motif', () => {
    H.edition = nouvelleEdition({ stockInitialBase: { g1: true } });
    assert.strictEqual(H.correctionsStockEdition().length, 0);
  });
  await test('22 → 25 : correction, motif requis', () => {
    H.edition = nouvelleEdition({ stockInitialBase: { g1: true } });
    H.edition.counts.g1.stock_initial = 25;
    assert.strictEqual(H.correctionsStockEdition().length, 1);
  });

  // --- Point 3 : pas de verdict sur un quart en cours --------------------
  await test('brouillon sans comptage confirmé : aucun verdict, correction de stock seule', () => {
    H.edition = nouvelleEdition();
    H.edition.counts.g1.stock_initial = 25;
    assert.strictEqual(H.quartEnCoursSansComptage(), true);
    assert.strictEqual(H.caisseSaisieModifiee(), false, 'un stock seul ne touche pas la caisse');
    assert.strictEqual(H.brouillonSansVerdict(), true);
    assert.strictEqual(H.certificationDemandee(), false);
  });
  await test('comptage confirmé, non validé : comportement actuel (case Certifier)', () => {
    H.edition = nouvelleEdition({ confirmeLe: '2026-11-10T22:00:00Z' });
    assert.strictEqual(H.quartEnCoursSansComptage(), false);
    assert.strictEqual(H.brouillonSansVerdict(), false);
    assert.strictEqual(H.certificationDemandee(), false); // case non cochée
    H.edition.certifier = true;
    assert.strictEqual(H.certificationDemandee(), true);
  });
  await test('passage à « Validé » : le verdict reste exigé', () => {
    H.edition = nouvelleEdition({ statutShift: 'valide' });
    assert.strictEqual(H.quartEnCoursSansComptage(), false);
    assert.strictEqual(H.certificationDemandee(), true);
  });
  await test('brouillon où le manager a saisi la caisse : pas de saut du verdict', () => {
    H.edition = nouvelleEdition({ caisseReelle: 90 });
    assert.strictEqual(H.caisseSaisieModifiee(), true);
    assert.strictEqual(H.brouillonSansVerdict(), false);
  });

  // --- Câblage (lu dans le texte, jamais dans git) -----------------------
  await test('câblage : motif effectif, champ masquable, branche sans verdict', () => {
    assert.ok(html.includes('id="blocMotifCorrectionStock"'));
    assert.ok(html.includes('Fin du quart précédent :'));
    assert.ok(html.includes('const motifStock = correctionsStock.length ? motifStockEffectif : null;'));
    assert.ok(html.includes('if (!edition.confirmeLe && sansVerdict) {'));
    assert.ok(html.includes('!sansVerdict && NexusFdjMoteur.motifEcartObligatoire('));
  });

  console.log(`${n} test(s) passent${ko ? `, ${ko} en échec` : ''}.`);
  if (ko) process.exit(1);
})();
