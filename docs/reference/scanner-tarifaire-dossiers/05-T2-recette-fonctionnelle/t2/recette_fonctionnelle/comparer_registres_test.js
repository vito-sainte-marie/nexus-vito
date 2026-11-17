// Recette fonctionnelle T2 : registres RELUS dans Supabase Test (export 61) -> adaptateur -> moteur T1 v2 -> comparaison
// avec le résultat T1 v2 sur les 440 références de Sainte-Marie. Lecture seule, aucun réseau.
// Usage : node comparer_registres_test.js <export_61.json> [rapport.json] [--repetition-locale]
// Sans --repetition-locale, l'export doit venir du projet Test (est_projet_test vrai), sinon verdict ECART.
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const T1 = path.join(__dirname, '..', '..', 't1');
require(path.join(T1, 'nexus-produits-mesure.js'));
const T = require(path.join(T1, 'nexus-politique-tarifaire.js'));
const A = require(path.join(__dirname, '..', 'adaptateur', 'nexus-politique-tarifaire-registres.js'));
const cfg = require(path.join(T1, 'config_sainte_marie_t1.js'));
const lire = f => JSON.parse(fs.readFileSync(path.join(T1, 'donnees', f), 'utf8'));

const brut = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const reg = brut.registres || (Array.isArray(brut) && brut[0] && brut[0].registres) || brut;
const sortie = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null;
const local = process.argv.includes('--repetition-locale');
const rapport = { repetition_locale: local, source: path.basename(process.argv[2]), lu_le: reg.horodatage || null, est_projet_test: reg.est_projet_test,
  comptes: Object.fromEntries(['familles', 'rattachements', 'seuils', 'reglages', 'exceptions', 'prixDecides', 'applications', 'regimes', 'controles'].map(k => [k, (reg[k] || []).length])),
  attendus: { familles: 24, rattachements: 51, seuils: 13, reglages: 4, exceptions: 13, prixDecides: 21, applications: 0, regimes: 1, controles: 3 }, ecarts: [] };

const ventes = lire('ventes_decenium_2periodes.json').map(r => Object.assign({}, r, { categorie: String(r.categorie || '').replace(/Ã /g, 'à').replace(/\s+/g, ' ').trim() }));
const R = new Set(cfg.RAYONS), C = cfg.contexte;
const P1 = ventes.filter(r => r.periode_debut === '2026-09-19' && R.has(r.categorie)), P2 = ventes.filter(r => r.periode_debut === '2026-10-05' && R.has(r.categorie));
const base = { periode: C.periode, jours: C.jours, stockSource: C.stockSource, tva: C.tva, justifications: C.justifications, motifsDivergents: C.motifsDivergents, natureDe: C.natureDe, stock: lire('stock_pa_net_ht_20261110.json').lignes };
const ctx = A.contexteDepuisRegistres(reg, base);
const r2 = T.analyser(P2, P1, ctx);
const r1 = JSON.parse(fs.readFileSync(path.join(T1, 'resultats', 'resultats_sainte_marie_t1.json'), 'utf8'));
const lib = ctx.libellesFamilles, i1 = new Map(r1.lignes.map(l => [l.article, l]));
const eg = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let identiques = 0;
for (const l of r2.lignes) {
  const o = i1.get(l.article), e = [];
  if (!o) { rapport.ecarts.push({ article: l.article, ecart: 'absente de T1' }); continue; }
  if ((lib[l.famille] || l.famille) !== o.famille) e.push('famille');
  for (const k of ['statut', 'raisonStatut', 'taux', 'regime', 'fiabilite']) if (!eg(l[k], o[k])) e.push(k);
  if (!eg({ etat: l.conformite.etat, motif: l.conformite.motif }, { etat: o.conformite.etat, motif: o.conformite.motif })) e.push('conformite');
  if (!eg(l.alertes.map(a => [a.code, a.consequence]), o.alertes.map(a => [a.code, a.consequence]))) e.push('alertes');
  for (const k of ['prixDecide', 'minimum', 'cible', 'repereMinimum', 'repereCible']) if (!eg(l.simulation[k], o.simulation[k])) e.push(k);
  if (e.length) rapport.ecarts.push({ article: l.article, ecart: e.join(',') }); else identiques++;
}
rapport.references = { t2: r2.lignes.length, t1: r1.lignes.length, identiques };
rapport.gains_identiques = eg(r2.gains, r1.gains);
rapport.statuts_identiques = eg(r2.synthese.statuts, r1.synthese.statuts);
rapport.alertes_identiques = eg(r2.synthese.alertes, r1.synthese.alertes);
rapport.comptes_conformes = eg(rapport.comptes, rapport.attendus);
rapport.verdict = (local || rapport.est_projet_test === true) && rapport.comptes_conformes && identiques === 440 && r2.lignes.length === 440
  && rapport.gains_identiques && rapport.statuts_identiques && rapport.alertes_identiques && rapport.ecarts.length === 0 ? 'CONFORME' : 'ECART';
if (sortie) fs.writeFileSync(sortie, JSON.stringify(rapport, null, 1));
console.log(`${rapport.verdict} : ${identiques}/440 références identiques à T1 v2, gains ${rapport.gains_identiques ? 'identiques' : 'DIFFÉRENTS'}, registres ${rapport.comptes_conformes ? 'complets' : 'INCOMPLETS ' + JSON.stringify(rapport.comptes)}`);
process.exit(rapport.verdict === 'CONFORME' ? 0 : 1);
