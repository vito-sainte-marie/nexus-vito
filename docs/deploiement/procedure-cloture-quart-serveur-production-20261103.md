# Procédure — clôture serveur du quart d'inventaire (#176 puis #177)

Lot INVENTAIRE-CAISSE-RENFORT-20261102. Migration
`supabase/migrations/20261103190000_cloture_quart_inventaire_anticipee_et_repli.sql`.
Ce document ne constitue aucune autorisation : l'application en Production, la
fusion de #176 et celle de #177 restent trois GO distincts de Frédéric.

## Ordre strict

1. **#176 appliquée en Production, puis relue** (ci-dessous).
2. **#177 fusionnée ensuite.** Dès que #177 est servie, le front n'écrit plus
   `inventaire_quarts` : sans la migration, personne ne clôt le quart.
3. Retour arrière de #177 seule : sans danger (le front d'avant ferme le quart).
   Retour arrière de #176 après #177 : interdit sans retirer #177.

## Ce que fait la migration

`create or replace` de `public.run_scheduled_inventory_reviews()` (SECURITY
DEFINER, search_path public) : clôture anticipée quand toute la population du
quart (shift de même `quart`) a validé ; repli à fin normale + `closureDelayMinutes`
avec `cloture_le` exact et alerte `cloture_incomplete` ; journal
`inventaire_audit_log` (`cloture_serveur`). Aucun DDL destructif, aucune table
touchée, aucune donnée corrigée. Elle finit par
`revoke execute ... from public, anon, authenticated` ; aucun grant.

## Relecture avant d'écrire (catalogue, lecture seule)

- la fonction existe, `prosecdef` vrai, corps sans `cloture_serveur` ni `anticipee` ;
- `proacl` = `{postgres=X/postgres}` (état constaté le 03/11/2026) ;
- les colonnes et contraintes citées par le corps existent (mesurées le 03/11/2026).

## Relecture après application

- corps contenant `cloture_serveur` et `anticipee` ;
- `proacl` toujours limité à `postgres` : aucun EXECUTE pour public, anon, authenticated ;
- job cron `nexus-inventaire-reviews` actif ;
- à fusionner #177 seulement si les trois points sont vrais.
