# Ce qui est prouvé sur Test, et ce qui ne l'est pas encore

**11/09/2026.** Six migrations appliquées à Supabase **Test uniquement**
(`udljdqxerrbbbajxubfn`), dans l'ordre imposé. Aucune action Production.

## Appliquées sur Test

| # | migration | état |
|---|---|---|
| 1 | `pointages_service_id` | appliquée |
| 2 | `pointages_client_event_id` | appliquée |
| 3 | `pointages_rattachement_historique` | appliquée |
| 4 | `pointages_unicite_partielle` + `shifts_fin_apres_debut` (NOT VALID) | appliquées |
| 5 | `depart_ferme_son_propre_service` | appliquée |

La migration 2 a d'abord échoué : `UPDATE … FROM LATERAL` ne peut pas
référencer la table cible en PostgreSQL (`42P10`). Réécrite en sous-requête
corrélée. Le fichier du rail porte la version qui passe.

## Prouvé en base, par tentative réelle

> **Un doublon de `client_event_id` est refusé.** Deux lignes portant le même
> identifiant : `unique_violation`. L'idempotence ne dépend plus du JavaScript.

> **Une fin antérieure au début est refusée.** `check_violation` sur
> `shifts_fin_apres_debut`.

> **Deux services distincts le même jour restent possibles.** Le premier est
> clos par le second, en `prise_de_poste_suivante`.

> **Un départ ne ferme que le service porté par son pointage.** Un départ
> désignant un service déjà clos laisse le service courant ouvert — il ne se
> rabat plus sur « le plus récent ».

Le bac à sable a été nettoyé : zéro service ouvert résiduel.

## Pas encore prouvé, et je ne le présente pas comme acquis

- **80 rattachements et 12 exceptions** : ce sont des chiffres de
  **Production**. Test n'a que quelques pointages. Cette preuve exige la
  répétition complète sur une copie portant les données, pas Test tel quel.
- **Parcours hors ligne réel dans le navigateur** : la file est prouvée par
  ses fonctions réelles (17/17), pas encore par un navigateur mis hors réseau.
- **CI et parcours manuel simultanés sur deux comptes** : la garde d'identité
  existe et mord (7/7), mais l'exécution simultanée demande le code PIN du
  compte humain, que Frédéric Bragance saisit lui-même.
