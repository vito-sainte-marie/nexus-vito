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
// Vrais modules (pas de double) : un export oublié (DELAI_FERMETURE_MIN) rendait le seuil NaN sans qu'aucune épreuve ne rougisse.
const Accueil = require('./nexus-accueil-piste.js');
const Caisse = require('./nexus-fil-caisse.js');
const modele = new Function('NexusAccueilPiste', 'NexusFilCaisse', extraire('function modeleParcoursManager(') + '\nreturn modeleParcoursManager;')(Accueil, Caisse);
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
const debutFait = { ...base, filLien: null, faitsFil: {}, fermetureLien: 'x', finIndexApplicable: true, finIndexFait: false, clotureInventaireFait: false, maintenantMinutes: 500 };
t('pompiste, début fait et fermeture pas due : « Début de quart terminé » et l\'heure de la fermeture', () => {
  const m = modele('pompiste', debutFait);
  assert.strictEqual(m.texte, 'Début de quart terminé ✓');
  assert.strictEqual(m.lien, null);
  assert.strictEqual(m.progression, 'Fermeture de la piste à partir de 13 h 15');
});
t('pompiste, fermeture due : bouton de fermeture (seuil du vrai module)', () => {
  const m = modele('pompiste', { ...debutFait, maintenantMinutes: 795 });
  assert.strictEqual(m.texte, 'Faire ma fermeture de piste');
  assert.strictEqual(m.lien, 'x');
  assert.strictEqual(modele('pompiste', { ...debutFait, maintenantMinutes: 794 }).lien, null);
});
t('pompiste, fermeture faite : « Quart terminé » sans bouton, jamais « Parcours du quart terminé »', () => {
  const m = modele('pompiste', { ...debutFait, fermetureLien: null, finIndexFait: true, clotureInventaireFait: true, maintenantMinutes: 830 });
  assert.strictEqual(m.texte, 'Quart terminé ✓');
  assert.strictEqual(m.lien, null);
  assert.strictEqual(m.progression, null);
  assert.ok(!/Parcours du quart terminé/.test(HTML), 'ancien libellé trompeur encore dans la source');
});
t('pompiste, index de fin non applicable : seule la clôture de l\'inventaire compte', () => {
  assert.strictEqual(modele('pompiste', { ...debutFait, finIndexApplicable: false, clotureInventaireFait: true }).texte, 'Quart terminé ✓');
  assert.strictEqual(modele('pompiste', { ...debutFait, finIndexApplicable: false, clotureInventaireFait: false }).texte, 'Début de quart terminé ✓');
});
t('l\'heure vient des horaires de la station : deux fins de quart, deux heures', () => {
  assert.strictEqual(modele('pompiste', { ...debutFait, finMinutes: 840 }).progression, 'Fermeture de la piste à partir de 13 h 15');
  assert.strictEqual(modele('pompiste', { ...debutFait, finMinutes: 780 }).progression, 'Fermeture de la piste à partir de 12 h 15');
  assert.strictEqual(modele('pompiste', { ...debutFait, finMinutes: 1320 }).progression, 'Fermeture de la piste à partir de 21 h 15');
  assert.strictEqual(modele('pompiste', { ...debutFait, finMinutes: null }).progression, null);
});
t('les horaires réels de la station (régime normal et étendu) donnent des heures différentes', () => {
  global.window = global;
  require('./nexus-station.js');
  const Station = global.NexusStation_ || global.NexusStation;
  const fuseau = 'Europe/Paris';
  const mercredi = new Date('2026-11-04T10:00:00Z'), vendredi = new Date('2026-11-06T10:00:00Z');
  const h1 = { quart1: { fin_normal: '13:00', fin_etendu: '14:00' } };
  const h2 = { quart1: { fin_normal: '14:30', fin_etendu: '15:30' } };
  const calc = (h, d) => Station.finDuQuartMinutes(h, 'quart1', fuseau, d);
  assert.deepStrictEqual([calc(h1, mercredi), calc(h1, vendredi), calc(h2, mercredi)], [780, 840, 870]);
  const prog = (min) => modele('pompiste', { ...debutFait, finMinutes: min }).progression;
  assert.strictEqual(prog(calc(h1, mercredi)), 'Fermeture de la piste à partir de 12 h 15');
  assert.strictEqual(prog(calc(h1, vendredi)), 'Fermeture de la piste à partir de 13 h 15');
  assert.strictEqual(prog(calc(h2, mercredi)), 'Fermeture de la piste à partir de 13 h 45');
});
t('manager caissière : lien du fil caisse, fermeture après le comptage', () => {
  const debut = modele('caissiere', { ...base, filCaisseLien: 'NEXUS-Inventaire-v1.html?fil=caisse&etape=2', piloteCaisse: true });
  assert.strictEqual(debut.texte, 'Faire mon début de quart (caissière)');
  assert.strictEqual(debut.lien, 'NEXUS-Inventaire-v1.html?fil=caisse&etape=2');
  const fin = modele('caissiere', { ...base, filCaisseLien: 'x', piloteCaisse: true, fermetureCaisseDue: true, inventaireOuvertureFaite: true });
  assert.strictEqual(fin.texte, 'Faire ma fermeture de caisse');
});
const caisseSoir = { ...base, piloteCaisse: true, fermetureCaisseApplicable: true, filCaisseLien: null, inventaireFait: false, finMinutes: 1320 };
t('caissière du soir : début fait, heure de la fermeture, puis quart terminé', () => {
  const m = modele('caissiere', caisseSoir);
  assert.strictEqual(m.texte, 'Début de quart terminé ✓');
  assert.strictEqual(m.lien, null);
  assert.strictEqual(m.progression, 'Fermeture de caisse à partir de 21 h 15');
  assert.strictEqual(modele('caissiere', { ...caisseSoir, finMinutes: 1260 }).progression, 'Fermeture de caisse à partir de 20 h 15');
  const fin = modele('caissiere', { ...caisseSoir, inventaireFait: true });
  assert.strictEqual(fin.texte, 'Quart terminé ✓');
  assert.strictEqual(fin.progression, null);
});
t('caissière du matin : pas de fermeture de caisse, donc quart terminé après le comptage', () => {
  assert.strictEqual(modele('caissiere', { ...caisseSoir, fermetureCaisseApplicable: false }).texte, 'Quart terminé ✓');
});
t('aucune heure littérale dans le modèle : tout vient des horaires de la station', () => {
  const src = extraire('function modeleParcoursManager(');
  assert.ok(!/\d{1,2}\s*h\s*\d{2}|\d{1,2}:\d{2}/.test(src), 'heure en dur dans modeleParcoursManager');
  assert.ok(/finMinutes\s*-\s*NexusAccueilPiste\.DELAI_FERMETURE_MIN/.test(src) || /NexusAccueilPiste\.DELAI_FERMETURE_MIN/.test(src));
  assert.ok(typeof Accueil.DELAI_FERMETURE_MIN === 'number' && typeof Accueil.heureDeMinutes === 'function', 'export manquant');
});
t('manager caissière non pilote : rien', () => {
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
