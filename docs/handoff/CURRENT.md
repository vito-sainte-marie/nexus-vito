<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/MENU-ACCUEIL-EMPLOYE-20261030/request-6.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: MENU-ACCUEIL-EMPLOYE-20261030
seq: 6
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=2885c3e9
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 168-fichiers
---
# MENU-ACCUEIL-EMPLOYE-20261030 : request-6 — fusion effective de la PR #164, demande de clôture

BRANCHE_DU_LOT: menu-accueil-employe-20261030

## Contexte

decision-4 (e56fc242, APPROVED, closes:true) a clos le lot sur le plan documentaire et précisait qu'elle n'autorisait aucune fusion. La fusion a eu lieu depuis, par Frédéric.

## Preuve des conditions de decision-4

decision-4 ne pose aucune condition (`CONDITIONS: aucune`). Il n'y a donc rien à prouver au titre de ses conditions ; le présent dépôt consigne l'état réellement livré.

## État réellement livré (Guardian, #160, commentaire 6528040977, 30/10)

- PR #164 fusionnée par Frédéric dans `production` (2885c3e9, 12 h 32), après changement de base `main` → `production` puis fermeture/réouverture pour relancer « Construire et éprouver l'artefact ». Tests et Déploiement Production verts (12 h 37).
- Contenu servi sur app.nexusconseil.net, vérifié par Guardian sans connexion ni écriture : `NEXUS-App-v1.html` contient `menuAccueilBouton` en #E8EDF2 et charge `nexus-menu-accueil.js` ; le module servi contient « Désactivé par le manager » et conditionne Pointage à `pointage_actif`.
- Fonctionnalité livrée : menu ☰ à l'extrême gauche de l'en-tête de l'Accueil employé, bouton blanc ; entrées selon le poste (`roleADroitModule`) ; option B pour le renfort (Inventaire présent, grisé, non cliquable, « Désactivé par le manager ») ; Pointage affiché seulement si `station_config.pointage_actif` est vrai ; recherche conservée pour le manager et le gérant.
- Écart de description : le corps de la PR #164 est resté sur l'option A et « Pointage pour tous ». Il est périmé ; les décisions 2 à 4 du rail et le présent dépôt font foi.

## Périmètre

Interface seule : aucune colonne, aucune migration. Aucune action Production de ma part ; le déploiement est celui de la CI, déclenché par la fusion de Frédéric.

## À arbitrer

La fusion effective et l'état livré ci-dessus sont-ils consignés, le lot demeurant clos (decision-4) ? Restent hors lot : libellés du relevé des index, écran manager pour `anomalie_nuit`, réglage « Inventaire renfort ».
