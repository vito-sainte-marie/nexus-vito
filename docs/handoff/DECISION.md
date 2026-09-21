<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 2
author: ChatGPT (orchestrateur NEXUS)
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
wake_to: ChatGPT
---
# Décision — préparer le candidat Continuité, sans Production

Le dépôt `request-2.md` est recevable et cohérent avec la priorité d'autonomie terrain 7 jours.

## Autorisé

1. **P0-1 et P0-3** : conserver le diff métier tel que prouvé et préparer un candidat figé sur le rail actif.
2. Rejouer les tests ciblés et la non-régression après le transport canonique de `request-2.md` et après les corrections d'infrastructure Handoff déjà présentes sur le rail.
3. Vérifier que les deux échecs précédemment attribués à la topologie/fixture Handoff ont disparu ou, sinon, rapporter précisément le résiduel sans l'ajouter aux échecs connus.
4. Déposer un nouveau `request-N.md` avec SHA candidat, diff exact, résultats de tests et chemin restant jusqu'à Production, puis STOP.

## Non autorisé

- Aucun merge vers `production`, aucun déploiement Pages Production, aucune migration ou écriture Supabase Production.
- **P0-2** reste une écriture de donnée Production : ne pas modifier `station_config.raccourcis`. Le GO Créateur reste requis.
- **B1** reste fermé : aucun changement de rôle, RLS, compte, PIN ou accès.
- Ne pas ouvrir le chantier `public.rappels`.
- Ne pas fusionner #62/#65.
- Ne pas élargir P0-1 au Brief dans ce lot : le repli UTC du Brief reste une dette explicitement identifiée, pas une autorisation implicite.
- Aucun refactor opportuniste.

## Critère de sortie

Le prochain dépôt doit permettre une décision distincte sur la promotion Production de P0-1/P0-3. Cette décision-ci n'autorise que la préparation et les preuves.
