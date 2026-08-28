// Test — v2.266 : masquage de l'écart avant clôture + révélation au "Point
// de clôture" (28/08/2026, demande de Frédéric).
//
// Constat de Frédéric : "si l'employé voit son écart avant d'avoir figé sa
// déclaration, il peut rechercher la valeur attendue, modifier ses
// quantités jusqu'à obtenir un résultat satisfaisant, puis valider — NEXUS
// enregistrerait alors une caisse apparemment parfaite sans connaître la
// première déclaration." Deux familles de vérifications :
//   A) Statique — les écrans de SAISIE (renderCaisse, renderResume) et la
//      modale de clôture (demanderConfirmationCloture) ne doivent plus
//      jamais faire apparaître l'écart ni la caisse attendue dans leur
//      code source (recherche textuelle sur la fonction réellement
//      extraite de NEXUS-FDJ-v1.html, jamais une copie à la main).
//   B) Fonctionnelle — pointDeClotureHTML/detailEcartCaisseHTML (pures,
//      sans DOM) révèlent bien Attendu/Déclaré/Écart, avec le bon badge et
//      le bon comportement de l'option masquerCorrection.

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

// ------------------------------------------------------------
// A) Statique — les fonctions de saisie ne révèlent plus rien.
// ------------------------------------------------------------
const srcCaisse = extraire('renderCaisse');
assert.ok(!srcCaisse.includes('renderCarteEcart'), 'renderCaisse() ne doit plus appeler renderCarteEcart (aperçu écart retiré)');
assert.ok(!srcCaisse.includes('ecartCaisse()'), 'renderCaisse() ne doit plus calculer/afficher l\'écart pendant la saisie');
console.log('OK — renderCaisse() : aucune trace d\'affichage de l\'écart.');

const srcResume = extraire('renderResume');
assert.ok(!srcResume.includes('renderCarteEcart'), 'renderResume() ne doit plus appeler renderCarteEcart');
assert.ok(!srcResume.includes('ecartCaisse()'), 'renderResume() ne doit plus calculer/afficher l\'écart avant clôture');
assert.ok(!srcResume.includes('caisseAttendue()'), 'renderResume() ne doit plus afficher la caisse attendue (permettrait de déduire l\'écart)');
assert.ok(srcResume.includes('CLÔTURER MA CAISSE'), 'Le bouton doit être renommé "CLÔTURER MA CAISSE"');
console.log('OK — renderResume() : ni écart ni caisse attendue, bouton renommé.');

const srcModale = extraire('demanderConfirmationCloture');
assert.ok(!srcModale.includes('Écart constaté'), 'La modale de clôture ne doit plus révéler l\'écart');
assert.ok(!srcModale.includes('cloture-ecart-valeur'), 'La ligne d\'écart de la modale doit avoir disparu');
assert.ok(srcModale.includes('Clôturer ma caisse'), 'Le bouton de la modale doit être renommé "Clôturer ma caisse"');
console.log('OK — demanderConfirmationCloture() : modale aveugle, bouton renommé.');

// ------------------------------------------------------------
// B) Fonctionnelle — pointDeClotureHTML / detailEcartCaisseHTML (pures).
// ------------------------------------------------------------
function extraireConst(nomConst) {
  const debut = script.indexOf(`const ${nomConst} = {`);
  assert.ok(debut !== -1, `Constante ${nomConst} introuvable`);
  const fin = script.indexOf('};', debut) + 2;
  return script.slice(debut, fin);
}

const src = [
  `function fmtEuro(n) { return (n === null || n === undefined || isNaN(n)) ? '—' : (Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €'; }`,
  extraire('pointDeClotureHTML'),
  extraire('detailEcartCaisseHTML'),
  'globalThis.__test = { pointDeClotureHTML, detailEcartCaisseHTML };',
].join('\n\n');

const vm = require('vm');
const ctx = { globalThis: {}, console };
ctx.globalThis = ctx;
vm.runInNewContext(src, ctx);
const { pointDeClotureHTML, detailEcartCaisseHTML } = ctx.__test;

// 1) Caisse exacte (écart nul) : badge Conforme, pas de bouton de correction.
let bloc = pointDeClotureHTML({ heureLabel: '18:07', attendue: 486, reelle: 486, ecart: 0, ventesGrattage: 900, lotsPayes: 620, caisseTirages: 206, regularisations: 0 });
assert.ok(bloc.includes('18:07'), 'Heure de clôture affichée');
assert.ok(bloc.includes('Conforme'), 'Badge conforme attendu pour un écart nul');
assert.ok(bloc.includes('Attendu'), 'Attendu révélé au Point de clôture');
assert.ok(bloc.includes('Déclaré'), 'Déclaré révélé au Point de clôture');
assert.ok(!bloc.includes('btnDemanderCorrectionPDC'), 'Pas de bouton "Demander une correction" quand l\'écart est nul');
console.log('OK — Point de clôture, écart nul : Conforme, pas de bouton de correction.');

// 2) Écart réel (exemple exact de Frédéric : attendu 486, déclaré 468, écart -18).
bloc = pointDeClotureHTML({ heureLabel: '18:07', attendue: 486, reelle: 468, ecart: -18, ventesGrattage: 900, lotsPayes: 620, caisseTirages: 206, regularisations: 0 });
assert.ok(bloc.includes('⚠️ Écart détecté'), 'Badge "Écart détecté" attendu');
assert.ok(bloc.includes('486,00 €'), 'Attendu = 486,00 €');
assert.ok(bloc.includes('468,00 €'), 'Déclaré = 468,00 €');
assert.ok(bloc.includes('-18,00 €'), 'Écart = -18,00 €');
assert.ok(bloc.includes('btnDemanderCorrectionPDC'), 'Bouton "Demander une correction" présent quand l\'écart est non nul');
assert.ok(bloc.includes('btnComprendreEcart'), 'Bouton "Comprendre mon écart" toujours présent');
assert.ok(bloc.includes('style="display:none;"'), 'Le détail est masqué par défaut (repli, pas affiché d\'emblée)');
console.log('OK — Point de clôture, écart -18 € : badge, Attendu/Déclaré/Écart corrects, bouton de correction présent.');

// 3) Option masquerCorrection (utilisée par renderAccueil, qui a déjà son
//    propre bouton avec état "déjà envoyée") : le bouton intégré disparaît.
bloc = pointDeClotureHTML({ heureLabel: '18:07', attendue: 486, reelle: 468, ecart: -18 }, { masquerCorrection: true });
assert.ok(!bloc.includes('btnDemanderCorrectionPDC'), 'masquerCorrection doit supprimer le bouton intégré');
console.log('OK — option masquerCorrection : bouton intégré supprimé.');

// 4) detailEcartCaisseHTML — décompose la formule (ventes grattage, lots
//    payés, caisse tirages, régularisations), consommé par "Comprendre mon
//    écart".
const detail = detailEcartCaisseHTML({ ventesGrattage: 900, lotsPayes: 620, caisseTirages: 206, regularisations: 5 });
assert.ok(detail.includes('900,00 €'), 'Ventes grattage dans le détail');
assert.ok(detail.includes('620,00 €'), 'Lots payés dans le détail');
assert.ok(detail.includes('206,00 €'), 'Caisse tirages dans le détail');
assert.ok(detail.includes('5,00 €'), 'Régularisations dans le détail');
console.log('OK — detailEcartCaisseHTML : décompose bien la formule.');

// ------------------------------------------------------------
// C) Statique — vocabulaire manager à trois niveaux (NEXUS-FDJ-Manager-v1.html).
//    "Personne ne valide sa propre caisse" : EMPLOYÉ clôture, MANAGER
//    contrôle, NEXUS certifie.
// ------------------------------------------------------------
const htmlManager = fs.readFileSync(__dirname + '/NEXUS-FDJ-Manager-v1.html', 'utf8');
const scriptManager = htmlManager.match(/<script>([\s\S]*)<\/script>/)[1];

function extraireManager(nomFonction) {
  const debut = scriptManager.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable dans NEXUS-FDJ-Manager-v1.html`);
  let i = scriptManager.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (scriptManager[j] === '{') profondeur++;
    else if (scriptManager[j] === '}') profondeur--;
    j++;
  }
  return scriptManager.slice(debut, j);
}

const srcRenderEdition = extraireManager('renderEdition');
assert.ok(srcRenderEdition.includes("'Contrôler la clôture'"), 'Le titre doit devenir "Contrôler la clôture" pour un quart existant');
assert.ok(srcRenderEdition.includes("'Certifier le contrôle'"), 'Le bouton doit devenir "Certifier le contrôle" pour un quart existant');
assert.ok(srcRenderEdition.includes("'Nouveau quart FDJ'"), 'La création directe manager (pouvoir total, sans clôture employé) reste un cas distinct');
assert.ok(!srcRenderEdition.includes('Modifier ce quart FDJ'), 'L\'ancien libellé générique ne doit plus être affiché');
assert.ok(!srcRenderEdition.includes('Valider le contrôle du quart'), 'L\'ancien libellé de bouton ne doit plus être affiché');
console.log('OK — NEXUS-FDJ-Manager-v1.html : vocabulaire "Contrôler la clôture" / "Certifier le contrôle" en place.');

console.log('Tous les tests de masquage/révélation "Point de clôture" (v2.266) passent.');
