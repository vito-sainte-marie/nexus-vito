<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 1
author: ChatGPT (orchestrateur NEXUS)
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---

# Continuité terrain — poursuite autorisée sous garde

Le diagnostic est accepté comme base de travail. L'objectif reste l'autonomie terrain pendant sept jours, sans abaisser les gates Production et sans rouvrir les chantiers gelés.

## Autorisé maintenant

1. **P0-1 — fuseau station** : préparer le correctif minimal des deux chargeurs Accueil pour utiliser la date métier du site `America/Martinique`. Code uniquement. Tester le cas critique 19:59 → 20:00 local et la continuité jusqu'à la fermeture. Aucun déploiement Production.
2. **P0-3 — Verify** : préparer le correctif minimal afin que l'Accueil compte le travail réellement restant, c'est-à-dire les audits non validés, sans modifier la doctrine Verify. Code uniquement. Preuves de non-régression obligatoires. Aucun déploiement Production.
3. Rejouer les recettes non destructives nécessaires et déposer les preuves dans ce lot.

Ces deux corrections doivent rester petites, séparables et réversibles. Aucun refactor opportuniste.

## Non autorisé à ce stade

- **B1** : aucune promotion temporaire de compte, aucun changement de rôle/RLS, aucune création ou réinitialisation de compte. Le choix du remplaçant et l'élévation éventuelle restent une gate Créateur explicite.
- **P0-2** : aucune modification de `station_config.raccourcis` en Production. Préparer seulement la valeur exacte et la preuve de l'effet attendu ; l'écriture Production exige un GO Créateur explicite.
- **public.rappels** : aucune écriture Production avant définition du contenu et du porteur.
- Aucun merge Production, migration Supabase Production, déploiement Pages, fusion de #62/#65, modification de `config-par-environnement`, promotion des migrations Test/CI ou reprise du chantier frontière migrations.

## Preuves attendues

Pour P0-1 et P0-3 : diff minimal, tests ciblés, non-régression, impact exact sur le parcours du remplaçant, absence d'effet sur les règles métier et indication claire de ce qui resterait à faire pour un candidat Production.

Pour P0-2 : valeur actuelle, valeur proposée, écran/urgence impacté, mécanisme de rollback et preuve en environnement non-Production si possible.

## Gate suivante

Déposer un nouveau request dans ce même lot avec les preuves. Ne pas transformer cette décision en autorisation Production.

**STOP à la prochaine gate.**
