// A4-1b : proposer / valider une marge cible (migration 20261127171000). Contrat statique.
const assert = require('assert');
const fs = require('fs');
function t(nom, f) { try { f(); } catch (e) { console.error('ECHEC', nom, e.message); process.exitCode = 1; } }
const sql = fs.readFileSync('supabase/migrations/20261127171000_objectifs_a4_1b_marge_cible.sql', 'utf8').replace(/--.*$/gm, '');
const R = fs.readFileSync('supabase/retours/20261127171000_retour_objectifs_a4_1b_marge_cible.sql', 'utf8');
const corps = n => sql.slice(sql.indexOf('function public.' + n), sql.indexOf('$$;', sql.indexOf('function public.' + n)));
t('security definer, search_path vide, 2 fonctions', () => {
  assert.strictEqual((sql.match(/security definer/g) || []).length, 2);
  assert.strictEqual((sql.match(/set search_path = ''/g) || []).length, 2);
});
t('habilitation par objectif_habilite, jamais par le rôle', () => {
  assert.ok(/objectif_habilite\(p_site, 'proposer'\)/.test(corps('proposer_marge_cible')));
  assert.ok(/objectif_habilite\(v_row\.site, 'valider'\)/.test(corps('valider_marge_cible')));
  assert.ok(!/current_employee_role|'gerant'/.test(sql));
});
t('station de l\'appelant seulement', () => {
  assert.ok(/objectif_autre_station/.test(corps('proposer_marge_cible')));
  assert.ok(/objectif_autre_station/.test(corps('valider_marge_cible')));
});
t('proposer écrit indicatif, valider écrit valide et chaîne remplace_id', () => {
  assert.ok(/'indicatif'/.test(corps('proposer_marge_cible')));
  assert.ok(/'valide'/.test(corps('valider_marge_cible')));
  assert.ok(/remplace_id/.test(corps('proposer_marge_cible')) && /remplace_id/.test(corps('valider_marge_cible')));
});
t('auto-validation refusée avant l\'écriture', () => {
  const c = corps('valider_marge_cible');
  assert.ok(c.indexOf('objectif_auto_validation_interdite') < c.indexOf('insert into'));
});
t('aucun update ni delete sur le registre', () => {
  assert.ok(!/\bupdate\s+public\.tarif_seuils|\bdelete\b/.test(sql));
});
t('exécution : authenticated seulement, public et anon révoqués', () => {
  assert.ok(/revoke all on function public\.proposer_marge_cible[^;]*from public, anon/.test(sql));
  assert.ok(/revoke all on function public\.valider_marge_cible[^;]*from public, anon/.test(sql));
  assert.ok(/grant execute on function public\.proposer_marge_cible[^;]*to authenticated/.test(sql));
  assert.ok(!/to anon/.test(sql));
});
t('le retour supprime les deux fonctions', () => {
  assert.ok(/drop function if exists public\.valider_marge_cible/.test(R));
  assert.ok(/drop function if exists public\.proposer_marge_cible/.test(R));
});
