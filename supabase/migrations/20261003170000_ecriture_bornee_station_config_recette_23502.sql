-- SEC-023 — l'ÉCRITURE BORNÉE du rôle CI sur `station_config`, pour la seule
-- épreuve request-20.
--
-- CE QUE CETTE MIGRATION DÉBLOQUE. L'étape « Épreuve station_config 23502
-- (request-20) » du rail exécute
-- `outils/epreuve-station-config-upsert-fuseau-horaire-23502-20261002.sql`,
-- qui reproduit puis constate la disparition du défaut `23502` sur un upsert
-- `on conflict (site)`. Au run Tests 37131612297 (rail
-- 620b8418b681cafa327079be0a18698903d96274, 03/10/2026 14:59 UTC), la première
-- écriture de l'épreuve — ligne 48 du fichier — a été refusée :
--
--     ERROR:  permission denied for table station_config        -- 42501
--
-- Le `BEGIN` qui précède immédiatement avait réussi : ni la connexion, ni la
-- transaction, ni le secret n'étaient en cause. SEULE l'écriture était refusée.
--
-- CAUSE, MESURÉE LE 03/10/2026 ET NON DÉDUITE. Sur nexus-test, le rôle
-- `nexus_ci_recette` ne détient sur `public.station_config` que les QUATRE
-- droits de COLONNE en lecture posés par
-- `20260909110000_lecture_station_config_test_pour_derive_recette`
-- (`site`, `fuseau_horaire`, `cuves_carburants`, `carburant_commande_config`),
-- lisibles dans `pg_attribute.attacl`. Il ne détient AUCUN droit de table :
-- `pg_class.relacl` ne nomme que `postgres`, `anon`, `authenticated` et
-- `service_role`, et `has_table_privilege` rend `f` pour les sept privilèges.
-- `pg_auth_members` rend zéro ligne : le rôle n'hérite de rien.
--
-- PIÈGE DE LECTURE À NE PAS REFAIRE : `information_schema.role_table_grants`
-- n'expose PAS les droits de colonne. Lue là, la situation se présente comme
-- « ce rôle n'a aucun droit », ce qui pousse à concevoir un droit de TABLE
-- alors que le précédent du dépôt — et la bonne réponse — est un droit de
-- COLONNE. Les catalogues `pg_class.relacl` et `pg_attribute.attacl` sont les
-- seules sources non filtrantes.
--
-- AUTORISATION HUMAINE : Frédéric Bragance, 03/10/2026, verbatim — « Frédéric
-- autorise une capacité d'écriture TEST strictement minimale permettant à
-- l'épreuve request-20 d'exécuter ses deux cas synthétiques sur
-- public.station_config. » Cette autorisation concerne nexus-test UNIQUEMENT,
-- ne concerne aucune Production, et doit être bornée aux deux identifiants
-- synthétiques utilisés par l'épreuve. Elle interdit explicitement tout
-- élargissement général du rôle `nexus_ci_recette`.
--
-- PORTÉE, BORNÉE SUR LES DEUX AXES À LA FOIS — comme SEC-018 :
--
--   · en LIGNES — trois politiques RLS nommant `nexus_ci_recette` SEUL et
--     portant toutes le même prédicat :
--         site in ('nexus-test-repro-23502-neuf',
--                  'nexus-test-repro-23502-existant')
--     Ces deux identifiants n'existent dans aucune station réelle et ne
--     survivent à aucune des transactions de l'épreuve, qui se terminent
--     toutes par `rollback`. Aucune station cliente n'entre dans cette portée,
--     aujourd'hui ni quand il y en aura d'autres. La station de recette
--     `nexus-station-test` N'Y ENTRE PAS NON PLUS : elle reste en lecture
--     seule pour ce rôle, par `lecture_recette_station_test`, que cette
--     migration ne touche pas.
--
--   · en COLONNES — l'écriture ne porte que sur les champs que l'épreuve
--     renseigne vraiment : cinq à l'insertion, trois dans le `do update set`.
--     La lecture n'est élargie que de `prix_carburants`, qu'une des deux
--     vérifications de la PARTIE B projette ; `site` et `fuseau_horaire`
--     étaient déjà lisibles depuis SEC-018.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS, ET POURQUOI C'EST MESURÉ :
--   · elle n'active PAS la RLS : `pg_class.relrowsecurity` vaut déjà `t` sur
--     `public.station_config` (et `relforcerowsecurity` vaut `f`). Rien à
--     activer, donc AUCUN effet de bord sur `anon`, `authenticated` ou
--     `service_role`, qui gardent exactement ce qu'ils avaient ;
--   · elle n'accorde PAS `usage` sur le schéma `public` :
--     `has_schema_privilege` le rend déjà `t`, depuis
--     `20260909150000_usage_schema_public_role_ci_recette` ;
--   · elle n'accorde ni suppression, ni vidage de table, ni droit de référence,
--     ni droit de déclencheur — ni à l'échelle de la table, ni à celle d'une
--     colonne ;
--   · elle ne modifie aucune politique existante et n'en supprime aucune
--     autre que les trois qu'elle crée elle-même.
--
-- POURQUOI UNE POLITIQUE, ET PAS SEULEMENT UN DROIT. Un `grant` ne sait pas
-- borner par valeur de ligne : il ouvre la colonne pour toutes les lignes. Le
-- seul bornage « aux deux identifiants synthétiques » compatible avec le
-- mécanisme NEXUS est donc une politique RLS portant le prédicat, adossée au
-- droit le plus étroit possible. Et le rôle est bien soumis à ces politiques :
-- il est `rolsuper = f` ET `rolbypassrls = f` (mesuré ; `postgres`, lui, est
-- `rolbypassrls = t`, ce qui explique qu'une mesure prise sous `postgres` ne
-- prouve RIEN du bornage).
--
-- POURQUOI LA LECTURE BORNÉE EST NÉCESSAIRE, ET PAS UN CONFORT. La PARTIE B de
-- l'épreuve relit chaque ligne écrite. Sans politique de lecture sur ces deux
-- identifiants, ces `select` rendraient ZÉRO LIGNE EN SILENCE — la RLS filtre,
-- elle ne refuse pas — et l'épreuve deviendrait verte sans rien avoir prouvé.
-- C'est la différence à garder en tête : un droit ABSENT est bruyant
-- (`permission denied`), une politique qui ne passe pas est MUETTE en lecture.
--
-- CE QUI NE PEUT PAS ÊTRE PROUVÉ DEPUIS UN POSTE. Le bornage ne se constate
-- que sous l'identité réelle. Or, le 03/10/2026, `set role nexus_ci_recette;`
-- exécuté comme `postgres` sur nexus-test a répondu
-- `ERROR: permission denied to set role "nexus_ci_recette"`, alors même que
-- `pg_has_role('postgres','nexus_ci_recette','MEMBER')` rendait `t` — c'est
-- l'option `SET` de l'appartenance qui manque, et `pg_has_role(…,'USAGE')`
-- rendait `f`, seul signal honnête. La preuve du bornage est donc portée par
-- `outils/epreuve-bornage-ecriture-recette-station-config-20261003.sql`, qui
-- REFUSE DE CONCLURE si `current_user` n'est pas `nexus_ci_recette` : elle ne
-- peut être concluante que là où la CI se connecte.
--
-- TEST/CI UNIQUEMENT — à ne PAS appliquer en Production : le rôle
-- `nexus_ci_recette` n'y existe pas, et les deux identifiants synthétiques
-- n'ont aucun sens hors de l'épreuve. Même exclusion et même motif que les
-- migrations 19 et 20 du manifeste de promotion
-- (`manifeste-migrations-production-1.md`).
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

  -- La PARTIE B projette `site`, `fuseau_horaire` (déjà lisibles) et
  -- `prix_carburants` (sous la forme `is not null`). Seul le troisième manque.
  execute 'grant select (prix_carburants)
             on public.station_config to nexus_ci_recette';

  execute 'drop policy if exists ecriture_recette_23502_insert on public.station_config';
  execute $pol$
    create policy ecriture_recette_23502_insert on public.station_config
      for insert to nexus_ci_recette
      with check (site in ('nexus-test-repro-23502-neuf',
                           'nexus-test-repro-23502-existant'))
  $pol$;

  -- `on conflict (site) do update` relit la ligne en conflit : il faut le
  -- `using` autant que le `with check`, et les deux portent le même prédicat.
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
