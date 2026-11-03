---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=5d9650c9
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 172-fichiers
---
# INVENTAIRE-CAISSE-RENFORT-20261102 : request-4 — arbitrage de la PR #173 (clé additive `pilotesCaisse` / `pilotesRenfort`)

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

## Objet

La decision-3 (a93d1b0c, APPROVED_WITH_CONDITIONS, `closes: false`) autorisait les étapes 3 et 4 de L1 : code sur Test, puis épreuves pilote / non-pilote / isolation intersite. Elles sont faites et portées par la PR #173 (brouillon vers `production`, commit 8831cc05, branche `claude/pilotes-caisse-20261102`). La recette Guardian est validée (Employé Test B, #160, 6591998130). Cette request demande l'arbitrage de la PR avant sa fusion par Frédéric.

## Ce que porte la PR #173

- Clé additive `pilotesCaisse` et `pilotesRenfort` dans `station_config.parametres_inventaire` : listes d'`employee_id` uniquement, vides par défaut (= refusé pour tous), réglables par le chemin manager existant (NEXUS-Parametres-Inventaire-v1.html).
- `pilotesRenfort` n'est lue par aucun écran (lecteur prévu en L3).
- Garde `estPiloteCaisse` (nexus-pilotes-inventaire.js) : refus par défaut ; pilote seulement si l'identifiant figure dans une liste bien formée, non vide, du site propre ; une liste partiellement corrompue est refusée en entier.
- NEXUS-Inventaire-v1.html : `piloteCaisseCourant` posé au chargement des réglages, sans aucun consommateur dans ce lot (le fil caisse vient en L1 suite).

## Preuves

- 13 contrôles dédiés (test_pilotes_caisse_20261102.js) : pilote, non-pilote, liste vide, clé absente, JSON illisible, liste corrompue, isolation intersite.
- Preuves de mutation par `SRC_MUTE` et `GARDE_EXTRA` : la garde rougit quand on l'affaiblit.
- Suite complète : les 7 échecs connus et aucun autre.
- Aucune migration, policy, grant. Aucune lecture ni écriture Production par l'exécutant.

## Preuve des conditions de decision-3

- **Contrôle côté page = mécanisme de déploiement, pas autorisation** : la garde ne donne aucun droit de lecture ni d'écriture nouveau ; la frontière reste la RLS existante. Rappelé dans le code et la PR.
- **Absence de clé, valeur mal formée, liste vide, identifiant absent = fil actuel** : épreuves dédiées (clé absente, JSON illisible, liste vide, identifiant absent, liste partiellement corrompue refusée en entier), toutes vertes.
- **`pilotesRenfort` sans lecteur avant L3** : posée dans les défauts et l'écran de réglage uniquement ; aucun écran ne la lit (vérifié par recherche dans le dépôt).
- **Épreuves sur Test** : pilote caisse, non-pilote, refus par défaut, isolation intersite, avec preuves de mutation (`SRC_MUTE`, `GARDE_EXTRA`) ; recette Guardian validée avec Employé Test B (#160, 6591998130).
- **Aucune migration, policy, grant, mutation Production, fusion ni déploiement Production** par l'exécutant : PR #173 en brouillon, fusion et déploiement réservés à Frédéric.

## Audit demandé par Guardian : « clé absente » contre valeur par défaut

Aucun lecteur ne traite « clé absente » différemment de la valeur par défaut. La première sauvegarde d'un pilote en Production matérialise les clés par défaut (9 clés deviennent 20) sans changer aucun comportement.

- Lecteurs JS : NEXUS-Inventaire-Manager-v1.html (défauts 500–508 ; `snapshotMaxDelayMinutes != null ? … : défaut` à 1387–1388 ; `reviewFrequency === 'exception_only'` à 3359), NEXUS-Inventaire-v1.html (gardes `Number.isFinite`, 1385–1400), NEXUS-Parametres-Inventaire-v1.html (fusion de `DEFAULTS_PARAMETRES_INVENTAIRE` sur le JSON stocké, 280–320, 2907–2908). Tous fusionnent les défauts ou gardent par `Number.isFinite`, `!= null` ou `||`.
- Fonctions SQL de revue (20260905131500_fuseau_horaire_par_site.sql, 20260803021549_planification_synthese_inventaire.sql) : ne lisent que les 9 clés d'origine. Celles-ci sont toujours présentes par le défaut de colonne NOT NULL (20260803015407_inventaire_supervision_configurable.sql), `reviewFrequency` comprise.
- Réserve : audit fait sur le dépôt, aucune ligne Production lue par moi. Parmi les 11 clés matérialisées, seules les deux listes sont nouvelles dans ce lot ; `pilotesCaisse` n'est lue que par la garde, `pilotesRenfort` par aucun écran. Les autres sont des défauts déjà portés par l'écran de réglages.

## Frontière de sécurité (rappel de decision-3)

La décision « pilote ou non » est prise dans la page : mécanisme de déploiement, pas frontière d'autorisation. Une application côté base serait une porte SECURITE_RLS_SITE_ID, non franchie.

## Demande

1. Arbitrage APPROVED ou APPROVED_WITH_CONDITIONS, `closes: false`, sur la PR #173 (fusion et déploiement par Frédéric).
2. Confirmation que l'audit « clé absente = défaut » est suffisant, ou précision de ce qui manque.
3. Autorisation de chaîner L1 (fil caisse de la pilote) sur cette base.

## Limites

Rien en Production. Le défaut A (RLS UPDATE du cycle d'observation) reste un lot distinct sous SECURITE_RLS_SITE_ID. Renfort non activé, aucun élargissement, aucune communication terrain.
