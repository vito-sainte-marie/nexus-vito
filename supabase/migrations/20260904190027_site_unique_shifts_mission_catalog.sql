-- Une ligne, un site : supprimer la double identité de rattachement
-- (04/09/2026).
--
-- ANOMALIE A2, CONSTATÉE EN CONDITIONS RÉELLES pendant la recette navigateur,
-- là où trois passes de contrôles SQL ne l'avaient pas vue.
--
--   Écran Prise de poste, rôle Manager, compte de `nexus-station-test` :
--   POST /rest/v1/shifts → 201, et la ligne créée porte
--     site    = 'nexus-station-test'   (écrit par l'application)
--     site_id = 'vito-sainte-marie'    (valeur PAR DÉFAUT — la production)
--
-- DIAGNOSTIC. Deux tables portent `site` ET `site_id`, toutes deux `text`,
-- `NOT NULL`, avec le même `DEFAULT 'vito-sainte-marie'`. Aucune n'est tenue
-- en cohérence par quoi que ce soit. Or les deux colonnes ne servent pas au
-- même monde :
--
--   * la SÉCURITÉ ne connaît que `site_id` : les 7 politiques RLS de `shifts`
--     et `mission_catalog` s'appuient toutes sur lui, aucune sur `site` ;
--   * l'APPLICATION écrit l'un ou l'autre selon l'écran :
--       - NEXUS-Prise-De-Poste-v1.html écrit `site`, jamais `site_id` ;
--       - NEXUS-Scanner-v1.html écrit `site_id`, jamais `site` ;
--       - NEXUS-Tempo-v1.html écrit les deux, cohérents.
--
-- La colonne omise prend donc le défaut, c'est-à-dire l'identifiant du site de
-- production. Personne ne le voit : la RLS d'INSERT de `shifts` ne vérifiait
-- ni `site` ni `site_id` — seulement `employee_id` et le rôle.
--
-- CE QUE ÇA COÛTE EN MULTI-SITE. `select_shifts` filtre les managers sur
-- `site_id` : un manager ne verrait pas les services de sa propre équipe, et
-- un manager de `vito-sainte-marie` verrait ceux des employés de TOUS les
-- autres commerces. Sur `mission_catalog`, 89 lignes sur 208 portent déjà deux
-- sites différents — l'anomalie n'est pas théorique, elle est en base.
--
-- STRATÉGIE. `site_id` est la source de vérité : c'est la colonne de la
-- sécurité, et celle que l'application lit. `site` devient une copie tenue
-- par la base, jamais par l'appelant. Trois verrous, du plus déclaratif au
-- plus contextuel — chacun suffisant seul, et c'est voulu :
--
--   1. CONTRAINTE `site = site_id` : aucune ligne ne PEUT porter deux
--      identités. C'est la seule garantie qu'aucun code futur ne contourne.
--   2. DÉCLENCHEUR : renseigne les deux colonnes depuis le site du compte
--      authentifié, et REFUSE toute valeur fournie par le client qui en
--      diffère. Une valeur venue du navigateur ne décide plus du site.
--   3. RLS d'INSERT : vérifie désormais le site, en plus de `employee_id` et
--      du rôle. Défense en profondeur, au cas où le déclencheur serait un
--      jour retiré.
--
-- Et le défaut dangereux disparaît : une colonne oubliée ne retombe plus
-- silencieusement sur la production. Elle est remplie par le déclencheur, ou
-- l'écriture échoue.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS. Elle ne supprime pas `site`. La cible —
-- une colonne unique — impose de modifier l'écran de Prise de poste, qui
-- écrit `site` ; c'est un lot applicatif à part, décrit dans
-- `docs/plans/2026-09-04-site-source-unique.md`. Ici, le schéma reste
-- compatible avec le code déployé : rien à promouvoir dans l'ordre.

-- ── 1. Réparer l'existant avant de poser la contrainte ──────────────────
-- `site_id` fait foi partout SAUF sur `shifts`, où l'application écrit `site`
-- et où `site_id` n'est que le défaut jamais renseigné. On aligne donc chaque
-- table sur celle de ses colonnes qui porte réellement l'information.
update public.shifts
set site_id = site
where site_id is distinct from site;

update public.mission_catalog
set site = site_id
where site is distinct from site_id;

-- ── 2. Le défaut de production disparaît ────────────────────────────────
alter table public.shifts          alter column site    drop default;
alter table public.shifts          alter column site_id drop default;
alter table public.mission_catalog alter column site    drop default;
alter table public.mission_catalog alter column site_id drop default;

-- ── 3. Une ligne ne peut plus porter deux sites ─────────────────────────
alter table public.shifts
  add constraint shifts_site_unique check (site = site_id);
alter table public.mission_catalog
  add constraint mission_catalog_site_unique check (site = site_id);

-- ── 4. Le site vient du compte, jamais de l'appelant ────────────────────
create or replace function public.nexus_forcer_site_unique()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_reference text;
  v_fourni    text;
begin
  -- Pour un utilisateur authentifié, la référence est SON site — pas celui
  -- que le navigateur a bien voulu envoyer. C'est ce point précis qui rend
  -- une valeur fournie par le client incapable de contourner la règle, y
  -- compris pour un créateur en consultation externe : il ne peut pas
  -- prendre un poste sur un site qu'il ne fait que consulter.
  if auth.uid() is not null then
    v_reference := public.current_employee_site_id();
    if v_reference is null then
      raise exception 'Écriture refusée : compte authentifié sans ligne employee, site indéterminable.'
        using errcode = '42501';
    end if;
  else
    -- Hors session (service_role, migrations, outillage) : pas de site de
    -- référence à imposer, mais les deux colonnes doivent s'accorder.
    v_reference := coalesce(NEW.site_id, NEW.site);
    if v_reference is null then
      raise exception 'Écriture refusée : ni site ni site_id fourni, et aucun compte pour trancher.'
        using errcode = '23502';
    end if;
  end if;

  -- Une valeur explicite qui contredit la référence est une erreur, pas une
  -- préférence : on refuse au lieu de réécrire en silence. Réécrire ferait
  -- croire à l'appelant que son intention a été respectée.
  foreach v_fourni in array array[NEW.site, NEW.site_id] loop
    if v_fourni is not null and v_fourni is distinct from v_reference then
      raise exception 'Écriture refusée : site « % » demandé, « % » attendu pour ce compte.',
        v_fourni, v_reference using errcode = '42501';
    end if;
  end loop;

  NEW.site    := v_reference;
  NEW.site_id := v_reference;
  return NEW;
end;
$$;

comment on function public.nexus_forcer_site_unique() is
  'Impose site = site_id = site du compte appelant. Refuse toute valeur divergente fournie par le client.';

drop trigger if exists shifts_site_unique on public.shifts;
create trigger shifts_site_unique
  before insert or update on public.shifts
  for each row execute function public.nexus_forcer_site_unique();

drop trigger if exists mission_catalog_site_unique on public.mission_catalog;
create trigger mission_catalog_site_unique
  before insert or update on public.mission_catalog
  for each row execute function public.nexus_forcer_site_unique();

-- ── 5. La RLS d'insertion vérifie enfin le site ─────────────────────────
-- `employee_own_shifts_insert` ne contrôlait que l'employé et le rôle : elle
-- laissait passer n'importe quel site. Le contrôle du site s'y ajoute, sans
-- retirer ce qu'elle vérifiait déjà.
drop policy if exists employee_own_shifts_insert on public.shifts;
create policy employee_own_shifts_insert on public.shifts
  for insert
  with check (
    employee_id = (select auth.uid())
    and (
      role <> all (array['manager'::text, 'gerant'::text])
      or (select public.current_employee_role()) = any (array['manager'::text, 'gerant'::text])
    )
    and site_id = (select public.current_employee_site_id())
    and site = site_id
  );
