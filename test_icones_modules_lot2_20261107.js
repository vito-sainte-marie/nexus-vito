// Icônes de modules, lot 2 (kit « nexus-icones-modules-lot2-v1.1 », 07/11/2026) : 12 modules ajoutés au registre
// nexus-icones.js, mêmes mécanismes que le lot 1 (img, appliquer, data-nexus-ancien-*, ICONES_V2 = false).
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
const LOT2 = {
  'mod-carburants-performance': 'Carburants Performance', 'mod-capital': 'Capital NEXUS', 'mod-brief': 'Brief NEXUS',
  'mod-reception-carburant': 'Réception carburant', 'mod-assignations': 'Assignations', 'mod-fdj-performance': 'FDJ Performance',
  'mod-comptes-clients': 'Comptes Clients', 'mod-resultats': 'Résultats', 'mod-journal': 'Journal',
  'mod-progression': 'Progression', 'mod-parametres': 'Paramètres', 'mod-produits': 'Produits',
};
const IDS = Object.keys(LOT2);
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
  ['icon-brief-nexus.png', 'icon-journal-nexus.png', 'icon-capital.png', 'icon-produits.png', 'icon-reception-carburant-24.png',
   'icon-assignations.png', 'icon-resultats-equipe.png', 'icon-parametres-24.png', 'icon-progression-48.png'].forEach(f =>
    assert.ok(fs.existsSync(path.join(__dirname, 'assets/icons', f)), f));
});

// ---- Le registre ----
const R = charger(SRC);
t('le registre porte les 12 modules du lot 2, chacun avec son libellé', () => {
  IDS.forEach(id => { assert.ok(R.MODULES[id], id); assert.strictEqual(R.MODULES[id].libelle, LOT2[id]); });
  assert.strictEqual(Object.keys(R.MODULES).length, 20);
});
t('≤ 24 px : simplifié ; au-delà : détaillé en srcset 1x/2x/3x', () => {
  IDS.forEach(id => {
    const p = R.chemins(id);
    ['detail1x', 'detail2x', 'detail3x', 'simplifie'].forEach(k => assert.ok(fs.existsSync(path.join(__dirname, p[k])), p[k]));
    assert.ok(R.img(id, 16, { decoratif: true }).includes('src="' + p.simplifie + '"'));
    assert.ok(R.img(id, 34, { decoratif: true }).includes('srcset="' + p.srcset + '"'));
    assert.ok(R.img(id, 20).includes('alt="' + LOT2[id] + '"'));
  });
});
t('ICONES_V2 = false : les 12 rendent l\'ancien balisage fourni', () => {
  const F = charger(SRC.replace('const ICONES_V2 = true;', 'const ICONES_V2 = false;'));
  IDS.forEach(id => assert.strictEqual(F.img(id, 34, { ancien: '<img src="ancien.png">' }), '<img src="ancien.png">'));
});

// ---- Les surfaces ----
const NAV = [['mod-brief', 'icon-brief-nexus.png'], ['mod-journal', 'icon-journal-nexus.png'], ['mod-capital', 'icon-capital.png'],
  ['mod-produits', 'icon-produits.png'], ['mod-reception-carburant', 'icon-reception-carburant-24.png'], ['mod-assignations', 'icon-assignations.png'],
  ['mod-resultats', 'icon-resultats-equipe.png'], ['mod-parametres', 'icon-parametres-24.png']];
const NAV_EMOJI = [['mod-carburants-performance', '📈'], ['mod-fdj-performance', '📊'], ['mod-comptes-clients', '👥']];
t('barre d\'accueil : 11 modules du lot 2, ancien src / emoji gardé pour le retour arrière', () => {
  NAV.forEach(([id, png]) => {
    const b = (APP.match(new RegExp('<img data-nexus-icone="' + id + '"[^>]*>')) || [])[0];
    assert.ok(b, id);
    assert.ok(/\ssrc="assets\/icones\/v2\//.test(b) && !/\ssrc="assets\/icons\//.test(b), id + ' : src');
    assert.ok(b.includes('data-nexus-ancien-src="assets/icons/' + png + '"'), id + ' : ancien src');
  });
  NAV_EMOJI.forEach(([id, em]) => {
    assert.ok(new RegExp('<div class="nav-icon" data-nexus-icone="' + id + '"[^>]*data-nexus-ancien-emoji="' + em + '"[^>]*><img src="assets/icones/v2/' + id + '/').test(APP), id);
  });
  assert.ok(!/data-nexus-icone="mod-progression"/.test(APP), 'Progression n\'a pas de ligne dans la barre d\'accueil');
});
t('menu bureau : 11 entrées portent leur module ; les Paramètres de domaine gardent leur icône', () => {
  [['Brief NEXUS', 'mod-brief'], ['Journal', 'mod-journal'], ['Capital NEXUS', 'mod-capital'], ['Produits', 'mod-produits'],
   ['Réception carburant', 'mod-reception-carburant'], ['Carburants Performance', 'mod-carburants-performance'], ['FDJ Performance', 'mod-fdj-performance'],
   ['Assignations', 'mod-assignations'], ['Résultats', 'mod-resultats'], ['Comptes Clients', 'mod-comptes-clients'], ['Paramètres', 'mod-parametres']].forEach(([l, id]) =>
    assert.ok(DESK.includes("label: '" + l + "', module: '" + id + "'"), l));
  ['Paramètres Comptes Clients', 'Paramètres Inventaire', 'Paramètres FDJ'].forEach(l => {
    const m = DESK.match(new RegExp("label: '" + l + "'[^\\n]*")); assert.ok(m && !/module:/.test(m[0]), l);
  });
});
t('raccourcis : Produits, Brief, Carburants Performance, FDJ Performance, Journal, Capital', () => {
  [['Produits', 'mod-produits'], ['Brief NEXUS', 'mod-brief'], ['Carburants Performance', 'mod-carburants-performance'],
   ['FDJ Performance', 'mod-fdj-performance'], ['Journal', 'mod-journal'], ['Capital NEXUS', 'mod-capital']].forEach(([l, id]) =>
    assert.ok(CAT.includes("label: '" + l + "', module: '" + id + "'"), l));
});
t('Documentation : 9 moteurs du lot 2 portent leur module', () => {
  [['brief', 'brief'], ['journal', 'journal'], ['capital', 'capital'], ['produits', 'produits'], ['assignations', 'assignations'],
   ['resultats', 'resultats'], ['comptes-clients', 'comptes-clients'], ['parametres-station', 'parametres'], ['progression', 'progression']].forEach(([a, i]) =>
    assert.ok(DOC.includes("id: '" + a + "', module: 'mod-" + i + "', groupe:"), a));
  ['parametres-cc', 'parametres-inventaire'].forEach(a => assert.ok(!new RegExp("id: '" + a + "', module:").test(DOC), a));
});

// ---- Gardes ----
garde('la barre d\'accueil porte Journal', APP, h => /<img data-nexus-icone="mod-journal"/.test(h), 'data-nexus-icone="mod-journal"', 'data-x="mod-journal"');
garde('la barre d\'accueil garde l\'emoji de Comptes Clients pour le retour arrière', APP, h => /data-nexus-icone="mod-comptes-clients"[^>]*data-nexus-ancien-emoji="👥"/.test(h), 'data-nexus-ancien-emoji="👥"', 'data-nexus-ancien-x="👥"');
garde('le bureau : Capital porte son module', DESK, h => h.includes("label: 'Capital NEXUS', module: 'mod-capital'"), "module: 'mod-capital'", "module: 'mod-x'");
garde('le bureau : Paramètres Inventaire n\'a pas le module Paramètres', DESK, h => !/label: 'Paramètres Inventaire', module:/.test(h), "label: 'Paramètres Inventaire', href", "label: 'Paramètres Inventaire', module: 'mod-parametres', href");
garde('les raccourcis : FDJ Performance', CAT, h => h.includes("module: 'mod-fdj-performance'"), "module: 'mod-fdj-performance'", "module: 'mod-x'");
garde('la Documentation : Ma Progression', DOC, h => h.includes("id: 'progression', module: 'mod-progression'"), "module: 'mod-progression'", "module: 'mod-x'");
garde('le registre : Progression', SRC, h => /'mod-progression':\s*\{ libelle: 'Progression' \}/.test(h), "libelle: 'Progression'", "libelle: ''");

console.log(n + ' épreuves OK');
