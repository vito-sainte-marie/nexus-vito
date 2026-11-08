// Icône de FDJ Opérations (kit « nexus-icones-fdj-operations », 07/11/2026, Guardian 6715719132) : 43e module du registre,
// câblé sur le menu bureau, la barre d'accueil et la Documentation. L'ancien icon-fdj-24.png reste en repli (data-nexus-ancien-*).
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
const ID = 'mod-fdj-operations';
const SRC = lire('nexus-icones.js');
function charger(src) { const ctx = { window: undefined }; ctx.globalThis = ctx; vm.runInNewContext(src, ctx); return ctx.NexusIcones; }
const APP = lire('NEXUS-App-v1.html'), DESK = lire('nexus-desktop.js'), CAT = lire('nexus-raccourcis-catalogue.js'), DOC = lire('NEXUS-Documentation-v1.html');
const dossier = path.join(__dirname, 'assets/icones/v2', ID);
const taille = suf => fs.statSync(path.join(dossier, ID + suf)).size;

t('les 6 fichiers sont là, @2x ≤ 15 Ko et @3x ≤ 25 Ko', () => {
  ['.svg', '@1x.webp', '@2x.webp', '@3x.webp', '-24.svg', '-24.png'].forEach(suf => assert.ok(fs.existsSync(path.join(dossier, ID + suf)), suf));
  assert.ok(taille('@2x.webp') <= 15 * 1024); assert.ok(taille('@3x.webp') <= 25 * 1024);
});
t('SVG vectoriels purs (ni <image> ni <text>), identifiants du 24 px suffixés', () => {
  ['.svg', '-24.svg'].forEach(suf => {
    const s = fs.readFileSync(path.join(dossier, ID + suf), 'utf8');
    assert.ok(!/<image/.test(s) && !/<text/.test(s), suf);
  });
  const d24 = fs.readFileSync(path.join(dossier, ID + '-24.svg'), 'utf8');
  ((d24.match(/\bid="([^"]+)"/g) || []).map(x => x.slice(4, -1))).forEach(i => assert.ok(/-24(-|$)/.test(i), 'id non suffixé ' + i));
  const d = fs.readFileSync(path.join(dossier, ID + '.svg'), 'utf8');
  ((d.match(/\bid="([^"]+)"/g) || []).map(x => x.slice(4, -1))).forEach(i => assert.ok(i.startsWith(ID + '-'), 'id hors préfixe ' + i));
});
const R = charger(SRC);
t('le registre porte FDJ Opérations et compte au moins 43 modules', () => {
  assert.strictEqual(R.MODULES[ID].libelle, 'FDJ Opérations');
  assert.ok(Object.keys(R.MODULES).length >= 43);
});
t('≤ 24 px : simplifié ; au-delà : srcset 1x/2x/3x ; ICONES_V2 = false : ancien balisage', () => {
  const p = R.chemins(ID);
  ['detail1x', 'detail2x', 'detail3x', 'simplifie'].forEach(k => assert.ok(fs.existsSync(path.join(__dirname, p[k])), p[k]));
  assert.ok(R.img(ID, 16, { decoratif: true }).includes('src="' + p.simplifie + '"'));
  assert.ok(R.img(ID, 34, { decoratif: true }).includes('srcset="' + p.srcset + '"'));
  const F = charger(SRC.replace('const ICONES_V2 = true;', 'const ICONES_V2 = false;'));
  assert.strictEqual(F.img(ID, 34, { ancien: '<img src="ancien.png">' }), '<img src="ancien.png">');
});
t('menu bureau : l\'entrée FDJ Opérations porte son module et garde l\'ancien PNG en repli', () => {
  assert.ok(DESK.includes("label: 'FDJ Opérations', module: 'mod-fdj-operations', href: 'NEXUS-FDJ-Manager-v1.html', icon: 'assets/icons/icon-fdj-24.png'"));
});
t('barre d\'accueil : la tuile est en image v2, ancien src gardé pour le retour arrière', () => {
  const b = (APP.match(/<img data-nexus-icone="mod-fdj-operations"[^>]*>/) || [])[0];
  assert.ok(b);
  assert.ok(/\ssrc="assets\/icones\/v2\/mod-fdj-operations\//.test(b) && !/\ssrc="assets\/icons\//.test(b));
  assert.ok(b.includes('data-nexus-ancien-src="assets/icons/icon-fdj-24.png"') && b.includes('data-nexus-ancien-alt="FDJ Opérations"'));
  assert.ok(!/⭐|🌟/.test(((APP.match(/<a[^>]*NEXUS-FDJ-Manager-v1\.html[^]*?<\/a>/) || [''])[0])), 'plus d\'étoile dans la tuile');
});
t('Documentation : le moteur controle-fdj porte le module', () => {
  assert.ok(/nom: 'FDJ Opérations',\s*module: 'mod-fdj-operations',/.test(DOC));
});
t('raccourcis : aucune entrée FDJ Opérations (rien à câbler)', () => {
  assert.ok(!/FDJ-Manager/.test(CAT));
});
t('icon-fdj-24.png n\'est chargé directement par aucune surface de module : uniquement en repli (data-nexus-ancien-*, ancien du menu)', () => {
  const hors = [];
  [['NEXUS-App-v1.html', APP], ['NEXUS-Documentation-v1.html', DOC], ['nexus-raccourcis-catalogue.js', CAT]].forEach(([f, s]) => {
    (s.match(/<img[^>]*>/g) || []).forEach(b => { if (/\ssrc="[^"]*icon-fdj-24/.test(b)) hors.push(f); });
  });
  assert.deepStrictEqual(hors, [], 'src direct sur le PNG');
  assert.ok(!/(^|[^-])\bicon:\s*'assets\/icons\/icon-fdj-24\.png'[^}]*\}/.test(CAT));
  // dans le menu, l'entrée passe par NexusIcones.img(module, ..., { ancien }) : le PNG ne sert que si ICONES_V2 est coupé
  assert.ok(DESK.includes('NexusIcones.img(item.module, 16, { decoratif: true, ancien })'));
  assert.ok(!/<img[^>]*src="assets\/icons\/icon-fdj-24/.test(DESK));
});
t('l\'ancien PNG reste dans le dépôt (retour arrière)', () => {
  assert.ok(fs.existsSync(path.join(__dirname, 'assets/icons/icon-fdj-24.png')));
});

garde('le registre : FDJ Opérations', SRC, h => /'mod-fdj-operations':\s*\{ libelle: 'FDJ Opérations' \}/.test(h), "libelle: 'FDJ Opérations'", "libelle: ''");
garde('le menu bureau : FDJ Opérations porte son module', DESK, h => h.includes("label: 'FDJ Opérations', module: 'mod-fdj-operations'"), "module: 'mod-fdj-operations'", "module: 'mod-fdj'");
garde('la barre d\'accueil : tuile en v2', APP, h => /<img data-nexus-icone="mod-fdj-operations"/.test(h), 'data-nexus-icone="mod-fdj-operations"', 'data-x="mod-fdj-operations"');
garde('la barre d\'accueil : ancien src gardé', APP, h => /data-nexus-icone="mod-fdj-operations"[^>]*data-nexus-ancien-src="assets\/icons\/icon-fdj-24\.png"/.test(h), 'data-nexus-ancien-src="assets/icons/icon-fdj-24.png" data-nexus-ancien-alt="FDJ Opérations"', 'data-nexus-ancien-x="assets/icons/icon-fdj-24.png" data-nexus-ancien-alt="FDJ Opérations"');
garde('la Documentation : controle-fdj', DOC, h => /nom: 'FDJ Opérations',\s*module: 'mod-fdj-operations',/.test(h), "module: 'mod-fdj-operations',", "module: 'mod-x',");

console.log(n + ' épreuves OK');
