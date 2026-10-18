---
protocol: nexus-handoff/2
kind: request
lot_id: SECURITE-DEFINER-ETAPE1-20261018
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=8e8b7ba2
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 157-fichiers
---
# SÉCURITÉ SECURITY DEFINER — Étape 1 : aligner Test sur Production (révocation `anon` sur 2 fonctions, TEST exclusivement)

Suite du lot de sécurité ouvert en **lecture seule** le 18/10/2026 (GO de Frédéric). Cette demande ne porte que sur l'**étape 1** du plan de correction. Les étapes 2 à 5 (épinglage du `search_path`, révocation sur les fonctions de trigger, `nexus_identifiant_de_connexion`) auront chacune leur demande distincte. **Aucun SQL n'a été exécuté** ; seules des lectures de catalogue (SELECT) ont servi aux mesures. Ni Production, ni migration de dépôt, ni fusion, ni nouveau GRANT, ni modification des privilèges de `nexus_ci_recette`, ni `claude.yml`.

## Constat mesuré (SELECT sur les catalogues)

| Fonction | Test | Production |
|---|---|---|
| `public.run_scheduled_inventory_reviews()` | SECURITY DEFINER, `search_path=public`, **EXECUTE `anon` : oui** | EXECUTE `anon` : **non** |
| `public.nexus_garde_regularisation_reception()` | SECURITY DEFINER, `search_path=public`, **EXECUTE `anon` : oui** | EXECUTE `anon` : **non** |

Test porte donc 19 fonctions SECURITY DEFINER hors lot exposées à `anon`, contre 17 en Production : les deux en plus sont exactement celles-ci. C'est une **dérive de Test** par rapport à Production, pas un défaut de Production.

## Dépendances (aucune ne s'appuie sur `anon`)

- `run_scheduled_inventory_reviews()` : appelée par le job `pg_cron` `nexus-inventaire-reviews` (`*/15 * * * *`), utilisateur **`postgres`** ; aucune politique RLS, vue ni CHECK ne la référence.
- `nexus_garde_regularisation_reception()` : fonction de trigger uniquement ; un trigger ne vérifie pas EXECUTE à l'exécution.
- Aucune des deux n'est appelée par le front (.html/.js de main).

## SQL proposé (NON exécuté)

```sql
revoke execute on function public.run_scheduled_inventory_reviews() from anon;
revoke execute on function public.nexus_garde_regularisation_reception() from anon;
```

Aucune autre instruction. Pas de `GRANT`, pas de `ALTER FUNCTION`, pas de DDL de table. Cible : Supabase **Test** `udljdqxerrbbbajxubfn` exclusivement.

## Préconditions (à relire le jour de l'exécution)

1. Rail relu : une décision matérialisée couvre cette opération (aucune exécution sur simple message).
2. Les deux fonctions existent avec ces signatures exactes et `has_function_privilege('anon', …, 'execute')` est vrai.
3. Le job `nexus-inventaire-reviews` est actif, utilisateur `postgres`.

## Postconditions (épreuves)

1. `has_function_privilege('anon', 'public.run_scheduled_inventory_reviews()', 'execute')` = faux ; idem pour `nexus_garde_regularisation_reception()`.
2. `authenticated` : droits inchangés (comparés avant/après).
3. Le job `nexus-inventaire-reviews` s'exécute encore à son prochain passage (`cron.job_run_details`, statut `succeeded`).
4. Le trigger reste actif (`pg_trigger.tgenabled`).
5. Nombre de SECURITY DEFINER hors lot exposées à `anon` sur Test : 19 → 17, et l'ensemble de ces 17 est identique à celui de Production.
6. La preuve 109/109 du Journal Piste n'est pas rejouée (non concernée) ; la preuve originale 107/2 est conservée.

## Risques

Quasi nul : `anon` ne sert aucune des deux ; le cron et le trigger s'exécutent sous des rôles propriétaires. Risque résiduel : un usage hors dépôt par `anon` non vu dans la base (aucun indice ; la même fermeture existe déjà en Production sans incident).

## Retour arrière

```sql
grant execute on function public.run_scheduled_inventory_reviews() to anon;
grant execute on function public.nexus_garde_regularisation_reception() to anon;
```

## Question d'arbitrage

Autorisez-vous ces deux `REVOKE` sur **Supabase Test seulement**, sous les préconditions et postconditions ci-dessus ? Réponse attendue : APPROVED / APPROVED_WITH_CONDITIONS / REJECTED, avec `closes` pour cette étape. Rien n'est appliqué avant une décision matérialisée.
