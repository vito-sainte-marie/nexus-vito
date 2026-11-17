// Comparaison locale, LECTURE SEULE, aucun réseau, aucune base. N'utilise PAS config_sainte_marie_t1.js.
// Contexte = construireContexteTarif (écran T3) + registres tarif_* (JSON exporté de Test, lecture seule) + export Production (fichier vérifié).
// Trois passes : A avec stock, B sans stock, C catalogue entier (avec stock). Chacune est comparée à resultats_sainte_marie_t1.json
// (les références absentes de T1 en C sont comptées à part, non comparées). Écarts classés : attendu (avec arbitrage), donnée absente, régression.
// Deux étiquettes : « réel » = export + registres seuls ; « conditionnel » = + compléments (TVA, motifs divergents, natures) fournis par --complements.
// Usage : node 50_comparer_a_b_c.mjs --moteur <dossier du dépôt> --export <fichier export.json> --registres <export registres.json>
//           --t1 <resultats_sainte_marie_t1.json> [--complements <fichier.json>] [--rayons <fichier.json>] [--sortie rapport.json]
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const a = process.argv.slice(2), opt = k => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : null; };
const need = k => opt(k) || (console.error('--' + k + ' requis'), process.exit(2));
const require = createRequire(path.resolve(need('moteur')) + '/');
const E = require('./nexus-politique-tarifaire-ecran.js'), PM = require('./nexus-produits-mesure.js'), T = require('./nexus-politique-tarifaire.js');
const lire = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const exp = lire(need('export')), reg = lire(need('registres')), r1 = lire(need('t1'));
const compl = opt('complements') ? lire(opt('complements')) : {};
const rayons = new Set(opt('rayons') ? lire(opt('rayons')) : r1.lignes.map(l => l.rayon)); // par défaut : rayons des résultats T1 (décision 1 du pilote : périmètre à arbitrer)
const num = v => v === '' || v == null ? null : Number(String(v).replace(',', '.'));
const lignes = j => j.lignes.map(s => { const c = s.split('\t'), o = {}; j.colonnes.forEach((k, i) => o[k] = c[i]);
  ['quantite', 'prix_achat', 'prix_vente', 'tva', 'ca', 'marge'].forEach(k => o[k] = num(o[k]));
  o.categorie = String(o.categorie || '').replace(/Ã /g, 'à').replace(/\s+/g, ' ').trim(); return o; });
const noms = Object.keys(exp.jeux).filter(n => n.startsWith('ventes_')).sort();
const [nP1, nP2] = noms; // période précédente puis période analysée (ordre de date dans le nom du jeu)
const brutes2 = lignes(exp.jeux[nP2]), brutes1 = lignes(exp.jeux[nP1]);
const periode = { debut: brutes2[0].periode_debut, fin: brutes2[0].periode_fin };
const jours = Math.round((Date.parse(periode.fin) - Date.parse(periode.debut)) / 864e5) + 1;
const nStock = Object.keys(exp.jeux).find(n => n.startsWith('stock_brut_'));
const stockBrut = exp.jeux[nStock].lignes.map(s => { const c = s.split('\t'); return { libelle: c[2], pa_net_ht: num(c[3]) }; });
const jd = n => n.slice(-8).replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1');
const stockSource = compl.stockSource || `valorisation du stock Decenium du ${jd(nStock)}, colonne « PA net HT »`;
const dec = exp.declarations, rows = k => (dec[k] && dec[k].lignes) || [];
function declarations(avecCompl) {
  const natures = avecCompl ? (compl.natures || []) : [];
  return {
    produits_nature_reference: rows('produits_nature_reference').concat(natures.map(article => ({ article, code_barres: '', nature: 'sortie_perimes_casse' })))
      .map((x, i) => ({ id: x.id || i + 1, article: x.article, code_barres: x.code_barres || '', nature: x.nature, declare_le: x.declare_le || '2026-11-16' })),
    produits_justifications_marge: rows('produits_justifications_marge'),
    produits_tva_confirmations: rows('produits_tva_confirmations'),
  };
}
const i1 = new Map(r1.lignes.map(l => [l.article, l]));
const eg = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const st = E.stockParLibelle(stockBrut), AMBIGUS = new Set(st.ambigus.map(x => x.article.toLowerCase()));
const NATURES = new Set(compl.natures || []);
const ARB = {
  sortie: 'nature des sorties Périmés/Casse : « sortie_perimes_casse » absent du vocabulaire Produits',
  doublon: 'règle du coût ambigu : libellé de stock aux PA différents retenu sans PA, référence à confirmer (T1 prenait la première ligne)',
  a5: 'alerte A5 « identité changée » propre au moteur T2, absente de T1',
};
function classer(e, passe, etiquette) {
  if (NATURES.has(e.article) || /périm|casse/i.test(e.categorie || '')) return { classe: 'attendu', arbitrage: ARB.sortie };
  if (AMBIGUS.has(PM.normaliserNom(e.article).toLowerCase())) return { classe: 'attendu', arbitrage: ARB.doublon };
  if (e.champs.length === 1 && e.champs[0] === 'alertes') return { classe: 'attendu', arbitrage: ARB.a5 };
  if (passe === 'B') return { classe: 'donnée absente', arbitrage: 'passe sans relevé de stock : coûts absents' };
  if (etiquette === 'réel') return { classe: 'donnée absente', arbitrage: 'explications TVA / motifs divergents non fournis (décisions 3 et 4 du pilote)' };
  return { classe: 'régression', arbitrage: null };
}
function passe(id, etiquette, { lignes: L, precedent, stock }) {
  const avec = etiquette === 'conditionnel';
  const ctx = E.construireContexteTarif({ registres: reg, declarations: declarations(avec), lignes: L, periode, stock, stockSource,
    tvaExplications: avec ? compl.tvaExplications : undefined, motifsDivergents: avec ? compl.motifsDivergents : undefined });
  ctx.jours = jours;
  const r2 = T.analyser(L, precedent, ctx), lib = ctx.libellesFamilles, parArticle = new Map(L.map(x => [x.article, x]));
  const ecarts = []; let identiques = 0, horsT1 = 0;
  for (const l of r2.lignes) {
    const o = i1.get(l.article); if (!o) { horsT1++; continue; }
    const e = [];
    if ((lib[l.famille] || l.famille) !== o.famille) e.push('famille');
    for (const k of ['statut', 'raisonStatut', 'taux', 'regime', 'fiabilite']) if (!eg(l[k], o[k])) e.push(k);
    if (!eg({ etat: l.conformite.etat, motif: l.conformite.motif }, { etat: o.conformite.etat, motif: o.conformite.motif })) e.push('conformite');
    if (!eg(l.alertes.map(x => [x.code, x.consequence]), o.alertes.map(x => [x.code, x.consequence]))) e.push('alertes');
    for (const k of ['prixDecide', 'minimum', 'cible', 'repereMinimum', 'repereCible']) if (!eg(l.simulation[k], o[k] === undefined ? o.simulation[k] : o.simulation[k])) e.push(k);
    if (e.length) { const b = parArticle.get(l.article) || {}; ecarts.push({ article: l.article, categorie: b.categorie, champs: e }); } else identiques++;
  }
  const classement = ecarts.map(e => Object.assign({ article: e.article, champs: e.champs }, classer(e, id, etiquette)));
  const parClasse = {}; classement.forEach(c => parClasse[c.classe] = (parClasse[c.classe] || 0) + 1);
  return { passe: id, etiquette, references: r2.lignes.length, comparees_a_t1: r2.lignes.length - horsT1, hors_t1: horsT1, identiques, ecarts: ecarts.length,
    classes: parClasse, statuts: r2.synthese.statuts, classement };
}
const P2 = brutes2.filter(r => rayons.has(r.categorie)), P1 = brutes1.filter(r => rayons.has(r.categorie));
const prec = L => brutes1.filter(r => L.some(x => x.article === r.article));
const rapport = { export: path.basename(need('export')), periode, jours, stock_source: stockSource, rayons: [...rayons].length, perimetre_rayons: opt('rayons') ? 'fichier fourni' : 'rayons des résultats T1 (décision 1 du pilote non tranchée)',
  stock: { lignes_brutes: stockBrut.length, libelles_ambigus: st.ambigus.length }, passes: [] };
for (const etiquette of ['conditionnel', 'réel']) {
  rapport.passes.push(passe('A', etiquette, { lignes: P2, precedent: P1, stock: stockBrut }));
  rapport.passes.push(passe('B', etiquette, { lignes: P2, precedent: P1, stock: null }));
  rapport.passes.push(passe('C', etiquette, { lignes: brutes2, precedent: brutes1, stock: stockBrut }));
}
rapport.regressions = rapport.passes.filter(p => p.etiquette === 'conditionnel' && p.passe !== 'B').reduce((n, p) => n + (p.classes['régression'] || 0), 0);
if (opt('sortie')) fs.writeFileSync(opt('sortie'), JSON.stringify(rapport, null, 1));
for (const p of rapport.passes) console.log(`${p.passe} ${p.etiquette.padEnd(12)} ${p.references} réf., ${p.comparees_a_t1} comparées à T1 : ${p.identiques} identiques, ${p.ecarts} écarts ${JSON.stringify(p.classes)}`);
console.log('régressions (passes A et C, conditionnel) :', rapport.regressions);
process.exit(rapport.regressions ? 1 : 0);
