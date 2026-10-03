-- SEC-023 ter — l'EXÉCUTION que les contraintes CHECK de station_config
-- exigent, complément de `20261003180000_lecture_excluded_station_config_recette_23502`.
--
-- CE QUI RESTAIT REFUSÉ APRÈS 20261003180000, MESURÉ. Au run Tests 37144179897
-- (rail 65854d03f77f979afc9399372b55c417ef96b850, 03/10/2026, job
-- 111264611567), APRÈS application de 20261003180000 sur nexus-test, l'étape
-- « Épreuve station_config 23502 (request-20) » échoue encore à la ligne 59 du
-- fichier d'épreuve (premier upsert de la PARTIE A) :
--
--     ERROR:  42501: permission denied for function planning_mappage_est_valide
--     LOCATION:  aclcheck_error, aclchk.c:2843
--
-- Progrès réel : les droits de TABLE et de COLONNE passent désormais. Ce qui
-- manque n'est plus sur station_config, mais sur une FONCTION.
--
-- CAUSE. Deux contraintes CHECK de station_config —
-- `station_config_planning_alias_check` et
-- `station_config_planning_codes_sites_check` — appellent
-- `public.planning_mappage_est_valide(jsonb)`. Une contrainte CHECK s'évalue
-- avec les privilèges de celui qui ÉCRIT la ligne : l'INSERT exige donc EXECUTE
-- sur la fonction. Or 20260919180000 l'a révoquée de public/anon et ne l'a
-- accordée qu'à `authenticated` et `service_role` ; mesuré sur Test le
-- 03/10/2026 : has_function_privilege('nexus_ci_recette', …, 'execute') = false.
--
-- C'EST LE SEUL DROIT MANQUANT, MESURÉ ET NON SUPPOSÉ. Inventaire en lecture
-- seule de la vraie base Test (290 migrations, dernière 20261003180000) de tout
-- ce qu'un INSERT sur station_config exécute :
--   · contraintes CHECK : quatre ; deux appellent la fonction ci-dessus, les
--     deux autres sont des `= ANY (…)` sans appel de fonction ;
--   · triggers : `trg_planning_codes_sites_controle` (BEFORE) et
--     `trg_planning_source_coherence` (contrainte, AFTER, différé) — tous deux
--     SECURITY DEFINER : ils s'exécutent avec les droits de leur propriétaire
--     et n'exigent aucun grant de l'écrivain ;
--   · valeurs par défaut : constantes, jsonb_build_object, now() — aucune
--     n'exige de droit.
--
-- POURQUOI CE DROIT NE DIVULGUE RIEN. `planning_mappage_est_valide` est
-- `language sql immutable`, `set search_path to 'public'`, et ne lit AUCUNE
-- table : elle vérifie la forme d'un jsonb qu'on lui passe. L'exécuter
-- n'ouvre aucune donnée, sur aucun site.
--
-- AUTORISATION HUMAINE : Frédéric Bragance, 03/10/2026, verbatim — « Frédéric
-- autorise une capacité d'écriture TEST strictement minimale permettant à
-- l'épreuve request-20 d'exécuter ses deux cas synthétiques sur
-- public.station_config. » Elle « ne doit pas élargir les droits au-delà de ce
-- qui est strictement nécessaire à INSERT + ON CONFLICT de cette épreuve » :
-- sans cet EXECUTE, aucun INSERT sur station_config n'est possible sous ce
-- rôle, quelles que soient les colonnes et les politiques.
--
-- POURQUOI UNE NOUVELLE MIGRATION QUI REJOUE TOUT. 20261003180000 est appliquée
-- et estampillée sur Test : la retoucher créerait un fichier qui ne dit plus ce
-- que la base a reçu. Celle-ci REJOUE donc toute la borne de 20261003180000
-- (mêmes droits de colonne, mêmes trois politiques, mêmes prédicats) et y
-- ajoute le seul EXECUTE : appliquée seule sur une base neuve, elle donne
-- l'état final complet ; appliquée après 20261003180000, elle n'ajoute que
-- l'EXECUTE. Le plafond se lit toujours dans la dernière porteuse.
--
-- EFFET DE BORD : aucun nouveau. Celui de 20261003180000 (lecture de
-- `horaires`/`updated_at` sur la ligne `nexus-station-test`, déjà ouverte en
-- lecture par SEC-018) est inchangé.
--
-- CE QU'ELLE NE FAIT PAS : ni droit de table, ni DELETE, ni TRUNCATE, ni
-- REFERENCES, ni TRIGGER ; aucun EXECUTE sur une autre fonction ; aucune
-- politique existante n'est modifiée ; la RLS n'est ni activée ni forcée.
--
-- TEST/CI UNIQUEMENT — à ne PAS appliquer en Production : le rôle
-- `nexus_ci_recette` n'y existe pas. Même exclusion et même motif que
-- 20261003170000 et 20261003180000.
--
-- Idempotente : le rôle est constaté et jamais supposé ; les `grant` sont
-- rejouables ; chaque politique est précédée de son `drop policy if exists`.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nexus_ci_recette') then
    raise notice 'Rôle nexus_ci_recette absent : migration Test/CI sans objet ici, ignorée.';
    return;
  end if;

  -- Les colonnes que l'épreuve renseigne à l'insertion, et rien de plus.
  execute 'grant insert (site, prix_carburants, horaires, fuseau_horaire, updated_at)
             on public.station_config to nexus_ci_recette';

  -- Les seules colonnes du « do update set » de l'épreuve.
  execute 'grant update (prix_carburants, horaires, updated_at)
             on public.station_config to nexus_ci_recette';

  -- Les colonnes que le « do update set » LIT par `excluded.*` — les mêmes
  -- trois. `site` et `fuseau_horaire` sont déjà lisibles depuis SEC-018.
  execute 'grant select (prix_carburants, horaires, updated_at)
             on public.station_config to nexus_ci_recette';

  -- Les deux contraintes CHECK `station_config_planning_alias_check` et
  -- `station_config_planning_codes_sites_check` l'appellent avec les droits de
  -- l'écrivain. Fonction pure (immutable, ne lit aucune table).
  execute 'grant execute on function public.planning_mappage_est_valide(jsonb)
             to nexus_ci_recette';

  execute 'drop policy if exists ecriture_recette_23502_insert on public.station_config';
  execute $pol$
    create policy ecriture_recette_23502_insert on public.station_config
      for insert to nexus_ci_recette
      with check (site in ('nexus-test-repro-23502-neuf',
                           'nexus-test-repro-23502-existant'))
  $pol$;

  execute 'drop policy if exists ecriture_recette_23502_update on public.station_config';
  execute $pol$
    create policy ecriture_recette_23502_update on public.station_config
      for update to nexus_ci_recette
      using (site in ('nexus-test-repro-23502-neuf',
                      'nexus-test-repro-23502-existant'))
      with check (site in ('nexus-test-repro-23502-neuf',
                           'nexus-test-repro-23502-existant'))
  $pol$;

  execute 'drop policy if exists lecture_recette_23502_select on public.station_config';
  execute $pol$
    create policy lecture_recette_23502_select on public.station_config
      for select to nexus_ci_recette
      using (site in ('nexus-test-repro-23502-neuf',
                      'nexus-test-repro-23502-existant'))
  $pol$;
end
$$;
