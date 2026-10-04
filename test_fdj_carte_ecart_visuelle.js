// Test — Rendu employé du résultat de caisse FDJ.
//
// 16/08/2026, demande de Frédéric : "fais en sorte comme la caisse boutique
// ou piste que les employé voient leurs ecart validée en FDJ. structure bien
// le visuels afin que ce soit simple, intuitif et graphiquement agreable".
// Cette exigence n'a jamais été annulée — c'est son RENDU qui a changé.
//
// Vague 1 (17/09/2026) — ce test portait sur renderCarteEcart() /
// phraseEcartCaisse() / LIBELLES_STATUT_CAISSE, tous trois supprimés de
// NEXUS-FDJ-v1.html. Deux raisons, l'une et l'autre écrites dans le mandat :
//
//   1. §4 — ces fonctions recevaient la ligne fdj_cash_controls entière, donc
//      le motif interne du manager et l'identité du validateur. « Aucun champ
//      sensible reçu dans le réseau puis simplement masqué dans l'interface. »
//   2. §3.3 — elles RECOMPOSAIENT le vocabulaire (« Excédent de X € »,
//      « Écart détecté », badge "En attente de validation"). Les libellés sont
//      désormais fixés par le serveur (fdj_libelle_ecart_employe) et recopiés
//      tels quels. Une phrase écrite dans un écran finit toujours par diverger
//      de la règle.
//
// Le test suit donc le nouveau rendu — pointDeCaisseHTML(), alimenté par
// fdj_ma_caisse() — et vérifie AUTANT ce qui est affiché que ce qui ne doit
// plus l'être : un test qui n'interdit rien ne prouve rien.

const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync(__dirname + '/NEXUS-FDJ-v1.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(nomFonction) {
  const debut = script.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable dans NEXUS-FDJ-v1.html`);
  let i = script.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '{') profondeur++;
    else if (script[j] === '}') profondeur--;
    j++;
  }
  return script.slice(debut, j);
}

const srcPointDeCaisse = extraire('pointDeCaisseHTML');

const src = [
  `function fmtEuro(n) { return (n === null || n === undefined || isNaN(n)) ? '—' : (Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €'; }`,
  extraire('heureCourte'),
  extraire('dateHeureCourte'),
  srcPointDeCaisse,
  extraire('detailCaisseHTML'),
  'globalThis.__test = { pointDeCaisseHTML, detailCaisseHTML };',
].join('\n\n');

const vm = require('vm');
const ctx = { globalThis: {}, console, Date, Number, isNaN };
ctx.globalThis = ctx;
vm.runInNewContext(src, ctx);
const { pointDeCaisseHTML, detailCaisseHTML } = ctx.__test;

// ------------------------------------------------------------
// 1) L'écran ne nomme pas le résultat : il recopie le libellé du serveur.
//    Preuve par l'absurde — un libellé qui ne ressemble à aucune formule
//    connue doit ressortir intact. S'il était recomposé ici, il serait perdu.
// ------------------------------------------------------------
let bloc = pointDeCaisseHTML({
  ma_saisie: { caisse_attendue: 486, caisse_reelle: 468 },
  confirmation_initiale: { confirme_le: '2026-09-17T18:07:00Z', caisse_reelle: 468 },
  ecart_provisoire: -18,
  libelle_ecart: 'Écart provisoire en moins : −18,00 €',
  message: 'Cette caisse reste en attente du contrôle du manager.',
});
assert.ok(bloc.includes('Écart provisoire en moins : −18,00 €'),
  'Le libellé du serveur doit être recopié tel quel (§3.3)');
assert.ok(bloc.includes('Cette caisse reste en attente du contrôle du manager.'),
  'Le message du serveur accompagne l\'écart provisoire (§3.3)');
assert.ok(bloc.includes('486,00 €') && bloc.includes('468,00 €'),
  'Attendu et Déclaré restent affichés : l\'employé doit pouvoir comprendre et corriger sa propre saisie (§4)');
console.log('OK — le libellé et le message viennent du serveur, recopiés sans retouche.');

// ------------------------------------------------------------
// 2) Aucun vocabulaire fabriqué dans l'écran. Recherche sur le CODE SOURCE
//    réel de la fonction, pas sur une sortie : c'est la seule façon de voir
//    une phrase qui ne s'afficherait que dans un cas non testé.
// ------------------------------------------------------------
for (const mot of ['Excédent', 'Manque', 'Écart détecté', 'En attente de validation',
                   'petit écart', 'grand écart', 'Caisse validée']) {
  assert.ok(!srcPointDeCaisse.includes(mot),
    `L'écran employé ne doit plus écrire "${mot}" : le vocabulaire est fixé par le serveur (§3.3/§3.6)`);
}
for (const champ of ['motif_ecart_texte', 'valide_par', 'valide_le', 'resultat_controle', 'commentaire_interne']) {
  assert.ok(!srcPointDeCaisse.includes(champ),
    `L'écran employé ne doit jamais manipuler ${champ} : ce champ ne lui est pas envoyé (§4)`);
}
console.log('OK — ni vocabulaire manager ni champ réservé au manager dans le rendu employé.');

// ------------------------------------------------------------
// 3) Deux tons, jamais trois. Un troisième ton qualifierait l'écart avant
//    que le manager l'ait regardé — exactement ce que "petit/grand écart"
//    interdit (§3.3).
// ------------------------------------------------------------
assert.ok(pointDeCaisseHTML({ ecart_provisoire: 0, libelle_ecart: 'Aucun écart provisoire' }).includes('stat-value green'),
  'Écart nul : vert');
assert.ok(pointDeCaisseHTML({ ecart_provisoire: -0.5, libelle_ecart: 'x' }).includes('stat-value amber'),
  'Écart non nul : ambre, quel que soit le montant (plus de seuil à 1 €)');
assert.ok(pointDeCaisseHTML({ ecart_provisoire: -1200, libelle_ecart: 'x' }).includes('stat-value amber'),
  'Un écart de 1 200 € reste ambre : l\'écran ne hiérarchise pas la gravité');
assert.ok(!srcPointDeCaisse.includes('red'), 'Aucun rouge dans le rendu employé');
console.log('OK — deux tons seulement, sans seuil de gravité.');

// ------------------------------------------------------------
// 4) Avant confirmation, rien n'est établi : pas d'heure de confirmation,
//    et le résultat retombe sur "—" plutôt que sur un chiffre inventé.
// ------------------------------------------------------------
bloc = pointDeCaisseHTML({ ma_saisie: { caisse_attendue: 486 } });
assert.ok(bloc.includes('>—<'), 'Sans libellé serveur, aucun résultat n\'est affiché');
assert.ok(!bloc.includes('stat-value green') && !bloc.includes('stat-value amber'),
  'Sans écart connu, aucune couleur : ne rien dire plutôt que suggérer');
console.log('OK — avant confirmation, aucun résultat présenté comme établi.');

// ------------------------------------------------------------
// 5) Correction après confirmation (§3.4) — la première confirmation reste
//    visible À CÔTÉ de la nouvelle valeur, jamais à sa place.
// ------------------------------------------------------------
bloc = pointDeCaisseHTML({
  ma_saisie: { caisse_attendue: 486, caisse_reelle: 486 },
  confirmation_initiale: { confirme_le: '2026-09-17T18:07:00Z', caisse_reelle: 468 },
  ecart_provisoire: 0, libelle_ecart: 'Aucun écart provisoire', nb_corrections: 2,
});
assert.ok(bloc.includes('corrigée 2 fois'), 'Le nombre de corrections est annoncé (§3.4)');
assert.ok(bloc.includes('468,00 €'), 'La valeur de la PREMIÈRE confirmation reste affichée');
assert.ok(bloc.includes('486,00 €'), 'La valeur corrigée est affichée elle aussi');
assert.ok(pointDeCaisseHTML({ ecart_provisoire: 0, libelle_ecart: 'x',
  confirmation_initiale: { confirme_le: '2026-09-17T18:07:00Z', caisse_reelle: 468 }, nb_corrections: 1 })
  .includes('corrigée une fois'), 'Accord du singulier');
assert.ok(!pointDeCaisseHTML({ ecart_provisoire: 0, libelle_ecart: 'x' }).includes('corrigée'),
  'Aucune mention de correction quand il n\'y en a pas eu');
console.log('OK — une correction n\'efface jamais la première confirmation.');

// ------------------------------------------------------------
// 6) L'action offerte est celle que le SERVEUR autorise — l'écran ne décide
//    pas qui peut corriger. Même décision que celle qui autorise l'écriture,
//    pas une seconde règle recopiée dans la page (§5.3).
// ------------------------------------------------------------
bloc = pointDeCaisseHTML({ ecart_provisoire: 0, libelle_ecart: 'x',
  correction_possible: true, action_disponible: 'Corriger ma saisie' });
assert.ok(bloc.includes('data-action="corriger"') && bloc.includes('Corriger ma saisie'));

bloc = pointDeCaisseHTML({ ecart_retenu: 0, libelle_ecart: 'x',
  signalement_possible: true, action_disponible: 'Signaler une erreur après validation' });
assert.ok(bloc.includes('data-action="signaler"') && bloc.includes('Signaler une erreur après validation'),
  'Après validation, le seul recours est le signalement (§3.7)');

bloc = pointDeCaisseHTML({ ecart_retenu: -18, libelle_ecart: 'Écart en moins : −18,00 €' });
assert.ok(!bloc.includes('btnActionCaisse'),
  'Quand le serveur n\'autorise ni correction ni signalement, aucun bouton n\'est proposé');
console.log('OK — l\'action disponible est décidée par le serveur, jamais par l\'écran.');

// ------------------------------------------------------------
// 7) detailCaisseHTML — décompose la formule pour "Comprendre mon résultat",
//    et uniquement à partir de la propre saisie de l'employé.
// ------------------------------------------------------------
const detail = detailCaisseHTML({ ventes_grattage_valeur: 900, lots_payes_grattage: 620,
                                  caisse_tirages: 206, regularisations: 5 });
for (const v of ['900,00 €', '620,00 €', '206,00 €', '5,00 €']) {
  assert.ok(detail.includes(v), `${v} attendu dans le détail`);
}
console.log('OK — detailCaisseHTML : décompose la formule à partir de la seule saisie de l\'employé.');

console.log('Tous les tests du rendu employé du résultat de caisse FDJ passent.');
