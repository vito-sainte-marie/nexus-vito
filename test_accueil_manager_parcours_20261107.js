// Parcours du quart d'un manager en service pompiste ou caissière (#160, Guardian 6708056326, 07/11/2026) :
// la carte « Service en cours » de son accueil porte le bouton du parcours de son rôle du jour. Même calcul que
// l'employé (calculerParcours), fonction séparée de renderPrisePoste (qui ne lit ni n'écrit rien).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, 'NEXUS-App-v1.html'), 'utf8');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function garde(nom, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(HTML), 'la garde doit passer sur la source');
    assert.ok(HTML.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(HTML.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
function extraire(entete) {
  const i = HTML.indexOf(entete); assert.ok(i >= 0, entete);
  let p = 0, d = i + entete.length - 1;
  for (let k = d; k < HTML.length; k++) { if (HTML[k] === '(') p++; else if (HTML[k] === ')' && --p === 0) { d = k; break; } }
  let prof = 0;
  for (let k = HTML.indexOf('{', d); k < HTML.length; k++) {
    if (HTML[k] === '{') prof++; else if (HTML[k] === '}' && --prof === 0) return HTML.slice(i, k + 1);
  }
}
const modele = new Function('NexusAccueilPiste', extraire('function modeleParcoursManager(') + '\nreturn modeleParcoursManager;')({ DELAI_FERMETURE_MIN: 45 });
const base = { jaugeageApplicable: true, indexApplicable: true, inventaireApplicable: true,
  faitsFil: { resteJaugeage: false, resteIndex: true, resteInventaire: true }, filLien: 'NEXUS-Releves-Piste-v1.html?moment=debut_q1',
  fermetureLien: null, finMinutes: 840, maintenantMinutes: 480, piloteCaisse: false, fermetureCaisseDue: false, inventaireOuvertureFaite: false, filCaisseLien: null };

t('manager pompiste, étapes restantes : bouton vers le fil et progression', () => {
  const m = modele('pompiste', base);
  assert.strictEqual(m.texte, 'Faire mon début de quart (pompiste)');
  assert.strictEqual(m.lien, base.filLien);
  assert.strictEqual(m.progression, '1 étape sur 3 faite');
});
t('manager pompiste, deux étapes faites sur trois : pluriel', () => {
  const m = modele('pompiste', { ...base, faitsFil: { resteJaugeage: false, resteIndex: false, resteInventaire: true } });
  assert.strictEqual(m.progression, '2 étapes sur 3 faites');
});
t('manager pompiste, fin de quart due : fermeture de piste', () => {
  const m = modele('pompiste', { ...base, filLien: null, faitsFil: {}, fermetureLien: 'NEXUS-Releves-Piste-v1.html?moment=fin_q1', maintenantMinutes: 800 });
  assert.strictEqual(m.texte, 'Faire ma fermeture de piste');
  assert.strictEqual(m.lien, 'NEXUS-Releves-Piste-v1.html?moment=fin_q1');
});
t('manager pompiste, tout fait et fin pas due : parcours terminé, sans bouton', () => {
  const m = modele('pompiste', { ...base, filLien: null, faitsFil: {}, fermetureLien: 'x', maintenantMinutes: 500 });
  assert.strictEqual(m.texte, 'Parcours du quart terminé ✓');
  assert.strictEqual(m.lien, null);
});
t('manager caissière : lien du fil caisse, fermeture après le comptage', () => {
  const debut = modele('caissiere', { ...base, filCaisseLien: 'NEXUS-Inventaire-v1.html?fil=caisse&etape=2', piloteCaisse: true });
  assert.strictEqual(debut.texte, 'Faire mon début de quart (caissière)');
  assert.strictEqual(debut.lien, 'NEXUS-Inventaire-v1.html?fil=caisse&etape=2');
  const fin = modele('caissiere', { ...base, filCaisseLien: 'x', piloteCaisse: true, fermetureCaisseDue: true, inventaireOuvertureFaite: true });
  assert.strictEqual(fin.texte, 'Faire ma fermeture de caisse');
});
t('manager caissière, fil terminé : parcours terminé ; non pilote : rien', () => {
  assert.strictEqual(modele('caissiere', { ...base, piloteCaisse: true }).lien, null);
  assert.strictEqual(modele('caissiere', base), null);
});
t('renfort, autre rôle ou rien à faire : aucun bloc', () => {
  assert.strictEqual(modele('renfort', base), null);
  assert.strictEqual(modele('manager', base), null);
  assert.strictEqual(modele('pompiste', { ...base, jaugeageApplicable: false, indexApplicable: false, inventaireApplicable: false, filLien: null }), null);
});

garde('le bloc manager appelle le parcours après le poste, sans casser l\'accueil si la lecture échoue',
  h => /await initPosteManager\(employee\);\n\s*try \{ await initParcoursManager\(employee, roleDuJour, quartDuJour, serviceCourant\); \} catch/.test(h),
  'try { await initParcoursManager(', 'try { await (async()=>{})(');
garde('aucun bloc sans service du jour, ni pour un rôle autre que pompiste ou caissière',
  h => /if \(roleDuJour !== 'pompiste' && roleDuJour !== 'caissiere'\) return;[\s\S]{0,700}if \(!serviceCourantJour\) return;/.test(h),
  "if (roleDuJour !== 'pompiste' && roleDuJour !== 'caissiere') return;", '');
garde('le parcours manager réutilise le calcul de l\'employé',
  h => /const lectures = await lirePourParcours\(employee, params\);\n\s*const faits = await calculerParcours\(employee, params, lectures\);/.test(h),
  'await calculerParcours(employee, params, lectures)', 'await ({})');
garde('renderPrisePoste ne lit rien du parcours',
  h => { const a = h.indexOf('function renderPrisePoste('); const b = h.indexOf('\n  }\n', a); const c = h.slice(a, b); return a > 0 && !/calculerParcours|lirePourParcours|initParcoursManager/.test(c); },
  'function renderPrisePoste(', 'function renderPrisePoste(/*calculerParcours*/');
garde('le bouton est un lien vers le fil de l\'employé (href posé en attribut)',
  h => /a\.className = 'ap-bouton am-parcours-bouton';\n\s*a\.setAttribute\('href', m\.lien\);/.test(h),
  "a.setAttribute('href', m.lien);", "a.setAttribute('data-lien', m.lien);");
garde('la carte grandit pour contenir le parcours (sinon .ap-poste la coupe à 104 px)',
  h => /body:has\(\.am-marqueur\):has\(\.am-parcours\) \.am-poste\{height:auto;/.test(h),
  'body:has(.am-marqueur):has(.am-parcours) .am-poste{height:auto;', 'body:has(.am-marqueur):has(.am-parcours) .am-poste{height:104px;');
garde('pas de couleur en dur dans le style du parcours manager',
  h => !/\.am-parcours[^{]*\{[^}]*#[0-9a-fA-F]{3,6}/.test(h),
  '.am-parcours{padding:0 0 4px;}', '.am-parcours{color:#fff;}');

console.log(n + ' épreuves OK');
