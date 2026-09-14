<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-POINTAGE-CORRECTIF-1-20260911/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-POINTAGE-CORRECTIF-1-20260911
seq: 1
author: NEXUS Orchestrator
branch: config-par-environnement
decision: APPROVED
closes: false
in_reply_to: request-2.md
---
# Décision — intégration contrôlée du correctif accueil (journée déjà terminée)

## Verdict

`APPROVED`, `closes: false`.

Approuvé pour intégration contrôlée sur `config-par-environnement` et
déploiement NEXUS Test uniquement. Le lot reste ouvert : la preuve
navigateur humaine sur Employé Test B et les nouvelles mesures Production
restent dues avant toute clôture.

## Motifs vérifiés

- la branche `claude/issue-28-20260914-0247` est une avance propre d'un
  seul commit sur le canon `894e306` — aucune divergence, fast-forward
  confirmé (`git merge-base` = `894e306`, `git diff --stat` limité aux
  fichiers annoncés) ;
- le diagnostic de `request-2.md` distingue correctement le contrôle
  `statut='en_cours'` fait en amont, côté lecture (`nexusServiceCourant`,
  `nexus-auth.js`), de la confusion aval dans
  `NEXUS-App-v1.html::initAccueilEmploye` entre journée non commencée et
  journée déjà terminée (`dejaFaitDuService(pointagesJour, null)` retombant
  sur un état vide quel que soit le contenu réel de `pointagesJour`) ;
- le témoin de mutation échoue sur `894e306` : rejoué indépendamment dans
  cette session, le nouveau test donne 7 assertions rouges contre
  `NEXUS-App-v1.html` au commit `894e306` (avant correctif) et 20/20 sur
  le correctif ;
- `NEXUS-Pointage-v1.html` reste inchangé et la preuve Pointage déjà
  acquise (parcours complet, 27/27) est préservée ;
- aucune donnée Test B ni Production n'a été modifiée par ce correctif ou
  par son diagnostic (lecture seule, aucun service créé, rouvert, clôturé
  ou supprimé, aucune action employé cliquée).

## Ce qui reste dû avant clôture

- preuve navigateur humaine réelle sur Employé Test B, contre le SHA
  canonique effectivement servi par NEXUS Test ;
- nouvelles mesures Production (le lot `NEXUS-PRODUCTION-READINESS-1-20260908`
  reste sans `PRET_POUR_PRODUCTION` tant que cette preuve n'est pas
  acquise) ;
- `aucun_blocage_non_resolu` reste `false` jusqu'à ces deux preuves.

## Interdictions rappelées

Aucun changement `main`/`production`, aucune opération Supabase
Production, aucune création/réouverture/clôture/suppression de service
Test B, aucune gate Production accordée par cette décision.
