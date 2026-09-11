# ADR-0003 — Exception étroite `main` pour le control-plane d'orchestration

Statut : **ACCEPTEE**
Date : 2026-09-06
Autorisation humaine : Frederic Bragance — « donne les droits où il faut quand il faut pour que notre nouvelle doctrine soit mise en place ».

## Contexte

Les événements GitHub `issue_comment` qui réveillent Claude utilisent obligatoirement le workflow présent sur la branche par défaut. Dans ce dépôt, `.github/workflows/claude.yml` vit donc sur `main`, tandis que le checkout de travail reste `config-par-environnement`.

Le 06/09/2026, le run Claude `34069823147` a été bloqué avant le démarrage de Claude par une étape optionnelle de préparation Supabase Test read-only. Aucun code produit n'était concerné, mais l'invariant général « aucun changement automatique sur main » empêchait de réparer le control-plane sans clarifier la frontière.

## Décision

Une exception étroite est reconnue pour **le control-plane d'orchestration uniquement** :

- seuls les fichiers `.github/workflows/*` strictement nécessaires au déclenchement/contrôle des agents peuvent être modifiés sur `main` ;
- une telle modification exige une autorisation humaine explicite de Frederic pour le chantier concerné ;
- elle ne peut modifier aucun fichier applicatif, métier, donnée, migration, build de Production ou contenu servi par NEXUS ;
- elle ne vaut jamais autorisation de modifier `production`, Supabase Production ou NEXUS Production ;
- elle ne peut introduire de secret en clair ni élargir un droit Production ;
- le checkout de Claude reste explicitement `config-par-environnement` ;
- l'objectif doit être la disponibilité/sécurité du canal d'orchestration, pas le contournement des gates.

Sans autorisation humaine explicite, la règle générale d'immuabilité automatique de `main` reste applicable.

## Application initiale

Commit control-plane : `2ded5215b6f8865ef581397083d884202a3d905f`.

Correction : une capacité Supabase Test read-only absente ou invalide est désormais marquée indisponible et Claude continue sans DB, au lieu d'être bloqué avant son démarrage. Aucun accès supplémentaire n'est accordé.

## Invariants non modifiés

- aucune promotion Production sans GO explicite de Frederic ;
- aucun `service_role` dépôt/navigateur/logs ;
- aucune donnée cliente hors contexte autorisé ;
- fail closed pour une action qui exige réellement une preuve DB : la capacité absente ne devient jamais une preuve PASS.
