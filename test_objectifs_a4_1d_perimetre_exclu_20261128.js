// A4-1d : périmètre exclu (migration 20261128100000), normalisation des rayons et objectif calculé de la station.
const assert = require('assert');
const fs = require('fs');
function t(nom, f) { try { f(); } catch (e) { console.error('AssertionError: ' + nom + ' : ' + String(e.message).split('\n')[0]); process.exitCode = 1; } }
const sql = fs.readFileSync('supabase/migrations/20261128100000_objectifs_a4_1d_perimetre_exclu.sql', 'utf8').replace(/--.*$/gm, '');
const R = fs.readFileSync('supabase/retours/20261128100000_retour_objectifs_a4_1d_perimetre_exclu.sql', 'utf8');
const corps = n => sql.slice(sql.indexOf('function public.' + n), sql.indexOf('$$;', sql.indexOf('function public.' + n)));
const M = require('./nexus-cible-marge.js');

t('fonctions security definer, search_path vide, public et anon fermés', () => {
  assert.strictEqual((sql.match(/security definer/g) || []).length, 2);
  assert.ok((sql.match(/set search_path = ''/g) || []).length >= 3);
  assert.ok(/revoke all on function public\.declarer_perimetre_exclu\(text, text, text\) from public, anon;/.test(sql));
  assert.ok(/revoke all on function public\.retirer_perimetre_exclu\(uuid, text\) from public, anon;/.test(sql));
  assert.ok(/revoke all on table public\.tarif_perimetre_exclu from public, anon, authenticated/.test(sql));
  assert.ok(/grant select on table public\.tarif_perimetre_exclu to authenticated/.test(sql));
});
t('écriture refusée sans habilitation valider ; lecture par lire', () => {
  assert.ok(/objectif_habilite\(p_site, 'valider'\)/.test(corps('declarer_perimetre_exclu')));
  assert.ok(/objectif_habilite\(v_l\.site, 'valider'\)/.test(corps('retirer_perimetre_exclu')));
  assert.ok(/objectif_habilite\(site, 'lire'\)/.test(sql));
  assert.ok(!/current_employee_role|'gerant'/.test(sql));
});
t('garde dans les deux sens', () => {
  assert.ok(/perimetre_rayon_cible_validee/.test(corps('declarer_perimetre_exclu')));
  assert.ok(/perimetre_rayon_exclu/.test(sql) && /before insert on public\.tarif_seuils/i.test(sql));
});
t('retrait : motif exigé ; annulation, jamais de suppression', () => {
  assert.ok(/perimetre_motif_requis/.test(corps('retirer_perimetre_exclu')));
  assert.ok(!/delete from public\.tarif_perimetre_exclu/.test(sql));
});
t('aucune liste initiale de rayons dans la migration', () => {
  assert.ok(!/insert into public\.tarif_perimetre_exclu/.test(sql.replace(corps('declarer_perimetre_exclu'), '')));
});
t('retour : défait trigger, fonctions et table', () => {
  assert.ok(/drop trigger/i.test(R) && /drop function/i.test(R) && /drop table/i.test(R));
});
t('normalisation : mojibake, double espace, casse, accents', () => {
  const ref = M.normaliserRayon('Tabac à rouler');
  assert.strictEqual(M.normaliserRayon('Tabac Ã  rouler'), ref);
  assert.strictEqual(M.normaliserRayon('Tabac Ã rouler'), ref);
  assert.strictEqual(M.normaliserRayon('  TABAC   a  rouler '), ref);
  assert.strictEqual(M.normaliserRayon('Feuilles à  rouler - Filtres - Tubes'), M.normaliserRayon('Feuilles à rouler - Filtres - Tubes'));
  assert.notStrictEqual(M.normaliserRayon('Tabac à rouler'), M.normaliserRayon('Tabac à pipe'));
  assert.notStrictEqual(M.normaliserRayon('Boissons'), M.normaliserRayon('Boisson'));
});
const L = (rayon, famille, ca, m) => ({ rayon, famille, ca_ht: ca, margeEstimee: { margeHt: m } });
t('objectif : moyenne pondérée par le CA, marge réelle sur le même périmètre', () => {
  const o = M.objectifStation([L('A', 'f1', 100, 30), L('A', 'f2', 300, 60), L('B', 'f3', 100, 10)], { cibles: { f1: 0.3, f2: 0.2 }, exclus: [] });
  assert.ok(Math.abs(o.cible - (100 * 0.3 + 300 * 0.2) / 400) < 1e-9);
  assert.ok(Math.abs(o.marge - 90 / 400) < 1e-9);
  assert.ok(Math.abs(o.couverture - 400 / 500) < 1e-9);
  assert.strictEqual(o.familles, 2); assert.strictEqual(o.etat, 'evalue');
});
t('objectif : un rayon exclu sort du dénominateur', () => {
  const o = M.objectifStation([L('A', 'f1', 100, 30), L('X', 'f9', 900, 0)], { cibles: { f1: 0.3 }, exclus: [{ rayon_cle: 'x' }] });
  assert.strictEqual(o.couverture, 1);
});
t('couverture < 50 % : objectif non évalué, cible moyenne des familles validées conservée', () => {
  const o = M.objectifStation([L('A', 'f1', 100, 30), L('B', 'f2', 400, 40)], { cibles: { f1: 0.3 } });
  assert.strictEqual(o.etat, 'non_evalue'); assert.strictEqual(o.cible, null); assert.strictEqual(o.marge, null);
  assert.ok(Math.abs(o.cibleMoyenne - 0.3) < 1e-9);
  assert.ok(Math.abs(o.couvertureCa - 0.2) < 1e-9);
});
t('deux indicateurs de couverture : familles pilotables et CA pilotable', () => {
  const o = M.objectifStation([L('A', 'f1', 100, 30), L('A', 'f2', 100, 10), L('B', 'f3', 800, 40)], { cibles: { f1: 0.3, f2: 0.2 } });
  assert.ok(Math.abs(o.couvertureFamilles - 2 / 3) < 1e-9);
  assert.ok(Math.abs(o.couvertureCa - 0.2) < 1e-9);
  assert.strictEqual(o.famillesCiblees, 2); assert.strictEqual(o.famillesPilotables, 3);
});
t('ligne cible sans marge connue : hors cible et marge, comptée à part, couverture sur le même périmètre', () => {
  const lignes = [L('A', 'f1', 100, 30), L('A', 'f2', 20, null), L('B', 'f3', 10, 5)];
  const o = M.objectifStation(lignes, { cibles: { f1: 0.3, f2: 0.4 } });
  assert.deepStrictEqual(o.sansMarge, { lignes: 1, ca: 20 });
  assert.ok(Math.abs(o.cible - 0.3) < 1e-9, 'la cible ignore la ligne sans marge');
  assert.ok(Math.abs(o.marge - 0.3) < 1e-9);
  assert.ok(Math.abs(o.couvertureCa - 100 / 130) < 1e-9, 'couverture mesurée sur le périmètre comparable');
  assert.strictEqual(o.etat, 'evalue');
});
t('aucune cible validée : non évalué', () => {
  const o = M.objectifStation([L('A', 'f1', 100, 30)], { cibles: {} });
  assert.strictEqual(o.etat, 'non_evalue'); assert.strictEqual(o.cible, null);
});

// Clé SQL tarif_rayon_cle (migration 20261128140000) contre normaliserRayon.
const sql2 = fs.readFileSync('supabase/migrations/20261128140000_objectifs_a4_1d_cle_rayon_normalisee.sql', 'utf8').replace(/--.*$/gm, '');
const R2 = fs.readFileSync('supabase/retours/20261128140000_retour_objectifs_a4_1d_cle_rayon_normalisee.sql', 'utf8');
const cleSql = x => String(x).replace(/Ã\s+/g, 'à ').toLowerCase()
  .replace(/[àáâãäåçèéêëìíîïñòóôõöùúûüýÿ]/g, c => 'aaaaaaceeeeiiiinooooouuuuyy'['àáâãäåçèéêëìíîïñòóôõöùúûüýÿ'.indexOf(c)])
  .replace(/\s+/g, ' ').trim();
t('clé SQL : mêmes cas que normaliserRayon, forme mojibake et forme accentuée', () => {
  ['Tabac à rouler', 'Tabac Ã  rouler', 'Tabac Ã rouler', '  TABAC   a  rouler ', 'Boissons Alcoolisées', 'Épicerie salée'].forEach(c =>
    assert.strictEqual(cleSql(c), M.normaliserRayon(c), c));
  assert.strictEqual(cleSql('Tabac Ã  rouler'), cleSql('Tabac à rouler'));
});
t('migration 140000 : la clé unique sert aux deux gardes et aux clés déjà posées', () => {
  assert.ok(/function public\.tarif_rayon_cle\(p_rayon text\)[\s\S]*immutable/.test(sql2));
  assert.ok(/translate\(/.test(sql2) && /Ã\\s\+/.test(sql2));
  const f = n => sql2.slice(sql2.indexOf('function public.' + n), sql2.indexOf('$$;', sql2.indexOf('function public.' + n)));
  assert.ok(/public\.tarif_rayon_cle\(p_rayon_cle\)/.test(f('declarer_perimetre_exclu')));
  assert.ok(/public\.tarif_rayon_cle\(t\.cible_niveau\)/.test(f('declarer_perimetre_exclu')));
  assert.ok(/public\.tarif_rayon_cle\(new\.cible_niveau\)/.test(f('tarif_seuils_rayon_exclu_garde')));
  assert.ok(/update public\.tarif_perimetre_exclu/.test(sql2));
  assert.ok(/revoke all on function public\.declarer_perimetre_exclu\(text, text, text\) from public, anon;/.test(sql2));
  assert.ok(/drop function if exists public\.tarif_rayon_cle/.test(R2));
});

// Câblage écran : exclusions lues, filtrées par site, cache-bust.
const ecran = fs.readFileSync('nexus-politique-tarifaire-ecran.js', 'utf8');
const page = fs.readFileSync('NEXUS-Produits-v1.html', 'utf8');
t('chargerObjectifs lit tarif_perimetre_exclu filtré par site et non annulé', () => {
  const i = ecran.indexOf("from('tarif_perimetre_exclu')");
  assert.ok(i > 0, 'lecture absente');
  const bloc = ecran.slice(i, i + 300);
  assert.ok(/\.eq\('site', site\)/.test(bloc) && /\.is\('annule_le', null\)/.test(bloc));
  assert.ok(/rayonsExclus: exclus/.test(ecran));
});
t('rechargerObjectifs alimente etat.rayonsExclus ; cache-bust de l\'écran levé', () => {
  assert.ok(/etat\.rayonsExclus = ob\.rayonsExclus/.test(page));
  // build.sh épingle les ?v= avant la suite : on vérifie une épingle ; la valeur source est gardée par test_versions_scripts_20261121.js.
  assert.ok(/nexus-politique-tarifaire-ecran\.js\?v=[0-9a-zA-Z-]+/.test(page));
});
t('texte sous le seuil et ligne sans marge dans l\'écran', () => {
  assert.ok(ecran.includes('Objectif de la station non évalué : les cibles validées couvrent'));
  assert.ok(ecran.includes('du CA pilotable (seuil \' + Math.round(NCM.SEUIL_COUVERTURE * 100) + \' %). '));
  assert.ok(ecran.includes('Cible moyenne des familles validées'));
  assert.ok(/sansMarge/.test(ecran));
});
