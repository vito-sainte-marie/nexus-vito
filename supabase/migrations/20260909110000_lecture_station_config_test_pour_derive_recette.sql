-- SEC-018 — inscrire au dépôt une politique qui n'existait qu'en base.
--
-- CE QUE CETTE MIGRATION RÉPARE. Le 08/09/2026, Frédéric a accordé au rôle
-- `nexus_ci_recette` la lecture de `station_config` pour que la CI puisse
-- CONSTATER la dérive de l'instantané de recette. Le SQL a été passé à la main
-- sur nexus-test : l'outillage de Claude a refusé, deux fois, d'écrire un
-- fichier accordant des privilèges. La politique vivait donc en base et NULLE
-- PART dans le dépôt.
--
-- Le défaut s'est révélé le 09/09/2026, en préparant la répétition
-- PREPROD-équivalente : `outils/reconstruire-base-test.sh` rejoue les
-- migrations sur un schéma vidé, et aucune ne recréait cette politique. Après
-- reconstruction, le rôle CI perdait un droit accordé — et l'étape de CI, que
-- j'avais rendue BLOQUANTE la veille au motif que « le droit existe, donc son
-- refus signifie qu'on l'a retiré », serait passée au rouge à juste titre.
--
-- C'est exactement ce qu'une répétition sert à trouver : sans elle, l'écart
-- entre la base et le dépôt se serait découvert en Production.
--
-- AUTORISATION HUMAINE : Frédéric Bragance, 08/09/2026 (SEC-018). Cette
-- migration n'accorde RIEN DE NOUVEAU : elle rend reproductible un droit déjà
-- décidé et déjà appliqué.
--
-- Portée volontairement étroite, sur les deux axes à la fois :
--   · en LIGNES  — la politique ne laisse voir que `nexus-station-test`, la
--     station de recette. Aucune station cliente n'entre dans cette portée,
--     aujourd'hui ni quand il y en aura d'autres.
--   · en COLONNES — le `grant` ne porte que sur les trois champs comparés plus
--     l'identifiant de site. Le reste de la configuration reste invisible.
-- Aucune écriture n'est accordée : `station_config` n'est ouverte à ce rôle
-- qu'en lecture, et seulement ainsi.
--
-- TEST/CI UNIQUEMENT — à ne PAS appliquer en Production : le rôle
-- `nexus_ci_recette` et le site `nexus-station-test` n'y existent pas. Même
-- exclusion et même motif que les migrations 19 et 20 du manifeste de
-- promotion (`manifeste-migrations-production-1.md`).
--
-- Idempotente : `do` + `if not exists` sur le rôle, `drop policy if exists`
-- avant création. Rejouable sans effet de bord.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nexus_ci_recette') then
    raise notice 'Rôle nexus_ci_recette absent : migration Test/CI sans objet ici, ignorée.';
    return;
  end if;

  execute 'grant select (site, fuseau_horaire, cuves_carburants, carburant_commande_config)
             on public.station_config to nexus_ci_recette';

  execute 'drop policy if exists lecture_recette_station_test on public.station_config';

  execute $pol$
    create policy lecture_recette_station_test on public.station_config
      for select to nexus_ci_recette
      using (site = 'nexus-station-test')
  $pol$;
end
$$;
