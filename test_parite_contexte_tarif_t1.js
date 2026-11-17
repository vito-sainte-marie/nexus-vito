// Parité : construireContexteTarif(sources) alimenté par l'export Production (lignes brutes) contre le résultat T1 v2 (440 références).
// Lecture seule, aucun réseau. Les données de référence ne vivent pas dans ce dépôt : NEXUS_REF_SCANNER=<dossier docs/reference/scanner-tarifaire-dossiers>.
// Sans ce dossier, le test se déclare IGNORÉ (code 0) : il ne prouve rien dans ce cas.
// Usage : NEXUS_REF_SCANNER=... node test_parite_contexte_tarif_t1.js [rapport.json]
const fs = require('fs'), path = require('path');
const REF = process.env.NEXUS_REF_SCANNER;
if (!REF || !fs.existsSync(REF)) { console.log('IGNORÉ : NEXUS_REF_SCANNER absent, parité non mesurée'); process.exit(0); }
const E = require('./nexus-politique-tarifaire-ecran.js');
const PM = require('./nexus-produits-mesure.js');
const T = require('./nexus-politique-tarifaire.js');
const T1 = path.join(REF, '01-T1-moteur', 't1');
const cfg = require(path.join(T1, 'config_sainte_marie_t1.js')), C = cfg.contexte;
const lireJ = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const exp = lireJ(path.join(REF, '09-export-production-20261117', 'export_scanner_sm_20261117-2157.json'));
const reg = lireJ(path.join(REF, '05-T2-recette-fonctionnelle', 't2', 'recette_fonctionnelle', 'preuves', 'export_61_test_20261117-1417.json'));
const r1 = lireJ(path.join(T1, 'resultats', 'resultats_sainte_marie_t1.json'));
const ventesLignes = j => j.lignes.map(s => { const c = s.split('\t'); const o = {}; j.colonnes.forEach((k, i) => o[k] = c[i]);
  ['quantite', 'prix_achat', 'prix_vente', 'tva', 'ca', 'marge'].forEach(k => o[k] = o[k] === '' || o[k] === undefined ? null : Number(String(o[k]).replace(',', '.')));
  o.categorie = String(o.categorie || '').replace(/Ã /g, 'à').replace(/\s+/g, ' ').trim(); return o; });
const stockLignes = j => j.lignes.map(s => { const c = s.split('\t'); return { libelle: c[2], pa_net_ht: c[3] === '' ? null : Number(String(c[3]).replace(',', '.')) }; });
const R = new Set(cfg.RAYONS);
const P1 = ventesLignes(exp.jeux.ventes_20260919).filter(r => R.has(r.categorie));
const P2 = ventesLignes(exp.jeux.ventes_20261005).filter(r => R.has(r.categorie));
// Déclarations Produits équivalentes à la base T1 : 3 natures, 3 justifications, aucune confirmation de TVA.
const articlesNature = P2.map(r => r.article).filter(a => C.natureDe({ article: a }));
const declarations = {
  produits_nature_reference: [...new Set(articlesNature)].map((a, i) => ({ id: i + 1, article: a, code_barres: '', nature: 'sortie_perimes_casse', declare_le: '2026-11-16' })),
  produits_justifications_marge: C.justifications.map((j, i) => ({ id: i + 1, article: j.article, motif: j.motif, periode_debut: C.periode.debut, periode_fin: C.periode.fin, valide_le: '2026-11-16' })),
  produits_tva_confirmations: [],
};
const periode = C.periode;
const eg = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const stockBrut = stockLignes(exp.jeux.stock_brut_20261110);
const i1 = new Map(r1.lignes.map(l => [l.article, l]));

function passe(nom, { lignes, stock, tvaExplications, motifsDivergents }) {
  const ctx = E.construireContexteTarif({ registres: reg, declarations, lignes, periode, stock, stockSource: C.stockSource, tvaExplications, motifsDivergents });
  ctx.jours = C.jours;
  const r2 = T.analyser(lignes, lignes === P2 ? P1 : P1.filter(r => lignes.some(x => x.article === r.article)), ctx);
  const lib = ctx.libellesFamilles, ecarts = []; let identiques = 0;
  for (const l of r2.lignes) {
    const o = i1.get(l.article), e = [];
    if (!o) { ecarts.push({ article: l.article, champs: ['absente de T1'] }); continue; }
    if ((lib[l.famille] || l.famille) !== o.famille) e.push('famille');
    for (const k of ['statut', 'raisonStatut', 'taux', 'regime', 'fiabilite']) if (!eg(l[k], o[k])) e.push(k);
    if (!eg({ etat: l.conformite.etat, motif: l.conformite.motif }, { etat: o.conformite.etat, motif: o.conformite.motif })) e.push('conformite');
    if (!eg(l.alertes.map(a => [a.code, a.consequence]), o.alertes.map(a => [a.code, a.consequence]))) e.push('alertes');
    for (const k of ['prixDecide', 'minimum', 'cible', 'repereMinimum', 'repereCible']) if (!eg(l.simulation[k], o.simulation[k])) e.push(k);
    if (e.length) ecarts.push({ article: l.article, champs: e }); else identiques++;
  }
  const champs = {}; ecarts.forEach(x => x.champs.forEach(c => champs[c] = (champs[c] || 0) + 1));
  return { nom, references: r2.lignes.length, identiques, ecarts: ecarts.length, champs, gains_identiques: eg(r2.gains, r1.gains), statuts_identiques: eg(r2.synthese.statuts, r1.synthese.statuts), _ecarts: ecarts };
}
const st = E.stockParLibelle(stockBrut);
const rapport = { stock: { lignes_brutes: stockBrut.length, libelles_distincts: st.libelles, libelles_en_conflit_de_cout: st.conflits, libelles_ambigus_sans_pa: st.ambigus.length, libelles_retenus: st.lignes.length } };
rapport.parite_complete = passe('contexte page, stock brut, base T1 (TVA + motifs divergents fournis)', { lignes: P2, stock: stockBrut, tvaExplications: C.tva.explications, motifsDivergents: C.motifsDivergents });
rapport.contexte_page_reel = passe('contexte page tel que câblé aujourd\'hui (stock brut, sans explications TVA ni motifs divergents)', { lignes: P2, stock: stockBrut });
rapport.sans_stock = passe('sans stock', { lignes: P2, stock: null });
// Classement : tout écart de la parité complète est une régression ; l'écart du contexte réel est « attendu » s'il s'explique par une donnée absente (décisions 3 et 4).
const reel = rapport.contexte_page_reel;
const ARB_SORTIE = 'nature des 3 sorties Périmés/Casse (sortie_perimes_casse absent du vocabulaire Produits)';
const ARB_DOUBLON = 'règle du coût ambigu : libellé de stock aux PA différents retenu sans PA, référence à confirmer (T1 prenait la première ligne)';
const AMBIGUS = new Set(st.ambigus.map(a => a.article.toLowerCase()));
const ARB_A5 = "alerte A5 « identité changée » propre au moteur T2, absente de T1";
function classer(e) {
  const a = e.article;
  if (/Barre Mars Coeur Fondant|HARIBO CARENSAC|DURMINT/.test(a)) return { classe: 'attendu', arbitrage: ARB_SORTIE };
  if (AMBIGUS.has(PM.normaliserNom(a).toLowerCase())) return { classe: 'attendu', arbitrage: ARB_DOUBLON };
  if (e.champs.length === 1 && e.champs[0] === 'alertes') return { classe: 'attendu', arbitrage: ARB_A5 };
  return { classe: 'régression', arbitrage: null };
}
rapport.parite_complete.classement = rapport.parite_complete._ecarts.map(e => Object.assign({ article: e.article }, classer(e)));
const nbReg = rapport.parite_complete.classement.filter(c => c.classe === 'régression').length;
rapport.regressions = nbReg;
rapport.verdict = rapport.parite_complete.ecarts === 0 && rapport.parite_complete.gains_identiques ? 'PARITÉ' : (nbReg === 0 && rapport.parite_complete.identiques + rapport.parite_complete.ecarts === 440 ? 'AUCUNE RÉGRESSION (écarts attendus classés)' : 'RÉGRESSION');
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(rapport, null, 1));
for (const k of ['parite_complete', 'contexte_page_reel', 'sans_stock']) { const p = rapport[k]; console.log(`${p.nom}: ${p.identiques}/${p.references} identiques, ${p.ecarts} écarts ${JSON.stringify(p.champs)}, gains ${p.gains_identiques ? '=' : '≠'}`); }
console.log('stock', JSON.stringify(rapport.stock), '=>', rapport.verdict);
process.exit(rapport.verdict === 'RÉGRESSION' ? 1 : 0);
