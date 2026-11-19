// Non-disparition des titres de l'écran Scanner (lot L7). Données ENTIÈREMENT fictives.
// Règle : un titre de section, de question ou de carte présent dans la base de référence ne disparaît pas
// sans figurer dans RETRAITS_DECIDES (décision écrite du pilote, avec la date et la raison).
const assert = require('assert');
const E = require('./nexus-politique-tarifaire-ecran.js');
const A = require('./nexus-politique-tarifaire-registres.js');
const T = require('./nexus-politique-tarifaire.js');

// Titres décidés comme retirés : « N » remplace tout nombre. Aujourd'hui : l'indicateur « N contrôles sur M références ».
const RETRAITS_DECIDES = [
  { titre: 'contrôles sur N références', raison: 'indicateur remplacé par « Contrôles à effectuer (N) » et la ventilation par cause (décision du pilote, lot L7)' },
];

const norm = s => String(s).replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\d+(?:[.,]\d+)?/g, 'N').replace(/\s+/g, ' ').trim();
// Titres = texte des éléments de titre (h1 à h4, summary, legend, .sc-nom, .pt-ctl-titre) ; une question est réduite à sa phrase.
function titres(html) {
  const out = new Set();
  const re = /<(h[1-4]|summary|legend)\b[^>]*>([\s\S]*?)<\/\1>|<(\w+)\b[^>]*class="[^"]*\b(?:sc-nom|pt-ctl-titre)\b[^"]*"[^>]*>([\s\S]*?)<\/\3>/g;
  let m;
  while ((m = re.exec(html))) { let t = norm(m[2] !== undefined ? m[2] : m[4]); if (t.indexOf('?') > 0) t = t.slice(0, t.indexOf('?') + 1); if (t && t.length > 1) out.add(t); }
  return [...out];
}
// Renvoie la liste des titres de la base qui ont disparu sans être décidés.
function disparus(base, apres, retraits) {
  const decides = new Set((retraits || RETRAITS_DECIDES).map(r => r.titre));
  const present = new Set(apres);
  return base.filter(t => !present.has(t) && !decides.has(t));
}

const S = 'site-fictif-1';
const periode = { debut: '2030-03-01', fin: '2030-03-30' };
const reg = {
  familles: [{ site: S, famille_code: 'Alpha', libelle: 'Famille Alpha' }],
  rattachements: [{ site: S, portee: 'rayon', rayon: 'Rayon Alpha', famille_code: 'Alpha' }],
  seuils: [{ site: S, id: 1, niveau: 'famille', cible_niveau: 'Alpha', minimum: 0.4, cible: 0.5, statut_minimum: 'valide', statut_cible: 'valide' }],
};
const prod = (article, cat, q, pv, pa) => ({ article, categorie: cat, quantite: q, prix_vente: pv, prix_achat: pa, tva: 20, code_barres: '' });
const courantes = [prod('Produit A', 'Rayon Alpha', 100, 1.5, 1), prod('Produit B', 'Rayon Alpha', 50, 1.2, 1.5), prod('Produit C', 'Rayon Beta', 30, 3, 2)];
const analyse = T.analyser(courantes, [], A.contexteDepuisRegistres(reg, { periode }));
const apres = titres(E.htmlPage({ analyse, role: 'gerant', filtres: {}, incoherences: [] }));

// Base de référence : titres de la page en Production avant le lot L7. Ajouter un titre est libre ; en retirer un exige une décision.
const BASE = JSON.parse(process.env.NEXUS_TITRES_BASE_TEST || 'null') || require('./test_non_disparition_titres_scanner_base.json');

// ---- Éléments structurels et axe attendu (demande du Guardian, lot L7) ----
// Un élément = « type:identifiant » ; son axe = le panneau (data-axe-panneau) qui le contient ('entete' avant le premier panneau).
// Un élément de la base qui manque, ou qui change d'axe, échoue sauf s'il figure dans RETRAITS_ELEMENTS_DECIDES (décision écrite du pilote).
const RETRAITS_ELEMENTS_DECIDES = [];
function elements(html) {
  const out = {};
  let axe = 'entete', m;
  const re = /data-axe-panneau="(\w+)"|data-carte="([^"]+)"|data-filtre="([^"]+)"|data-historique="1"|data-filtre-histo="1">([\s\S]*?)<\/select>|conseiller-titre|data-commencer="1"|data-stock-absent="1"|data-ctl-causes="1"|Repère statistique : écart à la médiane/g;
  while ((m = re.exec(html))) {
    if (m[1]) axe = m[1];
    else if (m[2]) out['carte:' + m[2]] = axe;
    else if (m[3]) out['filtre:' + m[3]] = axe;
    else if (m[0] === 'data-historique="1"') out['historique'] = axe;
    else if (m[4] !== undefined) { out['historique-filtre'] = axe; (m[4].match(/value="([^"]+)"/g) || []).forEach(v => { out['historique-vue:' + v.slice(7, -1)] = axe; }); }
    else if (m[0] === 'conseiller-titre') out['conseiller'] = axe;
    else if (m[0] === 'data-commencer="1"') out['bouton-commencer-par'] = axe;
    else if (m[0] === 'data-stock-absent="1"') out['note-releve-stock-non-fourni'] = axe;
    else if (m[0] === 'data-ctl-causes="1"') out['pastilles-par-cause'] = axe;
    else out['repere-statistique-ecart-mediane'] = axe;
  }
  return out;
}
function ecartsElements(base, apres, retraits) {
  const decides = new Set((retraits || RETRAITS_ELEMENTS_DECIDES).map(r => r.element));
  const d = [];
  Object.keys(base).forEach(k => {
    if (decides.has(k)) return;
    if (!(k in apres)) d.push(k + ' : absent (axe attendu ' + base[k] + ')');
    else if (apres[k] !== base[k]) d.push(k + ' : axe ' + apres[k] + ' au lieu de ' + base[k]);
  });
  return d;
}
const pageAvec = (extra, a) => E.htmlPage(Object.assign({ analyse: a || analyse, role: 'gerant', filtres: {}, incoherences: [] }, extra));
const sansStock = Object.assign({}, analyse, { synthese: Object.assign({}, analyse.synthese, { stockFourni: false }) });
const stubMarge = '<details class="sc-carte pt-marge" data-marge-plus="repere"><summary><span class="sc-nom">Repère statistique : écart à la médiane</span></summary></details>';
const elementsApres = Object.assign({},
  elements(pageAvec({ historiqueDispo: true, verifications: [], margePlus: stubMarge })),
  elements(pageAvec({}, sansStock)).hasOwnProperty('note-releve-stock-non-fourni') ? { 'note-releve-stock-non-fourni': elements(pageAvec({}, sansStock))['note-releve-stock-non-fourni'] } : {});
if (process.argv[2] === '--elements') { console.log(JSON.stringify(elementsApres, null, 1)); process.exit(0); }
const BASE_ELEMENTS = require('./test_non_disparition_elements_scanner_base.json');

let n = 0;
const ok = (nom, f) => { f(); n++; };
ok('aucun titre de la base ne disparaît sans décision', () => {
  const d = disparus(BASE, apres);
  assert.deepStrictEqual(d, [], 'titres disparus sans décision : ' + JSON.stringify(d));
});
ok('l\'épreuve mord : un titre retiré en douce est détecté', () => {
  assert.deepStrictEqual(disparus(['Titre fictif retiré en douce'], apres), ['Titre fictif retiré en douce']);
  const sans = apres.filter(t => t !== apres[0]);
  assert.deepStrictEqual(disparus(BASE, sans), [apres[0]]);
});
ok('un retrait décidé n\'est pas signalé, et il est daté et motivé', () => {
  RETRAITS_DECIDES.forEach(r => assert.ok(r.titre && r.raison));
  assert.deepStrictEqual(disparus(['contrôles sur N références'], []), []);
});
ok('chaque retrait décidé figure dans la base (liste sans reste)', () => {
  RETRAITS_DECIDES.forEach(r => assert.ok(BASE.indexOf(r.titre) >= 0, 'retrait inconnu de la base : ' + r.titre));
});
ok('aucun élément structurel de la base ne manque ni ne change d\'axe sans décision', () => {
  assert.deepStrictEqual(ecartsElements(BASE_ELEMENTS, elementsApres), []);
});
ok('la base couvre les éléments demandés : cartes, historique et ses cinq vues, Conseiller, Commencer par, relevé de stock, repère statistique, filtres, pastilles par cause', () => {
  ['carte:marge_negative', 'carte:a_verifier', 'carte:marge_estimee', 'carte:propositions', 'carte:non_constates', 'historique',
    'historique-vue:verifiee', 'historique-vue:persistante', 'historique-vue:aggravee', 'historique-vue:resolue', 'historique-vue:tous',
    'conseiller', 'bouton-commencer-par', 'note-releve-stock-non-fourni', 'repere-statistique-ecart-mediane',
    'filtre:famille', 'filtre:rayon', 'filtre:statut', 'filtre:fiabilite', 'filtre:exception', 'pastilles-par-cause'
  ].forEach(k => assert.ok(k in BASE_ELEMENTS, 'absent de la base : ' + k));
});
ok('l\'épreuve mord sur les éléments : un élément retiré ou déplacé d\'axe est détecté', () => {
  const cle = 'filtre:statut', sans = Object.assign({}, elementsApres); delete sans[cle];
  assert.strictEqual(ecartsElements(BASE_ELEMENTS, sans).length, 1);
  const deplace = Object.assign({}, elementsApres, { 'carte:propositions': 'controler' });
  assert.strictEqual(ecartsElements(BASE_ELEMENTS, deplace).length, 1);
  assert.deepStrictEqual(ecartsElements(BASE_ELEMENTS, sans, [{ element: cle, raison: 'x' }]), []);
});
ok('le repère statistique est bien fabriqué par la page hôte', () => {
  const hote = require('fs').readFileSync(require('path').join(__dirname, 'NEXUS-Produits-v1.html'), 'utf8');
  assert.ok(hote.indexOf('Repère statistique : écart à la médiane') >= 0 && hote.indexOf('margePlus') >= 0);
});
console.log('test_non_disparition_titres_scanner : ' + n + ' épreuves OK');
module.exports = { titres, disparus, elements, ecartsElements };
if (process.argv[2] === '--base') console.log(JSON.stringify(apres, null, 1));
