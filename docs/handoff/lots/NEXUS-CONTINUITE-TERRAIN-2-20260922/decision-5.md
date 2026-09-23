---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 5
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-6.md
---
# Décision — arbitrage technique déterministe de request-6.md

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Le diagnostic mécanique de `request-6.md` est confirmé par preuve GitHub fraîche : le patch décrit
en §4 (remplacer l'étape « Cohérence des épingles de cache » par `bash outils/build.sh` avec les
identifiants Test fictifs déjà éprouvés) a été appliqué exactement en un commit sur la candidate
(`.github/workflows/tests.yml` uniquement, aucun autre fichier touché). Preuve : run CI
`35838111274` sur `rebuild/carburants-65-20260922` @ `664af9853481cb6676a900dd37f89257898c4a20`.
L'étape « Cohérence des épingles de cache » est désormais SUCCESS ; `bash outils/build.sh`
construit une génération `783bc43a1658`, commit `664af98`, environnement `test`, 972 références
cohérentes.

## Condition — ce que ce succès ne prouve pas

Le succès de la garde build ne qualifie PAS la candidate. La même CI échoue ensuite à
« Comparer aux échecs connus » : 197/224 passent, 27 échouent — 20 nouveaux échecs au-delà des
7 historiques connus. Ces 20 nouveaux échecs sont maintenant le bloqueur réel du lot, pas la garde
build. Deux familles observées dans les logs :
- `nexus-auth.js` (règles accès/service/fuseau/jour métier absentes) ;
- réception/régularisation (plusieurs tests, dont `test_reception_regularisation_20260919.js`).

## Poursuite autorisée sans gate Créateur

Analyse de fermeture de dépendances, en lecture/preuve d'abord :
- comparer chaque famille de nouveaux échecs à la base Production actuelle et au rail moderne
  (`handoff-continuite-20260920`) pour déterminer précisément quels fichiers/socles manquent à la
  reconstruction #65 et lesquels sont réellement imputables au changement carburant du portage ;
- n'ajouter aucun fichier par intuition, ne masquer aucun test ;
- appliquer ensuite seulement les corrections mécaniques minimales qui restaurent des règles déjà
  canoniques, sur la branche rebuild non protégée (`rebuild/carburants-65-20260922`), si leur
  nécessité est démontrée par preuve directe (diff/lecture), sans introduire de logique parallèle ;
- rejouer la CI après chaque lot cohérent de corrections.

## Avant toute recette navigateur

CI sans nouvelle régression, puis preuve du `nexus-config.js` réellement servi ciblant
exclusivement Supabase Test. « Supabase Preview skipped » n'est pas une preuve d'isolation — la
preuve doit porter sur le contenu réellement servi, pas sur l'absence d'une étape.

## Frontière — retour Handoff obligatoire

STOP et retour par le Handoff canonique seulement si la fermeture des 20 échecs exige : une
nouvelle règle métier/UX, une modification rôle/RLS/sécurité, un choix d'architecture non couvert
par la doctrine existante, ou un risque matériel. En dehors de ces cas, la correction mécanique
minimale se poursuit sans nouvel arbitrage.

## Invariants

Aucun `main`/`production`, aucune migration/écriture Supabase Production, aucun déploiement
Production. Priorité inchangée : continuité terrain et autonomie manager remplaçant.
