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
console.log('test_non_disparition_titres_scanner : ' + n + ' épreuves OK');
module.exports = { titres, disparus };
if (process.argv[2] === '--base') console.log(JSON.stringify(apres, null, 1));
