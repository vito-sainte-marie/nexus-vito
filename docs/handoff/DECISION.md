<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/decision-8.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 8
author: NEXUS Orchestrator
decision: APPROVED
closes: false
in_reply_to: request-8.md
branch: config-par-environnement
---
# Poursuite déterministe : sérialiser uniquement les épreuves qui partagent le registre PREPROD

Aucun arbitrage Frédéric supplémentaire n'est requis pour le défaut démontré `zzzzrefdetestinexistante`.

Le diagnostic de `request-8.md` établit que la voie 2 est la correction minimale, réversible et sans élargissement de surface de sécurité. Elle est cohérente avec la gouvernance déjà autorisée : corriger les défauts déterministes de l'outillage Test, ne pas perfectionner PREPROD, ne pas modifier les gardes ni les scripts de release sans nécessité démontrée.

## 1. Voie retenue

Retenir la voie 2 : exécuter en série les seules épreuves qui manipulent `docs/handoff/PREPROD-CYCLE.json`, en les retirant du pool parallèle du lanceur de tests.

Le correctif doit rester limité au lanceur et aux tests nécessaires pour prouver l'absence de course. Aucune logique métier, aucune garde PREPROD, aucun script de release et aucun comportement Production ne doivent être modifiés pour fermer ce défaut.

## 2. Preuves exigées

Prouver au minimum :

1. plusieurs exécutions successives et parallèles de la suite ne laissent plus survivre `REF_BIDON` ou `zzzzrefdetestinexistante` ;
2. `PREPROD-CYCLE.json` revient exactement à son état initial après chaque épreuve ;
3. le correctif est détecté par une mutation négative ou une épreuve équivalente ;
4. aucune nouvelle régression n'apparaît dans la suite globale et les Guardians ;
5. la recette connectée et la répétition reprennent à l'étape utile, sans reconstruire inutilement ce qui est déjà prouvé.

## 3. Défaut security distinct

Le défaut `security` observé sur `ea561f6` reste distinct et sa cause reste non isolée. Cette décision n'autorise pas une correction par analogie. Utiliser l'instrumentation déjà ajoutée pour capturer la prochaine occurrence et isoler la cause réelle.

Une correction déterministe minimale peut être appliquée ensuite si la cause est démontrée et reste dans le périmètre Test/outillage déjà autorisé. Toute extension de privilège, modification d'une garde de sécurité ou modification d'un script de release exige une nouvelle décision avant application.

## 4. Discipline de fin de lot

Ne pas ajouter de nouvelle architecture. Ne pas améliorer l'outillage au-delà de ce qui est nécessaire pour obtenir la preuve de release. Une fois les défauts d'outillage fermés, reprendre directement la recette réelle et compléter le package de readiness.

Revenir par un nouveau `request-N.md` avec les preuves réelles, les points fermés et les seuls blocages encore ouverts. Si le package est complet, demander uniquement les re-mesures Production SELECT-only déjà autorisées et la préparation de la gate finale spécifique.

## 5. Interdictions inchangées

Aucune écriture ou migration Supabase Production. Aucun push/merge vers `main` ou `production`. Aucun déploiement ni rollback Production. Aucune copie non anonymisée de Production. Aucun secret ou service_role exposé. Migration 21 reste exclue de cette release. `Prêt pour Production` ne vaut jamais autorisation Production.
