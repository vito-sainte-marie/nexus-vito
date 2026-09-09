-- SEC-020 — les DROITS DE TABLE du rôle CI, qui n'existaient qu'en base.
--
-- CE QUE CETTE MIGRATION RÉPARE. `20260908033743_acces_rls_role_ci_recette_site_test`
-- crée les POLITIQUES RLS qui bornent le rôle `nexus_ci_recette` à la seule
-- station de recette sur `audits_caisse` et `carburant_releves`. Elle n'accorde
-- aucun DROIT DE TABLE. Or une politique sans droit ne s'applique à rien : le
-- rôle ne voit même pas la table, et PostgreSQL répond « relation does not
-- exist » — un message qui fait chercher une table manquante là où le problème
-- est un privilège absent.
--
-- Ces `grant` avaient donc été posés à la main, hors du dépôt. Le 09/09/2026,
-- la reconstruction complète de nexus-test les a perdus, et le semis du
-- scénario Carburants a échoué en CI sur « relation audits_caisse does not
-- exist » alors que la table existait bel et bien.
--
-- C'est le TROISIÈME droit trouvé ce jour-là à vivre en base sans exister au
-- dépôt, après SEC-018 (lecture de `station_config`) et la politique qui
-- l'accompagnait. Le point commun n'est pas l'étourderie : c'est qu'un droit
-- accordé à chaud, pour débloquer, ne laisse aucune trace reproductible.
-- `test_droits_ci_dans_migrations_20260909.js` surveille désormais cette
-- famille.
--
-- PORTÉE. Le rôle reçoit exactement ce que le semis exécute — INSERT, et SELECT
-- pour que `on conflict` puisse relire la ligne en jeu — et rien d'autre :
-- ni DELETE, ni TRUNCATE, ni droit sur une autre table. Les LIGNES restent
-- bornées par les politiques déjà en place : `site = 'nexus-station-test'`,
-- en lecture comme en écriture. Aucune station cliente n'entre dans cette
-- portée, aujourd'hui ni quand il y en aura d'autres.
--
-- TEST/CI UNIQUEMENT — à ne PAS appliquer en Production : le rôle
-- `nexus_ci_recette` et le site `nexus-station-test` n'y existent pas. Même
-- exclusion et même motif que les migrations 19 et 20 du manifeste de
-- promotion (`manifeste-migrations-production-1.md`).
--
-- AUTORISATION HUMAINE : Frédéric Bragance, 08/09/2026 (SEC-019, publication
-- du journal et semis de recette par la CI). Cette migration n'accorde RIEN DE
-- NOUVEAU : elle rend reproductible un accès déjà décidé et déjà en usage.
--
-- Idempotente : le rôle est constaté, jamais supposé ; `grant` est rejouable.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nexus_ci_recette') then
    raise notice 'Rôle nexus_ci_recette absent : migration Test/CI sans objet ici, ignorée.';
    return;
  end if;

  execute 'grant select, insert, update on public.audits_caisse to nexus_ci_recette';
  execute 'grant select, insert, update on public.carburant_releves to nexus_ci_recette';
end
$$;
