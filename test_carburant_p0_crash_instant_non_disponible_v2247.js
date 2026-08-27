// Test — P0 (27/08/2026, v2.247) : crash réel "null is not an object
// (evaluating 't1.getTime')" remonté par Frédéric depuis le Brief NEXUS
// (NEXUS-App-v1.html), consécutif à une réception carburant réelle
// (vito-sainte-marie, 26/08/2026) enregistrée avec `origine:
// 'reception_livraison'` et `mesure_le: null` (anomalie de saisie réelle,
// vérifiée en base). `M.instantFenetreReleve` renvoie honnêtement `null`
// pour ce cas (comportement voulu depuis v2.244) — mais
// `classerQuartFaceFenetre`/`resoudreVentesFenetre`/`quartsAEstimerDansFenetre`
// supposaient jusqu'ici `t0`/`t1` toujours valides et plantaient sur
// `.getTime()` d'un `null`, faisant échouer la promesse du Brief et bloquer
// l'écran d'accueil ("Analyse en cours..." figé).
//
// Ce fichier verrouille le comportement corrigé : jamais un plantage
// (Article 5), un instant manquant est traité comme un chevauchement
// honnête ('instant_non_disponible'), jamais une fausse certitude ni un
// chiffre fabriqué.

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, 'nexus-carburant-moteur.js'), 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const M = sandbox.NexusCarburantMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

const HORAIRES = {
  quart1: { etendu: '06:00', fin_etendu: '14:00' },
  quart2: { etendu: '14:00', fin_etendu: '22:00' },
};
const FUSEAU = 'UTC';

// ------------------------------------------------------------
// 1) classerQuartFaceFenetre — t0 ou t1 null -> 'instant_non_disponible',
//    jamais une exception.
// ------------------------------------------------------------
{
  const fenetreQuart = M.fenetreQuartLarge(HORAIRES, 'quart1', '2026-08-26', FUSEAU);
  const t0Valide = new Date('2026-08-26T00:00:00.000Z');
  const t1Valide = new Date('2026-08-26T15:00:00.000Z');

  assert.doesNotThrow(() => M.classerQuartFaceFenetre(fenetreQuart, t0Valide, null), 'jamais une exception quand t1 est null');
  assert.strictEqual(M.classerQuartFaceFenetre(fenetreQuart, t0Valide, null), 'instant_non_disponible');
  assert.doesNotThrow(() => M.classerQuartFaceFenetre(fenetreQuart, null, t1Valide), 'jamais une exception quand t0 est null');
  assert.strictEqual(M.classerQuartFaceFenetre(fenetreQuart, null, t1Valide), 'instant_non_disponible');
  assert.doesNotThrow(() => M.classerQuartFaceFenetre(fenetreQuart, null, null));
  assert.strictEqual(M.classerQuartFaceFenetre(fenetreQuart, null, null), 'instant_non_disponible');
  // Comportement valide inchangé (non-régression) : quart1 26/08 (06h-14h)
  // entièrement compris dans [00h,15h] -> 'dans'.
  assert.strictEqual(M.classerQuartFaceFenetre(fenetreQuart, t0Valide, t1Valide), 'dans');

  ok('classerQuartFaceFenetre — t0/t1 null traité comme instant_non_disponible, jamais une exception (P0 crash réel corrigé)');
}

// ------------------------------------------------------------
// 2) resoudreVentesFenetre — reproduit le cas réel : releveDuJour
//    (reception_livraison, mesure_le=null) rend fenetreFin null via
//    instantFenetreReleve ; jamais un plantage, retombe honnêtement en
//    "non isolable" avec une raison explicite.
// ------------------------------------------------------------
{
  const releveReceptionSansMesureLe = { date: '2026-08-26', origine: 'reception_livraison', mesure_le: null };
  const fenetreFin = M.instantFenetreReleve(releveReceptionSansMesureLe, FUSEAU);
  assert.strictEqual(fenetreFin, null, 'instantFenetreReleve doit honnêtement renvoyer null pour ce cas (comportement voulu depuis v2.244)');

  const fenetreDebut = new Date('2026-08-25T00:00:00.000Z');
  const lignesQuarts = [
    { date: '2026-08-25', quart: '1', litrage_sp95: 800, litrage_gazole: 500, litrage_gnr: null },
    { date: '2026-08-26', quart: '1', litrage_sp95: 900, litrage_gazole: 600, litrage_gnr: null },
  ];

  let resultat;
  assert.doesNotThrow(() => { resultat = M.resoudreVentesFenetre(lignesQuarts, HORAIRES, fenetreDebut, fenetreFin, FUSEAU); },
    'resoudreVentesFenetre ne doit JAMAIS planter, même avec une borne de fenêtre null (P0, cas réel 26/08 vito-sainte-marie)');
  assert.strictEqual(resultat.isolable, false, 'fenêtre non isolable quand un instant manquant empêche toute classification fiable');
  assert.ok(resultat.quartsChevauchants.some(q => q.raison === 'instant_ancre_ou_mesure_non_calculable'),
    'raison explicite distincte du chevauchement classique, pour diagnostiquer facilement ce cas précis');
  // {...} : recompose un objet natif du realm du test — vm crée ses objets
  // dans un autre realm, deepStrictEqual les juge non identiques même à
  // contenu strictement égal (même précédent que Array.from() ailleurs
  // dans le projet).
  assert.deepStrictEqual({ ...resultat.ventes }, { go: null, sp95: null, gnr: null }, 'jamais un chiffre fabriqué quand l\'instant de mesure est inconnu');

  ok('resoudreVentesFenetre — reproduit le crash réel corrigé : fenêtre non isolable honnêtement signalée, jamais un plantage');
}

// ------------------------------------------------------------
// 3) quartsAEstimerDansFenetre — même garde-fou, jamais un plantage sur un
//    t1 manquant (le mécanisme d'estimation historique de v2.246 est
//    exposé au même risque que resoudreVentesFenetre, même primitive
//    partagée classerQuartFaceFenetre).
// ------------------------------------------------------------
{
  let resultat;
  assert.doesNotThrow(() => {
    resultat = M.quartsAEstimerDansFenetre([], HORAIRES, '2026-08-26', new Date('2026-08-26T00:00:00.000Z'), null, FUSEAU);
  }, 'quartsAEstimerDansFenetre ne doit jamais planter avec t1 null');
  assert.deepStrictEqual(Array.from(resultat), [], 'aucune estimation fabriquée quand l\'instant courant est inconnu');

  ok('quartsAEstimerDansFenetre — jamais un plantage sur un t1 manquant, aucune estimation fabriquée à sa place');
}

console.log(`\n${n}/${n} tests passés.`);
