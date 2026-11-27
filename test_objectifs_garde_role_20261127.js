// Garde d'éligibilité (G-4) de accorder_droit_objectif : migration 20261127170500.
const assert = require('assert');
const fs = require('fs');
function t(nom, f) { try { f(); } catch (e) { console.error('ECHEC', nom, e.message); process.exitCode = 1; } }
const M = fs.readFileSync('supabase/migrations/20261127170500_objectifs_garde_role_eligible.sql', 'utf8');
const R = fs.readFileSync('supabase/retours/20261127170500_retour_objectifs_garde_role_eligible.sql', 'utf8');
const sql = M.replace(/--.*$/gm, '');
t('code objectif_role_non_eligible, quel que soit le droit', () => {
  assert.ok(/objectif_role_non_eligible/.test(sql));
  const iDroit = sql.indexOf("p_droit not in");
  const iRole = sql.indexOf('objectif_role_non_eligible');
  const iInsert = sql.indexOf('insert into');
  assert.ok(iRole > iDroit && iRole < iInsert, 'le refus précède toute écriture');
  assert.ok(!/p_droit\s*=\s*'/.test(sql.slice(sql.indexOf('objectif_role_non_eligible') - 400, iRole)), 'pas de condition sur le droit');
});
t('population : manager, gérant, créateur ; pas pompiste, caissier, renfort, vacataire', () => {
  assert.ok(/e\.role in \('manager', 'gerant'\)/.test(sql));
  assert.ok(/est_createur/.test(sql));
  ['pompiste', 'caissier', 'renfort', 'vacataire'].forEach(r => assert.ok(!sql.includes(`'${r}'`), r));
});
t('le contrôle porte sur le bénéficiaire et reste security definer', () => {
  assert.ok(/e\.id = p_employe/.test(sql));
  assert.ok(/security definer/.test(sql) && /set search_path = ''/.test(sql));
  assert.ok(/objectif_habilite\(p_site, 'valider'\)/.test(sql));
});
t('redéfinition, pas de drop : les droits d\'exécution restent', () => {
  assert.ok(/create or replace function public\.accorder_droit_objectif/.test(sql));
  assert.ok(!/\bdrop\b/.test(sql));
});
t('le retour rétablit R2 sans la garde', () => {
  assert.ok(/create or replace function public\.accorder_droit_objectif/.test(R));
  assert.ok(!/objectif_role_non_eligible/.test(R.replace(/--.*$/gm, '')));
});
console.log('ok');
