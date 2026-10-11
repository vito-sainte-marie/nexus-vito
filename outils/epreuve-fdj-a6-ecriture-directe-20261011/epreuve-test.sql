-- Épreuve A6 sur nexus-test (udljdqxerrbbbajxubfn) : relevés de clôture,
-- rapports et journal d'audit FDJ fermés à l'écriture directe
-- (20261011090000).
--
-- TOUT se joue dans UNE transaction terminée par ROLLBACK : la migration est
-- appliquée dans la transaction (\i), puis annulée avec le reste. Rien n'est
-- persisté sur Test ; aucun verrou n'est tenu au-delà de la transaction
-- (lock_timeout 3 s, statement_timeout 120 s).
--
-- Identités RÉELLES de la station nexus-station-test (employees.id = uid
-- Auth) : caissier 868d0b92…, manager 28810f30… ; anon sans sub. Chaque essai
-- simule PostgREST : `set local role` + `request.jwt.claims` (sub, role).
--
-- Un refus n'est compté que sur son SQLSTATE : « OK n=0 » n'est jamais un
-- refus. Chaque essai de refus est de toute façon annulé (sous-transaction),
-- y compris quand il réussit AVANT la migration.
--
-- Lancement : outils/epreuve-fdj-a6-ecriture-directe-20261011/executer-test.sh
\set ON_ERROR_STOP 1
\set q2 '9400fffc-d055-4ae7-adcf-ff0c7b0c2e69'
\set cais '868d0b92-bf65-4c99-be43-656911919afd'
\set mgr '28810f30-8182-4126-920f-051a4c7cb596'
\set jeu 'bb98cf3e-cd43-4736-bcec-ff020083c56a'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';

create temp table journal (
  t       timestamptz default clock_timestamp(),
  phase   text, cas text, role text, attendu text, obtenu text, detail text
) on commit drop;
grant insert, select on pg_temp.journal to anon, authenticated;

-- Identité simulée. Toujours appelée en postgres (reset role entre deux).
create function pg_temp.comme(p_role text, p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then json_build_object('role', p_role)::text
         else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  execute format('set local role %I', p_role);
end $$;

-- Essai de refus : l'instruction est TOUJOURS annulée (sous-transaction).
create function pg_temp.essai(p_phase text, p_cas text, p_attendu text, p_sql text) returns void
language plpgsql as $$
declare n bigint; v_etat text; v_msg text;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
    v_etat := 'OK'; v_msg := 'n=' || n;
    raise exception using errcode = 'P0001', message = '__annule__';
  exception when others then
    if sqlerrm <> '__annule__' then v_etat := sqlstate; v_msg := sqlerrm; end if;
  end;
  insert into pg_temp.journal(phase, cas, role, attendu, obtenu, detail)
  values (p_phase, p_cas, current_user, p_attendu, v_etat, v_msg);
end $$;

-- Essai positif (ou refus d'une commande) : l'effet est CONSERVÉ s'il réussit.
create function pg_temp.faire(p_phase text, p_cas text, p_attendu text, p_sql text) returns text
language plpgsql as $$
declare v text; v_etat text; v_msg text;
begin
  begin
    execute p_sql into v;
    v_etat := 'OK'; v_msg := left(coalesce(v, '(void)'), 400);
  exception when others then
    v_etat := sqlstate; v_msg := sqlerrm;
  end;
  insert into pg_temp.journal(phase, cas, role, attendu, obtenu, detail)
  values (p_phase, p_cas, current_user, p_attendu, v_etat, v_msg);
  return v;
end $$;

-- Matrice de refus : 3 tables × INSERT/UPDATE/DELETE/TRUNCATE.
create function pg_temp.matrice(p_phase text, p_attendu text) returns void
language plpgsql as $$
declare
  q2 text := '9400fffc-d055-4ae7-adcf-ff0c7b0c2e69';
  ca text := '868d0b92-bf65-4c99-be43-656911919afd';
  mg text := '28810f30-8182-4126-920f-051a4c7cb596';
begin
  perform pg_temp.essai(p_phase, 'fdj_audit_log INSERT', p_attendu, format(
    'insert into public.fdj_audit_log(site, shift_id, entite_type, entite_id, action, acteur_id, motif)
     values (''nexus-station-test'', %L, ''fdj_shift'', %L, ''falsification_a6'', %L, ''essai A6'')', q2, q2, mg));
  perform pg_temp.essai(p_phase, 'fdj_audit_log UPDATE', p_attendu,
    'update public.fdj_audit_log set motif = ''falsifié A6'' where site = ''nexus-station-test''');
  perform pg_temp.essai(p_phase, 'fdj_audit_log DELETE', p_attendu,
    'delete from public.fdj_audit_log where site = ''nexus-station-test''');
  perform pg_temp.essai(p_phase, 'fdj_audit_log TRUNCATE', p_attendu, 'truncate public.fdj_audit_log');

  perform pg_temp.essai(p_phase, 'fdj_releves_cloture INSERT', p_attendu, format(
    'insert into public.fdj_releves_cloture(site, shift_id, date, quart, employee_id, version_num, type_version, cree_par, statut)
     values (''nexus-station-test'', %L, ''2026-10-10'', ''2'', %L, 3, ''regularisation_manager'', %L, ''conforme'')', q2, ca, mg));
  perform pg_temp.essai(p_phase, 'fdj_releves_cloture UPDATE', p_attendu,
    'update public.fdj_releves_cloture set statut = ''conforme'' where site = ''nexus-station-test''');
  perform pg_temp.essai(p_phase, 'fdj_releves_cloture DELETE', p_attendu,
    'delete from public.fdj_releves_cloture where site = ''nexus-station-test''');
  perform pg_temp.essai(p_phase, 'fdj_releves_cloture TRUNCATE', p_attendu, 'truncate public.fdj_releves_cloture');

  perform pg_temp.essai(p_phase, 'fdj_reports INSERT (upsert)', p_attendu, format(
    'insert into public.fdj_reports(site, shift_id, type_rapport, caisse_tirages, saisi_par)
     values (''nexus-station-test'', %L, ''temps_reel'', 999, %L)
     on conflict (shift_id, type_rapport) do update set caisse_tirages = excluded.caisse_tirages', q2, ca));
  perform pg_temp.essai(p_phase, 'fdj_reports UPDATE', p_attendu,
    'update public.fdj_reports set caisse_tirages = 999 where site = ''nexus-station-test''');
  perform pg_temp.essai(p_phase, 'fdj_reports DELETE', p_attendu,
    'delete from public.fdj_reports where site = ''nexus-station-test''');
  perform pg_temp.essai(p_phase, 'fdj_reports TRUNCATE', p_attendu, 'truncate public.fdj_reports');
end $$;

-- A5 : chemins de contournement candidats (toujours annulés).
create function pg_temp.a5(p_phase text) returns void
language plpgsql as $$
declare q2 text := '9400fffc-d055-4ae7-adcf-ff0c7b0c2e69';
begin
  perform pg_temp.essai(p_phase, 'A5 fdj_cash_controls INSERT', '42501', format(
    'insert into public.fdj_cash_controls(site, shift_id) values (''nexus-station-test'', %L)', q2));
  perform pg_temp.essai(p_phase, 'A5 fdj_cash_controls UPDATE (déclencheur → relevé)', '42501', format(
    'update public.fdj_cash_controls set caisse_reelle = caisse_reelle + 1 where shift_id = %L', q2));
  perform pg_temp.essai(p_phase, 'A5 fdj_shift_counts UPDATE (déclencheur → audit)', '42501', format(
    'update public.fdj_shift_counts set stock_initial = stock_initial + 1 where shift_id = %L', q2));
  perform pg_temp.essai(p_phase, 'A5 appel direct fdj_sync_releve_apres_cash_control()', '0A000',
    'select public.fdj_sync_releve_apres_cash_control()');
  perform pg_temp.essai(p_phase, 'A5 appel direct fdj_tracer_correction_stock_initial()', '0A000',
    'select public.fdj_tracer_correction_stock_initial()');
  -- Caissier : refusé par la garde métier existante (P0001 « Accès manager
  -- requis ») ; anon : refusé par l'ACL que pose la migration (42501).
  perform pg_temp.essai(p_phase, 'A5 fdj_synchroniser_releves_courants(site)',
    case when current_user = 'anon' then '42501' else 'P0001' end,
    'select public.fdj_synchroniser_releves_courants(''nexus-station-test'')');
end $$;

grant execute on function pg_temp.essai(text, text, text, text), pg_temp.faire(text, text, text, text),
  pg_temp.matrice(text, text), pg_temp.a5(text) to anon, authenticated;

create temp table compte0 on commit drop as
select (select count(*) from public.fdj_audit_log) a, (select count(*) from public.fdj_releves_cloture) r,
       (select count(*) from public.fdj_reports) p;

-- =========================================================================
-- AVANT la migration : le défaut, mesuré (attendu « OK » = écriture admise).
-- Pour anon, l'INSERT est déjà refusé par la policy (pas de site) : son
-- défaut est le TRUNCATE, qui ignore la RLS. Pour UPDATE/DELETE, « OK n=0 »
-- signifie seulement que la RLS masque les lignes : ce n'est pas un refus.
-- =========================================================================
select pg_temp.comme('authenticated', :'cais'); select pg_temp.matrice('avant', 'OK (défaut)'); select pg_temp.a5('avant'); reset role;
select pg_temp.comme('anon', null);             select pg_temp.matrice('avant', 'OK (défaut ; INSERT refusé par la policy)'); select pg_temp.a5('avant'); reset role;
select pg_temp.comme('authenticated', :'mgr');  select pg_temp.matrice('avant', 'OK (défaut)'); reset role;

-- =========================================================================
-- Migration appliquée DANS la transaction.
-- =========================================================================
\i :migration

insert into pg_temp.journal(phase, cas, role, attendu, obtenu, detail)
select 'droits', c.relname, r.rolname, 'aucune écriture',
       case when has_table_privilege(r.rolname, c.oid, 'insert,update,delete,truncate,references,trigger,maintain')
            then 'ÉCRITURE' else 'fermé' end,
       'select=' || has_table_privilege(r.rolname, c.oid, 'select') || ' acl=' || c.relacl::text
  from pg_class c cross join (values ('anon'), ('authenticated')) r(rolname)
 where c.oid in ('public.fdj_audit_log'::regclass, 'public.fdj_releves_cloture'::regclass, 'public.fdj_reports'::regclass);

-- =========================================================================
-- APRÈS : refus directs (attendu 42501 pour chaque cas, chaque rôle).
-- =========================================================================
select pg_temp.comme('authenticated', :'cais'); select pg_temp.matrice('apres', '42501'); select pg_temp.a5('apres'); reset role;
select pg_temp.comme('anon', null);             select pg_temp.matrice('apres', '42501'); select pg_temp.a5('apres'); reset role;
select pg_temp.comme('authenticated', :'mgr');  select pg_temp.matrice('apres', '42501'); reset role;

-- =========================================================================
-- APRÈS : flux légitimes par les vraies commandes (effets conservés jusqu'au
-- rollback final).
-- =========================================================================
-- P1 manager : création d'un Q1 du 10/10 (brouillon) pour le caissier.
select pg_temp.comme('authenticated', :'mgr');
select from pg_temp.faire('positif', 'P1 fdj_manager_creer_quart Q1', 'OK',
  format('select (public.fdj_manager_creer_quart(%L, ''1'', %L, ''brouillon''))->>''id''', '2026-10-10', :'cais'));
reset role;
select id as q1 from public.fdj_shifts where site = 'nexus-station-test' and date = '2026-10-10' and quart = '1' \gset

select pg_temp.comme('authenticated', :'mgr');
select from pg_temp.faire('positif', 'P2 fdj_manager_journaliser creation_manager', 'OK',
  format('select public.fdj_manager_journaliser(%L, ''fdj_shift'', %L, ''creation_manager'', null, null, ''{"statut":"brouillon"}'')::text', :'q1', :'q1'));
reset role;

-- P3–P5 caissier : ouverture, trace d'ouverture, clôture (confirmation).
select pg_temp.comme('authenticated', :'cais');
select from pg_temp.faire('positif', 'P3 fdj_valider_ouverture_quart', 'OK',
  format('select public.fdj_valider_ouverture_quart(%L, %L)::text', :'q1',
         json_build_array(json_build_object('game_id', :'jeu', 'stock_initial', 60, 'appro', 0))::text));
select from pg_temp.faire('positif', 'P4 fdj_journaliser_ouverture_validee', 'OK',
  format('select public.fdj_journaliser_ouverture_validee(%L, %L)::text', :'q1',
         json_build_array(:'jeu')::text));
select from pg_temp.faire('positif', 'P5 fdj_confirmer_caisse (clôture employé)', 'OK',
  format('select public.fdj_confirmer_caisse(%L, %L, 5, 20, 30, 0)::text', :'q1',
         json_build_array(json_build_object('game_id', :'jeu', 'stock_initial', 60, 'appro', 0, 'stock_final', 47))::text));
reset role;

-- P6–P11 manager.
select pg_temp.comme('authenticated', :'mgr');
select from pg_temp.faire('positif', 'P6 fdj_manager_enregistrer_rapports', 'OK',
  format('select public.fdj_manager_enregistrer_rapports(%L, 6, 21)::text', :'q1'));
select from pg_temp.faire('positif', 'P7 fdj_corriger_caisse_manager (déclencheur → relevé)', 'OK',
  format('select public.fdj_corriger_caisse_manager(%L, ''Correction épreuve A6'', 31, null, null)::text', :'q1'));
reset role;
select coalesce(max(version_num), 0) as vmax from public.fdj_releves_cloture where shift_id = :'q1' \gset
select id as rel1 from public.fdj_releves_cloture where shift_id = :'q1' order by version_num limit 1 \gset

select pg_temp.comme('authenticated', :'mgr');
select from pg_temp.faire('positif', 'P8 fdj_manager_poser_releve_cloture recalcul', 'OK',
  format('select public.fdj_manager_poser_releve_cloture(%L, %L)::text', :'q1',
         json_build_object('version_num', :vmax + 1, 'type_version', 'recalcul_automatique_chaine',
                           'statut', 'recalcule_automatiquement', 'diff_vs_precedent', json_build_object(),
                           'signature', json_build_object('source', 'epreuve_a6'))::text));
select from pg_temp.faire('positif', 'P9 fdj_manager_poser_releve_cloture régularisation', 'OK',
  format('select public.fdj_manager_poser_releve_cloture(%L, %L)::text', :'q1',
         json_build_object('version_num', :vmax + 2, 'type_version', 'regularisation_manager',
                           'statut', 'regularise', 'motif_regularisation', 'Régularisation épreuve A6')::text));
select from pg_temp.faire('positif', 'P10 fdj_manager_journaliser exception_ecart_recalcule_revalide', 'OK',
  format('select public.fdj_manager_journaliser(%L, ''fdj_releves_cloture'', %L, ''exception_ecart_recalcule_revalide'', ''Revalidation épreuve A6'', null, ''{}'')::text', :'q1', :'rel1'));
select from pg_temp.faire('positif', 'P11 alerte (écriture directe A5) puis fdj_manager_journaliser auto', 'OK',
  format('with a as (insert into public.fdj_alertes(site, type, shift_id) values (''nexus-station-test'', ''chaine_interrompue'', %L) returning id)
          select public.fdj_manager_journaliser(%L, ''fdj_alerte'', (select id from a), ''fdj_chaine_retablie_automatiquement'', null, null, ''{}'')::text', :'q1', :'q1'));
select from pg_temp.faire('positif', 'P12 fdj_manager_aligner_fin_quart_precedent (Q1 → Q2)', 'OK',
  format('select public.fdj_manager_aligner_fin_quart_precedent(%L, ''Alignement épreuve A6'')::text', :'q2'));
select from pg_temp.faire('positif', 'P13 fdj_manager_corriger_comptages (déclencheur → audit)', 'OK',
  format('select public.fdj_manager_corriger_comptages(%L, %L)::text', :'q1',
         json_build_array(json_build_object('game_id', :'jeu', 'stock_initial', 61))::text));
select from pg_temp.faire('positif', 'P14 fdj_synchroniser_releves_courants (manager)', 'OK',
  'select public.fdj_synchroniser_releves_courants(''nexus-station-test'')::text');
reset role;

-- =========================================================================
-- APRÈS : refus des commandes (garde de rôle, liste fermée, séquence).
-- =========================================================================
select coalesce(max(version_num), 0) as vmax2 from public.fdj_releves_cloture where shift_id = :'q1' \gset
select pg_temp.comme('authenticated', :'cais');
select from pg_temp.faire('rpc', 'R1 caissier → fdj_manager_journaliser', '42501',
  format('select public.fdj_manager_journaliser(%L, ''fdj_shift'', %L, ''correction_manager'', ''x'', null, null)::text', :'q1', :'q1'));
select from pg_temp.faire('rpc', 'R2 caissier → fdj_manager_poser_releve_cloture', '42501',
  format('select public.fdj_manager_poser_releve_cloture(%L, %L)::text', :'q1',
         json_build_object('version_num', :vmax2 + 1, 'type_version', 'regularisation_manager', 'statut', 'conforme')::text));
select from pg_temp.faire('rpc', 'R3 caissier → fdj_manager_enregistrer_rapports', '42501',
  format('select public.fdj_manager_enregistrer_rapports(%L, 1, 1)::text', :'q1'));
select from pg_temp.faire('rpc', 'R4 caissier → trace d''ouverture sur quart validé (Q2)', '42501',
  format('select public.fdj_journaliser_ouverture_validee(%L, ''[]'')::text', :'q2'));
reset role;
select pg_temp.comme('anon', null);
select from pg_temp.faire('rpc', 'R5 anon → fdj_manager_journaliser', '42501',
  format('select public.fdj_manager_journaliser(%L, ''fdj_shift'', %L, ''correction_manager'', ''x'', null, null)::text', :'q1', :'q1'));
select from pg_temp.faire('rpc', 'R6 anon → fdj_journaliser_ouverture_validee', '42501',
  format('select public.fdj_journaliser_ouverture_validee(%L, ''[]'')::text', :'q1'));
select from pg_temp.faire('rpc', 'R7 anon → fdj_manager_poser_releve_cloture', '42501',
  format('select public.fdj_manager_poser_releve_cloture(%L, ''{}'')::text', :'q1'));
select from pg_temp.faire('rpc', 'R8 anon → fdj_manager_enregistrer_rapports', '42501',
  format('select public.fdj_manager_enregistrer_rapports(%L, 1, 1)::text', :'q1'));
reset role;
select pg_temp.comme('authenticated', :'mgr');
select from pg_temp.faire('rpc', 'R9 manager → action d''audit hors liste', '22023',
  format('select public.fdj_manager_journaliser(%L, ''fdj_shift'', %L, ''falsification_a6'', ''x'', null, null)::text', :'q1', :'q1'));
select from pg_temp.faire('rpc', 'R10 manager → trace de quart sur une autre entité', '22023',
  format('select public.fdj_manager_journaliser(%L, ''fdj_shift'', %L, ''correction_manager'', ''x'', null, null)::text', :'q1', :'q2'));
select from pg_temp.faire('rpc', 'R11 manager → version de relevé qui saute un rang', '22023',
  format('select public.fdj_manager_poser_releve_cloture(%L, %L)::text', :'q1',
         json_build_object('version_num', :vmax2 + 5, 'type_version', 'regularisation_manager', 'statut', 'conforme')::text));
select from pg_temp.faire('rpc', 'R12 manager → version de relevé déjà prise', '23505',
  format('select public.fdj_manager_poser_releve_cloture(%L, %L)::text', :'q1',
         json_build_object('version_num', 1, 'type_version', 'regularisation_manager', 'statut', 'conforme')::text));
select from pg_temp.faire('rpc', 'R13 manager → type correction_employe', '22023',
  format('select public.fdj_manager_poser_releve_cloture(%L, %L)::text', :'q1',
         json_build_object('version_num', :vmax2 + 1, 'type_version', 'correction_employe', 'statut', 'conforme')::text));
reset role;

-- =========================================================================
-- Lignes écrites dans les trois tables pendant la transaction (now() =
-- horodatage de la transaction), et rapports du Q1.
-- =========================================================================
select 'ECRIT|audit|' || action || '|acteur=' || coalesce(acteur_id::text, '-') || '|via=' || coalesce(metadata->>'via', '(serveur)')
  from public.fdj_audit_log where date_action = now() order by date_action, action;
select 'ECRIT|releve|v' || version_num || '|' || type_version || '|' || statut || '|cree_par=' || coalesce(cree_par::text, '-')
  from public.fdj_releves_cloture where shift_id = :'q1' order by version_num;
select 'ECRIT|reports|' || type_rapport || '|lots=' || coalesce(lots_payes_grattage::text, '-') || '|tirages=' || coalesce(caisse_tirages::text, '-') || '|saisi_par=' || coalesce(saisi_par::text, '-')
  from public.fdj_reports where shift_id = :'q1' order by type_rapport;
select 'COMPTE|avant=' || c.a || '/' || c.r || '/' || c.p || '|apres=' ||
       (select count(*) from public.fdj_audit_log) || '/' || (select count(*) from public.fdj_releves_cloture) || '/' || (select count(*) from public.fdj_reports)
  from compte0 c;

select 'J|' || phase || '|' || cas || '|' || role || '|' || attendu || '|' || obtenu || '|' || replace(coalesce(detail, ''), E'\n', ' ')
  from pg_temp.journal order by t;

rollback;
