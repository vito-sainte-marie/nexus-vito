-- NEXUS Scanner, politique tarifaire T2 : déclencheurs d'intégrité, permissions et isolation par site, applicable après la migration 20261117020430.
-- Dépend de 20261118100000_tarif_registres.sql.
-- Version 2 (examen du 16/11/2026) : aucune fonction SECURITY DEFINER nouvelle. Les deux fonctions de lecture
-- de statut de la version 1 sont remplacées par un déclencheur ordinaire, qui lit la table sous les droits de la personne.

-- 1. Une seule version active par (site, clé). Active = non annulée et non remplacée par une version non annulée
--    (même règle que NexusProduitsMesure.actives). Contrôle APRÈS insertion : la colonne générée `cle` n'est calculée
--    qu'après les déclencheurs BEFORE. Le verrou consultatif sérialise deux saisies simultanées de la même clé ;
--    la fonction étant volatile, chaque requête voit les lignes validées par la transaction qui détenait le verrou.

-- Prérequis : la migration s'arrête avant toute écriture si un objet attendu manque (aucune identité de projet n'est supposée).
do $prerequis$
declare v_manque text;
begin
  select string_agg(o, ', ') into v_manque from unnest(array['public.sites', 'public.employees', 'public.import_batches', 'public.tarif_familles', 'public.tarif_rattachements', 'public.tarif_seuils', 'public.tarif_reglages', 'public.tarif_exceptions', 'public.tarif_prix_decides', 'public.tarif_prix_application', 'public.tarif_regimes_prix', 'public.tarif_controles_reglementaires', 'public.tarif_decisions']) as o where to_regclass(o) is null;
  if v_manque is not null then
    raise exception 'prerequis_migrations : 20261117020652 (appliquer 20261117020430 avant) : objets absents : %', v_manque;
  end if;
end $prerequis$;

create or replace function tarif_controle_version() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  v_autres int;
  v_cible record;
  v_freres int;
begin
  perform pg_advisory_xact_lock(hashtext(tg_table_name || '|' || new.site || '|' || new.cle));
  if new.remplace_id is null then
    execute format('select count(*) from %I t where t.site = $1 and t.cle = $2 and t.id <> $3 and t.annule_le is null
                      and not exists (select 1 from %I c where c.remplace_id = t.id and c.annule_le is null)', tg_table_name, tg_table_name)
      into v_autres using new.site, new.cle, new.id;
    if v_autres > 0 then
      raise exception 'tarif_version_active_existante : remplacer la version active ou l annuler d abord' using errcode = 'P0001';
    end if;
  else
    execute format('select site, cle, annule_le from %I where id = $1', tg_table_name) into v_cible using new.remplace_id;
    if v_cible is null or v_cible.site <> new.site or v_cible.cle <> new.cle then
      raise exception 'tarif_version_cible_invalide : la version remplacée doit être du même site et de la même clé' using errcode = 'P0001';
    end if;
    execute format('select count(*) from %I c where c.remplace_id = $1 and c.id <> $2 and c.annule_le is null', tg_table_name)
      into v_freres using new.remplace_id, new.id;
    if v_cible.annule_le is not null or v_freres > 0 then
      raise exception 'tarif_version_inactive : la version visée n est plus active' using errcode = 'P0001';
    end if;
  end if;
  return null;
end $$;

-- 2. Pas de rétrogradation : seul le gérant remplace une exception autre que candidate, ou un contrôle déjà qualifié.
--    Lecture de la ligne visée sous les droits de la personne (pas de SECURITY DEFINER, pas de récursion de politique).
--    service_role (rôle employé nul) est traité comme un non-gérant.
create or replace function tarif_controle_retrogradation() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_avant text;
begin
  if new.remplace_id is null or current_employee_role() is not distinct from 'gerant' then return null; end if;
  if tg_table_name = 'tarif_exceptions' then
    select statut into v_avant from tarif_exceptions where id = new.remplace_id;
    if v_avant is distinct from 'candidate' then
      raise exception 'tarif_retrogradation_refusee : seule une candidature peut être remplacée par un manager' using errcode = 'P0001';
    end if;
  else
    select etat into v_avant from tarif_controles_reglementaires where id = new.remplace_id;
    if v_avant is null or v_avant not in ('controle_ouvert', 'a_completer') then
      raise exception 'tarif_retrogradation_refusee : seul un contrôle ouvert ou à compléter peut être remplacé par un manager' using errcode = 'P0001';
    end if;
  end if;
  return null;
end $$;

-- 3. Une famille visée par un rattachement ou un seuil de famille doit être active sur le même site.
create or replace function tarif_controle_famille() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_code text;
begin
  if tg_table_name = 'tarif_rattachements' then v_code := new.famille_code;
  elsif new.niveau = 'famille' then v_code := new.cible_niveau;
  end if;
  if v_code is not null and not exists (
       select 1 from tarif_familles f where f.site = new.site and f.famille_code = v_code and f.annule_le is null
         and not exists (select 1 from tarif_familles c where c.remplace_id = f.id and c.annule_le is null)) then
    raise exception 'tarif_famille_inconnue : famille % absente ou inactive sur le site %', v_code, new.site using errcode = 'P0001';
  end if;
  return new;
end $$;

-- 4. Une application vise un prix décidé ACTIF du même site, dont la nature n'est pas « maintenu ».
create or replace function tarif_controle_application() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (
       select 1 from tarif_prix_decides p where p.id = new.prix_decide_id and p.site = new.site and p.annule_le is null and p.nature <> 'maintenu'
         and not exists (select 1 from tarif_prix_decides c where c.remplace_id = p.id and c.annule_le is null)) then
    raise exception 'tarif_application_invalide : le prix décidé visé n est pas actif, pas du même site, ou est « maintenu »' using errcode = 'P0001';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_regimes_prix','tarif_controles_reglementaires'] loop
    execute format('drop trigger if exists %I on %I', t || '_version', t);
    execute format('create trigger %I after insert on %I for each row execute function tarif_controle_version()', t || '_version', t);
  end loop;
  foreach t in array array['tarif_exceptions','tarif_controles_reglementaires'] loop
    execute format('drop trigger if exists %I on %I', t || '_retrogradation', t);
    execute format('create trigger %I after insert on %I for each row execute function tarif_controle_retrogradation()', t || '_retrogradation', t);
  end loop;
end $$;
drop trigger if exists tarif_rattachements_famille on tarif_rattachements;
create trigger tarif_rattachements_famille before insert on tarif_rattachements for each row execute function tarif_controle_famille();
drop trigger if exists tarif_seuils_famille on tarif_seuils;
create trigger tarif_seuils_famille before insert on tarif_seuils for each row execute function tarif_controle_famille();
drop trigger if exists tarif_prix_application_controle on tarif_prix_application;
create trigger tarif_prix_application_controle before insert on tarif_prix_application for each row execute function tarif_controle_application();
-- Version 1 : fonctions SECURITY DEFINER retirées si elles avaient été créées.
drop function if exists tarif_statut_exception(uuid);
drop function if exists tarif_etat_controle(uuid);
-- Les fonctions de déclencheur ne s'appellent pas directement.
revoke all on function tarif_controle_version(), tarif_controle_retrogradation(), tarif_controle_famille(), tarif_controle_application() from public, anon, authenticated, service_role;

-- 5. Permissions. Lecture : manager et gérant du site ; créateur seulement si le site l'autorise. Aucun accès anon ni employé.
--    Écriture : gérant pour tout ce qui décide ; manager pour proposer (candidate), ouvrir un contrôle, déclarer une application.
--    Aucun DELETE ni TRUNCATE. UPDATE limité aux trois colonnes d'annulation, y compris pour service_role
--    (les privilèges par défaut de Supabase, qui accordent tout à anon, authenticated et service_role, sont retirés).
do $$
declare
  t text;
  lecture text := '(site = (select current_employee_site_id()) and (select current_employee_role()) in (''manager'',''gerant''))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = %I.site and s.acces_createur_autorise))';
  gerant text := 'site = (select current_employee_site_id()) and (select current_employee_role()) = ''gerant''';
  manager text := 'site = (select current_employee_site_id()) and (select current_employee_role()) in (''manager'',''gerant'')';
  ecriture text;
  annulation text;
begin
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions'] loop
    ecriture := case t
      when 'tarif_exceptions' then format('(%s) or (%s and statut = ''candidate'')', gerant, manager)
      when 'tarif_controles_reglementaires' then format('(%s) or (%s and etat in (''controle_ouvert'',''a_completer''))', gerant, manager)
      when 'tarif_prix_application' then manager
      else gerant end;
    annulation := case t
      when 'tarif_exceptions' then format('(%s) or (%s and saisi_par = (select auth.uid()) and statut = ''candidate'')', gerant, manager)
      when 'tarif_controles_reglementaires' then format('(%s) or (%s and saisi_par = (select auth.uid()) and etat in (''controle_ouvert'',''a_completer''))', gerant, manager)
      when 'tarif_prix_application' then format('(%s) or (%s and saisi_par = (select auth.uid()))', gerant, manager)
      else gerant end;
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists lecture_meme_site on %I', t);
    execute format('create policy lecture_meme_site on %I for select to authenticated using (%s)', t, format(lecture, t));
    execute format('drop policy if exists insertion_roles_meme_site on %I', t);
    execute format('create policy insertion_roles_meme_site on %I for insert to authenticated with check ((%s) and saisi_par = (select auth.uid()) and annule_le is null)', t, ecriture);
    execute format('drop policy if exists annulation_roles_meme_site on %I', t);
    execute format('create policy annulation_roles_meme_site on %I for update to authenticated using ((%s) and annule_le is null) with check (annule_le is not null and annule_par = (select auth.uid()))', t, annulation);
    execute format('revoke all on %I from anon, public, authenticated, service_role', t);
    execute format('grant select, insert on %I to authenticated, service_role', t);
    execute format('grant update (annule_le, annule_par, motif_annulation) on %I to authenticated, service_role', t);
  end loop;
end $$;
