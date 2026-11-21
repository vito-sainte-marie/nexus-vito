'use strict';
// Garde Guardian 7068757893 : le registre d'icônes de catégorie doit déclarer toute famille que la table des rayons peut rendre.
// Défaut corrigé : 18 familles ajoutées sans entrée dans CATEGORIES, imgCategorie rendait '' (vignettes vides).
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const D = __dirname;
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
global.NexusRayonsFamilles = require(path.join(D, 'nexus-rayons-familles.js'));
require(path.join(D, 'nexus-icones.js'));
const RF = global.NexusRayonsFamilles;
const NI = global.NexusIcones || (typeof window !== 'undefined' && window.NexusIcones);
assert.ok(NI && NI.imgCategorie, 'NexusIcones.imgCategorie indisponible');
const rendu = (id, taille) => NI.imgCategorie(id, taille || 40, { decoratif: true, jour: false });

t('chaque identifiant de PRETES est déclaré dans le registre (rend une image)', () => {
  const manques = RF.PRETES.filter(id => !rendu(id));
  assert.deepStrictEqual(manques, [], 'identifiants sans entrée dans CATEGORIES : ' + manques.join(', '));
});
t('chaque famille citée par une règle (cible ou secours prête) est rendue', () => {
  const ids = new Set();
  RF.REGLES.forEach(r => { ids.add(r.famille); if (r.secours) ids.add(r.secours); });
  const manques = Array.from(ids).filter(id => RF.PRETES.indexOf(id) >= 0 && !rendu(id));
  assert.deepStrictEqual(manques, []);
});
t('chaque règle, exercée par un libellé de rayon, aboutit à une vignette non vide', () => {
  const echantillon = ['Confiserie', 'Biscuits', 'Chips', 'Jus', 'Eaux', 'Bières', 'Alcools', 'Tabac à rouler', 'Feuilles',
    'Vape', 'Cartes', 'Glaces', 'Épicerie', 'Hygiène', 'Entretien', 'Auto', 'Électricité', 'Bricolage', 'Gaz', 'Huiles moteur',
    'Boissons', 'Viennoiserie', 'Pains', 'Journaux', 'CBD', 'Paquet de 20', 'Petits articles', 'Rayon sans règle connue'];
  echantillon.forEach(r => {
    const id = RF.iconeRayon(r);
    assert.ok(rendu(id), r + ' -> ' + id + ' : vignette vide');
  });
});
t('chaque identifiant de PRETES a ses fichiers d\'image (SVG 24 px et WebP @1x, Jour et Nuit)', () => {
  RF.PRETES.forEach(id => {
    ['', '-jour'].forEach(j => {
      ['/' + id + '-24' + j + '.svg', '/' + id + j + '@1x.webp'].forEach(f => assert.ok(fs.existsSync(path.join(D, 'assets/icones/v2', id + f)), id + f));
    });
  });
});
t('identifiant hors registre : chaîne vide (le repli est du ressort de l\'écran, qui le trace)', () => {
  assert.strictEqual(rendu('cat-inexistant'), '');
  const src = fs.readFileSync(path.join(D, 'nexus-politique-tarifaire-ecran.js'), 'utf8');
  assert.ok(/identifiant de famille inconnu : ' \+ id \+ ' \(rayon : '/.test(src), 'trace du repli sans identifiant et rayon');
});
const RAYONS_REELS = [
 "AUTO / MOTO",
 "Accesoires - Briquets - Gaz",
 "Accessoires",
 "Additifs",
 "Ampoules",
 "Article de M\u00e9nage",
 "Autres",
 "Biscuiterie - Pains d'\u00e9pices - Patisserie Industrielle",
 "Bi\u00e8res Stouts",
 "Bi\u00e8res, Cidres et Panach\u00e9s",
 "Bois et d\u00e9riv\u00e9s - Charbon",
 "Boissons Alcoolis\u00e9es",
 "Boissons Energ\u00e9tiques",
 "Boissons Malt\u00e9s",
 "Boissons au Th\u00e9",
 "CBD",
 "Caf\u00e9 - Th\u00e9 - Infusions et Boissons instantan\u00e9es",
 "Carrosserie",
 "Cartes pr\u00e9pay\u00e9es",
 "Champagnes",
 "Charcuterie",
 "Chips - Biscuits et Petits Sal\u00e9s",
 "Chocolat",
 "Cigares",
 "Cigarettes",
 "Codes promo",
 "Colles",
 "Concentr\u00e9s et Sirop",
 "Condiments et Sauces",
 "Confiserie",
 "Conserves",
 "Courrier",
 "Divers",
 "E-LIQUIDE",
 "E-Liquides",
 "EPICERIE",
 "Eaux Aromatis\u00e9es",
 "Eaux non aromatis\u00e9es",
 "Eaux plates ou gazeuses",
 "Electricit\u00e9",
 "Entretien",
 "Esth\u00e9tique",
 "Farine - F\u00e9cule - Semoule - Pur\u00e9e de Pomme de Terre",
 "Feuilles \u00e0 rouler - Filtres - Tubes",
 "Fruits et L\u00e9gumes Secs - Riz - Graine Sal\u00e9es",
 "Gaz",
 "Gaz / Pein air / Glacons",
 "Glaces et cr\u00e8mes glac\u00e9es",
 "Glacons",
 "Graisse",
 "Huile Moteur",
 "Huiles - Vinaigres - Graisses",
 "Hygi\u00e8ne",
 "Int\u00e9rieur",
 "Jardinage",
 "Jouet",
 "Jus de fruits et l\u00e9gumes",
 "Kits et Packs",
 "Lait de Conserve (boites, tubes) \u00e9tuis et Berlingots",
 "Lavage",
 "Lave Glace",
 "Liquide Refroidissement",
 "Lubrifiants",
 "Outillage",
 "PUFFS",
 "Pains - Patisseries fraiches",
 "Paquet de 20",
 "Paquet de 25",
 "Paquet de 30",
 "Pates Alimentaires",
 "Plats cuisin\u00e9s en conserves et Soupes",
 "Pneumatique",
 "Pot Tabac",
 "Presse",
 "Produits Capillaires",
 "Produits Papiers, hygi\u00e8ne et accessoires",
 "Quincaillerie",
 "Services - Presse - T\u00e9l\u00e9phonie",
 "Sodas, toniques",
 "Soins et Beaut\u00e9 du Corps",
 "Spiritueux, Eaux de vie, Liqueurs, Cocktails, Rhums",
 "Sucres - Confitures et Fruits au Sirop",
 "Tabac \u00c3 rouler - 30g",
 "Vaisselle",
 "Vins",
 "auto-moto",
 "maison deco"
];
// Libellés seuls des 87 rayons du lot réel (Guardian 7065506472), tels qu'importés (écritures d'origine conservées).
t('87 rayons réels : chacun a une famille et une vignette non vide ; seuls Divers et Jouet prennent le neutre', () => {
  assert.strictEqual(RAYONS_REELS.length, 87);
  const neutres = [], vides = [];
  RAYONS_REELS.forEach(r => {
    const id = RF.iconeRayon(r);
    if (!rendu(id)) vides.push(r + ' -> ' + id);
    if (id === RF.NEUTRE) neutres.push(r);
  });
  assert.deepStrictEqual(vides, [], 'vignette vide : ' + vides.join(' ; '));
  assert.deepStrictEqual(neutres.sort(), ['Divers', 'Jouet'], 'rayons au neutre : ' + neutres.join(' ; '));
});
console.log(n + ' épreuves OK');
