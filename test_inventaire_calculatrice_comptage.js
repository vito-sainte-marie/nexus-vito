// Test — Calculatrice de comptage (16/08/2026, demande de Frédéric —
// "possible d'intégrer une calculatrice ?", écran carrousel "Comptage
// dépôt" de NEXUS-Inventaire-v1.html).
//
// Deux briques testées ici, extraites du VRAI fichier via regex (jamais
// réécrites à la main — même discipline que les autres suites de tests de
// ce module) :
//   1) evaluerAdditionChainee() — parseur d'addition en chaîne ("6+6+12"),
//      qui remplace parseFloat() partout où un comptage est lu.
//   2) Le moteur de la calculatrice pop-up (+ − × ÷) : calcApplique,
//      calcAppuiChiffre, calcAppuiOperateur, calcAppuiEgal.
//
// Ces deux fonctions sont pures (aucune dépendance au DOM/Supabase), donc
// testées directement plutôt que via le harnais mock-DOM complet des autres
// suites de ce module — la couverture reste réelle : c'est exactement le
// code qui tourne dans le navigateur, extrait tel quel.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const cheminHtml = path.join(__dirname, 'NEXUS-Inventaire-v1.html');
const html = fs.readFileSync(cheminHtml, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function extraireFonction(nom) {
  const re = new RegExp('function ' + nom + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}');
  const m = script.match(re);
  if (!m) throw new Error('Fonction introuvable dans NEXUS-Inventaire-v1.html : ' + nom);
  return m[0];
}

// ------------------------------------------------------------
// 1) evaluerAdditionChainee
// ------------------------------------------------------------
let sandbox1 = {};
new Function('sandbox', extraireFonction('evaluerAdditionChainee') + '\nsandbox.evaluerAdditionChainee = evaluerAdditionChainee;')(sandbox1);
const { evaluerAdditionChainee } = sandbox1;

const casChaine = [
  ['24', 24],                    // nombre seul, comportement historique inchangé
  ['6+6+12', 24],                // addition en chaîne — le cas d'usage demandé
  ['10-2+3', 11],                // mélange +/-
  [' 6 + 6 ', 12],               // espaces tolérés
  ['6,5+3,5', 10],               // virgule française
  ['-3', -3],                    // nombre négatif seul (valide arithmétiquement)
  ['0', 0],
  ['', NaN],                     // champ vide
  ['6+', NaN],                   // chaîne incomplète (en cours de frappe) — jamais bloquant
  ['6*2', NaN],                  // opérateur non supporté ici -> calculatrice pop-up
  ['abc', NaN],                  // texte
  ['6++6', NaN],                 // deux opérateurs à la suite, jamais interprété au hasard
];
for (const [entree, attendu] of casChaine) {
  const res = evaluerAdditionChainee(entree);
  if (Number.isNaN(attendu)) assert.ok(Number.isNaN(res), `evaluerAdditionChainee(${JSON.stringify(entree)}) devrait être NaN, obtenu ${res}`);
  else assert.strictEqual(res, attendu, `evaluerAdditionChainee(${JSON.stringify(entree)}) devrait valoir ${attendu}, obtenu ${res}`);
}
console.log('OK — evaluerAdditionChainee : ' + casChaine.length + ' cas passent (addition en chaîne, virgule FR, chaînes invalides jamais bloquantes).');

// ------------------------------------------------------------
// 2) Moteur calculatrice pop-up (+ − × ÷)
// ------------------------------------------------------------
let sandbox2 = { calcEtat: null };
const srcCalc = [
  'sandbox.calcEtat = null;',
  extraireFonction('calcApplique'),
  'function majAffichageCalc(){}', // dépend du DOM réel, no-op ici
  extraireFonction('calcAppuiChiffre').replace(/calcEtat/g, 'sandbox.calcEtat'),
  extraireFonction('calcAppuiOperateur').replace(/calcEtat/g, 'sandbox.calcEtat'),
  extraireFonction('calcAppuiEgal').replace(/calcEtat/g, 'sandbox.calcEtat'),
  'sandbox.calcAppuiChiffre = calcAppuiChiffre;',
  'sandbox.calcAppuiOperateur = calcAppuiOperateur;',
  'sandbox.calcAppuiEgal = calcAppuiEgal;',
].join('\n');
new Function('sandbox', srcCalc)(sandbox2);

function nouvelEtat() { return { affichage: '0', accumulateur: null, operateurEnAttente: null, effacerAuProchainChiffre: false }; }

sandbox2.calcEtat = nouvelEtat();
'6+6='.split('').forEach(c => {
  if (c === '=') sandbox2.calcAppuiEgal();
  else if (['+', '-', '*', '/'].includes(c)) sandbox2.calcAppuiOperateur(c);
  else sandbox2.calcAppuiChiffre(c);
});
assert.strictEqual(sandbox2.calcEtat.affichage, '12', '6+6= devrait afficher 12');

sandbox2.calcEtat = nouvelEtat();
'8*3-4='.split('').forEach(c => {
  if (c === '=') sandbox2.calcAppuiEgal();
  else if (['+', '-', '*', '/'].includes(c)) sandbox2.calcAppuiOperateur(c);
  else sandbox2.calcAppuiChiffre(c);
});
assert.strictEqual(sandbox2.calcEtat.affichage, '20', '8×3−4= devrait afficher 20 (calcul séquentiel, comme une calculatrice physique)');

sandbox2.calcEtat = nouvelEtat();
sandbox2.calcAppuiChiffre('7'); sandbox2.calcAppuiChiffre(','); sandbox2.calcAppuiChiffre('5');
sandbox2.calcAppuiOperateur('+');
sandbox2.calcAppuiChiffre('2'); sandbox2.calcAppuiChiffre(','); sandbox2.calcAppuiChiffre('5');
sandbox2.calcAppuiEgal();
assert.strictEqual(sandbox2.calcEtat.affichage, '10', '7,5+2,5= devrait afficher 10 (décimales avec virgule française)');

sandbox2.calcEtat = nouvelEtat();
sandbox2.calcAppuiChiffre('9'); sandbox2.calcAppuiOperateur('/'); sandbox2.calcAppuiChiffre('0'); sandbox2.calcAppuiEgal();
assert.strictEqual(sandbox2.calcEtat.affichage, 'Erreur', '9÷0= devrait afficher "Erreur", jamais planter ni afficher Infinity');

console.log('OK — moteur calculatrice pop-up : 4 séquences passent (chaîné, ×/−, virgule FR, division par zéro).');
console.log('Tous les tests calculatrice de comptage passent.');
