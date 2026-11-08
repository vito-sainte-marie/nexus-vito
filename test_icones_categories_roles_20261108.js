// Icônes de catégories (11) et de rôles (5) v2 (Guardian 6722511613 et 6722548885, 08/11/2026) : registres CATEGORIES et ROLES
// de nexus-icones.js, correspondance tolérante nom → id, variantes Jour et 24 px, interrupteurs, surfaces câblées, grandes
// illustrations de poste laissées intactes.
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
function charger(src) { const ctx = { window: undefined }; ctx.globalThis = ctx; vm.runInNewContext(src, ctx); return ctx.NexusIcones; }
const SRC = lire('nexus-icones.js');
const NI = charger(SRC);
const dossier = id => path.join(__dirname, 'assets/icones/v2', id);

const CATS = {
  'cat-gaz': 'Gaz', 'cat-glacons': 'Glaçons', 'cat-huiles': 'Huiles', 'cat-boissons': 'Boissons chaudes',
  'cat-lave-glace': 'Lave-glace & Liquide de refroidissement', 'cat-viennoiserie': 'Viennoiserie', 'cat-pains': 'Pains',
  'cat-journaux': 'Journaux', 'cat-cbd': 'CBD', 'cat-cigarettes': 'Cigarettes', 'cat-petits-articles': 'Petits articles caisse',
};
const ROLES = { 'role-caissiere': 'caissiere', 'role-pompiste': 'pompiste', 'role-renfort': 'renfort', 'role-manager': 'manager', 'role-gerant': 'gerant' };
const attendus = id => [
  id + '.svg', id + '-jour.svg', id + '-24.svg', id + '-24-jour.svg', id + '-24.png',
  id + '@1x.webp', id + '@2x.webp', id + '@3x.webp', id + '-jour@1x.webp', id + '-jour@2x.webp', id + '-jour@3x.webp',
];

// ---- Le kit ----
t('les 11 catégories et les 5 rôles ont leurs 11 fichiers', () => {
  assert.strictEqual(Object.keys(CATS).length, 11);
  assert.strictEqual(Object.keys(ROLES).length, 5);
  Object.keys(CATS).concat(Object.keys(ROLES)).forEach(id => {
    attendus(id).forEach(f => assert.ok(fs.existsSync(path.join(dossier(id), f)), id + '/' + f));
    assert.strictEqual(fs.readdirSync(dossier(id)).length, 11, id);
  });
});
t('les registres exposent exactement ces identifiants', () => {
  assert.deepStrictEqual(Object.keys(NI.CATEGORIES).sort(), Object.keys(CATS).sort());
  assert.deepStrictEqual(Object.keys(NI.ROLES).sort(), Object.keys(ROLES).sort());
});

// ---- Catégories : nom → id ----
const NOMS = {
  'Gaz': 'cat-gaz', 'Glaçons': 'cat-glacons', 'Glacons': 'cat-glacons', 'Huiles': 'cat-huiles', 'Boissons chaudes': 'cat-boissons',
  'Bières': 'cat-boissons', 'Lave-glace & Liquide de refroidissement': 'cat-lave-glace', 'Viennoiserie': 'cat-viennoiserie',
  'Pains': 'cat-pains', 'Sandwichs': 'cat-pains', 'Journaux': 'cat-journaux', 'CBD': 'cat-cbd', 'Cigarettes': 'cat-cigarettes',
  'Petits articles caisse': 'cat-petits-articles', '  GAZ ': 'cat-gaz', 'Lave glace': 'cat-lave-glace',
};
t('11 catégories reconnues, casse, accents et espaces tolérés', () => {
  Object.keys(NOMS).forEach(nom => assert.strictEqual(NI.idCategorie(nom), NOMS[nom], nom));
  assert.strictEqual(new Set(Object.values(NOMS)).size, 11);
});
t('« Lave-glace » n\'est pas pris pour des glaçons (l\'ancienne règle « gla » se trompait)', () => {
  assert.strictEqual(NI.idCategorie('Lave-glace'), 'cat-lave-glace');
  assert.strictEqual(NI.idCategorie('Glaçons 5 kg'), 'cat-glacons');
});
t('catégorie inconnue, vide ou absente : null, la surface garde son pictogramme', () => {
  ['Épicerie', '', null, undefined, 42].forEach(x => assert.strictEqual(NI.idCategorie(x), null, String(x)));
  assert.strictEqual(NI.imgCategorie('cat-inconnue', 40, { ancien: '<svg>ancien</svg>' }), '<svg>ancien</svg>');
  assert.strictEqual(NI.imgCategorie(null, 40), '');
});

// ---- Rôles : code → id ----
t('5 rôles reconnus, « caissier » vaut caissière, polyvalent et inconnus : null', () => {
  Object.keys(ROLES).forEach(id => assert.strictEqual(NI.idRole(ROLES[id]), id));
  assert.strictEqual(NI.idRole('caissier'), 'role-caissiere');
  assert.strictEqual(NI.idRole(' Manager '), 'role-manager');
  ['polyvalent', 'vacataire', '', null, undefined, 'admin'].forEach(x => assert.strictEqual(NI.idRole(x), null, String(x)));
  assert.strictEqual(NI.imgRole('role-inconnu', 20, { ancien: 'X' }), 'X');
});

// ---- Variantes ----
t('thème sombre : @1x avec srcset 1x/2x/3x au-delà de 24 px', () => {
  const a = NI.attributsCategorie('cat-gaz', 40, { jour: false });
  assert.strictEqual(a.src, 'assets/icones/v2/cat-gaz/cat-gaz@1x.webp');
  assert.ok(/cat-gaz@2x\.webp 2x, assets\/icones\/v2\/cat-gaz\/cat-gaz@3x\.webp 3x$/.test(a.srcset));
  assert.strictEqual(a.width, 40);
});
t('thème Jour : variante -jour, pour les catégories et les rôles', () => {
  assert.strictEqual(NI.attributsCategorie('cat-gaz', 40, { jour: true }).src, 'assets/icones/v2/cat-gaz/cat-gaz-jour@1x.webp');
  assert.strictEqual(NI.attributsRole('role-manager', 40, { jour: true }).src, 'assets/icones/v2/role-manager/role-manager-jour@1x.webp');
  assert.ok(/-jour@3x\.webp 3x$/.test(NI.attributsRole('role-manager', 40, { jour: true }).srcset));
});
t('jusqu\'à 24 px : variante simplifiée -24.svg (et -24-jour.svg), sans srcset', () => {
  [16, 20, 24].forEach(px => {
    const a = NI.attributsCategorie('cat-cbd', px, { jour: false });
    assert.strictEqual(a.src, 'assets/icones/v2/cat-cbd/cat-cbd-24.svg'); assert.ok(!('srcset' in a));
    assert.strictEqual(NI.attributsRole('role-pompiste', px, { jour: true }).src, 'assets/icones/v2/role-pompiste/role-pompiste-24-jour.svg');
  });
  assert.ok(NI.attributsCategorie('cat-cbd', 25, { jour: false }).srcset);
});
t('thème lu sur html[data-theme] quand « jour » n\'est pas imposé', () => {
  const ctx = { document: { documentElement: { getAttribute: () => 'jour' } } };
  ctx.globalThis = ctx; ctx.window = undefined; vm.runInNewContext(SRC, ctx);
  assert.ok(/-jour@1x\.webp$/.test(ctx.NexusIcones.attributsCategorie('cat-gaz', 40).src));
});
t('décoratif : alt vide et aria-hidden ; sinon alt = libellé', () => {
  const d = NI.imgCategorie('cat-gaz', 40, { decoratif: true });
  assert.ok(/alt="" /.test(d) && /aria-hidden="true"/.test(d));
  assert.ok(/alt="Gaz"/.test(NI.imgCategorie('cat-gaz', 40)));
  assert.ok(/alt="Manager"|alt="[^"]*anager[^"]*"/.test(NI.imgRole('role-manager', 24)));
});

// ---- Interrupteurs ----
t('ICONES_CATEGORIES_V2 = false : l\'ancien rendu est restitué, les rôles restent actifs', () => {
  const off = charger(SRC.replace('const ICONES_CATEGORIES_V2 = true;', 'const ICONES_CATEGORIES_V2 = false;'));
  assert.strictEqual(off.imgCategorie('cat-gaz', 40, { ancien: 'ANCIEN' }), 'ANCIEN');
  assert.ok(/<img /.test(off.imgRole('role-manager', 20)));
});
t('ICONES_ROLES_V2 = false : l\'ancien rendu est restitué, les catégories restent actives', () => {
  const off = charger(SRC.replace('const ICONES_ROLES_V2 = true;', 'const ICONES_ROLES_V2 = false;'));
  assert.strictEqual(off.imgRole('role-manager', 20, { ancien: 'ANCIEN' }), 'ANCIEN');
  assert.ok(/<img /.test(off.imgCategorie('cat-gaz', 40)));
});
garde('interrupteur catégories : actif par défaut', SRC, c => /const ICONES_CATEGORIES_V2 = true;/.test(c), 'const ICONES_CATEGORIES_V2 = true;', 'const ICONES_CATEGORIES_V2 = false;');
garde('interrupteur rôles : actif par défaut', SRC, c => /const ICONES_ROLES_V2 = true;/.test(c), 'const ICONES_ROLES_V2 = true;', 'const ICONES_ROLES_V2 = false;');
garde('seuil simplifié à 24 px', SRC, c => /SEUIL_SIMPLIFIE = 24/.test(c), 'SEUIL_SIMPLIFIE = 24', 'SEUIL_SIMPLIFIE = 8');
garde('« caissier » vaut caissière', SRC, c => /caissier: 'role-caissiere'/.test(c), "caissier: 'role-caissiere'", "caissier: 'role-pompiste'");
garde('le thème est rafraîchi quand data-theme change', SRC, c => /new MutationObserver\(\(\) => rafraichirTheme\(\)\)/.test(c) && /attributeFilter: \['data-theme'\]/.test(c), "attributeFilter: ['data-theme']", "attributeFilter: ['lang']");

// ---- Surfaces câblées ----
const INV = lire('NEXUS-Inventaire-v1.html'), MGR = lire('NEXUS-Inventaire-Manager-v1.html'), APP = lire('NEXUS-App-v1.html');
const PDP = lire('nexus-prise-de-poste.js'), PLAN = lire('NEXUS-Mon-Planning-v1.html'), PARAM = lire('NEXUS-Parametres-Inventaire-v1.html');
t('Inventaire employé : listes à 40 px, en-tête de groupe à 24 px, repli sur l\'ancien pictogramme', () => {
  assert.strictEqual((INV.match(/iconeCategorie\(g\.nom\)/g) || []).length, 2);
  assert.ok(INV.includes('iconeCategorie(groupe.nom, 24)'));
  assert.ok(INV.includes('taille || 40'));
  assert.ok(INV.includes('ancien: ancien') && INV.includes("const ancien = svgKit(cle, 'inv-cat-icone')"));
});
t('Contrôle inventaire : lignes de comptage à 24 px, repli sur l\'ancien pictogramme', () => {
  assert.ok(MGR.includes('iconeCategorie(c.nom, 24)'));
  assert.ok(MGR.includes('NexusIcones.idCategorie(nom)') && MGR.includes('ancien: ancien'));
});
t('Paramètres Inventaire : aucun pictogramme de catégorie à remplacer, page non touchée', () => {
  assert.ok(!/NexusIcones|iconeCategorie/.test(PARAM));
});
t('Accueil : les deux lignes « Service en cours » portent l\'icône du rôle à 20 px', () => {
  assert.strictEqual((APP.match(/iconeRole\(serviceCourant\.role, 20\)/g) || []).length, 2);
  assert.ok(/ap-poste-nom/.test(APP) && /\.nexus-role-pict\{/.test(APP));
});
t('Prise de poste : récap à 24 px, confirmation de changement à 20 px', () => {
  assert.ok(PDP.includes('${iconeRole(info.value, 24)}${info.label}'));
  assert.ok(PDP.includes('iconeRole(ancien.value, 20)') && PDP.includes('iconeRole(nouveau.value, 20)'));
});
t('Planning : icône 16 px pour manager et renfort seulement, script du registre chargé', () => {
  assert.ok(/<script src="nexus-icones\.js\?v=[^"]+"><\/script>/.test(PLAN));
  assert.ok(PLAN.includes("(statut !== 'manager' && statut !== 'renfort')"));
  assert.ok(PLAN.includes('imgRole(id, 16,'));
  assert.ok(PLAN.includes('${iconeRoleStatut(ps.statut)}') && PLAN.includes('${iconeRoleStatut(r.statut)}'));
});
t('grandes illustrations de poste intactes : cartes de choix et ill-poste-* ne passent pas par le registre', () => {
  assert.ok(/ill-poste-/.test(PDP) || /pdp-image/.test(PDP));
  assert.ok(!/imgRole\([^)]*ill-poste|ill-poste[^\n]*iconeRole/.test(PDP));
  const carte = (PDP.match(/class="pdp-image"[^\n]*/g) || []).join('\n');
  assert.ok(carte && !/iconeRole|imgRole/.test(carte));
});
t('feuilles de style : les icônes ne déforment pas leur ligne', () => {
  [INV, MGR].forEach(s => assert.ok(/\.inv-cat-pict\{[^}]*object-fit:contain/.test(s)));
  assert.ok(/\.nexus-role-pict\{[^}]*object-fit:contain/.test(APP));
  assert.ok(/\.nexus-role-pict\{[^}]*object-fit:contain/.test(PDP));
  assert.ok(/\.nexus-role-pict\{[^}]*object-fit:contain/.test(PLAN));
});
t('toutes les pages câblées chargent le registre avec la version qui porte les nouvelles fonctions', () => {
  ['NEXUS-Inventaire-v1.html', 'NEXUS-Inventaire-Manager-v1.html', 'NEXUS-App-v1.html', 'NEXUS-Prise-De-Poste-v1.html', 'NEXUS-Mon-Planning-v1.html']
    .forEach(f => assert.ok(/nexus-icones\.js\?v=[\w-]+/.test(lire(f)), f));
  // build.sh réécrit le ?v= : on ne fige pas sa valeur, on vérifie que le fichier servi porte les nouvelles fonctions.
  const R = lire('nexus-icones.js');
  assert.ok(/imgCategorie/.test(R) && /imgRole/.test(R));
});

garde('Inventaire : en-tête à 24 px', INV, c => c.includes('iconeCategorie(groupe.nom, 24)'), 'iconeCategorie(groupe.nom, 24)', 'iconeCategorie(groupe.nom, 40)');
garde('Inventaire : listes à 40 px', INV, c => c.includes('taille || 40'), 'taille || 40', 'taille || 16');
garde('Inventaire : repli sur l\'ancien pictogramme', INV, c => c.includes('ancien: ancien'), 'ancien: ancien', 'ancien: \'\'');
garde('Contrôle inventaire : 24 px', MGR, c => c.includes('iconeCategorie(c.nom, 24)'), 'iconeCategorie(c.nom, 24)', 'iconeCategorie(c.nom, 64)');
garde('Accueil : icône du rôle sur la première ligne', APP, c => (c.match(/iconeRole\(serviceCourant\.role, 20\)/g) || []).length === 2, 'iconeRole(serviceCourant.role, 20)', 'iconeRole(serviceCourant.role, 99)');
garde('Prise de poste : récap', PDP, c => c.includes('${iconeRole(info.value, 24)}${info.label}'), '${iconeRole(info.value, 24)}${info.label}', '${info.label}');
garde('Prise de poste : confirmation de changement', PDP, c => c.includes('iconeRole(nouveau.value, 20)'), 'iconeRole(nouveau.value, 20)', 'nouveau.value');
garde('Planning : seulement manager et renfort', PLAN, c => c.includes("(statut !== 'manager' && statut !== 'renfort')"), "(statut !== 'manager' && statut !== 'renfort')", "(statut === 'zzz')");
garde('Planning : icône 16 px', PLAN, c => c.includes('imgRole(id, 16,'), 'imgRole(id, 16,', 'imgRole(id, 48,');

console.log(n + ' épreuves OK');
