// Objectifs de station R1 (#394) : contrat statique de la migration
// 20261127160000 (S1-S4, S7-S13 de la recette). Aucune base n'est jointe : la
// recette sur Test est celle de Guardian.
const assert = require('assert');
const fs = require('fs');
let ok = 0;
function t(nom, f) { try { f(); ok++; } catch (e) { console.error('ECHEC', nom, e.message); process.exitCode = 1; } }
const M = fs.readFileSync('supabase/migrations/20261127160000_objectifs_r1_schema_habilitation.sql', 'utf8');
const R = fs.readFileSync('supabase/retours/20261127160000_retour_objectifs_r1_schema_habilitation.sql', 'utf8');
const sql = M.replace(/--.*$/gm, '');

t('trois tables, une vue, deux fonctions', () => {
  ['objectif_catalogue', 'station_objectifs', 'objectif_habilitation'].forEach(n =>
    assert.ok(new RegExp(`create table public\\.${n}\\b`).test(sql), n));
  assert.ok(/create view public\.objectif_officiel\s+with \(security_invoker = true\)/.test(sql));
  assert.ok(/create function public\.objectif_habilite\(/.test(sql));
  assert.ok(/create function public\.station_objectifs_immuable\(/.test(sql));
});
t('contraintes de période, version, officiel, motif, unicité', () => {
  ['station_objectifs_alignement', 'station_objectifs_periode_ordre', 'station_objectifs_officiel_valide',
   'station_objectifs_motif_si_revision', 'station_objectifs_version_unique',
   'station_objectifs_un_officiel'].forEach(n => assert.ok(sql.includes(n), n));
  assert.ok(/where statut = 'officiel'/.test(sql));
  assert.ok(/in \(1,4,7,10\)/.test(sql));
});
t('immuabilité : trigger avant update et delete, aucune suppression d\'un officiel', () => {
  assert.ok(/before update or delete on public\.station_objectifs/.test(sql));
  assert.ok(/officiel.*remplace.*retire|'officiel','remplace','retire'/.test(sql));
  assert.ok(/old\.statut = 'officiel' and new\.statut in \('remplace','retire'\)/.test(sql));
});
t('objectif_habilite : security definer, search_path vide, rôle sans effet, hiérarchie des droits', () => {
  const f = sql.slice(sql.indexOf('create function public.objectif_habilite'));
  const corps = f.slice(0, f.indexOf('$$;', f.indexOf('as $$')) + 3);
  assert.ok(/security definer/.test(corps));
  assert.ok(/set search_path = ''/.test(corps));
  assert.ok(/revoque_le is null/.test(corps));
  assert.ok(!/role/.test(corps.replace(/employe_id/g, '')), 'le rôle ne doit pas compter');
  assert.ok(/'lire'\s+then h\.droit in \('lire','proposer','valider'\)/.test(corps));
  assert.ok(/'valider'\s+then h\.droit = 'valider'/.test(corps));
});
t('toute fonction security definer a un search_path vide', () => {
  const n = (sql.match(/security definer/g) || []).length;
  const m = (sql.match(/set search_path = ''/g) || []).length;
  assert.ok(m >= n && n >= 1);
});
t('aucune écriture directe : pas de politique insert/update/delete, aucun grant d\'écriture', () => {
  assert.ok(!/for (insert|update|delete|all)/.test(sql));
  assert.ok(!/grant\s+(insert|update|delete|truncate|all)/i.test(sql));
  assert.ok(/revoke all on public\.station_objectifs\s+from public, anon, authenticated/.test(sql));
  assert.ok(/grant select on public\.station_objectifs\s+to authenticated/.test(sql));
});
t('anon et public fermés partout, y compris les fonctions', () => {
  assert.ok(/revoke all on function public\.objectif_habilite\(text, text\) from public, anon/.test(sql));
  assert.ok(/grant execute on function public\.objectif_habilite\(text, text\) to authenticated/.test(sql));
  assert.ok(/revoke all on public\.objectif_officiel from public, anon, authenticated/.test(sql));
  assert.ok(!/to anon/.test(sql));
});
t('RLS activée sur les trois tables ; lecture limitée à la station et au droit lire', () => {
  ['objectif_catalogue', 'station_objectifs', 'objectif_habilitation'].forEach(n =>
    assert.ok(new RegExp(`alter table public\\.${n}\\s+enable row level security`).test(sql), n));
  assert.ok(/site = public\.current_employee_site_id\(\)\s+and public\.objectif_habilite\(site, 'lire'\)/.test(sql));
});
t('la vue n\'expose que l\'officiel, sans brouillon ni proposant', () => {
  const v = sql.slice(sql.indexOf('create view public.objectif_officiel'), sql.indexOf('revoke all on public.objectif_officiel'));
  assert.ok(/where statut = 'officiel'/.test(v));
  assert.ok(!/propose_par|motif|brouillon/.test(v));
});
t('aucune habilitation insérée, aucun compte désigné', () => {
  assert.ok(!/insert into public\.objectif_habilitation/.test(sql));
  assert.ok(!/update public\.objectif_habilitation/.test(sql));
});
t('catalogue : non disponibles et dérivés non objectivables, non retenus absents, cible externe MAR-TAUX', () => {
  ['CARB-RUPTURE', 'CARB-MARGE', 'FDJ-COMMISSION', 'MAR-PERTE-DC', 'MAR-EVITE', 'OPS-TOURNEES', 'OPS-EQUIP',
   'CARB-PROGRES', 'COM-PROGRES', 'FDJ-EVOL', 'MAR-PROGRES'].forEach(id => {
    const l = sql.split('\n').find(x => x.includes(`('${id}'`));
    assert.ok(l && /\bfalse\)[,;]$/.test(l.trim()), id);
  });
  ['CARB-PROD-H', 'COM-CA-H', 'MAR-H'].forEach(id => assert.ok(!sql.includes(`'${id}'`), id));
  const mt = sql.split('\n').find(x => x.includes("('MAR-TAUX'"));
  assert.ok(/'tarif_seuils'/.test(mt));
  assert.ok(/'OPS-ECART-CAISSE'[^\n]*'baisse',true/.test(sql));
});
t('rollback : trigger ôté avant les tables, ordre inverse', () => {
  const i = x => R.indexOf(x);
  assert.ok(i('drop view') < i('drop trigger'));
  assert.ok(i('drop trigger') < i('drop table if exists public.station_objectifs'));
  assert.ok(i('drop table if exists public.station_objectifs') < i('drop table if exists public.objectif_catalogue'));
  assert.ok(i('drop table if exists public.objectif_habilitation') < i('drop table if exists public.objectif_catalogue'));
});
console.log(`${ok} épreuves objectifs R1 réussies`);
