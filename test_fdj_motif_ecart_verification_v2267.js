// Test — v2.267 : "Pourquoi cet écart ?" restructuré selon le résultat de
// la vérification manager (28/08/2026, demande de Frédéric).
//
// Constat de Frédéric : au lieu d'un menu plat de 9 motifs proposé dans
// tous les cas, NEXUS doit distinguer deux situations bien différentes —
// un écart CORRIGÉ à 0 après vérification (une vraie cause est exigée,
// menu réduit) et un écart RESTANT malgré la vérification (NEXUS ne force
// jamais une fausse explication, motif automatique "Origine non
// identifiée"). "Correction après vérification" n'est plus un motif
// proposé : "ce n'est pas une cause, c'est le résultat du processus de
// vérification."
//
// Deux volets : A) le moteur pur (nexus-fdj-moteur.js, require()-é
// directement) ; B) le rendu écran réel, extrait de
// NEXUS-FDJ-Manager-v1.html (jamais réécrit à la main), avec un objet
// `edition` en mémoire reproduisant l'état réel de l'écran.

const fs = require('fs');
const assert = require('assert');

// ------------------------------------------------------------
// A) Moteur pur — situationVerificationEcart / motifsEcartCorrigeDisponibles
//    / motifEcartObligatoire (2 arguments).
// ------------------------------------------------------------
require(__dirname + '/nexus-fdj-moteur.js');
const M = globalThis.NexusFdjMoteur;

assert.strictEqual(M.situationVerificationEcart(0, 12), 'corrige_a_zero', 'Écart initial +12€, ramené à 0 -> corrigé à zéro');
assert.strictEqual(M.situationVerificationEcart(0, -8), 'corrige_a_zero', 'Écart initial négatif aussi -> corrigé à zéro');
assert.strictEqual(M.situationVerificationEcart(0, null), 'aucun_ecart', 'Jamais eu d\'écart initial -> rien à expliquer');
assert.strictEqual(M.situationVerificationEcart(0, 0), 'aucun_ecart', 'Écart initial déjà nul -> rien à expliquer');
assert.strictEqual(M.situationVerificationEcart(2, 12), 'restant', 'Écart final non nul -> restant, même avec un écart initial connu');
assert.strictEqual(M.situationVerificationEcart(-2, null), 'restant', 'Écart final non nul -> restant, même sans écart initial connu (création manager directe)');
assert.strictEqual(M.situationVerificationEcart(null, 12), 'aucun_ecart', 'Écart final pas encore calculable -> rien à expliquer');
console.log('OK — situationVerificationEcart : les 3 branches, y compris les cas limites (null, création manager directe).');

const optsPositif = M.motifsEcartCorrigeDisponibles(12);
assert.strictEqual(optsPositif.some(o => o.value === 'remboursement'), false, 'Écart initial EXCÉDENT -> jamais "Remboursement" proposé');
assert.deepStrictEqual(optsPositif.map(o => o.value), ['', 'erreur_comptage', 'erreur_saisie', 'erreur_montant_caisse', 'erreur_rapport'], 'Menu réduit exact pour un excédent corrigé');
const optsNegatif = M.motifsEcartCorrigeDisponibles(-8);
assert.strictEqual(optsNegatif.some(o => o.value === 'remboursement'), true, 'Écart initial MANQUE -> "Remboursement" proposé en plus');
assert.strictEqual(optsNegatif[optsNegatif.length - 1].value, 'remboursement', 'Remboursement ajouté en dernier, jamais substitué aux 4 causes de base');
console.log('OK — motifsEcartCorrigeDisponibles : "Remboursement" seulement si l\'écart initial était un manque (négatif).');

assert.strictEqual(M.motifEcartObligatoire(0, 12), true, 'Corrigé à zéro -> une cause reste obligatoire');
assert.strictEqual(M.motifEcartObligatoire(0, null), false, 'Rien à expliquer -> pas de motif obligatoire');
assert.strictEqual(M.motifEcartObligatoire(0, 0), false, 'Écart initial déjà nul -> pas de motif obligatoire');
assert.strictEqual(M.motifEcartObligatoire(2, 12), true, 'Écart restant -> motif obligatoire (auto "Origine non identifiée")');
assert.strictEqual(M.motifEcartObligatoire(2, null), true, 'Écart restant sans origine connue -> motif obligatoire aussi');
// Rétrocompatibilité stricte avec l'ancien appel à 1 argument (voir
// test_fdj_statut_derive_ecart_verdict.js, jamais modifié par ce lot).
assert.strictEqual(M.motifEcartObligatoire(0), false);
assert.strictEqual(M.motifEcartObligatoire(1.00), true);
console.log('OK — motifEcartObligatoire : nouvelle règle 2-arguments, rétrocompatible avec l\'ancien appel à 1 argument.');

// ------------------------------------------------------------
// B) Rendu écran réel — extrait de NEXUS-FDJ-Manager-v1.html.
// ------------------------------------------------------------
const html = fs.readFileSync(__dirname + '/NEXUS-FDJ-Manager-v1.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(nomFonction) {
  const debut = script.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable dans NEXUS-FDJ-Manager-v1.html`);
  let i = script.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '{') profondeur++;
    else if (script[j] === '}') profondeur--;
    j++;
  }
  return script.slice(debut, j);
}
function extraireConst(nomConst) {
  const debut = script.indexOf(`const ${nomConst} = [`);
  assert.ok(debut !== -1, `Constante ${nomConst} introuvable`);
  const fin = script.indexOf('];', debut) + 2;
  return script.slice(debut, fin);
}

function construireContexte(motifInitial) {
  const src = [
    `let edition = { motifEcart: ${JSON.stringify(motifInitial)}, motifEcartTexte: '' };`,
    `function fmtEuro(n) { return (n === null || n === undefined || isNaN(n)) ? '—' : (Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €'; }`,
    extraireConst('MOTIFS_ECART_FDJ'),
    extraire('labelMotifEcart'),
    extraire('renderBlocMotifCorrige'),
    extraire('renderBlocMotifRestant'),
    extraire('renderBlocMotifEcart'),
    extraire('synchroniserMotifEcartAvecVerification'),
    'globalThis.__test = { renderBlocMotifEcart, synchroniserMotifEcartAvecVerification, edition: () => edition, NexusFdjMoteur: globalThis.NexusFdjMoteur };',
  ].join('\n\n');

  const vm = require('vm');
  const ctx = { globalThis: {}, console, NexusFdjMoteur: M };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  return ctx.__test;
}

// 1) Aucun écart -> bloc entièrement masqué.
let t = construireContexte('');
assert.strictEqual(t.renderBlocMotifEcart(0, null), '', 'Rien à expliquer -> bloc vide');
assert.strictEqual(t.renderBlocMotifEcart(0, 0), '', 'Écart initial déjà nul -> bloc vide');
console.log('OK — écran : aucun écart -> bloc "Pourquoi cet écart ?" entièrement masqué.');

// 2) Corrigé à zéro, écart initial positif -> menu réduit, sans Remboursement,
//    sans "Correction après vérification", sans "Autre motif".
t = construireContexte('');
let bloc = t.renderBlocMotifEcart(0, 12.00);
assert.ok(bloc.includes('Écart initial'), 'Le contexte de la vérification doit être rappelé');
assert.ok(bloc.includes('+12,00'), 'Montant de l\'écart initial affiché');
assert.ok(bloc.includes('Erreur de comptage'), 'Cause "Erreur de comptage" proposée');
assert.ok(bloc.includes('Erreur sur le montant de caisse'), 'Nouvelle cause "Erreur sur le montant de caisse" proposée');
assert.ok(!bloc.includes('Remboursement'), 'Excédent -> "Remboursement" ne doit pas être proposé');
assert.ok(!bloc.includes('Correction après vérification'), '"Correction après vérification" ne doit plus jamais être proposé (ce n\'est pas une cause)');
assert.ok(!bloc.includes('>Autre motif<'), '"Autre motif" ne fait plus partie du menu réduit');
assert.ok(!bloc.includes('Carnet non déclaré'), 'Motifs de stock hors-sujet retirés du menu de vérification caisse');
console.log('OK — écran : écart corrigé à 0 (excédent initial) -> menu réduit exact, sans Remboursement ni motifs hors-sujet.');

// 3) Corrigé à zéro, écart initial négatif -> Remboursement proposé en plus.
bloc = t.renderBlocMotifEcart(0, -8.00);
assert.ok(bloc.includes('Remboursement'), 'Manque initial -> "Remboursement" doit être proposé');
console.log('OK — écran : écart corrigé à 0 (manque initial) -> "Remboursement" proposé en plus.');

// 4) Restant, excédent -> badge "Excédent non expliqué", pas de <select>.
bloc = t.renderBlocMotifEcart(2.00, null);
assert.ok(bloc.includes('🟢 Excédent non expliqué'), 'Badge excédent non expliqué attendu');
assert.ok(bloc.includes('Non identifiée'), 'Origine affichée comme non identifiée');
assert.ok(!bloc.includes('<select'), 'Aucun menu déroulant forcé quand l\'écart persiste — jamais une fausse explication');
console.log('OK — écran : écart restant positif -> "Excédent non expliqué", aucun choix forcé.');

// 5) Restant, manque, même avec un écart initial connu (le manager n'a rien
//    pu corriger) -> "Manque non expliqué", toujours pas de menu.
bloc = t.renderBlocMotifEcart(-2.00, 12.00);
assert.ok(bloc.includes('🔴 Manque non expliqué'), 'Badge manque non expliqué attendu');
assert.ok(!bloc.includes('<select'), 'Toujours aucun menu déroulant tant que l\'écart persiste');
console.log('OK — écran : écart restant négatif (même avec écart initial connu) -> "Manque non expliqué", aucun choix forcé.');

// 6) synchroniserMotifEcartAvecVerification — auto-motif et remise à zéro.
t = construireContexte('mouvement_oublie'); // ancien motif hors-menu, doit être effacé
t.synchroniserMotifEcartAvecVerification(0, 12.00);
assert.strictEqual(t.edition().motifEcart, '', 'Un motif hors du nouveau menu réduit doit être réinitialisé, jamais laissé affiché à tort');
console.log('OK — synchronisation : motif obsolète (hors menu réduit) réinitialisé face à un écart corrigé à 0.');

t = construireContexte('erreur_comptage');
t.synchroniserMotifEcartAvecVerification(0, 12.00);
assert.strictEqual(t.edition().motifEcart, 'erreur_comptage', 'Un motif déjà valide dans le nouveau menu doit être conservé');
console.log('OK — synchronisation : motif déjà valide conservé, jamais réinitialisé sans raison.');

t = construireContexte('');
t.synchroniserMotifEcartAvecVerification(-5.00, null);
assert.strictEqual(t.edition().motifEcart, 'non_explique', 'Écart restant -> auto-motif "Origine non identifiée" (non_explique), jamais un choix manuel exigé');
console.log('OK — synchronisation : auto-motif "non_explique" posé automatiquement quand l\'écart persiste.');

t = construireContexte('erreur_comptage');
t.synchroniserMotifEcartAvecVerification(0, null);
assert.strictEqual(t.edition().motifEcart, '', 'Rien à expliquer -> motif et commentaire réinitialisés');
console.log('OK — synchronisation : motif réinitialisé quand il n\'y a plus rien à expliquer.');

console.log('Tous les tests "Pourquoi cet écart ?" (v2.267) passent.');
