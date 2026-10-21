---
protocol: nexus-handoff/2
kind: request
lot_id: PARCOURS-POMPISTE-LOT1-RELEVES-PISTE-20261021
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=84adc5de
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 159-fichiers
---
# LOT : PARCOURS-POMPISTE-LOT1-RELEVES-PISTE-20261021 — correctifs urgents des Relevés piste

## Origine
Demande de Frédéric (21/10/2026), tirée du document « Parcours pompiste : lots pour Claude Code » (parcours du 21/10 à 18:30 sur l'aperçu Test, compte « Employé Test B », pompiste du soir, format téléphone). L'aperçu Test sert `33fb3e1`, identique fichier pour fichier à la Production `84adc5de`. Lot 1 sur 3 ; les lots 2 et 3 ne sont pas demandés ici.

## Constats (écran `NEXUS-Releves-Piste-v1.html`, état `origin/production` 84adc5de)
1. **Impasse** : aucun lien vers l'Accueil ni « Menu » ni « Précédent » ; « Retour » (`data-act="choix"`, lignes 246, 396, 418) ramène au menu interne (`vueChoix`) qui n'a lui-même aucune sortie.
2. **Message d'état trompeur** : `majEtat()` (ligne ~110-120) écrit « Enregistré sur l'appareil · pas encore envoyé au serveur » dès le rendu, car `sauverLocalTest()` renvoie `true` quand `moment` est vide (`moment ? sauverLocal() : true`) : le texte s'affiche avant toute saisie et sans sauvegarde réelle.

## Périmètre modifié
- `NEXUS-Releves-Piste-v1.html` (et `nexus-releves-piste.js` si la logique d'état y migre), uniquement.
- (1) Une sortie « Quitter et revenir à l'Accueil » sur tous les écrans (choix/menu interne, pompe, revue, recopie, jauge, fini), toujours au même endroit, sans perte : les brouillons déjà écrits (`sauverLocal`, `sauverJauge`) sont conservés et rouverts au retour.
- (2) Le texte « Enregistré sur l'appareil · … » ne s'affiche qu'après une sauvegarde locale réelle (écriture réussie d'au moins une saisie) ; avant, aucun bandeau d'état ou un libellé neutre, jamais l'affirmation d'une sauvegarde.
- Épreuves rouges d'abord (écran sans sortie ; bandeau affiché à vide), puis vertes ; mutation de contrôle de chacune.

## Hors périmètre
Lot 2 (fil « Mon début de quart »), lot 3 (Missions vide, Inventaire lent), pointage (reste désactivé), SQL, migration, RLS, Supabase Production, toute modification de l'écran de jaugeage au-delà de la sortie, lot JAUGEAGE-OCR-20261021 (non touché), déploiement.

## Conduite
- Branche de travail depuis `origin/production` (jamais la branche locale), worktree. Un seul push pour le code et la consommation.
- Recette sur l'aperçu Test (format téléphone, compte pompiste) avant toute demande de GO.
- PR vers `production` ouverte en brouillon ; **aucune fusion ni déploiement sans le GO de Frédéric** (palier PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION).

## À arbitrer
Approuver ce périmètre et cette conduite pour que Claude exécute le lot 1 sur un rail de travail, sans autre geste humain avant la PR.

## Contraintes dites sans fard
- Le dépôt est public : aucune donnée personnelle ni secret dans ce lot.
- Divergence à lever avant de s'appuyer dessus : mes notes antérieures donnaient #145 fusionnée mais non déployée ; le document de Frédéric dit `84adc5de` = fusion de #145 déployée le 21/10 à 14:55. `origin/production` est bien à `84adc5de` à l'instant de ce dépôt.
- Le lot JAUGEAGE-OCR-20261021 reste actif en ATTENTE_DECISION (decision-3 NEEDS_EVIDENCE) ; ce lot-ci est indépendant de lui et ne le consomme pas.
