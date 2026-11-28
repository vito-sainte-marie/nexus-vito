// A4-1d : périmètre exclu (migration 20261128100000), normalisation des rayons et objectif calculé de la station.
const assert = require('assert');
const fs = require('fs');
function t(nom, f) { try { f(); } catch (e) { console.error('ECHEC', nom, e.message); process.exitCode = 1; } }
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
t('couverture < 50 % : marge non évaluée', () => {
  const o = M.objectifStation([L('A', 'f1', 100, 30), L('B', 'f2', 400, 40)], { cibles: { f1: 0.3 } });
  assert.strictEqual(o.marge, null); assert.strictEqual(o.etat, 'marge_non_evaluee'); assert.ok(o.cible > 0);
});
t('aucune cible validée : non évalué', () => {
  const o = M.objectifStation([L('A', 'f1', 100, 30)], { cibles: {} });
  assert.strictEqual(o.etat, 'non_evalue'); assert.strictEqual(o.cible, null);
});
