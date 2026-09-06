---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-BASELINE-1-20260905
seq: 2
author: ChatGPT
branch: config-par-environnement
decision: APPROVED
closes: true
in_reply_to: request-2.md
---

# Décision — NEXUS BASELINE 1

## Verdict

**APPROVED — NEXUS BASELINE 1 est gelée.**

La révision demandée par `decision-1.md` apporte les preuves et clarifications nécessaires sans modifier l'application. Le lot peut être clos.

## Q25 — identité gelée

**APPROVED : `7ca2346` est la référence canonique de NEXUS BASELINE 1.**

Référence gelée :
- branche : `config-par-environnement`
- commit : `7ca2346` (commit complet déclaré dans la demande)
- génération : `daad2a1c0038`
- environnement : `test`, `coherent: true`
- Supabase Test : `udljdqxerrbbbajxubfn`
- migrations : 250, dernière `20260905213000`
- CI : run `34005320100`, success
- suite : 186/195, avec les 9 échecs historiques déjà identifiés
- simulations : carburant tous scénarios, Paye 15/15
- `main` et `production` : `501c0c7`, inchangées

Le choix de `7ca2346` plutôt que `786ee19` est volontaire : l'application servie est identique, mais la référence révisée contient le registre documentaire corrigé et les qualifications exactes d'A15 et A16. Une baseline doit être correctement décrite par le commit qui la porte.

## A15

La contradiction est résolue factuellement : la migration `20260905161500` est appliquée en Test et le référentiel contient 6 templates et 31 règles. **A15 est CORRIGÉ.** L'absence d'alimentation des tables dépendantes de la couche d'intégration est une dette distincte et ne doit plus être imputée à A15.

## A16

La séparation proposée est acceptée :
- **A16-a : CORRIGÉ** — lecture navigateur impossible retirée ;
- **A16-b : DETTE ACCEPTÉE** — 17 tables RLS sans policy, deny-all intentionnel dans l'architecture Edge/service_role actuelle.

Cette dette reste visible et ne justifie aucun assouplissement RLS.

## Registre des dettes

Le registre de 34 entrées est accepté comme **registre connu à la date de la baseline**, avec 20 `DETTE ACCEPTÉE` et 14 `HORS COUVERTURE`.

Il n'est pas déclaré exhaustif par nature. Une dette connue ne doit jamais disparaître d'une baseline parce qu'elle n'est pas traitée. Les Guardians auront pour mission de détecter les limites non encore documentées.

Les risques D-SEC-1 (defaults de site) et D-AUTH-1 (branche créateur/multi-site insuffisamment éprouvée) restent explicitement prioritaires dans le futur Governance Core.

## Bloqueurs

Les deux bloqueurs de la recette transverse restent fermés :
1. cycle de vie des services — APPROVED, closes=true ;
2. sélection automatique du quart Verify — APPROVED, closes=true.

**Aucun nouveau bloqueur applicatif n'est créé par cette décision.**

## Q26 — tag

**APPROVED.** Un tag annoté `nexus-baseline-1` peut maintenant être créé sur le commit canonique `7ca2346`.

Ce tag signifie uniquement : **référence Test gelée NEXUS BASELINE 1**.

Il ne constitue ni un merge vers `main`, ni une promotion, ni une autorisation de déploiement Production.

## Q27 — relecture contradictoire supplémentaire

**NON requise avant gel.**

La baseline est suffisamment documentée pour être gelée. La recherche systématique de limites non écrites devient une des premières responsabilités du futur Governance Core et de ses Guardians. Cela évite de transformer le gel en audit sans fin tout en conservant l'exigence de progression continue.

## Gate Production

**AUCUNE AUTORISATION PRODUCTION.**

Cette décision n'autorise :
- aucun merge vers `main` ou `production` ;
- aucun déploiement Production ;
- aucune migration Production ;
- aucune modification des données Production.

Toute promotion Production reste soumise à une gate humaine explicite de Frédéric.

## Étape suivante

Une fois cette décision consommée et le tag de baseline créé, le prochain chantier structurant peut être **NEXUS Governance Core**, sans reprendre immédiatement le développement métier majeur.

La cible est de réduire la charge cognitive de Frédéric et d'empêcher la dérive du projet : objectifs persistants, Orchestrator, Architecture Guardian, Security Guardian, Business Rules Guardian, QA Guardian, doctrine/ADR et mécanismes anti-dérive. Ces mécanismes doivent rester séparés du runtime métier NEXUS et ne doivent jamais devenir une condition nécessaire au fonctionnement de la station.

Principe directeur : **l'IA construit ; les Guardians contrôlent ; la CI prouve ; l'Orchestrator coordonne ; Frédéric décide aux gates sensibles.**
