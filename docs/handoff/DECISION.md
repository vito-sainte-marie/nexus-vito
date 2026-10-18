<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/SECURITE-DEFINER-ETAPE1-20261018/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: SECURITE-DEFINER-ETAPE1-20261018
seq: 1
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# Décision sur request-1.md : révocation `anon` sur 2 fonctions, Supabase Test uniquement

Cette décision matérialise l'arbitrage de Frédéric Bragance dans la conversation du 18/10/2026. Elle répond à la demande active, request-1.md.

## 1. Opération autorisée

Exclusivement, sur Supabase **Test** (`udljdqxerrbbbajxubfn`) :

```sql
revoke execute on function public.run_scheduled_inventory_reviews() from anon;
revoke execute on function public.nexus_garde_regularisation_reception() from anon;
```

Aucune autre instruction : pas de `GRANT`, pas de `ALTER FUNCTION`, pas de DDL de table. Aucun droit ajouté ni modifié, y compris pour `nexus_ci_recette`.

## 2. Conditions avant exécution (à relire le jour même)

- Relire le rail : cette décision y est matérialisée et aucun STOP ni décision contraire plus récente n'existe.
- Les deux fonctions existent avec ces signatures exactes et `has_function_privilege('anon', …, 'execute')` est vrai.
- Le job `nexus-inventaire-reviews` est actif, utilisateur `postgres`.
- Relever avant l'exécution les droits `authenticated` des deux fonctions, pour comparaison.

Si une condition échoue ou exige une autre permission, interrompre et revenir à l'arbitrage.

## 3. Vérification après exécution

Les postconditions de request-1.md : `anon` sans EXECUTE sur les deux fonctions ; droits `authenticated` inchangés ; job `nexus-inventaire-reviews` toujours `succeeded` à son prochain passage ; trigger toujours actif ; 19 → 17 fonctions SECURITY DEFINER hors lot exposées à `anon`, ensemble identique à Production. En cas d'échec, annuler par le retour arrière de request-1.md (deux `GRANT` à `anon`) seulement si l'échec l'exige, puis présenter les résultats.

## Périmètre

Test exclusivement, étape 1 seulement. `closes: false` : les étapes 2 à 5 auront chacune leur demande et leur décision. Ni Production, ni migration de dépôt, ni fusion, ni déploiement, ni modification de `claude.yml` : GO distincts.
