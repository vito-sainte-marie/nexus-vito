<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CARBURANTS-VISUEL-1-20261014/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CARBURANTS-VISUEL-1-20261014
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=dea3ae73 production=3f5589e4
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 150-fichiers
  - id: go-humain
    classe: DECLARED
    valeur: Frédéric, message du 14/10/2026 (essai applicatif Carburants)
---
# NEXUS-CARBURANTS-VISUEL-1 — premier essai applicatif du Handoff : identité colorée de la page Carburants

Essai applicatif contrôlé, demandé par Frédéric (message du 14/10/2026) : une modification **exclusivement visuelle** de NEXUS → Carburants → Relevé du jour, pour prouver que Claude et ChatGPT font et contrôlent ensemble une évolution simple, sans intervention manuelle sur le code.

## Ce qui est demandé à l'arbitre
Si tu juges la demande recevable, désigner `EXECUTANT_NEXT: github-actions-claude`, `CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL`, `CLOSES: false`, avec les conditions ci-dessous. Au retour de l'exécutant, tu valides ou refuses le résultat.

## Fichier concerné
`NEXUS-Carburants-v1.html` (rail `handoff-continuite-20260920`). Cartes de carburant définies vers la ligne 240 : `sp95` « Sans plomb (SP95) », Gasoil (GO), `gnr` « Gasoil non routier (GNR) ». Les intitulés existants sont conservés tels quels.

## Cahier des charges visuel
Chaque carburant reçoit un encadré englobant toute sa section (intitulé, cuve, jaugeage, livraison, mouvement exceptionnel, théorique, écarts) :
- Sans plomb : vert `#16A765`, bordure fine, fond très légèrement teinté.
- Gasoil : jaune doré `#E8B746`, non fluorescent, même structure et mêmes proportions.
- GNR : rouge légèrement désaturé `#E45B60`.
- Petit accent graphique discret dans l'en-tête de chaque carte (trait coloré ou repère) ; **aucune courbe ni donnée inventée**.
- Ces couleurs identifient des familles, elles ne doivent pas ressembler à des alertes.
- Thème sombre et navigation latérale conservés ; angles légèrement arrondis, bordures fines homogènes, espacements réguliers, hiérarchie des titres, champs discrets et alignés, contraste suffisant, survol très subtil, présentation adaptée ordinateur / tablette / mobile.
- Pas de dégradés excessifs, d'ombres lourdes ni d'animations inutiles. Réutiliser les variables et composants CSS NEXUS existants.

## Contraintes fonctionnelles absolues
Ne modifier ni le calcul du théorique, ni celui des écarts, ni la reprise des ventes depuis NEXUS Verify, ni jaugeages, livraisons, mouvements exceptionnels, enregistrement des relevés, tables Supabase, règles métier, droits d'accès, ni les autres pages. Conserver champs, libellés, messages d'erreur et états. Aucune valeur manquante remplacée par une donnée fictive. Le diff ne doit toucher que le CSS et le balisage de présentation des cartes ; tout changement de logique JS est un motif de refus.

## Exécution et preuves attendues
1. Identifier ce que la page utilise réellement, réutiliser les styles existants, limiter le diff à la page.
2. Travailler sur le rail uniquement ; la page n'est pas du TypeScript : lancer les contrôles réellement disponibles (build, suite de tests pertinente) et dire lesquels n'existent pas.
3. Prouver que la logique n'a pas bougé (diff limité à la présentation) ; fournir une capture avant/après si l'environnement le permet, sinon le dire explicitement.
4. Rapporter : fichiers modifiés, améliorations, tests et résultats, SHA du commit, points bloquants.
5. Statut à annoncer exactement : « développé » (sur le rail), jamais « validé sur Test » ni « déployé » sans preuve distincte.

## Périmètre impératif
Écritures sur le rail seulement. Aucun accès ou changement Production, aucune fusion dans `main`, aucun déploiement sur app.nexusconseil.net, aucun secret, aucune permission GitHub, aucune migration, sans autorisation humaine distincte.
