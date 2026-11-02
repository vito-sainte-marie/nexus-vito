<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/MODE-JOUR-POMPISTE-20261102/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: MODE-JOUR-POMPISTE-20261102
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=ef6861f2
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 170-fichiers
---
# MODE-JOUR-POMPISTE-20261102 : request-1 — thème Jour (Sombre / Jour / Auto) pour le parcours pompiste

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

Branche du rail, déclarée une seule fois. Le code sera porté par une branche de travail distincte, ouverte après la décision de l'arbitre, puis par une PR vers `production` (fusion et déploiement par Frédéric).

## Objet

Le lot INVENTAIRE-CYCLE-ALERTES-LIBELLE-20261102 est clos (decision-2 APPROVED `closes: true`, consommée le 02/11). Ce lot ouvre le **mode Jour** du parcours pompiste, sur décision de Frédéric relayée par Guardian (#160, commentaire 6577633047). L'harmonisation graphique est en pause : seul le mode Jour est demandé.

Dossier de conception : https://claude.ai/artifact/QAvBh6qmsyJQzsd3674pmW, section « Thème Jour ».

## Périmètre

Parcours pompiste uniquement : `NEXUS-Login-v1.html`, `NEXUS-Prise-De-Poste-v1.html` + `nexus-prise-de-poste.js`, `NEXUS-App-v1.html` + `nexus-accueil-piste.js` + `nexus-menu-accueil.js`, `NEXUS-Inventaire-v1.html`, `NEXUS-Releves-Piste-v1.html`, `NEXUS-Carburant-Reception-v1.html`. Pages manager hors périmètre.

## Décisions de Frédéric (reprises de Guardian)

- Trois réglages dans le menu ☰ : Sombre, Jour, Auto. Mémorisés sur l'appareil (`localStorage` dans un try/catch, rendu correct sans lui).
- Auto : Jour de 6 h 00 à 18 h 00, heure de la station (fuseau de `nexus-station.js`), Sombre sinon, réévalué sans recharger la page. Défaut : Auto.
- Palette Jour (contrastes mesurés ≥ 4,5:1 pour le texte) : `--bg` #F4F6F8, `--panel` #FFFFFF, `--panel-raised` #EEF2F5, `--hairline` #D5DCE3, `--text` #0F172A, `--text-mid` #475569, `--text-dim` #64748B, `--cyan` #0B7285 (texte du bouton cyan #FFFFFF), `--green` #047857, `--green-dim` #D1FAE5, `--amber` #B45309. Rouges d'alerte à proposer avec leur contraste mesuré.
- Constat à traiter : le thème n'agit que sur les tokens. Les couleurs en dur du périmètre (`nexus-prise-de-poste.js`, styles `.ap-*` de `NEXUS-App-v1.html`, `rgba(79,195,217,…)`) passent sur les tokens, sans aucun changement visible en Sombre. Aucune taille, police, marge ni texte ne change.

## Contraintes

- Aucune logique métier touchée (quart, transmission, aveugle, repère de cage, écarts, fil de début et de fin).
- Pas de flash au chargement : thème posé sur `<html>` avant le premier rendu.
- Bandeau MODE TEST inchangé et lisible dans les deux thèmes. Photos de poste : fondu adapté au thème Jour.

## Preuves prévues

1. Épreuve du calcul du thème (Auto à 5:59, 6:00, 17:59, 18:00 ; réglage absent → Auto ; `localStorage` inaccessible → Auto sans erreur), mutation prouvée.
2. Épreuve de contraste : chaque paire texte / fond des deux palettes ≥ 4,5:1.
3. Non-régression Sombre : captures avant / après à 375 px, identiques en Sombre.
4. Suite complète : les 7 échecs connus et aucun autre.
5. Recette Guardian sur `nexus-station-test` (Employé Test B), puis sur un vrai téléphone en extérieur par Frédéric.

## Demande

1. Arbitrage APPROVED ou APPROVED_WITH_CONDITIONS, `closes: false`, pour ouvrir l'exécution (code et épreuves en branche de travail, PR vers `production`).
2. Aucune migration, aucune policy, aucun grant : lot purement front. Aucune lecture ni écriture Production par l'exécutant ; fusion et déploiement par Frédéric.

## Limites

Rien n'est codé par cette request. Le rouge d'alerte Jour reste à proposer avec son contraste mesuré. La PR #171 (libellé du lot précédent) reste à fusionner par Frédéric, indépendamment de ce lot.
