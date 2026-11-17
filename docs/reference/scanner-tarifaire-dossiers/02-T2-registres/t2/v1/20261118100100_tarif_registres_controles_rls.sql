-- NEXUS Scanner, politique tarifaire T2 : déclencheurs, permissions et isolation par site (PROJET, NON EXÉCUTÉ).
-- Dépend de 20261118100000_tarif_registres.sql. Cible : Test uniquement, après GO écrit.

-- Une seule version active par (site, clé). Active = non annulée et non remplacée par une version non annulée
-- (même règle que NexusProduitsMesure.actives). Contrôle APRÈS insertion : la colonne générée `cle` n'est calculée
-- qu'après les déclencheurs BEFORE. Le verrou consultatif sérialise deux saisies simultanées de la même clé ;
-- la fonction étant volatile, chaque requête voit les lignes validées par la transaction qui détenait le verrou.
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

do $$
declare t text;
begin
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_regimes_prix','tarif_controles_reglementaires'] loop
    execute format('drop trigger if exists %I on %I', t || '_version', t);
    execute format('create trigger %I after insert on %I for each row execute function tarif_controle_version()', t || '_version', t);
  end loop;
end $$;

-- Un rattachement et un seuil de famille visent une famille active du même site.
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
drop trigger if exists tarif_rattachements_famille on tarif_rattachements;
create trigger tarif_rattachements_famille before insert on tarif_rattachements for each row execute function tarif_controle_famille();
drop trigger if exists tarif_seuils_famille on tarif_seuils;
create trigger tarif_seuils_famille before insert on tarif_seuils for each row execute function tarif_controle_famille();

-- Statut d'une version visée par un remplacement, lu sans repasser par la politique de la même table
-- (sinon récursion). Limité au site de la personne connectée : aucune information d'un autre site.
create or replace function tarif_statut_exception(p_id uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select statut from tarif_exceptions where id = p_id and site = current_employee_site_id() $$;
create or replace function tarif_etat_controle(p_id uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select etat from tarif_controles_reglementaires where id = p_id and site = current_employee_site_id() $$;
revoke all on function tarif_statut_exception(uuid), tarif_etat_controle(uuid) from public, anon;
grant execute on function tarif_statut_exception(uuid), tarif_etat_controle(uuid) to authenticated;

-- Permissions. Lecture : manager et gérant du site ; créateur seulement si le site l'autorise. Aucun accès anon ni employé.
-- Écriture : gérant pour tout ce qui décide ; manager pour proposer (exception candidate), ouvrir un contrôle, déclarer une application.
-- Aucun DELETE. UPDATE limité aux trois colonnes d'annulation.
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
      -- Un manager ne peut remplacer qu'une candidature ou un contrôle encore ouvert : jamais une décision du gérant.
      when 'tarif_exceptions' then format('(%s) or (%s and statut = ''candidate'' and (remplace_id is null or tarif_statut_exception(remplace_id) = ''candidate''))', gerant, manager)
      when 'tarif_controles_reglementaires' then format('(%s) or (%s and etat in (''controle_ouvert'',''a_completer'') and (remplace_id is null or tarif_etat_controle(remplace_id) in (''controle_ouvert'',''a_completer'')))', gerant, manager)
      when 'tarif_prix_application' then format('%s and exists (select 1 from tarif_prix_decides p where p.id = prix_decide_id and p.site = tarif_prix_application.site)', manager)
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
    execute format('revoke all on %I from anon', t);
    execute format('revoke all on %I from public', t);
    execute format('revoke all on %I from authenticated', t);
    execute format('grant select, insert on %I to authenticated', t);
    execute format('grant update (annule_le, annule_par, motif_annulation) on %I to authenticated', t);
  end loop;
end $$;
