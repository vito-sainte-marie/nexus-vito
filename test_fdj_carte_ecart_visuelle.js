// Test — Carte visuelle "écart de caisse" (16/08/2026, demande de Frédéric :
// "fais en sorte comme la caisse boutique ou piste que les employé voient
// leurs ecart validée en FDJ. structure bien le visuels afin que ce soit
// simple, intuitif et graphiquement agreable").
//
// Extrait les fonctions réelles depuis NEXUS-FDJ-v1.html (jamais réécrites
// à la main) et vérifie la structure HTML produite par renderCarteEcart /
// phraseEcartCaisse pour les cas réels : aperçu en cours de saisie, écart
// en attente de validation manager, écart validé conforme/avec écart.

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

function extraireConst(nomConst) {
  const debut = script.indexOf(`const ${nomConst} = {`);
  assert.ok(debut !== -1, `Constante ${nomConst} introuvable dans NEXUS-FDJ-v1.html`);
  const fin = script.indexOf('};', debut) + 2;
  return script.slice(debut, fin);
}

const src = [
  `function fmtEuro(n) { return (n === null || n === undefined || isNaN(n)) ? '—' : (Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €'; }`,
  extraireConst('LIBELLES_STATUT_CAISSE'),
  extraire('renderCarteEcart'),
  extraire('phraseEcartCaisse'),
  'globalThis.__test = { renderCarteEcart, phraseEcartCaisse };',
].join('\n\n');

const vm = require('vm');
const ctx = { globalThis: {}, console };
ctx.globalThis = ctx;
vm.runInNewContext(src, ctx);
const { renderCarteEcart, phraseEcartCaisse } = ctx.__test;

// ------------------------------------------------------------
// 1) Aperçu avant saisie de la caisse réelle (ecart=null, statut=null) —
//    pas de badge, montant "—", phrase d'invite.
// ------------------------------------------------------------
let carte = renderCarteEcart(null, null, { label: 'Aperçu — Caisse FDJ' });
assert.ok(carte.includes('Aperçu — Caisse FDJ'), 'Le libellé personnalisé doit apparaître');
assert.ok(!carte.includes('statut-badge'), 'Aucun badge tant que rien n\'est encore calculé/enregistré');
assert.ok(carte.includes('>—<'), 'Montant affiché "—" tant que la caisse réelle n\'est pas saisie');
console.log('OK — aperçu avant saisie : pas de badge, montant "—".');

// ------------------------------------------------------------
// 2) Écart nul (caisse exacte) — badge vert si statut fourni, phrase claire.
// ------------------------------------------------------------
carte = renderCarteEcart(0, 'conforme', { label: 'Caisse FDJ · Quart 1' });
assert.ok(carte.includes('statut-badge conforme'), 'Badge conforme attendu');
assert.ok(carte.includes('Conforme'), 'Libellé français du statut attendu');
assert.ok(carte.includes('var(--green)'), 'Montant à 0 doit être en vert');
assert.ok(carte.includes('à l\'euro près'), 'Phrase explicite pour un écart nul');
console.log('OK — écart nul : badge Conforme, montant vert, phrase claire.');

// ------------------------------------------------------------
// 3) Écart négatif (manque), pas encore validé par le manager (provisoire).
// ------------------------------------------------------------
carte = renderCarteEcart(-12.5, 'provisoire', { label: 'Caisse FDJ · Quart 2' });
assert.ok(carte.includes('statut-badge provisoire'), 'Badge "en attente" attendu tant que non validé par le manager');
assert.ok(carte.includes('En attente de validation'), 'Libellé du badge provisoire');
assert.ok(carte.includes('var(--red)'), 'Écart > 1€ en valeur absolue doit être rouge');
assert.ok(carte.includes('-12,50'), 'Montant formaté en euros français');
const phraseManque = phraseEcartCaisse(-12.5, 'provisoire');
assert.ok(phraseManque.includes('Manque'), 'Écart négatif = manque');
assert.ok(phraseManque.includes('En attente de vérification par le manager'), 'Précision "en attente" tant que provisoire');
console.log('OK — écart négatif provisoire : badge "En attente de validation", montant rouge, phrase "Manque".');

// ------------------------------------------------------------
// 4) Écart positif (excédent), validé par le manager avec écart.
// ------------------------------------------------------------
carte = renderCarteEcart(0.8, 'valide_avec_ecart', { label: 'Caisse FDJ · Quart 1' });
assert.ok(carte.includes('statut-badge valide_avec_ecart'), 'Badge du statut choisi par le manager');
assert.ok(carte.includes('Validé avec écart'));
assert.ok(carte.includes('var(--amber)'), 'Écart <= 1€ doit être ambre (ni vert ni rouge)');
assert.ok(carte.includes('+0,80'), 'Signe + affiché pour un excédent');
const phraseExcedent = phraseEcartCaisse(0.8, 'valide_avec_ecart');
assert.ok(phraseExcedent.includes('Excédent'), 'Écart positif = excédent');
assert.ok(!phraseExcedent.includes('En attente'), 'Une fois validé par le manager, plus de mention "en attente"');
console.log('OK — écart positif validé : badge du statut manager, montant ambre, phrase "Excédent" sans mention "en attente".');

console.log('Tous les tests de la carte visuelle "écart de caisse" passent.');
