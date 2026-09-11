# NEXUS Handoff — decision-1

protocol: nexus-handoff/2
lot_id: NEXUS-LIVE-CONTROL-CENTER-1-20260906
decision: APPROVED_TEST_IMPLEMENTATION
branch: config-par-environnement
environment: TEST_ONLY
authorized_by: Frederic Bragance
date: 2026-09-06

## Décision

Frédéric autorise maintenant l'implémentation Test de **NEXUS LIVE DÉVELOPPEMENT** à partir des artefacts déjà existants `request-1.md` et `spec-1.md`.

Cette décision n'est pas une reconstruction rétroactive du passé : elle est une autorisation nouvelle, actuelle, append-only.

## Première obligation — reconstruire le travail réellement entrepris

Avant d'implémenter Live, Claude doit déterminer ce qu'il avait réellement entrepris et ce qui est réellement livré, en se fondant uniquement sur les sources vérifiables :
- `config-par-environnement` au HEAD courant ;
- `docs/handoff/STATE.json` et lots pertinents ;
- issue #28 et runs GitHub Actions ;
- branche/commits Claude encore pertinents ;
- gouvernance autonome v2, ADR-0002/0003 et `docs/learning/*` ;
- implémentation Guardians backend éventuellement produite lors du run `34069905909` ;
- lot event-driven et lot Carburants actifs ou récemment exécutés.

Claude ne doit pas s'appuyer sur une mémoire supposée de session. Il doit produire une courte cartographie factuelle : terminé / partiel / non intégré / bloqué / obsolète.

## Deuxième obligation — NEXUS LIVE DÉVELOPPEMENT MVP

Une fois cette cartographie établie, Claude implémente en Test le MVP déjà défini dans `spec-1.md`, en privilégiant les sources réellement disponibles aujourd'hui.

Objectif utilisateur : Frédéric ouvre NEXUS Live et comprend en moins de 10 secondes :
1. quel agent travaille ;
2. sur quel lot ;
3. l'étape actuelle ;
4. ce qui vient d'être terminé ;
5. état Guardians/tests/CI ;
6. présence ou non d'un vrai gate humain ;
7. prochaine étape automatique ;
8. si le système avance, attend ou est bloqué.

## Test réel demandé

Le chantier NEXUS Live lui-même sert de test d'observabilité autant que techniquement possible : les événements structurés, runs, commits, Guardians, tests et changements d'état de cette implémentation doivent alimenter la projection Live dès que le pipeline le permet.

Le MVP peut commencer par GitHub/Handoff/Actions et une projection structurée locale/Test. Il ne doit pas attendre une infrastructure parfaite si les sources existantes suffisent à produire une première vue fiable.

## Accès NEXUS Test autorisé

Claude dispose dans son runner de :
- `NEXUS_TEST_URL` ;
- `NEXUS_TEST_MANAGER_USERNAME` ;
- `NEXUS_TEST_EMPLOYEE_A_USERNAME` ;
- `NEXUS_TEST_EMPLOYEE_B_USERNAME` ;
- `NEXUS_TEST_PIN` via GitHub Secret.

Le pointage de `nexus-station-test` est désactivé afin que la recette multi-rôles ne dépende pas d'une intervention humaine.

Claude doit utiliser ces accès uniquement pour NEXUS Test. Le PIN ne doit jamais être imprimé, journalisé, committé ou recopié dans un fichier.

## Sécurité obligatoire

- NEXUS Live reste Créateur NEXUS uniquement.
- Manager/Employé/Admin client : accès refusé, y compris via URL directe.
- La supervision système n'accorde aucun accès nouveau aux données clientes.
- Aucun secret/token/service_role/log brut sensible dans l'UI.
- Security & Isolation Guardian a veto sur tout mécanisme d'accès Live.

## Autonomie

Dans ce périmètre Test déjà autorisé, Claude peut diagnostiquer, coder, tester, corriger et retester sans demander une nouvelle décision pour chaque défaut local.

Escalade uniquement si :
- choix produit fondateur non tranché ;
- contradiction avec Bible/ADR/gouvernance ;
- élargissement de périmètre nécessaire ;
- besoin d'un accès Production.

## Interdictions

- aucun changement `production` ;
- aucun Supabase Production ni NEXUS Production ;
- aucune promotion Production ;
- aucun secret dans repo, issue, UI ou logs ;
- ne pas altérer les vérités métier Carburants pour faire fonctionner Live ;
- Live observe les sources d'exécution, il ne devient pas le moteur manuel du workflow.

## Retour attendu

Un seul retour final utile, avec :
- cartographie factuelle de ce que Claude avait entrepris avant ce lot ;
- architecture réellement retenue pour Live ;
- fichiers/commits ;
- tests automatisés ;
- recette navigateur Test Manager/Employé/refus non-Créateur et Créateur si profil disponible ;
- preuve de non-exposition des secrets ;
- état Guardians/CI ;
- URL/chemin Test de NEXUS LIVE DÉVELOPPEMENT ;
- limites résiduelles clairement séparées des éléments terminés.
