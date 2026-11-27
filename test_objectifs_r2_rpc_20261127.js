// Objectifs de station R2 (#394) : contrat statique de la migration
// 20261127170000 (RPC). La recette S5, S6, S14, S16 sur Test est celle de Guardian.
const assert = require('assert');
const fs = require('fs');
function t(nom, f) { try { f(); } catch (e) { console.error('ECHEC', nom, e.message); process.exitCode = 1; } }
const M = fs.readFileSync('supabase/migrations/20261127170000_objectifs_r2_rpc.sql', 'utf8');
const R = fs.readFileSync('supabase/retours/20261127170000_retour_objectifs_r2_rpc.sql', 'utf8');
const sql = M.replace(/--.*$/gm, '');
const NOMS = ['proposer_objectif', 'valider_objectif', 'retirer_objectif', 'accorder_droit_objectif', 'revoquer_droit_objectif'];
function corps(nom) {
  const i = sql.indexOf(`create function public.${nom}(`);
  assert.ok(i >= 0, nom);
  const d = sql.indexOf('as $$', i);
  return sql.slice(i, sql.indexOf('$$;', d) + 3);
}

t('cinq fonctions, toutes security definer avec search_path vide', () => {
  NOMS.forEach(n => {
    const c = corps(n);
    assert.ok(/security definer/.test(c), n);
    assert.ok(/set search_path = ''/.test(c), n);
  });
});
t('toutes refusent une autre station et un appelant non authentifié', () => {
  NOMS.forEach(n => {
    const c = corps(n);
    assert.ok(/auth\.uid\(\) is null/.test(c), n);
    assert.ok(/current_employee_site_id\(\)/.test(c), n);
  });
});
t('le droit se lit par objectif_habilite, jamais par le rôle', () => {
  assert.ok(/objectif_habilite\(p_site, 'proposer'\)/.test(corps('proposer_objectif')));
  ['valider_objectif', 'retirer_objectif', 'accorder_droit_objectif', 'revoquer_droit_objectif'].forEach(n =>
    assert.ok(/objectif_habilite\(\w+(\.site)?, 'valider'\)/.test(corps(n)), n));
  NOMS.forEach(n => assert.ok(!/\brole\b/.test(corps(n)), n));
});
t('jamais valider sa propre proposition', () => {
  const c = corps('valider_objectif');
  assert.ok(/propose_par = auth\.uid\(\)/.test(c));
  assert.ok(/objectif_auto_validation_interdite/.test(c));
});
t('la validation remplace la version précédente dans la même fonction, après verrou', () => {
  const c = corps('valider_objectif');
  assert.ok(/for update/.test(c));
  assert.ok(c.indexOf("set statut = 'remplace'") < c.indexOf("set statut = 'officiel'"));
  assert.ok(/a_fiabiliser/.test(c) && /objectif_arbitrage_requis/.test(c));
});
t('proposer : gardes du catalogue, de la période, de la cible, du motif', () => {
  const c = corps('proposer_objectif');
  ['objectif_indicateur_non_objectivable', 'objectif_cible_externe', 'objectif_periode_non_alignee',
   'objectif_cible_zero_interdite', 'objectif_proposition_ouverte', 'objectif_motif_requis',
   'objectif_periode_close'].forEach(g => assert.ok(c.includes(g), g));
  assert.ok(/non_disponible/.test(c));
  assert.ok(/in \(1,4,7,10\)/.test(c));
});
t('retirer : motif obligatoire, statut retire, jamais de delete', () => {
  const c = corps('retirer_objectif');
  assert.ok(/objectif_motif_requis/.test(c));
  assert.ok(/set statut = 'retire'/.test(c));
  assert.ok(!/\bdelete\b/i.test(sql));
});
t('révocation : le dernier valideur ne se retire pas', () => {
  assert.ok(/objectif_dernier_valideur/.test(corps('revoquer_droit_objectif')));
});
t('droits : authenticated seulement, anon et public refermés explicitement', () => {
  assert.ok(/revoke all on function public\.proposer_objectif\(text, text, text, date, numeric, text, text\) from public, anon;/.test(sql));
  NOMS.forEach(n => {
    assert.ok(new RegExp(`revoke all on function public\\.${n}\\([^)]*\\)\\s+from public, anon;`).test(sql), 'revoke ' + n);
    assert.ok(new RegExp(`grant execute on function public\\.${n}\\([^)]*\\)\\s+to authenticated;`).test(sql), 'grant ' + n);
  });
  assert.ok(!/grant [^;]*to (anon|public)\b/.test(sql));
});
t('aucun compte désigné par cette migration', () => {
  assert.ok(!/insert into public\.station_objectifs\b[\s\S]*'valider'/.test(sql.replace(/create function[\s\S]*?\$\$;/g, '')));
  assert.ok(!/insert into public\.objectif_habilitation[\s\S]*values\s*\(\s*'/.test(sql));
});
t('retour arrière : les cinq fonctions, R1 intact', () => {
  NOMS.forEach(n => assert.ok(new RegExp(`drop function if exists public\\.${n}\\(`).test(R), n));
  assert.ok(!/drop table/.test(R));
});

t('la clôture de période se lit au jour de la station, jamais à current_date (23 h Martinique)', () => {
  const c = corps('proposer_objectif');
  assert.ok(!/current_date/.test(c), 'current_date interdit');
  assert.ok(/from public\.sites where site_id = p_site/.test(c));
  assert.ok(/now\(\) at time zone v_tz\)::date/.test(c));
  assert.ok(/objectif_fuseau_station_absent/.test(c));
  // simulation : 23 h le 30/11 en Martinique (UTC-4) = 03 h le 01/12 UTC
  const instant = new Date('2026-12-01T03:00:00Z');
  const jourStation = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Martinique' }).format(instant);
  const jourUtc = instant.toISOString().slice(0, 10);
  assert.strictEqual(jourStation, '2026-11-30');
  assert.notStrictEqual(jourStation, jourUtc);
  // le mois de novembre (fin = 01/12) n'est pas clos à 23 h station : 01/12 <= 30/11 est faux
  assert.ok(!('2026-12-01' <= jourStation));
  assert.ok('2026-12-01' <= jourUtc);
});
