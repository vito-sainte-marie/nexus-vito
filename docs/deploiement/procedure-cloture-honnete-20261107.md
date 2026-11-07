# Procédure — clôture honnête (PR #219)

Migration `supabase/migrations/20261107100000_cloture_honnete_comptage_et_regime_etendu.sql`.
Ce document ne constitue aucune autorisation : l'application sur Test, puis en
Production, et la fusion de #219 restent des GO distincts de Frédéric.
**Non appliquée à ce jour, GO requis.**

## Ordre

La migration et le code client sont indépendants : le client n'appelle pas la
fonction, et la fonction ne lit aucune colonne nouvelle. Aucun ordre strict.
Appliquer la migration seule corrige la clôture automatique (heure de fin du
jeudi au samedi, quarts clos avec leurs vrais non-comptés). Fusionner #219 seule
rend l'écran honnête sans changer ce que le serveur fait.

## Ce que fait la migration

`create or replace` de `public.run_scheduled_inventory_reviews()` (SECURITY
DEFINER, search_path public), base 20261106100000 :

1. repli : les produits piste obligatoires du plan **sans comptage
   `type_comptage = 'cloture'` valide** sur le quart sont comptés non faits ;
2. fin de quart : `fin_etendu` les jeudi, vendredi, samedi (ISO 4, 5, 6),
   repli sur `fin_normal` ;
3. `revoke execute ... from public, anon, authenticated` conservé.

Aucun DDL destructif, aucune table ni colonne créée, aucune donnée corrigée.

## Relecture avant d'écrire (catalogue, lecture seule)

Mesurée sur Test le 07/11/2026 : fonction présente, `prosecdef` vrai, corps de
9852 caractères (md5 `d5e470ebe2ba7694c5ba3f923646d05e`) sans `fin_etendu`,
estampille 20261107100000 absente. À refaire en Production, avec GO et
filtre de site.

## Relecture après application

- corps contenant `fin_etendu` et `type_comptage = 'cloture'` ;
- `proacl` sans EXECUTE pour public, anon, authenticated ;
- job cron `nexus-inventaire-reviews` actif.

## Retour arrière

Réappliquer `20261106100000_cloture_incomplete_perimetre_piste.sql`. Aucune donnée
n'est écrite par la migration elle-même.
