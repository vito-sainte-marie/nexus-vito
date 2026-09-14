---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 1
author: NEXUS Orchestrator
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
type: architecture-and-implementation-request
---
# Préparer la première promotion sécurisée du vrai NEXUS

## Contexte

La branche canonique de Test contient plusieurs jours de travail validé alors que `production` reste en retrait. La procédure canonique de promotion n'existe pas encore. Frédéric a explicitement demandé de lancer cette procédure avec Claude via la chaîne NEXUS et de ne le solliciter qu'en cas de véritable arbitrage.

## Mission

Construire la première procédure de promotion sécurisée sans effectuer de changement Production. La candidate doit être figée au HEAD canonique réellement validé au démarrage du lot et rester immuable pendant la preuve.

Travail attendu :

1. Réconcilier d'abord le rail Handoff précédent : `decision-3.md` du lot Philosophie existe et clôt ce lot, alors que `STATE.json` est encore en retard. Ne pas ouvrir deux lots actifs.
2. Mesurer Production en lecture seule et produire les impacts réels des migrations non encore vues par Production.
3. Inventorier chaque migration et distinguer schéma, lecture, fonction différée et écriture au déploiement.
4. Classifier les données impactées en `supprimées`, `écrasées`, `complétées`, `corrigées`.
5. Chaque mesure affichable dans NEXUS Live doit porter candidate, source et horodatage et devenir invalide si elle précède la candidate ou si l'état Production a dérivé.
6. Définir un PREPROD anonymisé mais structurellement fidèle à Production. Préserver volumes, relations, dates, statuts, valeurs nulles, divergences et anomalies utiles aux migrations. Masquer ou pseudonymiser les identités, données RH sensibles, commentaires libres sensibles, photos et pièces jointes non nécessaires.
7. Ne créer ou alimenter PREPROD qu'après preuve que les données personnelles réelles ne persistent pas hors Production. Une copie fidèle non anonymisée exige un nouvel arbitrage Frédéric.
8. Répéter les migrations et la candidate sur PREPROD, puis exécuter Guardians, CI et recette navigateur adaptés.
9. Produire un plan de réparation en avant pour les migrations de données. Distinguer rollback code et rollback données. Le snapshot global n'est qu'un dernier recours car il peut perdre les écritures métier postérieures.
10. Déterminer une fenêtre de déploiement sûre en lisant l'activité métier réelle. Des services ou écritures critiques en cours doivent pouvoir rendre la fenêtre `DECONSEILLEE` ou `BLOQUEE`.
11. Définir les critères exacts de `Prêt pour Production` dans NEXUS Live et la preuve qu'un bouton autorise une release précise avec un impact précis.
12. Produire le `Production Readiness Report` et la procédure canonique proposée, sans encore franchir la gate finale Production.

## Preuves minimales attendues

- candidate SHA immuable ;
- CI de cette candidate ;
- inventaire complet des migrations entre Production et candidate ;
- mesures Production en lecture seule avec heure de mesure ;
- preuve d'anonymisation ou statut `INCONNU` ;
- répétition PREPROD ou explication fail-closed si impossible ;
- Guardians applicables ;
- plan de réparation / rollback ;
- fenêtre opérationnelle évaluée ;
- aucune écriture Production ;
- aucun secret ou donnée personnelle brute dans dépôt, logs ou artefacts publics.

## Pourquoi un humain doit-il intervenir ici ?

Il ne doit pas intervenir pendant les étapes déterministes de préparation, mesure, anonymisation, répétition et preuve. Frédéric intervient seulement si une nouvelle décision de fondateur apparaît, si une copie non anonymisée devient techniquement indispensable, ou à la gate finale qui autorise réellement une release précise en Production.

## Interdictions

Aucun push/merge `main` ou `production`, aucune migration ou écriture Supabase Production, aucun déploiement NEXUS Production, aucun rollback Production. La lecture Production déjà autorisée reste strictement en lecture seule jusqu'à la gate finale.
