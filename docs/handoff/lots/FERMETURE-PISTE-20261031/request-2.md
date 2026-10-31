---
protocol: nexus-handoff/2
kind: request
lot_id: FERMETURE-PISTE-20261031
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=e4e4c75c
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 168-fichiers
  - id: capacite-recette-navigateur-test
    classe: VERIFIED
    valeur: NEXUS_TEST_URL-absent-recette-navigateur-test.js-degrade-ENV-003-preuve-UI-non-satisfaite
---
# FERMETURE-PISTE-20261031 : request-2 — exploration d'architecture faite, arrêt sur capacité absente (condition 4 de decision-1)

BRANCHE_DU_LOT: fermeture-piste-20261031

## Preuve des conditions de decision-1

Aucune des cinq conditions n'est aujourd'hui tenue par du code : rien n'a été commité sur
`fermeture-piste-20261031` (la branche existe en local, créée depuis `origin/production`,
puis supprimée sans commit — aucune trace à nettoyer). Je les reporte donc toutes comme
NON TENUES (GOV-002/GOV-007), pas comme des choix validés :

1. **« Pointer mon départ » sans écriture dans `shifts` ni migration** — ABSENT. Conception
   faite (lien vers le pointage existant, type `depart`, photo de mise en alarme déjà
   obligatoire dans `nexus-pointage-regles.js`), aucune ligne écrite.
2. **Horaires lus dans `station_config.horaires`, régime normal/étendu, fuseau de la
   station, sans constante locale** — ABSENT. Conception faite (voir § Architecture),
   aucune ligne écrite.
3. **Formule du matin conservée, sous-ligne du soir omise** — ABSENT, non codé.
4. **Éprouver sur Test la clôture anticipée avant toute adaptation** — BLOQUÉ, pas
   seulement « non fait » : voir § Capacité absente ci-dessous. C'est la raison de cet
   arrêt.
5. **Huit épreuves de mutation, écran de choix du manager préservé** — ABSENT, aucune
   épreuve écrite ; l'écran de choix du manager n'a pas été touché (aucun fichier modifié).

## Ce qui a été fait (exploration, aucun commit)

Branche `fermeture-piste-20261031` créée localement depuis `origin/production`
(`e4e4c75c`), explorée en lecture seule, puis supprimée sans rien y avoir écrit. Les faits
suivants ont été établis par lecture directe du code (pas par supposition) :

- `station_config.horaires` porte déjà les 4 champs par quart : `quart1`/`quart2` ×
  `{normal, etendu, fin_normal, fin_etendu}` (`NEXUS-Parametres-Station-v1.html:1879-1880`).
- Aucune fonction cliente n'existe aujourd'hui pour combiner `cleHoraireDuJour` (régime du
  jour, `nexus-station.js:320`) avec `horaires[quartCle].fin_<régime>` : le seul calcul
  jour-exact d'une fin de quart vit côté base, dans la RPC `calculer_horaires_quart`
  (`supabase/migrations/20260919160000_horaires_moteur_unique_et_retard_nullable.sql:105-175`).
  `cleHoraireDuJour` reste exportée comme « formulation éprouvable », mais « ne décide plus
  rien en production » (commentaire `nexus-station.js:339`) depuis le 19/09/2026, précisément
  pour éviter la dérive à deux calculs que la condition 2 de decision-1 demande pourtant de
  reproduire côté client, pour l'AFFICHAGE du déclenchement (pas pour une décision engageant
  une commande). Les deux textes (requête et décision) résolvent explicitement cette
  tension en faveur d'une lecture client de `station_config.horaires` — je ne la rouvre pas,
  je la signale pour que l'exécutant suivant ne découvre pas la même tension à l'aveugle.
- `fuseauStation` (`NEXUS-App-v1.html:2546`) vient de `sites.timezone`, pas de
  `station_config` — `station_config.horaires` n'est fetché nulle part sur l'Accueil
  aujourd'hui (nouvelle lecture à ajouter, même style que `chargerReceptionCarburantRole`
  etc., `NEXUS-App-v1.html:2006-2010`).
- Le module `NexusFilDebutQuart` (`nexus-fil-debut-quart.js`) est entièrement câblé en dur
  sur 3 étapes (`NOMBRE_ETAPES`, `PAGES`, `LIBELLES_VERS`) : pas réutilisable pour un fil de
  fermeture à 2 étapes sans un sibling dédié (`NexusFilFinQuart`, même forme, clé de
  stockage distincte — une clé partagée ferait reprendre la fermeture à l'étape où
  l'ouverture s'était arrêtée le même jour).
- L'étape « inventaire de clôture » n'a PAS besoin d'une nouvelle URL : `NEXUS-Inventaire-v1.html`
  dérive déjà la phase (ouverture/clôture) de l'état serveur (`a_valide_ouverture`,
  `statut`, `cloture_le`), sans paramètre dédié. `inventaireFait` côté Accueil
  (`NEXUS-App-v1.html:2671-2677`) est déjà, en l'état, un booléen « clôture faite »
  (`cloture_le` non nul) — directement réutilisable comme fait de fin pour le fil de
  fermeture, sans nouvelle requête.
- Aucune fenêtre horaire n'existe en base sur `inventaire_quarts` (17 migrations
  grepées, aucun trigger ni check lié au temps) — ce qui NE PROUVE PAS que la clôture
  anticipée est acceptée, seulement qu'aucune garde explicite ne l'empêche. C'est
  exactement la différence `VERIFIED`/`DECLARED` que le protocole impose de ne pas
  gommer (PROTOCOL.md « Provenance des preuves ») : une absence trouvée par lecture de
  schéma n'est pas une épreuve sur Test.

## Capacité absente (condition 4)

`node outils/recette-navigateur-test.js` dans CE runner :

> Recette navigateur Test non exécutée — absents du runner : NEXUS_TEST_URL. Dégradation
> explicite (ENV-003), non bloquante. La preuve UI reste donc NON satisfaite.

Sans `NEXUS_TEST_URL`, je ne peux pas exécuter la recette navigateur Test dans cette
session (préautorisation 4 de `CLAUDE.md`, mais l'outillage qu'elle suppose n'est pas
câblé sur ce runner). Je n'ai pas cherché d'autre variable d'environnement Supabase Test
par un `env` large : lire l'environnement à l'aveugle pour contourner une capacité
manquante serait précisément le contournement que la condition 4 interdit, et la gate
humaine sur la lecture de secrets reste entière même pour un identifiant qui n'en est
peut-être pas un.

## Pourquoi je m'arrête ici plutôt que de livrer du code non vérifié

Le périmètre de decision-1 touche au moins sept fichiers interdépendants (`NEXUS-App-v1.html`,
`nexus-accueil-piste.js`, un nouveau `nexus-fil-fin-quart.js`, `nexus-menu-accueil.js`,
`NEXUS-Releves-Piste-v1.html`, `NEXUS-Inventaire-v1.html`, `nexus-station.js`), plus l'écran
C (récap) qui demande des horodatages (première/dernière étape d'ouverture et de fermeture)
non lus aujourd'hui par l'Accueil — une exploration de schéma supplémentaire, pas encore
faite, serait nécessaire avant d'écrire ce récap sans inventer de valeur (condition 5).

Tous les lots comparables déjà livrés sur ce dépôt (RELEVES-FIN-QUART-20261030,
ACCUEIL-EN-SERVICE-20261030, PRISE-DE-POSTE-UN-ECRAN-20261025) ont été codés en session
interactive avec Frédéric — recette navigateur réelle, retouches demandées en direct — puis
seulement documentés a posteriori sur ce rail. Je n'ai trouvé aucun lot de cette taille
livré par ce seul réveil autonome. GOV-010 documente à l'inverse un risque nommé :
un réveil autonome ayant implémenté une décision en parallèle d'une session interactive a
produit deux implémentations divergentes du même lot (JAUGEAGE-SAISIE-DIRECTE-20261022).

Avec la condition 4 structurellement invérifiable ici, et un périmètre qui engage des
choix de présentation (écran C) que je ne peux pas confirmer sans recette navigateur, je
préfère consigner l'exploration — réutilisable sans recommencer — plutôt que de pousser du
code non éprouvé sur `fermeture-piste-20261031` en le faisant passer pour livré.

## À arbitrer

1. Le lot continue-t-il en session interactive (Frédéric + Claude, recette Test réelle),
   cette request servant d'amorce d'architecture pour ne pas refaire l'exploration ?
2. Ou bien ce réveil autonome doit-il développer malgré la condition 4 non vérifiable ici —
   avec quelle preuve de remplacement pour la clôture anticipée, et sous quelle réserve
   explicite dans la décision de clôture ?
3. Rien n'a été poussé ni modifié hors de ce dépôt de registre : aucune régression,
   aucun risque introduit par cet arrêt.
