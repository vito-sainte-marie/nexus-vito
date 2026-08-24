// Test — Traçabilité traité/résolu dans le Journal NEXUS (24/08/2026,
// v2.231, audit "NEXUS_Audit_Cockpit_Ameliorations_Developpeur.pdf" §12
// "Boucle de traitement" — dernier chantier choisi par Frédéric
// ("tracabilité go") après le langage niveau de preuve (v2.230).
//
// §12 — L'audit : "NEXUS trace l'action et la preuve éventuelle... Cycle
// de vie explicite et auditable." et le test d'acceptation exact :
// "Le bouton « Marquer comme traité » journalise l'action sans supprimer
// l'historique du signal."
//
// Avant ce lot, DEUX actions "Marquer comme traité" du Cockpit/Brief
// n'apparaissaient dans AUCUN historique visible :
//  - la case "Justifié" sur un écart de caisse (écrit un commentaire texte
//    sur audits_caisse, mais sans horodatage dédié avant v2.231 — colonne
//    commentaire_le ajoutée par la migration
//    ajouter_commentaire_le_audits_caisse) ;
//  - "Marquer comme fait" sur un rappel (rappels.fait_le existait déjà,
//    simplement jamais lu par ce Journal).
//
// Ce test NE duplique PAS un moteur .js dédié : NEXUS-Journal-v1.html n'a
// pas de fichier moteur séparé (toute sa logique est inline). Il extrait
// donc le code source réel de echapperHtml/construireEvenements
// directement depuis le fichier HTML livré (pas une copie récrite à la
// main) et l'exécute dans un contexte isolé (vm.Script) — pour tester le
// VRAI code qui s'exécute à l'écran, conformément à l'Article 5 ("jamais
// une fausse précision").
//
// Portée volontairement étroite (voir aussi la doctrine "prématuré"
// suivie tout au long de ce chantier) : produits (déjà tracé via
// journal_decisions + renderBouclage) et stock (résolution 100%
// automatique, sans bouton "traité") sont hors périmètre — seuls caisse
// et rappel avaient un vrai trou de traçabilité.

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const htmlPath = path.join(__dirname, 'NEXUS-Journal-v1.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const startMarker = 'function echapperHtml';
const endMarker = 'function renderRoot';
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker);
assert.ok(start > -1 && end > start, 'les marqueurs d\'extraction (echapperHtml -> renderRoot) doivent exister dans NEXUS-Journal-v1.html — si ce test casse ici, la structure du fichier a changé et l\'extraction doit être adaptée, pas contournée');

const source = html.slice(start, end) + '\nmodule.exports = { echapperHtml, construireEvenements };';
const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
new vm.Script(source, { filename: 'NEXUS-Journal-v1.html (extrait)' }).runInContext(sandbox);
const { echapperHtml, construireEvenements } = sandbox.module.exports;

assert.strictEqual(typeof echapperHtml, 'function', 'echapperHtml doit être extrait avec succès du fichier réel');
assert.strictEqual(typeof construireEvenements, 'function', 'construireEvenements doit être extrait avec succès du fichier réel');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) Caisse justifiée — apparaît dans la timeline avec dot-signal, sans
//    prétendre que le sujet est "Résolu" (juste le fait daté).
// ------------------------------------------------------------
{
  const caisseJustifiee = [
    { id: 1, date: '2026-08-24', quart: 'Q1', ecart_total: -12.5, commentaire: 'Erreur de rendu monnaie corrigée', commentaire_le: '2026-08-24T09:15:00.000Z' },
  ];
  const evts = construireEvenements([], [], [], {}, caisseJustifiee, []);
  assert.strictEqual(evts.length, 1);
  const e = evts[0];
  assert.strictEqual(e.type, 'signal', 'le type doit être "signal" pour être routé par le nouveau filtre TYPE_PAR_FILTRE');
  assert.strictEqual(e.dot, 'dot-signal');
  assert.ok(e.texte.includes('Écart de caisse justifié'));
  assert.ok(e.texte.includes('Q1'));
  assert.ok(e.meta.includes('Erreur de rendu monnaie corrigée'), 'le commentaire de justification doit être repris tel quel (Article 5 — aucune reformulation inventée)');
  assert.ok(e.valeur.includes('13€') || e.valeur.includes('-13€') || e.valeur.includes('12€'), 'l\'écart chiffré doit rester visible (arrondi), preuve non effacée par la trace');
  assert.ok(e.heure.length > 0, 'l\'heure doit être dérivée de commentaire_le (le nouvel horodatage v2.231)');
  ok('construireEvenements — écart de caisse justifié apparaît en événement "signal" daté, avec le commentaire et l\'écart d\'origine intacts');
}

// ------------------------------------------------------------
// 2) Rappel fait — apparaît dans la timeline, texte libre échappé (même
//    précédent que anomalie_signalee pour les pointages).
// ------------------------------------------------------------
{
  const rappelsFaits = [
    { id: 7, texte: 'Appeler le fournisseur <script>alert(1)</script>', fait_le: '2026-08-24T14:03:00.000Z' },
  ];
  const evts = construireEvenements([], [], [], {}, [], rappelsFaits);
  assert.strictEqual(evts.length, 1);
  const e = evts[0];
  assert.strictEqual(e.type, 'signal');
  assert.strictEqual(e.dot, 'dot-signal');
  assert.ok(e.texte.includes('Rappel marqué comme fait'));
  assert.ok(!e.texte.includes('<script>'), 'le texte libre du rappel doit être échappé via echapperHtml, comme anomalie_signalee sur les pointages (précédent établi 28/07/2026)');
  assert.ok(e.texte.includes('&lt;script&gt;'));
  ok('construireEvenements — rappel fait apparaît en événement "signal" daté, texte libre échappé contre l\'injection HTML');
}

// ------------------------------------------------------------
// 3) Aucun signal traité aujourd'hui — non-régression, aucun événement
//    fabriqué, les autres catégories restent inchangées.
// ------------------------------------------------------------
{
  const decisions = [{ heure: '08:00', rule_id: 'R2-BAISSE', article: 'X', impact_eur: 100, recommandation: 'Vérifiez X' }];
  const evts = construireEvenements(decisions, [], [], {}, [], []);
  assert.strictEqual(evts.length, 1);
  assert.strictEqual(evts[0].type, 'decision');
  assert.ok(!evts.some(e => e.type === 'signal'));
  ok('construireEvenements — non-régression : sans caisse justifiée ni rappel fait, aucun événement "signal" fabriqué, les décisions restent inchangées');
}

// ------------------------------------------------------------
// 4) Tri chronologique décroissant — un signal traité se mélange
//    correctement avec les autres catégories dans la même timeline.
// ------------------------------------------------------------
{
  const decisions = [{ heure: '08:00', rule_id: 'R2-BAISSE', article: 'X', impact_eur: 100, recommandation: 'Vérifiez X' }];
  const caisseJustifiee = [{ id: 1, date: '2026-08-24', quart: 'Q1', ecart_total: -5, commentaire: 'ok', commentaire_le: '2026-08-24T15:30:00.000Z' }];
  const evts = construireEvenements(decisions, [], [], {}, caisseJustifiee, []);
  assert.strictEqual(evts.length, 2);
  assert.strictEqual(evts[0].type, 'signal', 'le signal (15:30) doit passer avant la décision (08:00) dans le tri décroissant');
  ok('construireEvenements — un signal traité se trie correctement, par heure, avec les autres catégories existantes');
}

console.log(`\n${n}/${n} tests passés — Traçabilité traité/résolu du Journal NEXUS (v2.231).`);
