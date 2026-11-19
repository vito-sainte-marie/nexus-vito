// Compare, par référence des rayons retenus, le PA net HT du relevé de stock du 10/11 et le prix_achat_ht du cliché Inventaire du 08/11.
// LECTURE DE FICHIERS SEULEMENT : aucune connexion, aucune écriture hors --sortie. Le cliché du 08/11 n'est pas dans l'export :
// sa lecture en Production exige un GO distinct ; ce programme attend un fichier déjà obtenu (JSON [objets] ou TSV avec en-tête).
// Appariement : code-barres si les deux côtés en portent un, sinon libellé normalisé. Sortie déterministe (aucune date, ordre trié).
//
// node 60_comparer_pa_1011_0811.mjs --export <export.json> [--jeu stock_brut_20261110] --cliche <cliche_0811.json|.tsv> --t1 <resultats_t1.json> [--sortie <rapport.json>]
// Colonnes du cliché reconnues : code_barres | libelle|article|libellé | prix_achat_ht | categorie|rayon|Catégorie.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';

const argv = process.argv.slice(2);
const opt = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const need = n => opt(n) || (console.error('--' + n + ' requis'), process.exit(2));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const num = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : null; };
const pick = (o, ...ks) => { for (const k of ks) if (o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== '') return o[k]; return null; };

function lireTable(f) {
  const t = fs.readFileSync(f, 'utf8');
  if (/\.json$/i.test(f)) { const j = JSON.parse(t); return Array.isArray(j) ? j : (j.lignes || []); }
  const L = t.split(/\r?\n/).filter(Boolean), h = L[0].split('\t');
  return L.slice(1).map(l => Object.fromEntries(l.split('\t').map((v, i) => [h[i], v])));
}

const exp = JSON.parse(fs.readFileSync(need('export'), 'utf8'));
const jeu = exp.jeux[opt('jeu') || 'stock_brut_20261110'];
if (!jeu) { console.error('jeu absent de l\'export'); process.exit(2); }
const r1 = JSON.parse(fs.readFileSync(need('t1'), 'utf8'));
const rayons = new Set(r1.lignes.map(l => norm(l.rayon)));
const releve = jeu.lignes.map(x => typeof x === 'string' ? Object.fromEntries(x.split('\t').map((v, i) => [jeu.colonnes[i], v])) : x)
  .map(o => ({ rayon: pick(o, 'Catégorie', 'categorie'), libelle: pick(o, 'Libellé', 'libelle', 'article'), code: String(pick(o, 'code_barres', 'Code-barres') || '').trim(), pa: num(pick(o, 'PA net HT', 'pa_net_ht')) }))
  .filter(o => rayons.has(norm(o.rayon)));
const cliche = lireTable(need('cliche'))
  .map(o => ({ rayon: pick(o, 'categorie', 'rayon', 'Catégorie'), libelle: pick(o, 'libelle', 'article', 'libellé', 'Libellé'), code: String(pick(o, 'code_barres') || '').trim(), pa: num(pick(o, 'prix_achat_ht')) }))
  .filter(o => !o.rayon || rayons.has(norm(o.rayon)));

// Index du cliché : par code-barres, puis par libellé. Plusieurs lignes à la même clé = ambigu, jamais choisi au hasard.
const idx = (rows, cle) => { const m = new Map(); for (const r of rows) { const k = cle(r); if (!k) continue; (m.get(k) || m.set(k, []).get(k)).push(r); } return m; };
const parCode = idx(cliche, r => r.code), parNom = idx(cliche, r => norm(r.libelle));
const utilises = new Set(), ecarts = [], sansCliche = [], ambigus = [];
let identiques = 0, apparies = 0, nonComparables = 0;
for (const r of releve) {
  let c = r.code ? parCode.get(r.code) : null, mode = 'code-barres';
  if (!c) { c = parNom.get(norm(r.libelle)); mode = 'libellé'; }
  if (!c) { sansCliche.push(r.libelle); continue; }
  if (c.length > 1) { ambigus.push({ libelle: r.libelle, lignes_cliche: c.length }); c.forEach(x => utilises.add(x)); continue; }
  utilises.add(c[0]); apparies++;
  if (r.pa === null || c[0].pa === null) { nonComparables++; continue; }
  const ecart = Math.round((r.pa - c[0].pa) * 10000) / 10000;
  if (Math.abs(ecart) < 0.00005) { identiques++; continue; }
  ecarts.push({ libelle: r.libelle, rayon: r.rayon, apparie_par: mode, pa_1011: r.pa, pa_0811: c[0].pa, ecart_valeur: ecart, ecart_pct: c[0].pa ? Math.round(ecart / c[0].pa * 10000) / 100 : null });
}
const seulClicheBrut = cliche.filter(c => !utilises.has(c));
const tri = (a, k) => a.sort((x, y) => String(x[k]).localeCompare(String(y[k]), 'fr'));
const rapport = {
  perimetre: { rayons: [...rayons].sort().length, lignes_releve_1011: releve.length, lignes_cliche_0811: cliche.length },
  resultat: { apparies, identiques, avec_ecart: ecarts.length, non_comparables_pa_absent: nonComparables, ambigus: ambigus.length, seulement_releve_1011: sansCliche.length, seulement_cliche_0811: seulClicheBrut.length },
  ecarts: tri(ecarts, 'libelle'), ambigus: tri(ambigus, 'libelle'),
  seulement_releve_1011: sansCliche.sort((a, b) => a.localeCompare(b, 'fr')),
  seulement_cliche_0811: seulClicheBrut.map(c => c.libelle).sort((a, b) => String(a).localeCompare(String(b), 'fr')),
  entrees: { export: { fichier: path.basename(need('export')), sha256: sha(need('export')) }, cliche: { fichier: path.basename(need('cliche')), sha256: sha(need('cliche')) }, t1: { fichier: path.basename(need('t1')), sha256: sha(need('t1')) } },
};
const sortie = JSON.stringify(rapport, null, 1) + '\n';
if (opt('sortie')) fs.writeFileSync(opt('sortie'), sortie);
console.log(JSON.stringify(rapport.perimetre), JSON.stringify(rapport.resultat));
console.log('sha256 de la sortie :', crypto.createHash('sha256').update(sortie).digest('hex'));
