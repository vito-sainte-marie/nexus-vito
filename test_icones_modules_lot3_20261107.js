// Icônes de modules, lot 3 (kit « nexus-icones-modules-lot3-v1.1 », 07/11/2026) : 12 modules ajoutés au registre
// nexus-icones.js, mêmes mécanismes que les lots 1 et 2 (img, appliquer, data-nexus-ancien-*, ICONES_V2 = false).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const LOT3 = {
  'mod-accueil': 'Accueil', 'mod-cockpit': 'Cockpit', 'mod-rapport': 'Rapport NEXUS', 'mod-scanner': 'Scanner NEXUS',
  'mod-radar': 'Radar du Manager', 'mod-tempo': 'Tempo', 'mod-campagnes': 'Campagnes', 'mod-scanner-stock': 'Scanner Stock',
  'mod-evaluations': 'Évaluations', 'mod-boite-reception': 'Boîte de réception', 'mod-imports': 'Imports', 'mod-rappels': 'Rappels',
};
const IDS = Object.keys(LOT3);
const SRC = lire('nexus-icones.js');
function charger(src) { const ctx = { window: undefined }; ctx.globalThis = ctx; vm.runInNewContext(src, ctx); return ctx.NexusIcones; }
const APP = lire('NEXUS-App-v1.html'), DESK = lire('nexus-desktop.js'), CAT = lire('nexus-raccourcis-catalogue.js'), DOC = lire('NEXUS-Documentation-v1.html');

// ---- Le kit ----
t('les 12 identifiants ont leurs 6 fichiers, aux bonnes tailles', () => {
  assert.strictEqual(IDS.length, 12);
  IDS.forEach(id => {
    ['.svg', '@1x.webp', '@2x.webp', '@3x.webp', '-24.svg', '-24.png'].forEach(suf =>
      assert.ok(fs.existsSync(path.join(__dirname, 'assets/icones/v2', id, id + suf)), id + suf));
    const taille = suf => fs.statSync(path.join(__dirname, 'assets/icones/v2', id, id + suf)).size;
    assert.ok(taille('@2x.webp') <= 15 * 1024, id + ' @2x > 15 Ko');
    assert.ok(taille('@3x.webp') <= 25 * 1024, id + ' @3x > 25 Ko');
    const d24 = fs.readFileSync(path.join(__dirname, 'assets/icones/v2', id, id + '-24.svg'), 'utf8');
    ((d24.match(/\bid="([^"]+)"/g) || []).map(x => x.slice(4, -1))).forEach(i => assert.ok(/-24(-|$)/.test(i), id + ' : id non suffixé ' + i));
  });
});
t('les anciens PNG restent dans le dépôt (retour arrière)', () => {
  ['icon-home.png', 'icon-scanner.png', 'icon-radar.png', 'icon-nexus-tempo.png', 'icon-campagne-nexus.png', 'icon-scanner-stock.png',
   'icon-evaluation.png', 'icon-import.png', 'icon-rappels.png'].forEach(f => assert.ok(fs.existsSync(path.join(__dirname, 'assets/icons', f)), f));
});

// ---- Le registre ----
const R = charger(SRC);
t('le registre porte les 12 modules du lot 3, chacun avec son libellé', () => {
  IDS.forEach(id => { assert.ok(R.MODULES[id], id); assert.strictEqual(R.MODULES[id].libelle, LOT3[id]); });
  assert.ok(Object.keys(R.MODULES).length >= 32);
});
t('≤ 24 px : simplifié ; au-delà : détaillé en srcset 1x/2x/3x', () => {
  IDS.forEach(id => {
    const p = R.chemins(id);
    ['detail1x', 'detail2x', 'detail3x', 'simplifie'].forEach(k => assert.ok(fs.existsSync(path.join(__dirname, p[k])), p[k]));
    assert.ok(R.img(id, 16, { decoratif: true }).includes('src="' + p.simplifie + '"'));
    assert.ok(R.img(id, 34, { decoratif: true }).includes('srcset="' + p.srcset + '"'));
    assert.ok(R.img(id, 20).includes('alt="' + LOT3[id] + '"'));
  });
});
t('ICONES_V2 = false : les 12 rendent l\'ancien balisage fourni', () => {
  const F = charger(SRC.replace('const ICONES_V2 = true;', 'const ICONES_V2 = false;'));
  IDS.forEach(id => assert.strictEqual(F.img(id, 34, { ancien: '<img src="ancien.png">' }), '<img src="ancien.png">'));
});

// ---- Les surfaces ----
const NAV = [['mod-cockpit', 'icon-home.png'], ['mod-scanner', 'icon-scanner.png'], ['mod-radar', 'icon-radar.png'], ['mod-tempo', 'icon-nexus-tempo.png'],
  ['mod-campagnes', 'icon-campagne-nexus.png'], ['mod-scanner-stock', 'icon-scanner-stock.png'], ['mod-evaluations', 'icon-evaluation.png'],
  ['mod-imports', 'icon-import.png'], ['mod-rappels', 'icon-rappels.png']];
t('barre d\'accueil : 9 modules en image + Rapport en emoji, ancien src / emoji gardé pour le retour arrière', () => {
  NAV.forEach(([id, png]) => {
    const b = (APP.match(new RegExp('<img data-nexus-icone="' + id + '"[^>]*>')) || [])[0];
    assert.ok(b, id);
    assert.ok(/\ssrc="assets\/icones\/v2\//.test(b) && !/\ssrc="assets\/icons\//.test(b), id + ' : src');
    assert.ok(b.includes('data-nexus-ancien-src="assets/icons/' + png + '"'), id + ' : ancien src');
  });
  assert.ok(/<div class="nav-icon" data-nexus-icone="mod-rapport"[^>]*data-nexus-ancien-emoji="📑"[^>]*><img src="assets\/icones\/v2\/mod-rapport\//.test(APP), 'Rapport');
  ['mod-accueil', 'mod-boite-reception'].forEach(id => assert.ok(!new RegExp('data-nexus-icone="' + id + '"').test(APP), id + ' : pas de ligne dans la barre d\'accueil'));
});
t('menu bureau : 11 entrées portent leur module', () => {
  [['Rapport NEXUS', 'mod-rapport'], ['Cockpit', 'mod-cockpit'], ['Scanner NEXUS', 'mod-scanner'], ['Radar du Manager', 'mod-radar'], ['Tempo', 'mod-tempo'],
   ['Campagnes', 'mod-campagnes'], ['Scanner Stock', 'mod-scanner-stock'], ['Évaluations', 'mod-evaluations'], ['Boîte de réception', 'mod-boite-reception'],
   ['Imports', 'mod-imports'], ['Rappels', 'mod-rappels']].forEach(([l, id]) =>
    assert.ok(DESK.includes("label: '" + l + "', module: '" + id + "'"), l));
});
t('menu bureau : le lien Accueil passe par mod-accueil, avec l\'ancienne maison en repli', () => {
  assert.ok(DESK.includes("NexusIcones.img('mod-accueil', 16, { decoratif: true, ancien: '<img src=\"assets/icons/icon-home.png\" alt=\"\">' })"));
});
t('Accueil et Cockpit ne partagent plus la même icône', () => {
  assert.notStrictEqual(R.chemins('mod-accueil').simplifie, R.chemins('mod-cockpit').simplifie);
  assert.notStrictEqual(R.chemins('mod-accueil').detail1x, R.chemins('mod-cockpit').detail1x);
});
t('raccourcis : Cockpit, Tempo, Rapport, Scanner Stock, Scanner, Radar, Import', () => {
  [['Cockpit', 'mod-cockpit'], ['Tempo', 'mod-tempo'], ['Rapport NEXUS', 'mod-rapport'], ['Scanner Stock', 'mod-scanner-stock'],
   ['Scanner NEXUS', 'mod-scanner'], ['Radar du Manager', 'mod-radar'], ['Import', 'mod-imports']].forEach(([l, id]) =>
    assert.ok(CAT.includes("label: '" + l + "', module: '" + id + "'"), l));
});
t('Documentation : 10 moteurs du lot 3 portent leur module', () => {
  ['cockpit', 'scanner', 'radar', 'tempo', 'campagnes', 'scanner-stock', 'evaluations', 'boite-reception', 'imports', 'rappels'].forEach(a =>
    assert.ok(DOC.includes("id: '" + a + "', module: 'mod-" + a + "', groupe:"), a));
});
t('usages laissés : les emojis de contenu (messages, états) ne sont pas touchés', () => {
  ['🔔', '📝', '📆', '📣', '📥'].forEach(e => assert.ok(APP.includes(e) || DOC.includes(e) || DESK.includes(e), e));
});

// ---- Gardes ----
garde('la barre d\'accueil porte Tempo', APP, h => /<img data-nexus-icone="mod-tempo"/.test(h), 'data-nexus-icone="mod-tempo"', 'data-x="mod-tempo"');
garde('la barre d\'accueil garde l\'emoji de Rapport pour le retour arrière', APP, h => /data-nexus-icone="mod-rapport"[^>]*data-nexus-ancien-emoji="📑"/.test(h), 'data-nexus-ancien-emoji="📑"', 'data-nexus-ancien-x="📑"');
garde('le bureau : Cockpit porte son module', DESK, h => h.includes("label: 'Cockpit', module: 'mod-cockpit'"), "module: 'mod-cockpit'", "module: 'mod-x'");
garde('le bureau : le lien Accueil porte mod-accueil', DESK, h => h.includes("NexusIcones.img('mod-accueil'"), "NexusIcones.img('mod-accueil'", "NexusIcones.img('mod-cockpit'");
garde('les raccourcis : Scanner Stock', CAT, h => h.includes("module: 'mod-scanner-stock'"), "module: 'mod-scanner-stock'", "module: 'mod-x'");
garde('la Documentation : Imports', DOC, h => h.includes("id: 'imports', module: 'mod-imports'"), "module: 'mod-imports'", "module: 'mod-x'");
garde('le registre : Rappels', SRC, h => /'mod-rappels':\s*\{ libelle: 'Rappels' \}/.test(h), "libelle: 'Rappels'", "libelle: ''");

console.log(n + ' épreuves OK');
