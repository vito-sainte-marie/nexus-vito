-- SEC-023 bis — la LECTURE que `excluded.*` exige, complément de
-- `20261003170000_ecriture_bornee_station_config_recette_23502`.
--
-- CE QUI RESTAIT REFUSÉ APRÈS 20261003170000, MESURÉ. Au run Tests
-- 37143142272, tentative 2 (rail 58899b5adc1db5d097480607990b27c6b2d923d8,
-- 03/10/2026, job 111261916475), APRÈS application de 20261003170000 sur
-- nexus-test, l'étape « Épreuve station_config 23502 (request-20) » échoue
-- encore, au premier upsert de la PARTIE A (ligne 59 du fichier d'épreuve) :
--
--     ERROR:  42501: permission denied for table station_config
--     LOCATION:  aclcheck_error, aclchk.c:2843
--
-- Même SQLSTATE qu'avant, mais plus le même droit : l'INSERT et l'UPDATE de
-- colonne sont bien là. Ce qui manque est une LECTURE.
--
-- CAUSE, PROUVÉE ET NON DÉDUITE. PostgreSQL exige le privilège SELECT sur
-- toute colonne LUE par une requête — et `excluded.col`, dans un
-- `on conflict … do update set col = excluded.col`, est une lecture de `col`.
-- L'épreuve écrit, dans ses deux upserts :
--
--     do update set prix_carburants = excluded.prix_carburants,
--                   horaires        = excluded.horaires,
--                   updated_at      = excluded.updated_at
--
-- 20261003170000 n'accordait SELECT que sur `prix_carburants` (raisonnement
-- fondé sur la seule PARTIE B, qui projette ; il oubliait les `excluded.*` de
-- la PARTIE A). `horaires` et `updated_at` restaient illisibles, d'où le
-- refus. `site`, l'arbitre du conflit, était déjà lisible depuis SEC-018.
--
-- Preuve en conteneur `postgres:17` jetable, le 03/10/2026, sous un rôle
-- `nobypassrls` portant EXACTEMENT les droits et politiques mesurés sur Test :
--   · état de Test reproduit        → même erreur, même `aclchk.c:2843` ;
--   · + `grant select (horaires, updated_at)` → A1 (insertion neuve) OK et
--     A2 (insertion puis upsert sur ligne existante) OK ;
--   · contre-témoin `nexus-station-test` → toujours refusé, par la RLS
--     (« new row violates row-level security policy »).
--
-- AUTORISATION HUMAINE : Frédéric Bragance, 03/10/2026, verbatim — « Frédéric
-- autorise une capacité d'écriture TEST strictement minimale permettant à
-- l'épreuve request-20 d'exécuter ses deux cas synthétiques sur
-- public.station_config. » Elle « ne doit pas élargir les droits au-delà de ce
-- qui est strictement nécessaire à INSERT + ON CONFLICT de cette épreuve » :
-- les deux colonnes ajoutées sont précisément celles qu'un ON CONFLICT de cette
-- épreuve lit, et aucune autre.
--
-- EFFET DE BORD, DÉCLARÉ ET NON CACHÉ. Un droit de colonne ne se borne pas par
-- ligne : la borne en lignes est portée par les politiques de LECTURE. Or la
-- politique préexistante `lecture_recette_station_test` (SEC-018) ouvre déjà
-- au rôle la ligne `nexus-station-test`. `horaires` et `updated_at` de cette
-- ligne deviennent donc LISIBLES par `nexus_ci_recette`. C'est une lecture, sur
-- la station de recette, jamais une écriture : l'écriture y reste refusée par
-- la RLS (BORNAGE-003 / BORNAGE-004 le mesurent sous l'identité réelle).
-- Aucune ligne d'un site réel n'est lisible : aucune politique ne les ouvre.
--
-- POURQUOI UNE NOUVELLE MIGRATION, ET PAS UNE RETOUCHE DE 20261003170000.
-- Celle-ci est appliquée et estampillée sur Test : la modifier créerait un
-- fichier qui ne dit plus ce que la base a reçu. Cette migration REJOUE donc
-- toute la borne de 20261003170000 (mêmes droits, mêmes trois politiques,
-- mêmes prédicats) et y ajoute les deux colonnes de lecture : appliquée seule
-- sur une base neuve, elle donne l'état final complet ; appliquée après
-- 20261003170000, elle n'ajoute que `select (horaires, updated_at)`.
--
-- CE QU'ELLE NE FAIT PAS : ni droit de table, ni DELETE, ni TRUNCATE, ni
-- REFERENCES, ni TRIGGER ; aucune politique existante n'est modifiée ; la RLS
-- n'est ni activée ni forcée (elle l'est déjà, `relforcerowsecurity = f`).
--
-- TEST/CI UNIQUEMENT — à ne PAS appliquer en Production : le rôle
-- `nexus_ci_recette` n'y existe pas. Même exclusion et même motif que
-- 20261003170000.
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
