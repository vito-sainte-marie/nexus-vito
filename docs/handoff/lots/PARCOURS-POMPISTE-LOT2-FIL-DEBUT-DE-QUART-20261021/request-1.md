---
protocol: nexus-handoff/2
kind: request
lot_id: PARCOURS-POMPISTE-LOT2-FIL-DEBUT-DE-QUART-20261021
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=2f412bdf
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 159-fichiers
---
# LOT : PARCOURS-POMPISTE-LOT2-FIL-DEBUT-DE-QUART-20261021 — le fil « Mon début de quart »

## Origine
Demande de Frédéric (21/10/2026), lot 2 sur 3 du document « Parcours pompiste : lots pour Claude Code ». Il suit le lot 1 (PARCOURS-POMPISTE-LOT1-RELEVES-PISTE-20261021), livré : sortie « Quitter et revenir à l'Accueil » et bandeau d'état honnête sur les Relevés piste, fusionné par la PR #146 et servi par la Production à `2f412bdfbf043294856450656893a91d18402297`. Le lot 3 (deux diagnostics) n'est pas demandé ici.

## Constat
Après la prise de poste « pompiste », le pompiste doit enchaîner trois écrans que l'Accueil lui présente comme des outils séparés (parcours du 21/10 à 18:30, compte « Employé Test B ») : la prise de poste l'envoie sur Missions (écran vide), le jaugeage passe par l'Inventaire, l'Inventaire lui redemande « Matin / Soir » alors que le quart est déjà choisi, et les Relevés piste n'ont, avant le lot 1, aucune sortie. Les étapes ne s'ouvrent pas l'une l'autre.

## Arbitrage de Frédéric
Un seul fil de trois étapes, chacune ouvrant directement la suivante :
1. **Jaugeage d'ouverture**, ouvert directement, sans passer par l'Inventaire. Après validation : un seul bouton « Continuer vers le relevé des index ».
2. **Relevé des index.** Après validation : « Continuer vers l'inventaire ».
3. **Inventaire gaz, glaçons et écailles**, sur le quart déjà choisi à la prise de poste (plus de « Matin / Soir »). Après validation : « Terminer mon début de quart », puis l'Accueil.

## Règles du fil
- Progression « Étape 1 sur 3 », puis 2, puis 3.
- La prise de poste, déjà faite, n'apparaît pas comme une tâche restante.
- Pendant le fil, le pompiste ne voit ni l'écran Missions, ni le catalogue de l'Inventaire, ni le menu des Relevés piste.
- Partout la même sortie « Quitter et revenir à l'Accueil », sans perte des données enregistrées (brouillons conservés et rouverts au retour ; reprise du fil à l'étape où il s'est arrêté).
- L'écran Missions reste accessible depuis l'Accueil, mais n'est plus la destination automatique de la prise de poste.
- Aucun pointage dans ce parcours (non utilisé à Sainte-Marie Usine, retards saisis à la main par le manager) : il reste désactivé, y compris sur Test.

## Périmètre modifié
Les écrans et le routage nécessaires au fil : redirection de fin de prise de poste, ouverture directe du jaugeage d'ouverture, enchaînement vers les Relevés piste puis l'Inventaire gaz/glaçons/écailles, retrait de « Matin / Soir » quand le quart est connu. Les fichiers exacts sont établis par le diff de base avant de coder et listés dans le compte rendu. Épreuves rouges d'abord, puis vertes, avec mutation de contrôle de chaque règle ci-dessus.

## Hors périmètre
Lot 3 (Missions vide, Inventaire lent : deux diagnostics, pas de correction à l'aveugle), pointage, SQL, migration, RLS, Supabase Production, lot JAUGEAGE-OCR (clos, réouverture future sous JAUGEAGE-OCR-2), modification de la logique métier de saisie du jaugeage, des index ou de l'inventaire au-delà de leur enchaînement, toute fusion ou déploiement.

## Conduite
- Avant de coder : établir le commit de base exact. La Production sert `2f412bdf` (fusion de #146, et plus `84adc5de`) ; mesurer `origin/production` après `git fetch`, ne pas le composer.
- Branche de travail depuis `origin/production` (jamais la branche locale), en worktree. Un seul push pour le code et la consommation de la décision.
- Mesure « avant » (nombre d'appuis, retours en arrière, durée totale) prise sur le parcours actuel, « après » sur le fil ; recette sur l'aperçu Test, format téléphone, compte pompiste, avant toute demande de GO.
- Recette finale sur iPhone par un pompiste, sans aide : geste humain, hors de ce que Claude peut produire.
- PR vers `production` ouverte en brouillon ; **aucune fusion ni déploiement sans le GO explicite de Frédéric** (palier PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION).

## À arbitrer
Approuver ce périmètre et cette conduite pour que Claude exécute le lot 2 sur un rail de travail, sans autre geste humain avant la PR. Lot 3 à déposer séparément après ce lot.

## Contraintes dites sans fard
- Le dépôt est public : aucune donnée personnelle ni secret dans ce lot.
- Les Missions vides et la lenteur de l'Inventaire (5 à 7 secondes sur « Chargement… ») ne sont pas traitées ici : le fil masquera une partie du détour mais pas cette lenteur, qui reste visible à l'étape 3.
- Le lot 1 est consommé (`closes: false`, preuve d09a0234) et non clos au registre ; il n'est pas actif au sens D3 (statut DECISION_CONSOMMEE), mais je le signale.
- La recette connectée du lot 1 en Production reste à faire par Frédéric ; ce lot-ci s'appuie sur la même page servie.
