// A4-1b : propositions de marge cible (migration 20261127171000). Contrat statique.
// Une proposition vit dans marge_cible_propositions ; la cible validée de tarif_seuils reste active.
const assert = require('assert');
const fs = require('fs');
function t(nom, f) { try { f(); } catch (e) { console.error('ECHEC', nom, e.message); process.exitCode = 1; } }
const sql = fs.readFileSync('supabase/migrations/20261127171000_objectifs_a4_1b_marge_cible.sql', 'utf8').replace(/--.*$/gm, '');
const R = fs.readFileSync('supabase/retours/20261127171000_retour_objectifs_a4_1b_marge_cible.sql', 'utf8');
const corps = n => sql.slice(sql.indexOf('function public.' + n), sql.indexOf('$$;', sql.indexOf('function public.' + n)));
t('3 fonctions security definer, search_path vide', () => {
  assert.strictEqual((sql.match(/security definer/g) || []).length, 3);
  assert.strictEqual((sql.match(/set search_path = ''/g) || []).length, 3);
});
t('table de propositions : RLS, lecture seule pour authenticated, anon fermé', () => {
  assert.ok(/create table if not exists public\.marge_cible_propositions/.test(sql));
  assert.ok(/alter table public\.marge_cible_propositions enable row level security/.test(sql));
  assert.ok(/revoke all on table public\.marge_cible_propositions from public, anon, authenticated/.test(sql));
  assert.ok(/grant select on table public\.marge_cible_propositions to authenticated/.test(sql));
  assert.ok(/objectif_habilite\(site, 'lire'\)/.test(sql));
  assert.strictEqual((sql.match(/create policy/g) || []).length, 1); assert.ok(/for select to authenticated/.test(sql));
  assert.ok(/marge_cible_propositions_une_ouverte/.test(sql));
});
t('habilitation par objectif_habilite, jamais par le rôle', () => {
  assert.ok(/objectif_habilite\(p_site, 'proposer'\)/.test(corps('proposer_marge_cible')));
  assert.ok(/objectif_habilite\([^)]*'valider'\)/.test(corps('valider_marge_cible')));
  assert.ok(!/current_employee_role|'gerant'/.test(sql));
});
t('proposer n\'écrit que dans la table de propositions', () => {
  const c = corps('proposer_marge_cible');
  assert.ok(/insert into public\.marge_cible_propositions/.test(c));
  assert.ok(!/tarif_seuils\s*\(/.test(c.replace(/from public\.tarif_seuils/g, '')) && !/insert into public\.tarif_seuils/.test(c));
});
t('valider insère une seule version valide et clôt la proposition', () => {
  const c = corps('valider_marge_cible');
  assert.strictEqual((c.match(/insert into public\.tarif_seuils/g) || []).length, 1);
  assert.ok(/'valide'/.test(c) && /remplace_id/.test(c));
  assert.ok(/update public\.marge_cible_propositions/.test(c) && /'validee'/.test(c));
  assert.ok(c.indexOf('objectif_auto_validation_interdite') < c.indexOf('insert into'));
});
t('retirer exige un motif', () => {
  const c = corps('retirer_marge_cible');
  assert.ok(/marge_cible_motif_requis/.test(c) && /'retiree'/.test(c));
});
t('aucun update ni delete sur le registre tarif_seuils', () => {
  assert.ok(!/\bupdate\s+public\.tarif_seuils|delete\s+from\s+public\.tarif_seuils/.test(sql));
});
t('exécution : authenticated seulement', () => {
  ['proposer_marge_cible', 'valider_marge_cible', 'retirer_marge_cible'].forEach(f => {
    assert.ok(new RegExp('revoke all on function public\\.' + f + '[^;]*from public, anon').test(sql), f);
    assert.ok(new RegExp('grant execute on function public\\.' + f + '[^;]*to authenticated').test(sql), f);
  });
  assert.ok(!/to anon/.test(sql));
});
t('le retour supprime les 3 fonctions puis la table', () => {
  ['valider_marge_cible', 'proposer_marge_cible', 'retirer_marge_cible'].forEach(f => assert.ok(new RegExp('drop function if exists public\\.' + f).test(R), f));
  assert.ok(/drop table if exists public\.marge_cible_propositions/.test(R));
});
