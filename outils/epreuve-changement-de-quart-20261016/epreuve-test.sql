-- Épreuve du changement de quart sur nexus-test (udljdqxerrbbbajxubfn),
-- migration 20261016090000.
--
-- UNE transaction terminée par ROLLBACK : la migration est chargée dans la
-- transaction (copie sans begin/commit, voir executer-test.sh) puis annulée
-- avec le reste. Rien n'est persisté sur Test.
--
-- Identités RÉELLES de nexus-station-test : Employé Test A (caissier) et
-- Employé Test B (pompiste). Chaque essai simule PostgREST : `set local role`
-- + `request.jwt.claims`. Un refus n'est compté que sur son SQLSTATE.
\set ON_ERROR_STOP 1
\set a '868d0b92-bf65-4c99-be43-656911919afd'
\set b '755a2dc5-3390-4a29-a865-847cbebc1133'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';

\i :chemin_migration
select set_config('t.a', :'a', false), set_config('t.b', :'b', false);

create temp table journal (n serial, cas text, attendu text, obtenu text, ok boolean) on commit drop;
grant all on journal to public;
grant all on sequence journal_n_seq to public;

create function pg_temp.comme(p_role text, p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then json_build_object('role', p_role)::text
         else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  execute format('set local role %I', p_role);
end $$;

create function pg_temp.note(p_cas text, p_attendu text, p_obtenu text) returns void language sql as $$
  insert into pg_temp.journal(cas, attendu, obtenu, ok) values (p_cas, p_attendu, p_obtenu, p_attendu = p_obtenu);
$$;

-- Une transaction fige now() : on « vieillit » le quart ouvert d'une minute
-- avant chaque nouvelle prise, comme le fait le temps réel entre deux appels.
create function pg_temp.vieillir(p_uid uuid) returns void language sql as $$
  update public.shifts set heure_debut = heure_debut - interval '1 minute'
   where employee_id = p_uid and statut = 'en_cours';
$$;

-- Départ propre : aucun quart ouvert pour A et B (annulé avec le reste).
reset role;
update public.shifts set statut = 'clos_sans_pointage', cloture_source = 'test', cloture_le = now()
 where employee_id in (:'a'::uuid, :'b'::uuid) and statut = 'en_cours';
create temp table mc_avant on commit drop as
  select md5(coalesce(string_agg(m::text, '|' order by m.id::text), '')) h, count(*) n
    from public.mission_completions m where m.employee_id = :'a'::uuid;

-- 1. Premier quart du jour : aucun avertissement, aucune clôture.
select pg_temp.comme('authenticated', :'a'::uuid);
create temp table r1 on commit drop as select public.nexus_changer_de_quart('caissiere', 'matin', null, false) r;
reset role;
select pg_temp.note('1 sans quart ouvert : ok', 'true', (select r->>'ok' from r1));
select pg_temp.note('1 aucune clôture', 'true', (select (r->'quart_cloture_id') = 'null'::jsonb from r1)::text);
select pg_temp.note('1 rôle du jour / rôle prévu séparés', 'caissiere|caissier',
  (select role || '|' || role_prevu from public.shifts where id = (select (r->>'prise_de_poste_id')::uuid from r1)));

-- 2. Quart ouvert SANS confirmation : rien n'est écrit.
create temp table avant2 on commit drop as select count(*) n from public.shifts where employee_id = :'a'::uuid;
grant select on avant2 to public;
select pg_temp.comme('authenticated', :'a'::uuid);
create temp table r2 on commit drop as select public.nexus_changer_de_quart('pompiste', 'matin', 'Relève absente ou en retard', false) r;
reset role;
select pg_temp.note('2 confirmation requise', 'confirmation_requise', (select r->>'code' from r2));
select pg_temp.note('2 ancien quart toujours ouvert, inchangé', '1|en_cours|',
  (select count(*) || '|' || min(statut) || '|' || coalesce(min(cloture_source), '') from public.shifts where employee_id = :'a'::uuid and statut = 'en_cours'));
select pg_temp.note('2 aucun quart créé', (select n::text from avant2), (select count(*)::text from public.shifts where employee_id = :'a'::uuid));

-- 3. Confirmation avec le motif « Relève absente ou en retard ».
select pg_temp.vieillir(:'a'::uuid);
select pg_temp.comme('authenticated', :'a'::uuid);
create temp table r3 on commit drop as select public.nexus_changer_de_quart('pompiste', 'matin', 'Relève absente ou en retard', true) r;
reset role;
select pg_temp.note('3 ok', 'true', (select r->>'ok' from r3));
select pg_temp.note('3 ancien quart clos : statut / mécanisme / auteur / motif / fin',
  'clos_sans_pointage|employe|true|Relève absente ou en retard|null',
  (select s.statut || '|' || s.cloture_source || '|' || (s.cloture_par = :'a'::uuid)::text || '|' || s.cloture_motif || '|' || coalesce(s.heure_fin::text, 'null')
     from public.shifts s where s.id = (select (r->>'quart_cloture_id')::uuid from r3)));
select pg_temp.note('3 clôture horodatée', 'true',
  (select (s.cloture_le is not null)::text from public.shifts s where s.id = (select (r->>'quart_cloture_id')::uuid from r3)));
select pg_temp.note('3 un seul quart ouvert, c''est le nouveau', 'true',
  (select (count(*) = 1 and min(id::text) = (select r->>'prise_de_poste_id' from r3))::text from public.shifts where employee_id = :'a'::uuid and statut = 'en_cours'));
select pg_temp.note('3 nouveau quart : fonction choisie, rôle prévu = fiche', 'pompiste|caissier|null',
  (select role || '|' || role_prevu || '|' || coalesce(heure_fin::text, 'null') from public.shifts where id = (select (r->>'prise_de_poste_id')::uuid from r3)));

-- 4. Même fonction, même jour, sans motif : permis, motif laissé NULL.
select pg_temp.vieillir(:'a'::uuid);
select pg_temp.comme('authenticated', :'a'::uuid);
create temp table r4 on commit drop as select public.nexus_changer_de_quart('pompiste', 'matin', null, true) r;
reset role;
select pg_temp.note('4 même fonction deux fois le même jour', 'true', (select r->>'ok' from r4));
select pg_temp.note('4 motif non imposé : NULL, jamais un texte système', 'employe|true|',
  (select s.cloture_source || '|' || (s.cloture_motif is null)::text || '|' || coalesce(s.heure_fin::text, '')
     from public.shifts s where s.id = (select (r->>'quart_cloture_id')::uuid from r4)));
select pg_temp.note('4 plusieurs quarts le même jour pour A', 'true',
  (select (count(*) >= 3)::text from public.shifts where employee_id = :'a'::uuid and heure_debut::date = current_date));

-- 5. Atomicité : un échec APRÈS la clôture annule la clôture.
reset role;
select pg_temp.vieillir(:'a'::uuid);
create function pg_temp.echec_force() returns trigger language plpgsql as $$
begin if NEW.role = 'echec_force' then raise exception 'échec forcé' using errcode = 'P0001'; end if; return NEW; end $$;
create trigger zz_echec_force before insert on public.shifts for each row execute function pg_temp.echec_force();
create temp table avant5 on commit drop as
  select id, statut, cloture_source from public.shifts where employee_id = :'a'::uuid and statut = 'en_cours';
do $$
declare v_etat text;
begin
  perform pg_temp.comme('authenticated', current_setting('t.a')::uuid);
  begin
    perform public.nexus_changer_de_quart('echec_force', 'matin', 'Relève absente ou en retard', true);
    v_etat := 'aucune erreur';
  exception when others then v_etat := sqlstate; end;
  reset role;
  perform pg_temp.note('5 l''insertion échoue', 'P0001', v_etat);
end $$;
select pg_temp.note('5 l''ancien quart est resté ouvert, sans trace de clôture', 'true',
  (select (s.statut = 'en_cours' and s.cloture_source is null and s.cloture_par is null and s.cloture_motif is null and s.cloture_le is null
           and s.id = a.id)::text
     from public.shifts s join pg_temp.avant5 a on a.id = s.id));
select pg_temp.note('5 aucune variable ne survit', '||',
  coalesce(current_setting('nexus.changement_quart_employe', true), '') || '|' || coalesce(current_setting('nexus.changement_quart_motif', true), '') || '|');
drop trigger zz_echec_force on public.shifts;

-- 6. Tiers : B ne peut ni clore ni voir bouger le quart de A.
select pg_temp.comme('authenticated', :'b'::uuid);
create temp table r6 on commit drop as select public.nexus_changer_de_quart('pompiste', 'matin', null, false) r;
reset role;
select pg_temp.note('6 B prend son poste sans toucher A', 'true|1',
  (select (r->>'ok') || '|' || (select count(*) from public.shifts where employee_id = :'a'::uuid and statut = 'en_cours') from r6));

-- 7. Anon refusé ; session sans identité refusée.
do $$
declare v_etat text;
begin
  perform pg_temp.comme('anon', null);
  begin perform public.nexus_changer_de_quart('caissiere'); v_etat := 'aucune erreur';
  exception when others then v_etat := sqlstate; end;
  reset role;
  perform pg_temp.note('7 anon refusé (42501)', '42501', v_etat);
  perform pg_temp.comme('authenticated', null);
  begin perform public.nexus_changer_de_quart('caissiere'); v_etat := 'aucune erreur';
  exception when others then v_etat := sqlstate; end;
  reset role;
  perform pg_temp.note('7 session sans employé refusée (28000)', '28000', v_etat);
end $$;

-- 8. Entrées invalides refusées avant toute écriture.
do $$
declare v_etat text;
begin
  perform pg_temp.comme('authenticated', current_setting('t.a')::uuid);
  begin perform public.nexus_changer_de_quart('pompiste', 'nuit', null, true); v_etat := 'aucune erreur';
  exception when others then v_etat := sqlstate; end;
  perform pg_temp.note('8 quart inconnu refusé (22023)', '22023', v_etat);
  begin perform public.nexus_changer_de_quart('pompiste', 'matin', repeat('x', 201), true); v_etat := 'aucune erreur';
  exception when others then v_etat := sqlstate; end;
  perform pg_temp.note('8 motif > 200 caractères refusé (22001)', '22001', v_etat);
  reset role;
end $$;

-- 9. Ancien chemin (INSERT direct, sans variable) : comportement P-1 inchangé.
select pg_temp.vieillir(:'b'::uuid);
select pg_temp.comme('authenticated', :'b'::uuid);
insert into public.shifts (employee_id, role, role_prevu, confirmed_by, quart, site, statut)
values (:'b'::uuid, 'pompiste', 'pompiste', 'employe', 'matin', 'nexus-station-test', 'en_cours');
reset role;
select pg_temp.note('9 INSERT direct : clôture « prise_de_poste_suivante », sans auteur ni heure de fin', 'prise_de_poste_suivante|true|null',
  (select s.cloture_source || '|' || (s.cloture_par is null)::text || '|' || coalesce(s.heure_fin::text, 'null')
     from public.shifts s where s.id = (select (r->>'prise_de_poste_id')::uuid from r6)));

-- 10. Missions de A : intactes.
select pg_temp.note('10 mission_completions de A inchangées', (select h || '|' || n from mc_avant),
  (select md5(coalesce(string_agg(m::text, '|' order by m.id::text), '')) || '|' || count(*) from public.mission_completions m where m.employee_id = :'a'::uuid));

\echo
select n, case when ok then 'OK  ' else 'ÉCHEC' end etat, cas, case when ok then '' else 'attendu=' || attendu || ' obtenu=' || obtenu end detail from pg_temp.journal order by n;
select count(*) filter (where ok) || ' / ' || count(*) as "verifications_reussies", count(*) filter (where not ok) as echecs from pg_temp.journal;
rollback;
