-- RÉCONCILIATION (06/09/2026) — fichier reconstitué depuis Supabase Test.
--
-- POURQUOI CE FICHIER EXISTE. Cette migration a été APPLIQUÉE à `nexus-test`
-- le 06/09/2026 sans qu'un fichier correspondant existe au dépôt : elle a été
-- posée par `apply_migration`, qui horodate lui-même la version. Le dépôt ne
-- pouvait donc plus reproduire Test — exactement la dérive que l'arbitrage de
-- la garde statique avait posée en précondition :
--
--     « toute modification persistante de policies/RLS doit être versionnée
--       par migration ; une modification hors migration constitue une dérive
--       et invalide la complétude de la garde. »
--
-- Le corps ci-dessous est la reproduction EXACTE de
-- `supabase_migrations.schema_migrations.statements` pour la version
-- 20260906113147. Rien n'a été reformulé : un fichier de réconciliation qui
-- « améliorerait » ce qui a été appliqué ne réconcilierait rien.
--
-- Elle est fonctionnellement identique à 20260906120000, qui la re-publie avec
-- un commentaire plus complet. Les deux sont idempotentes (`create or
-- replace`) : les appliquer dans l'ordre donne le même résultat.
--
-- Contenu : correction de `est_pompiste_du_jour` — journée-station calculée
-- dans `sites.timezone` au lieu d'UTC, lecture de `shifts.statut`, fail-closed
-- si le fuseau est absent ou invalide. Anomalie constatée au lot
-- SITE-EXPLICITE-1-NAMED-HELPERS-BEHAVIOR-PROOF-20260906.

create or replace function public.est_pompiste_du_jour(p_site text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare
  v_fuseau text;
begin
  select s.timezone into v_fuseau from public.sites s where s.site_id = p_site;

  if v_fuseau is null or btrim(v_fuseau) = ''
     or not exists (select 1 from pg_timezone_names where name = v_fuseau) then
    return false;
  end if;

  return exists (
    select 1 from public.shifts sh
    where sh.employee_id = auth.uid()
      and sh.site = p_site
      and sh.role = 'pompiste'
      and sh.statut = 'en_cours'
      and (sh.heure_debut at time zone v_fuseau)::date = (now() at time zone v_fuseau)::date
  );
end;
$$;

comment on function public.est_pompiste_du_jour(text) is
  'TEST NEXUS: droit pompiste actif uniquement si service en cours sur le site et la journée station calculée via sites.timezone; fail closed si fuseau absent/invalide.';
