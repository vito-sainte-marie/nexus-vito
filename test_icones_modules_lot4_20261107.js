// Icônes de modules, lot 4 (kit « nexus-icones-modules-lot4-v1.1 », 07/11/2026) : 10 derniers modules ajoutés au registre
// nexus-icones.js, mêmes mécanismes que les lots 1 à 3 (img, appliquer, data-nexus-ancien-*, ICONES_V2 = false).
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
const LOT4 = {
  'mod-admin': 'Administration', 'mod-aide': 'Aide', 'mod-apprentissage': 'Apprentissage', 'mod-centre-intelligence': "Centre d'intelligence",
  'mod-coach-fdj': 'Coach FDJ', 'mod-evolution': 'Évolution', 'mod-pointage': 'Pointage', 'mod-prise-de-poste': 'Prise de poste',
  'mod-rayon': 'Rayon', 'mod-tracabilite': 'Traçabilité',
};
const IDS = Object.keys(LOT4);
const SRC = lire('nexus-icones.js');
function charger(src) { const ctx = { window: undefined }; ctx.globalThis = ctx; vm.runInNewContext(src, ctx); return ctx.NexusIcones; }
const APP = lire('NEXUS-App-v1.html'), DESK = lire('nexus-desktop.js'), CAT = lire('nexus-raccourcis-catalogue.js'), DOC = lire('NEXUS-Documentation-v1.html');
const dossier = id => path.join(__dirname, 'assets/icones/v2', id);

// ---- Le kit ----
t('les 10 identifiants ont leurs 6 fichiers, aux bonnes tailles', () => {
  assert.strictEqual(IDS.length, 10);
  IDS.forEach(id => {
    ['.svg', '@1x.webp', '@2x.webp', '@3x.webp', '-24.svg', '-24.png'].forEach(suf => assert.ok(fs.existsSync(path.join(dossier(id), id + suf)), id + suf));
    const taille = suf => fs.statSync(path.join(dossier(id), id + suf)).size;
    assert.ok(taille('@2x.webp') <= 15 * 1024, id + ' @2x > 15 Ko');
    assert.ok(taille('@3x.webp') <= 25 * 1024, id + ' @3x > 25 Ko');
  });
});
t('les identifiants internes des SVG 24 px sont suffixés (aucune collision entre icônes)', () => {
  IDS.forEach(id => {
    const d24 = fs.readFileSync(path.join(dossier(id), id + '-24.svg'), 'utf8');
    ((d24.match(/\bid="([^"]+)"/g) || []).map(x => x.slice(4, -1))).forEach(i => assert.ok(/-24(-|$)/.test(i), id + ' : id non suffixé ' + i));
  });
});
t('Coach FDJ : seule icône dont le SVG embarque une image WebP (exception connue), les autres sont en vectoriel pur', () => {
  IDS.forEach(id => {
    const s = fs.readFileSync(path.join(dossier(id), id + '.svg'), 'utf8');
    if (id === 'mod-coach-fdj') assert.ok(/<image[^>]+data:image\/webp;base64,/.test(s), 'Coach FDJ embarque une image');
    else assert.ok(!/<image/.test(s), id + ' : image embarquée inattendue');
  });
});
t('les anciens PNG restent dans le dépôt (retour arrière)', () => {
  ['icon-aide-24.png', 'icon-centre-intelligence.png', 'icon-avatar-coach-24.png', 'icon-evolution.png', 'icon-pointage.png',
   'icon-prise-de-poste.png', 'icon-rayon.png'].forEach(f => assert.ok(fs.existsSync(path.join(__dirname, 'assets/icons', f)), f));
});

// ---- Le registre ----
const R = charger(SRC);
t('le registre porte les 10 modules du lot 4, chacun avec son libellé, et au moins 42 modules', () => {
  IDS.forEach(id => { assert.ok(R.MODULES[id], id); assert.strictEqual(R.MODULES[id].libelle, LOT4[id]); });
  assert.ok(Object.keys(R.MODULES).length >= 42);
});
t('≤ 24 px : simplifié ; au-delà : détaillé en srcset 1x/2x/3x', () => {
  IDS.forEach(id => {
    const p = R.chemins(id);
    ['detail1x', 'detail2x', 'detail3x', 'simplifie'].forEach(k => assert.ok(fs.existsSync(path.join(__dirname, p[k])), p[k]));
    assert.ok(R.img(id, 16, { decoratif: true }).includes('src="' + p.simplifie + '"'));
    assert.ok(R.img(id, 34, { decoratif: true }).includes('srcset="' + p.srcset + '"'));
    assert.ok(R.img(id, 20).includes('alt="' + LOT4[id].replace(/'/g, '&#39;') + '"'));
  });
});
t('ICONES_V2 = false : les 10 rendent l\'ancien balisage fourni', () => {
  const F = charger(SRC.replace('const ICONES_V2 = true;', 'const ICONES_V2 = false;'));
  IDS.forEach(id => assert.strictEqual(F.img(id, 34, { ancien: '<img src="ancien.png">' }), '<img src="ancien.png">'));
});

// ---- Les surfaces ----
const NAV = [['mod-centre-intelligence', 'icon-centre-intelligence.png'], ['mod-rayon', 'icon-rayon.png'],
  ['mod-coach-fdj', 'icon-avatar-coach-24.png'], ['mod-aide', 'icon-aide-24.png']];
t('barre d\'accueil : 4 modules en image + Administration en emoji, ancien src / emoji gardé pour le retour arrière', () => {
  NAV.forEach(([id, png]) => {
    const b = (APP.match(new RegExp('<img data-nexus-icone="' + id + '"[^>]*>')) || [])[0];
    assert.ok(b, id);
    assert.ok(/\ssrc="assets\/icones\/v2\//.test(b) && !/\ssrc="assets\/icons\//.test(b), id + ' : src');
    assert.ok(b.includes('data-nexus-ancien-src="assets/icons/' + png + '"'), id + ' : ancien src');
  });
  assert.ok(/<div class="nav-icon" data-nexus-icone="mod-admin"[^>]*data-nexus-ancien-emoji="⚙️"[^>]*><img src="assets\/icones\/v2\/mod-admin\//.test(APP), 'Administration');
});
t('tuiles de repli de l\'employé : Prise de poste, Pointage, Évolution portent leur module', () => {
  [['prisedeposte', 'mod-prise-de-poste'], ['pointage', 'mod-pointage'], ['evolution', 'mod-evolution']].forEach(([k, id]) =>
    assert.ok(new RegExp('\\b' + k + ": \\{ titre: '[^']*', desc: '[^']*', href: '[^']*', module: '" + id + "', icone:").test(APP), k));
});
t('menu bureau : Coach FDJ et Comprendre NEXUS portent leur module', () => {
  [['Coach FDJ', 'mod-coach-fdj'], ['Comprendre NEXUS', 'mod-aide']].forEach(([l, id]) => assert.ok(DESK.includes("label: '" + l + "', module: '" + id + "'"), l));
});
t('raccourcis : Rayon et Centre d\'Intelligence', () => {
  assert.ok(CAT.includes("label: 'Rayon', module: 'mod-rayon'"));
  assert.ok(CAT.includes('label: "Centre d\'Intelligence", module: \'mod-centre-intelligence\''));
});
t('Documentation : 5 moteurs du lot 4 portent leur module', () => {
  [['rayon', 'mod-rayon'], ['tracabilite', 'mod-tracabilite'], ['pointage', 'mod-pointage'], ['apprentissage', 'mod-apprentissage'],
   ['cin', 'mod-centre-intelligence']].forEach(([a, m]) => assert.ok(DOC.includes("id: '" + a + "', module: '" + m + "', groupe:"), a));
});
t('usages laissés : Debug créateur (🛠) et les emojis de contenu (🧠 🏷️) ne sont pas touchés', () => {
  assert.ok(APP.includes('<div class="nav-icon">🛠</div>'));
  assert.ok(lire('NEXUS-Centre-Intelligence-v1.html').includes('🧠 Ce que le Journal m\'apprend'));
  assert.ok(lire('NEXUS-Missions-v1.html').includes('🏷️ Produit concerné'));
});

// ---- Gardes ----
garde('la barre d\'accueil porte Rayon', APP, h => /<img data-nexus-icone="mod-rayon"/.test(h), 'data-nexus-icone="mod-rayon"', 'data-x="mod-rayon"');
garde('la barre d\'accueil garde l\'emoji d\'Administration pour le retour arrière', APP, h => /data-nexus-icone="mod-admin"[^>]*data-nexus-ancien-emoji="⚙️"/.test(h), 'data-nexus-ancien-emoji="⚙️"', 'data-nexus-ancien-x="⚙️"');
garde('la tuile Pointage porte son module', APP, h => h.includes("module: 'mod-pointage'"), "module: 'mod-pointage'", "module: 'mod-x'");
garde('le bureau : Coach FDJ porte son module', DESK, h => h.includes("label: 'Coach FDJ', module: 'mod-coach-fdj'"), "module: 'mod-coach-fdj'", "module: 'mod-x'");
garde('les raccourcis : Rayon', CAT, h => h.includes("module: 'mod-rayon'"), "module: 'mod-rayon'", "module: 'mod-x'");
garde('la Documentation : Traçabilité', DOC, h => h.includes("id: 'tracabilite', module: 'mod-tracabilite'"), "module: 'mod-tracabilite'", "module: 'mod-x'");
garde('le registre : Évolution', SRC, h => /'mod-evolution':\s*\{ libelle: 'Évolution' \}/.test(h), "libelle: 'Évolution'", "libelle: ''");

console.log(n + ' épreuves OK');
