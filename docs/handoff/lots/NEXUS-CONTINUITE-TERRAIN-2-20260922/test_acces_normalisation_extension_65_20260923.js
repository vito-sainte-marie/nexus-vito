// ============================================================================
// NORMALISATION `.html` DE `nexusCategorieAcces` (candidate #65, 23/09/2026)
//
// POURQUOI. `nexus-page.js` existe précisément parce que Cloudflare Pages
// retire l'extension `.html` de l'URL servie — ce qui a déjà produit une
// boucle de redirection infinie sur la prise de poste (04/09/2026, avant que
// `NexusPage` n'existe). `nexus-auth.js` ne peut pas dépendre de
// `nexus-page.js` (Production est servie BRUTE par GitHub Pages, sans build :
// voir le commentaire au-dessus de `nexusCategorieAcces`). Si la candidate
// #65 est un jour servie via Cloudflare Pages avec le retrait d'extension
// actif, le même défaut peut réapparaître : un écran de CONSULTATION
// (`NEXUS-App-v1`, sans `.html`) ne correspondrait plus à aucune entrée des
// listes, et retomberait sur le défaut OPÉRATIONNEL — pas une ouverture,
// mais un blocage de navigation inattendu.
//
// CE QUE CE FICHIER PROUVE, et comment. Le bloc de règle est EXTRAIT de
// `nexus-auth.js` et exécuté tel quel dans un contexte vm — jamais réécrit à
// la main, exactement comme `test_acces_hors_service_20260916.js`. Deux
// choses sont établies par exécution, pas par lecture :
//   1. un identifiant avec et sans `.html` produit EXACTEMENT la même
//      catégorie, pour un représentant de chacune des quatre catégories et
//      pour un écran inconnu (le défaut n'est pas altéré) ;
//   2. la normalisation ne DEVIENT pas une correspondance approximative :
//      un identifiant qui n'est PAS, une fois normalisé, strictement égal à
//      une entrée de liste ne doit matcher personne — vérifié à la fois sur
//      la règle réelle ET sur une variante délibérément élargie (préfixe
//      plutôt qu'égalité), pour prouver que ce contre-test a réellement les
//      moyens d'attraper un élargissement, pas seulement de l'espérer.
// ============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const RACINE = __dirname;
const AUTH = fs.readFileSync(path.join(RACINE, 'nexus-auth.js'), 'utf8');

const D = AUTH.indexOf('/* NEXUS-ACCES-REGLE:DEBUT');
const F = AUTH.indexOf('/* NEXUS-ACCES-REGLE:FIN */');
assert.ok(D !== -1 && F > D, 'le bloc de règle d\'accès a disparu de nexus-auth.js');
const BLOC = AUTH.slice(D, F);

assert.ok(/function nexusIdentifiantAccesNormalise\(/.test(BLOC),
  'la normalisation `.html` doit vivre DANS le bloc pur, comme le reste de la règle — ' +
  'sinon une épreuve qui l\'extrait séparément mesurerait une copie, pas le fichier réel');

function chargerRegle(bloc) {
  const ctx = { console };
  vm.runInNewContext(
    bloc + '\nthis.nexusCategorieAcces = nexusCategorieAcces;' +
           '\nthis.nexusIdentifiantAccesNormalise = nexusIdentifiantAccesNormalise;' +
           '\nthis.LISTES = { sequence: NEXUS_PAGES_SEQUENCE_OBLIGATOIRE, consultation: NEXUS_PAGES_CONSULTATION,' +
           ' operationnel: NEXUS_PAGES_OPERATIONNELLES, publique: NEXUS_PAGES_PUBLIQUES };',
    ctx);
  for (const k of Object.keys(ctx.LISTES)) ctx.LISTES[k] = Array.from(ctx.LISTES[k]);
  return ctx;
}

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// Un représentant mesuré de chaque catégorie, plus un écran inconnu — le
// même échantillon que `test_acces_hors_service_20260916.js`, pour rester
// une PREUVE du fichier réel et non un nouvel inventaire divergent.
const REPRESENTANTS = [
  ['NEXUS-Pointage-v1.html', 'sequence'],
  ['NEXUS-Prise-De-Poste-v1.html', 'sequence'],
  ['NEXUS-App-v1.html', 'consultation'],
  ['NEXUS-Cockpit-v2.html', 'consultation'],
  ['NEXUS-Login-v1.html', 'publique'],
  ['NEXUS-Missions-v1.html', 'operationnel'],
  ['NEXUS-Carburants-v1.html', 'operationnel'],
  ['NEXUS-Ecran-Qui-Nexiste-Pas-v9.html', 'operationnel'],
];

const sansExtension = (p) => p.replace(/\.html$/, '');

// ── 1. Équivalence avec/sans extension — sur la règle RÉELLE ───────────────

t('avec et sans `.html`, un écran connu produit exactement la même catégorie', () => {
  const r = chargerRegle(BLOC);
  for (const [page, attendu] of REPRESENTANTS) {
    const avecExt = r.nexusCategorieAcces(page);
    const sansExt = r.nexusCategorieAcces(sansExtension(page));
    assert.strictEqual(avecExt, attendu, `${page} (avec .html) devrait être ${attendu}`);
    assert.strictEqual(sansExt, attendu, `${sansExtension(page)} (sans .html) devrait être ${attendu}`);
    assert.strictEqual(avecExt, sansExt, `${page} : les deux formes divergent`);
  }
});

t('un écran inconnu reste OPÉRATIONNEL, avec ou sans extension — le défaut n\'a pas bougé', () => {
  const r = chargerRegle(BLOC);
  assert.strictEqual(r.nexusCategorieAcces('NEXUS-Fantome-v1.html'), 'operationnel');
  assert.strictEqual(r.nexusCategorieAcces('NEXUS-Fantome-v1'), 'operationnel');
  assert.strictEqual(r.nexusCategorieAcces(''), 'operationnel');
  assert.strictEqual(r.nexusCategorieAcces(undefined), 'operationnel');
});

// ── 2. La normalisation n'élargit AUCUNE catégorie ──────────────────────────
// La comparaison doit rester une ÉGALITÉ stricte après normalisation, jamais
// une correspondance partielle. Un identifiant qui n'est, une fois normalisé,
// strictement égal à AUCUNE entrée de liste ne doit matcher personne — même
// s'il partage un préfixe ou un suffixe avec un écran réellement classé.

t('un identifiant proche d\'un écran connu, mais non identique, ne matche personne', () => {
  const r = chargerRegle(BLOC);
  // Préfixe d'un écran de CONSULTATION réel : doit rester OPÉRATIONNEL
  // (le défaut), pas glisser vers 'consultation' par ressemblance.
  assert.strictEqual(r.nexusCategorieAcces('NEXUS-App-v1-Faux.html'), 'operationnel',
    'un suffixe supplémentaire après normalisation ne doit pas matcher NEXUS-App-v1');
  assert.strictEqual(r.nexusCategorieAcces('NEXUS-App-v1-Faux'), 'operationnel');
  // Une extension redoublée ne doit pas non plus se réduire à l'identifiant nu.
  assert.strictEqual(r.nexusCategorieAcces('NEXUS-App-v1.html.html'), 'operationnel',
    'seul UN suffixe `.html` terminal est retiré, jamais une réduction en boucle');
  // Un préfixe partiel d'un écran connu ne doit pas non plus matcher.
  assert.strictEqual(r.nexusCategorieAcces('NEXUS-App-v1'.slice(0, -1)), 'operationnel');
});

// ── 3. Le contre-test a des dents : une variante élargie EST détectée ──────
// On construit une mutation locale, réaliste, de `nexusCategorieAcces` — une
// correspondance par PRÉFIXE au lieu d'une égalité stricte après
// normalisation — et on prouve qu'elle échoue exactement l'épreuve ci-dessus.
// Si cette section ne détectait rien, la section 2 ne prouverait rien non
// plus : elle pourrait passer au vert quelle que soit l'implémentation.

t('mutation : une correspondance par préfixe élargit bien « consultation » — et l\'épreuve la détecte', () => {
  const EGALITE_STRICTE = 'liste.some(entree => nexusIdentifiantAccesNormalise(entree) === cible)';
  assert.ok(BLOC.includes(EGALITE_STRICTE),
    'le texte muté ci-dessous suppose cette forme exacte dans le fichier réel — ' +
    'si ce texte a changé, ce contre-test doit être mis à jour avec lui');

  const ELARGIE = 'liste.some(entree => cible.indexOf(nexusIdentifiantAccesNormalise(entree)) === 0)';
  const BLOC_MUTE = BLOC.replace(EGALITE_STRICTE, ELARGIE);
  assert.notStrictEqual(BLOC_MUTE, BLOC, 'la mutation doit avoir réellement changé le texte chargé');

  const rMute = chargerRegle(BLOC_MUTE);
  // La variante élargie (préfixe) DOIT laisser passer 'NEXUS-App-v1-Faux' en
  // 'consultation' : c'est exactement l'élargissement qu'une correspondance
  // par préfixe introduirait, et exactement ce que la section 2 interdit sur
  // la règle réelle.
  assert.strictEqual(rMute.nexusCategorieAcces('NEXUS-App-v1-Faux.html'), 'consultation',
    'la mutation devrait élargir la catégorie — sinon elle ne prouve rien');

  // Et la règle RÉELLE, elle, refuse toujours ce même identifiant.
  const rReel = chargerRegle(BLOC);
  assert.strictEqual(rReel.nexusCategorieAcces('NEXUS-App-v1-Faux.html'), 'operationnel',
    'la règle réelle doit rester fermée là où la mutation s\'est ouverte');
});

(() => {
  console.log(`\n${passes} vérifications passées — l'extension \`.html\` ne change jamais la catégorie d'un écran, et la comparaison reste stricte.\n`);
})();
