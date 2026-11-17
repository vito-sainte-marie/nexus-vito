// Non-régression T2 : les arbitrages de T1 traduits en lignes de registres, relus par l'adaptateur, doivent donner
// exactement le même résultat que T1 v2 sur les 440 références de Sainte-Marie. Écrit aussi les données initiales de recette
// pour le projet Test (fichier SQL, NON EXÉCUTÉ). node non_regression_t1_t2.js
const fs = require('fs'), path = require('path'), assert = require('assert');
globalThis.window = globalThis;
const T1 = path.join(__dirname, '..', '..', 't1');
require(path.join(T1, 'nexus-produits-mesure.js'));
const T = require(path.join(T1, 'nexus-politique-tarifaire.js'));
const A = require('./nexus-politique-tarifaire-registres.js');
const cfg = require(path.join(T1, 'config_sainte_marie_t1.js'));
const lire = f => JSON.parse(fs.readFileSync(path.join(T1, 'donnees', f), 'utf8'));
const SITE = 'vito-sainte-marie';

const ventes = lire('ventes_decenium_2periodes.json').map(r => Object.assign({}, r, { categorie: String(r.categorie || '').replace(/Ã /g, 'à').replace(/\s+/g, ' ').trim() }));
const R = new Set(cfg.RAYONS);
const P1 = ventes.filter(r => r.periode_debut === '2026-09-19' && R.has(r.categorie)), P2 = ventes.filter(r => r.periode_debut === '2026-10-05' && R.has(r.categorie));
const stock = lire('stock_pa_net_ht_20261110.json').lignes;
const C = cfg.contexte;

// 1. Familles : codes stables, libellés de T1.
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
const nomsFamilles = new Set([...Object.keys(C.seuils), ...Object.values(C.familles.parRayon), ...C.familles.parMotif.map(m => m.famille)]);
const familles = [...nomsFamilles].map(l => ({ site: SITE, famille_code: slug(l), libelle: l }));
const code = l => slug(l);

// 2. Rattachements : rayons entiers, puis motifs T1 convertis en déclarations par référence (aucune expression en base).
const rattachements = Object.entries(C.familles.parRayon).map(([rayon, f]) => ({ site: SITE, portee: 'rayon', rayon, famille_code: code(f) }));
const vus = new Set();
for (const r of P2.concat(P1)) {
  const m = C.familles.parMotif.find(e => e.rayon === r.categorie && new RegExp(e.motif, 'i').test(r.article));
  if (!m) continue;
  const fallback = m.motif === '.';
  if (fallback) { if (!rattachements.some(x => x.portee === 'rayon' && x.rayon === r.categorie)) rattachements.push({ site: SITE, portee: 'rayon', rayon: r.categorie, famille_code: code(m.famille) }); continue; }
  const k = r.code_barres || r.article; if (vus.has(k)) continue; vus.add(k);
  rattachements.push({ site: SITE, portee: 'reference', code_barres: r.code_barres || null, article: r.code_barres ? null : r.article, famille_code: code(m.famille), motif: m.note || 'reprise de la règle T1' });
}
// 3. Seuils, 4. réglages (valeurs initiales A6 acceptées le 16/11/2026), 5 à 9 : registres déclaratifs.
const seuils = Object.entries(C.seuils).map(([f, s]) => ({ site: SITE, niveau: 'famille', cible_niveau: code(f), minimum: s.minimum, statut_minimum: s.statutMinimum, cible: s.cible, statut_cible: s.statutCible }));
const reglages = [['a6_baisse_points', 0.02], ['a6_baisse_marge_unitaire_euros', 0.02], ['a6_baisse_marge_unitaire_relative', 0.05], ['a6_montant_minimal', 5]].map(([parametre, valeur]) => ({ site: SITE, parametre, valeur }));
const exceptions = C.exceptions.map(e => ({ site: SITE, article: e.code_barres ? null : e.article, code_barres: e.code_barres || null, type: e.type || 'autre', statut: e.statut, motif: e.motif,
  cond_prix_ttc: e.conditions && e.conditions.prix_ttc || null, source: 'tarif_exceptions' }));
const prixDecides = C.prixDecides.map((p, i) => ({ id: 'pd' + i, site: SITE, article: p.article, nature: p.nature, prix_ttc: p.prix_ttc, decide_le: p.decide_le || '2026-11-16' }));
const regimes = C.regimes.map(g => ({ site: SITE, article: g.article, regime: g.regime, raison: g.raison }));
const controles = C.reglementaire.map(c => ({ site: SITE, portee: c.rayon ? 'rayon' : 'reference', rayon: c.rayon || null, article: c.article || null, etat: c.etat, type_element: ({ 'feuille de tabac': 'produit_tabac' })[c.type_element] || c.type_element || null, raison: c.raison }));
const registres = { familles, rattachements, seuils, reglages, exceptions, prixDecides, applications: [], regimes, controles };

const base = { periode: C.periode, jours: C.jours, stockSource: C.stockSource, tva: C.tva, justifications: C.justifications, motifsDivergents: C.motifsDivergents, natureDe: C.natureDe, stock };
const ctx = A.contexteDepuisRegistres(registres, base);
const r2 = T.analyser(P2, P1, ctx);
const r1 = JSON.parse(fs.readFileSync(path.join(T1, 'resultats', 'resultats_sainte_marie_t1.json'), 'utf8'));

// Comparaison ligne à ligne : tout sauf le nom de famille (code au lieu du libellé) doit être identique.
const lib = ctx.libellesFamilles;
let n = 0;
const i1 = new Map(r1.lignes.map(l => [l.article, l]));
for (const l of r2.lignes) {
  const o = i1.get(l.article); assert.ok(o, 'référence absente : ' + l.article);
  assert.strictEqual(lib[l.famille] || l.famille, o.famille, 'famille ' + l.article);
  for (const k of ['statut', 'raisonStatut', 'taux', 'regime']) assert.deepStrictEqual(l[k], o[k], k + ' ' + l.article);
  assert.deepStrictEqual(l.fiabilite, o.fiabilite, 'fiabilité ' + l.article);
  // Seul changement attendu : le vocabulaire du type d'élément est celui de la contrainte en base (« feuille de tabac » devient « produit_tabac »).
  assert.deepStrictEqual({ etat: l.conformite.etat, motif: l.conformite.motif }, { etat: o.conformite.etat, motif: o.conformite.motif }, 'conformité ' + l.article);
  assert.deepStrictEqual(l.alertes.map(a => [a.code, a.consequence]), o.alertes.map(a => [a.code, a.consequence]), 'alertes ' + l.article);
  for (const k of ['prixDecide', 'minimum', 'cible', 'repereMinimum', 'repereCible']) assert.deepStrictEqual(l.simulation[k], o.simulation[k], k + ' ' + l.article);
  n++;
}
assert.deepStrictEqual(r2.gains, r1.gains, 'gains identiques');
assert.deepStrictEqual(r2.synthese.statuts, r1.synthese.statuts); assert.deepStrictEqual(r2.synthese.alertes, r1.synthese.alertes);
console.log(`Non-régression T1 → T2 : ${n} références identiques (statut, fiabilité, conformité, alertes, simulations), gains identiques.`);
console.log(`Registres : ${familles.length} familles, ${rattachements.length} rattachements (${rattachements.filter(x => x.portee === 'reference').length} par référence), ${seuils.length} seuils, ${reglages.length} réglages, ${exceptions.length} exceptions, ${prixDecides.length} prix décidés, ${regimes.length} régime, ${controles.length} contrôles.`);

// Données initiales de recette pour Test (SQL), dans l'ordre imposé par les déclencheurs (familles avant seuils et rattachements).
const q = v => v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const ins = (t, cols, rows) => rows.length ? `insert into ${t} (${cols.join(', ')}) values\n  ${rows.map(r => '(' + cols.map(c => q(r[c])).join(', ') + ')').join(',\n  ')};\n` : '';
const GARDE = fs.readFileSync(path.join(__dirname, '..', 'comptes_recette', '00_garde_projet_test.sql'), 'utf8');
let sql = `-- Données initiales de RECETTE pour le projet Test (NON EXÉCUTÉ). Arbitrages T1 du 16/11/2026 traduits en registres.
-- À exécuter en Test seulement, après GO, par postgres : la garde vérifie le projet, puis les lignes sont saisies sous RLS
-- au nom du gérant de recette actif recette-t2-gerant-sm (saisi_par = auth.uid()). Ordre : après les quatre migrations et le script 40.
-- Ne jamais exécuter en Production : en Production, les registres sont remplis par le gérant depuis les écrans (T3), ou sur GO distinct.
begin;
${GARDE}select set_config('request.jwt.claim.sub', (select id::text from public.employees where username = 'recette-t2-gerant-sm' and actif and site_id = '${SITE}'), true);
set local role authenticated;
`;
sql += ins('tarif_familles', ['site', 'famille_code', 'libelle'], familles);
sql += ins('tarif_rattachements', ['site', 'portee', 'rayon', 'article', 'code_barres', 'famille_code', 'motif'], rattachements.map(r => ({ rayon: null, article: null, code_barres: null, motif: null, ...r })));
sql += ins('tarif_seuils', ['site', 'niveau', 'cible_niveau', 'minimum', 'statut_minimum', 'cible', 'statut_cible'], seuils);
sql += ins('tarif_reglages', ['site', 'parametre', 'valeur'], reglages);
sql += ins('tarif_exceptions', ['site', 'article', 'code_barres', 'type', 'statut', 'motif', 'cond_prix_ttc'], exceptions);
sql += ins('tarif_prix_decides', ['site', 'article', 'nature', 'prix_ttc', 'decide_le'], prixDecides);
sql += ins('tarif_regimes_prix', ['site', 'article', 'regime', 'raison'], regimes);
sql += ins('tarif_controles_reglementaires', ['site', 'portee', 'rayon', 'article', 'type_element', 'etat', 'raison'], controles.map(c => ({ type_element: null, ...c })));
sql += 'commit;\n';
fs.writeFileSync(path.join(__dirname, '..', 'migrations', 'recette_test_donnees_sainte_marie_t2.sql'), sql);
fs.writeFileSync(path.join(__dirname, 'registres_sainte_marie_t2.json'), JSON.stringify(registres, null, 1));
